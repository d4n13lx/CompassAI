import { NextResponse } from "next/server";
import {
  applyAnswer,
  applyDiscard,
  initialSessionState,
  runEngine,
  selectNextQuestionId
} from "@/lib/inference/engine";
import type { QuizAnswer } from "@/lib/inference/types";
import { getEffectiveKnowledgeBase } from "@/lib/inference/knowledge-repository";
import { createSession, getSession, saveSession } from "@/lib/inference/session-store";

export const runtime = "nodejs";

type Body =
  | { action: "start" }
  | { action: "answer"; sessionId: string; questionId: string; answer: QuizAnswer }
  | { action: "discard"; sessionId: string; careerId: string };

function isAnswer(x: unknown): x is QuizAnswer {
  return x === "yes" || x === "no" || x === "maybe";
}

/** Mensagem útil no JSON sem expor segredos (para depurar 500 na Vercel). */
function quizErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Erro interno";
  const m = error.message;
  if (/P1001|P1000|Can't reach database server|connection.*refused|ENOTFOUND|ETIMEDOUT|getaddrinfo/i.test(m)) {
    return (
      "MongoDB inacessível. Confira DATABASE_URL na Vercel, usuário/senha, e no Atlas: Network Access " +
      "(ex.: 0.0.0.0/0 para testar) e Database user com permissão no cluster."
    );
  }
  if (/P1017|Server has closed the connection/i.test(m)) {
    return "Conexão com o MongoDB foi fechada. Verifique DATABASE_URL e se o cluster está ativo.";
  }
  if (/DATABASE_URL não definido|DATABASE_URL é obrigatório/i.test(m)) return m;
  if (/tempo excedido \(\d+ms\)/i.test(m)) {
    return "Banco demorou demais (timeout). Verifique rede, Atlas e string de conexão.";
  }
  return m;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (body.action === "start") {
      const kb = await getEffectiveKnowledgeBase();
      const sessionId = await createSession();
      // Mesmo estado que createSession gravou — evita 500 se getSession falhar (réplica/timeout).
      const state = initialSessionState();
      const payload = runEngine(kb, sessionId, state);
      return NextResponse.json({ ok: true, ...payload });
    }

    if (body.action === "answer") {
      if (!body.sessionId || !body.questionId || !isAnswer(body.answer)) {
        return NextResponse.json({ ok: false, error: "Payload invalido" }, { status: 400 });
      }

      const state = await getSession(body.sessionId);
      if (!state) {
        return NextResponse.json({ ok: false, error: "Sessao nao encontrada" }, { status: 404 });
      }
      const kb = await getEffectiveKnowledgeBase();

      const expected = selectNextQuestionId(kb, state);
      if (!expected || expected !== body.questionId) {
        return NextResponse.json(
          { ok: false, error: "Pergunta nao corresponde ao estado atual do servidor" },
          { status: 400 }
        );
      }

      if (body.questionId in state.answers) {
        return NextResponse.json({ ok: false, error: "Pergunta ja respondida" }, { status: 400 });
      }

      const nextState = applyAnswer(state, body.questionId, body.answer);
      await saveSession(body.sessionId, nextState);
      const payload = runEngine(kb, body.sessionId, nextState);
      return NextResponse.json({ ok: true, ...payload });
    }

    if (body.action === "discard") {
      if (!body.sessionId || !body.careerId) {
        return NextResponse.json({ ok: false, error: "Payload invalido" }, { status: 400 });
      }

      const state = await getSession(body.sessionId);
      if (!state) {
        return NextResponse.json({ ok: false, error: "Sessao nao encontrada" }, { status: 404 });
      }
      const kb = await getEffectiveKnowledgeBase();

      if (!kb.careers.some((c) => c.id === body.careerId)) {
        return NextResponse.json({ ok: false, error: "Carreira invalida" }, { status: 400 });
      }

      const nextState = applyDiscard(state, body.careerId);
      await saveSession(body.sessionId, nextState);
      const payload = runEngine(kb, body.sessionId, nextState);
      return NextResponse.json({ ok: true, ...payload });
    }

    return NextResponse.json({ ok: false, error: "Acao desconhecida" }, { status: 400 });
  } catch (error) {
    console.error("[api/quiz]", error);
    return NextResponse.json(
      {
        ok: false,
        error: quizErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
