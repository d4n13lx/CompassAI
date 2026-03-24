import { prisma } from "@/lib/prisma";
import { BASE_KB } from "@/lib/inference/engine";
import type { KnowledgeBase } from "@/lib/inference/types";

/** Subconjunto de `ModeratorCareer` usado na mescla (evita acoplamento a versões do client gerado). */
type ModeratorCareerRow = { id: string; name: string };

/** Subconjunto de `ModeratorRule` usado na mescla. */
type ModeratorRuleRow = {
  id: string;
  careerId: string;
  questionId: string;
  weight: number;
};

let cache: { value: KnowledgeBase; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function slugFromCareerName(name: string): string {
  const s = normalizeSlug(name);
  return s || `career-${Date.now()}`;
}

/** Garante slug único em `ModeratorCareer` (colisão por nomes que normalizam igual). */
export async function allocateUniqueModeratorSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let n = 0;
  for (;;) {
    const row = await prisma.moderatorCareer.findUnique({ where: { slug: candidate } });
    if (!row) return candidate;
    n += 1;
    candidate = `${baseSlug}-${n}`;
  }
}

export async function getEffectiveKnowledgeBase(): Promise<KnowledgeBase> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (!process.env.DATABASE_URL) {
    const base = BASE_KB;
    cache = { value: base, expiresAt: now + CACHE_TTL_MS };
    return base;
  }

  try {
    const [careers, rules] = (await Promise.all([
      prisma.moderatorCareer.findMany(),
      prisma.moderatorRule.findMany()
    ])) as [ModeratorCareerRow[], ModeratorRuleRow[]];

    const questionMap = new Map(BASE_KB.questions.map((q) => [q.id, q]));
    const mergedCareers = [
      ...BASE_KB.careers,
      ...careers.map((c) => ({
        id: c.id,
        name: c.name
      }))
    ];

    const mergedRules = [
      ...BASE_KB.rules,
      ...rules
        .filter((r) => questionMap.has(r.questionId))
        .map((r) => ({
          id: r.id,
          careerId: r.careerId,
          questionId: r.questionId,
          weight: r.weight
        }))
    ];

    const effective: KnowledgeBase = {
      questions: BASE_KB.questions,
      careers: mergedCareers,
      rules: mergedRules
    };

    cache = { value: effective, expiresAt: now + CACHE_TTL_MS };
    return effective;
  } catch (err) {
    console.error("[knowledge-repository] Prisma merge failed; using BASE_KB only", err);
    const base = BASE_KB;
    cache = { value: base, expiresAt: now + CACHE_TTL_MS };
    return base;
  }
}

export function invalidateKnowledgeCache() {
  cache = null;
}

