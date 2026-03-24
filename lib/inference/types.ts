export type QuizAnswer = "yes" | "no" | "maybe";

export type QuizStatus = "em_andamento" | "conclusao_encontrada" | "esgotado";

export type KnowledgeQuestion = { id: string; text: string };
export type KnowledgeCareer = { id: string; name: string };
export type KnowledgeRule = { id: string; careerId: string; questionId: string; weight: number };

export type KnowledgeBase = {
  questions: KnowledgeQuestion[];
  careers: KnowledgeCareer[];
  rules: KnowledgeRule[];
};

export type SessionState = {
  answers: Record<string, QuizAnswer>;
  discardedCareerIds: string[];
};

export type RankingEntry = {
  careerId: string;
  nome: string;
  probabilidade: number;
  scoreNormalizado: number;
};

/** Um passo do encadeamento para frente (regra disparada). */
export type InferenceChainStep = {
  ordem: number;
  regraId: string;
  perguntaId: string;
  textoPergunta?: string;
  resposta: QuizAnswer;
  carreiraId: string;
  nomeCarreira: string;
  pesoRegra: number;
  fatorResposta: number;
  contribuicao: number;
};

export type QuizEngineResponse = {
  sessionId: string;
  proximaPergunta: { id: string; texto: string } | null;
  rankingAtual: RankingEntry[];
  status: QuizStatus;
  carreiraProposta: string | null;
  /** Ordem em que as regras foram satisfeitas e disparadas (encadeamento para frente). */
  cadeiaInferencia: InferenceChainStep[];
};
