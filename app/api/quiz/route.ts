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
import { toCompactQuizJson } from "@/lib/quiz/wire-payload";

export const runtime = "nodejs";

type Body =
  | { action: "start"; includeReasoning?: boolean }
  | {
      action: "answer";
      sessionId: string;
      questionId: string;
      answer: QuizAnswer;
      includeReasoning?: boolean;
    }
  | { action: "discard"; sessionId: string; careerId: string; includeReasoning?: boolean };

function isAnswer(x: unknown): x is QuizAnswer {
  return x === "yes" || x === "no" || x === "maybe";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (body.action === "start") {
      const kb = await getEffectiveKnowledgeBase();
      const sessionId = await createSession();
      const state = (await getSession(sessionId)) ?? initialSessionState();
      const payload = runEngine(kb, sessionId, state);
      const includeReasoning = body.includeReasoning === true;
      return NextResponse.json(toCompactQuizJson(payload, includeReasoning));
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
      const includeReasoning = body.includeReasoning === true;
      return NextResponse.json(toCompactQuizJson(payload, includeReasoning));
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
      const includeReasoning = body.includeReasoning === true;
      return NextResponse.json(toCompactQuizJson(payload, includeReasoning));
    }

    return NextResponse.json({ ok: false, error: "Acao desconhecida" }, { status: 400 });
  } catch (error) {
    console.error("[api/quiz]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno"
      },
      { status: 500 }
    );
  }
}
