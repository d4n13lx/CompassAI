import type {
  InferenceChainStep,
  QuizAnswer,
  QuizEngineResponse
} from "@/lib/inference/types";

/** Formato mínimo para a UI (evita enviar dezenas de campos por regra). */
export type ChainFactWire = {
  perguntaId: string;
  texto: string;
  resposta: QuizAnswer;
};

export function compactChainFromSteps(steps: InferenceChainStep[]): ChainFactWire[] {
  const seen = new Set<string>();
  const out: ChainFactWire[] = [];
  for (const s of steps) {
    if (seen.has(s.perguntaId)) continue;
    seen.add(s.perguntaId);
    out.push({
      perguntaId: s.perguntaId,
      texto: s.textoPergunta ?? s.perguntaId,
      resposta: s.resposta
    });
  }
  return out;
}

/** Resposta POST leve: sem cadeia; ranking só top 4 e sem score bruto. */
export function toCompactQuizJson(
  payload: QuizEngineResponse,
  includeReasoning: boolean
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ok: true,
    sessionId: payload.sessionId,
    proximaPergunta: payload.proximaPergunta,
    rankingAtual: payload.rankingAtual.slice(0, 4).map((r) => ({
      careerId: r.careerId,
      nome: r.nome,
      probabilidade: r.probabilidade
    })),
    status: payload.status,
    carreiraProposta: payload.carreiraProposta
  };
  if (includeReasoning) {
    base.cadeiaResumo = compactChainFromSteps(payload.cadeiaInferencia);
  }
  return base;
}
