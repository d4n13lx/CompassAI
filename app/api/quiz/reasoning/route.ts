import { NextResponse } from "next/server";
import { runEngine } from "@/lib/inference/engine";
import { getEffectiveKnowledgeBase } from "@/lib/inference/knowledge-repository";
import { getSession } from "@/lib/inference/session-store";
import { compactChainFromSteps } from "@/lib/quiz/wire-payload";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId obrigatorio" }, { status: 400 });
  }
  try {
    const state = await getSession(sessionId);
    if (!state) {
      return NextResponse.json({ ok: false, error: "Sessao nao encontrada" }, { status: 404 });
    }
    const kb = await getEffectiveKnowledgeBase();
    const payload = runEngine(kb, sessionId, state);
    return NextResponse.json({
      ok: true,
      cadeiaResumo: compactChainFromSteps(payload.cadeiaInferencia),
      rankingAtual: payload.rankingAtual.slice(0, 4).map((r) => ({
        careerId: r.careerId,
        nome: r.nome,
        probabilidade: r.probabilidade
      }))
    });
  } catch (error) {
    console.error("[api/quiz/reasoning]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno"
      },
      { status: 500 }
    );
  }
}
