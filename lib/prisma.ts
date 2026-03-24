import { PrismaClient } from "@prisma/client";

/** Interseção: o index `[K: symbol]` do client gerado pode esconder getters nomeados no tipo. */
type AppPrisma = PrismaClient & {
  quizSession: any;
  moderatorCareer: any;
  moderatorRule: any;
};

const globalForPrisma = globalThis as unknown as { prisma: AppPrisma | undefined };

export const prisma: AppPrisma =
  globalForPrisma.prisma ?? (new PrismaClient() as AppPrisma);

export type { PrismaClient };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
