export type { QuizAnswer, InferenceChainStep } from "@/lib/inference/types";
import type { QuizStatus } from "@/lib/inference/types";
import type { ChainFactWire } from "@/lib/quiz/wire-payload";

export type ChainFactLite = ChainFactWire;

export type RankingItem = {
  careerId: string;
  nome: string;
  probabilidade: number;
  /** Opcional na API compacta; normalizado no cliente para 0 se ausente. */
  scoreNormalizado?: number;
};

export type QuizApiPayload = {
  sessionId: string;
  proximaPergunta: { id: string; texto: string } | null;
  rankingAtual: RankingItem[];
  status: QuizStatus;
  carreiraProposta: string | null;
  /** Fatos deduplicados; ausente até carregar (GET reasoning) ou POST com `includeReasoning`. */
  cadeiaResumo?: ChainFactLite[];
};
