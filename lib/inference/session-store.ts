import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessionState } from "@/lib/inference/types";
import { initialSessionState } from "@/lib/inference/engine";
import { withTimeout } from "@/lib/with-timeout";

const memory = new Map<string, SessionState>();

const DB_MS = 15_000;

/** Só em dev local sem Mongo: Map em memória. Na Vercel/produção com DATABASE_URL isso quebra (instâncias diferentes). */
const USE_MEMORY =
  process.env.NODE_ENV === "development" && !process.env.DATABASE_URL;

export async function createSession(): Promise<string> {
  const state = initialSessionState();

  if (process.env.DATABASE_URL) {
    const row = (await withTimeout(
      prisma.quizSession.create({
        data: { state: state as object }
      }),
      DB_MS,
      "quizSession.create"
    )) as { id: string };
    return row.id;
  }

  if (!USE_MEMORY) {
    throw new Error(
      "DATABASE_URL não definido. Em produção (ex.: Vercel) configure MongoDB; sessões em memória não funcionam entre requisições."
    );
  }

  const id = `mem_${randomUUID()}`;
  memory.set(id, state);
  return id;
}

export async function getSession(sessionId: string): Promise<SessionState | null> {
  if (process.env.DATABASE_URL) {
    const row = (await withTimeout(
      prisma.quizSession.findUnique({ where: { id: sessionId } }),
      DB_MS,
      "quizSession.findUnique"
    )) as { state: unknown } | null;
    if (!row) return null;
    return row.state as unknown as SessionState;
  }

  if (!USE_MEMORY) return null;
  return memory.get(sessionId) ?? null;
}

export async function saveSession(sessionId: string, state: SessionState): Promise<void> {
  if (process.env.DATABASE_URL) {
    await withTimeout(
      prisma.quizSession.update({
        where: { id: sessionId },
        data: { state: state as object }
      }),
      DB_MS,
      "quizSession.update"
    );
    return;
  }

  if (!USE_MEMORY) {
    throw new Error("DATABASE_URL é obrigatório para persistir a sessão.");
  }
  memory.set(sessionId, state);
}
