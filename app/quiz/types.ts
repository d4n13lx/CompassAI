export type { QuizAnswer, InferenceChainStep } from "@/lib/inference/types";
import type { InferenceChainStep, QuizStatus } from "@/lib/inference/types";

export type RankingItem = {
  careerId: string;
  nome: string;
  probabilidade: number;
  scoreNormalizado: number;
};

export type QuizApiPayload = {
  sessionId: string;
  proximaPergunta: { id: string; texto: string } | null;
  rankingAtual: RankingItem[];
  status: QuizStatus;
  carreiraProposta: string | null;
  cadeiaInferencia: InferenceChainStep[];
};
