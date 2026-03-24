import knowledgeJson from "@/data/knowledge.json";
import { runForwardChaining } from "@/lib/inference/forward-chaining";
import type {
  KnowledgeBase,
  QuizAnswer,
  RankingEntry,
  SessionState,
  QuizEngineResponse,
  QuizStatus
} from "@/lib/inference/types";

export const BASE_KB = knowledgeJson as KnowledgeBase;

const PRIOR_ANSWER: Record<QuizAnswer, number> = {
  yes: 0.45,
  no: 0.35,
  maybe: 0.2
};

/** Gap mínimo entre 1º e 2º (scores normalizados) para propor conclusão */
const MIN_GAP_CONCLUSION = 0.06;
/** Com muitas carreiras/regras (fluxo completo), o 1º lugar raramente passa de ~0.35 sem centenas de perguntas. */
const MIN_TOP_SCORE = 0.14;
/** Inclui perguntas do fluxo completo (`q_fluxo_*`) além das perguntas base. */
const MAX_QUESTIONS_SAFETY = 120;

/**
 * Pontuação máxima teórica se cada resposta alinhar com a regra (Sim em peso > 0, Não em peso < 0).
 * Não usar soma dos pesos brutos: mistura de +5 e -5 pode dar ≤ 0 e quebrava a normalização.
 */
function maxPossibleRawForCareer(kb: KnowledgeBase, careerId: string): number {
  const sum = kb.rules
    .filter((r) => r.careerId === careerId)
    .reduce((s, r) => s + Math.abs(r.weight), 0);
  return Math.max(sum, 1e-9);
}

/** Score bruto vem do encadeamento para frente (soma das contribuições das regras disparadas). */
function normalizedScoreFromFcRaw(
  kb: KnowledgeBase,
  careerId: string,
  rawByCareer: Record<string, number>
): number {
  const max = maxPossibleRawForCareer(kb, careerId);
  return (rawByCareer[careerId] ?? 0) / max;
}

function activeCareerIds(kb: KnowledgeBase, state: SessionState): string[] {
  return kb.careers
    .map((c) => c.id)
    .filter((id) => !state.discardedCareerIds.includes(id));
}

function buildRanking(
  kb: KnowledgeBase,
  state: SessionState,
  rawByCareer: Record<string, number>,
  topN = 4
): RankingEntry[] {
  const ids = activeCareerIds(kb, state);
  const rows = ids.map((careerId) => {
    const career = kb.careers.find((c) => c.id === careerId)!;
    const sn = normalizedScoreFromFcRaw(kb, careerId, rawByCareer);
    return { careerId, nome: career.name, scoreNormalizado: sn };
  });

  const positive = rows.map((r) => Math.max(0, r.scoreNormalizado + 1) / 2);
  const sum = positive.reduce((a, b) => a + b, 0) || 1;

  return rows
    .map((r, i) => ({
      ...r,
      probabilidade: positive[i]! / sum
    }))
    .sort((a, b) => b.scoreNormalizado - a.scoreNormalizado)
    .slice(0, topN);
}

function entropyOfDistribution(probs: number[]): number {
  const p = probs.filter((x) => x > 1e-12);
  if (p.length === 0) return 0;
  return -p.reduce((s, x) => s + x * Math.log2(x), 0);
}

function distributionOverCareers(
  kb: KnowledgeBase,
  state: SessionState,
  hypotheticalAnswers: Record<string, QuizAnswer>
): number[] {
  const hypState: SessionState = { ...state, answers: hypotheticalAnswers };
  const { rawByCareer } = runForwardChaining(kb, hypState);
  const ids = activeCareerIds(kb, state);
  const raw = ids.map((id) => {
    const sn = normalizedScoreFromFcRaw(kb, id, rawByCareer);
    return Math.max(0.001, sn + 1);
  });
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / s);
}

function expectedEntropyAfterQuestion(
  kb: KnowledgeBase,
  state: SessionState,
  questionId: string
): number {
  let h = 0;
  for (const ans of Object.keys(PRIOR_ANSWER) as QuizAnswer[]) {
    const hyp = { ...state.answers, [questionId]: ans };
    const dist = distributionOverCareers(kb, state, hyp);
    h += PRIOR_ANSWER[ans] * entropyOfDistribution(dist);
  }
  return h;
}

export function selectNextQuestionId(kb: KnowledgeBase, state: SessionState): string | null {
  const answered = new Set(Object.keys(state.answers));
  const candidates = kb.questions.map((q) => q.id).filter((id) => !answered.has(id));

  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  let bestH = Number.POSITIVE_INFINITY;

  for (const qid of candidates) {
    const h = expectedEntropyAfterQuestion(kb, state, qid);
    if (h < bestH) {
      bestH = h;
      best = qid;
    }
  }

  return best;
}

function countAnswered(state: SessionState): number {
  return Object.keys(state.answers).length;
}

function decideStatus(
  kb: KnowledgeBase,
  state: SessionState,
  rawByCareer: Record<string, number>
): {
  status: QuizStatus;
  carreiraProposta: string | null;
} {
  const ranking = buildRanking(kb, state, rawByCareer, 4);
  const active = activeCareerIds(kb, state);

  if (active.length === 0) {
    return { status: "esgotado", carreiraProposta: null };
  }

  const unanswered = kb.questions.filter((q) => !(q.id in state.answers));
  if (unanswered.length === 0) {
    const top = ranking[0];
    if (top && top.probabilidade > 0) {
      return { status: "conclusao_encontrada", carreiraProposta: top.nome };
    }
    return { status: "esgotado", carreiraProposta: null };
  }

  if (countAnswered(state) >= MAX_QUESTIONS_SAFETY) {
    const top = ranking[0];
    return {
      status: top ? "conclusao_encontrada" : "esgotado",
      carreiraProposta: top?.nome ?? null
    };
  }

  const [first, second] = ranking;
  if (
    first &&
    second &&
    first.scoreNormalizado - second.scoreNormalizado >= MIN_GAP_CONCLUSION &&
    first.scoreNormalizado >= MIN_TOP_SCORE
  ) {
    return { status: "conclusao_encontrada", carreiraProposta: first.nome };
  }

  if (first && !second && first.scoreNormalizado >= MIN_TOP_SCORE + 0.02) {
    return { status: "conclusao_encontrada", carreiraProposta: first.nome };
  }

  /** Com base grande, após várias respostas o líder costuma estabilizar — conclui sem exigir gap enorme. */
  if (
    first &&
    second &&
    countAnswered(state) >= 14 &&
    first.scoreNormalizado >= MIN_TOP_SCORE &&
    first.scoreNormalizado - second.scoreNormalizado >= 0.03
  ) {
    return { status: "conclusao_encontrada", carreiraProposta: first.nome };
  }

  return { status: "em_andamento", carreiraProposta: null };
}

export function runEngine(kb: KnowledgeBase, sessionId: string, state: SessionState): QuizEngineResponse {
  const fc = runForwardChaining(kb, state);
  const { status, carreiraProposta } = decideStatus(kb, state, fc.rawByCareer);

  let proximaPergunta: { id: string; texto: string } | null = null;

  if (status === "em_andamento") {
    const qid = selectNextQuestionId(kb, state);
    if (qid) {
      const q = kb.questions.find((x) => x.id === qid);
      if (q) proximaPergunta = { id: q.id, texto: q.text };
    }
  }

  if (status === "conclusao_encontrada") {
    proximaPergunta = null;
  }

  if (status === "esgotado") {
    proximaPergunta = null;
  }

  return {
    sessionId,
    proximaPergunta,
    rankingAtual: buildRanking(kb, state, fc.rawByCareer, 4),
    status,
    carreiraProposta,
    cadeiaInferencia: fc.steps
  };
}

export function initialSessionState(): SessionState {
  return { answers: {}, discardedCareerIds: [] };
}

export function applyAnswer(
  state: SessionState,
  questionId: string,
  answer: QuizAnswer
): SessionState {
  return {
    ...state,
    answers: { ...state.answers, [questionId]: answer }
  };
}

export function applyDiscard(state: SessionState, careerId: string): SessionState {
  if (state.discardedCareerIds.includes(careerId)) return state;
  return {
    ...state,
    discardedCareerIds: [...state.discardedCareerIds, careerId]
  };
}
