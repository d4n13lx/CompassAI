import type {
  InferenceChainStep,
  KnowledgeBase,
  QuizAnswer,
  SessionState
} from "@/lib/inference/types";

/** Mesmos fatores do motor legado: alinhamento resposta × peso da regra. */
const ANSWER_FACTOR: Record<QuizAnswer, number> = {
  yes: 1,
  no: -1,
  maybe: 0.25
};

/**
 * Encadeamento para frente: fatos = respostas do usuário; cada regra cuja premissa
 * ("pergunta respondida") está na memória de trabalho dispara uma vez e acrescenta
 * evidência (contribuição ao score) à carreira conclusão.
 */
export function runForwardChaining(
  kb: KnowledgeBase,
  state: SessionState
): { rawByCareer: Record<string, number>; steps: InferenceChainStep[] } {
  const rawByCareer: Record<string, number> = {};
  const steps: InferenceChainStep[] = [];
  const nomeCarreira = (id: string) => kb.careers.find((c) => c.id === id)?.name ?? id;

  const regras = [...kb.rules].sort((a, b) => a.id.localeCompare(b.id));
  let ordem = 0;

  for (const rule of regras) {
    const resposta = state.answers[rule.questionId];
    if (resposta === undefined) continue;

    const fator = ANSWER_FACTOR[resposta];
    const contrib = rule.weight * fator;
    ordem += 1;
    rawByCareer[rule.careerId] = (rawByCareer[rule.careerId] ?? 0) + contrib;

    steps.push({
      ordem,
      regraId: rule.id,
      perguntaId: rule.questionId,
      textoPergunta: kb.questions.find((q) => q.id === rule.questionId)?.text,
      resposta,
      carreiraId: rule.careerId,
      nomeCarreira: nomeCarreira(rule.careerId),
      pesoRegra: rule.weight,
      fatorResposta: fator,
      contribuicao: contrib
    });
  }

  return { rawByCareer, steps };
}
