import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessionState } from "@/lib/inference/types";
import { initialSessionState } from "@/lib/inference/engine";

const memory = new Map<string, SessionState>();

export async function createSession(): Promise<string> {
  const state = initialSessionState();

  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.quizSession.create({
        data: { state: state as object }
      });
      return row.id;
    } catch (err) {
      console.error("[session-store] Prisma create failed; using in-memory session", err);
    }
  }

  const id = `mem_${randomUUID()}`;
  memory.set(id, state);
  return id;
}

export async function getSession(sessionId: string): Promise<SessionState | null> {
  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.quizSession.findUnique({ where: { id: sessionId } });
      if (!row) return memory.get(sessionId) ?? null;
      return row.state as unknown as SessionState;
    } catch (err) {
      console.error("[session-store] Prisma read failed; trying memory", err);
    }
  }

  return memory.get(sessionId) ?? null;
}

export async function saveSession(sessionId: string, state: SessionState): Promise<void> {
  if (process.env.DATABASE_URL) {
    try {
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { state: state as object }
      });
      return;
    } catch (err) {
      console.error("[session-store] Prisma update failed; persisting in memory only", err);
    }
  }

  memory.set(sessionId, state);
}
