import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessionState } from "@/lib/inference/types";
import { initialSessionState } from "@/lib/inference/engine";

const memory = new Map<string, SessionState>();

export async function createSession(): Promise<string> {
  const state = initialSessionState();

  if (process.env.DATABASE_URL) {
    const row = await prisma.quizSession.create({
      data: { state: state as object }
    });
    return row.id;
  }

  const id = `mem_${randomUUID()}`;
  memory.set(id, state);
  return id;
}

export async function getSession(sessionId: string): Promise<SessionState | null> {
  if (process.env.DATABASE_URL) {
    const row = await prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (!row) return null;
    return row.state as unknown as SessionState;
  }

  return memory.get(sessionId) ?? null;
}

export async function saveSession(sessionId: string, state: SessionState): Promise<void> {
  if (process.env.DATABASE_URL) {
    await prisma.quizSession.update({
      where: { id: sessionId },
      data: { state: state as object }
    });
    return;
  }

  memory.set(sessionId, state);
}
