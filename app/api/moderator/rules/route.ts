import type { ModeratorCareer, ModeratorRule } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isModeratorAuthorized } from "@/lib/moderator-auth";
import { BASE_KB } from "@/lib/inference/engine";
import { invalidateKnowledgeCache } from "@/lib/inference/knowledge-repository";

export const runtime = "nodejs";

const WEIGHT_MIN = -50;
const WEIGHT_MAX = 50;

const questionTextById = new Map(BASE_KB.questions.map((q) => [q.id, q.text]));
const validQuestionIds = new Set(BASE_KB.questions.map((q) => q.id));

function requireDb() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL nao configurada" },
      { status: 503 }
    );
  }
  return null;
}

function parseIntWeight(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v)) return null;
  if (v < WEIGHT_MIN || v > WEIGHT_MAX) return null;
  return v;
}

export async function GET(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }
  const dbErr = requireDb();
  if (dbErr) return dbErr;

  const [careers, rules]: [ModeratorCareer[], ModeratorRule[]] = await Promise.all([
    prisma.moderatorCareer.findMany({ orderBy: { name: "asc" } }),
    prisma.moderatorRule.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  const careerName = new Map<string, string>(careers.map((c) => [c.id, c.name]));

  return NextResponse.json({
    ok: true,
    weightBounds: { min: WEIGHT_MIN, max: WEIGHT_MAX },
    careers: careers.map((c: ModeratorCareer) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      source: c.source
    })),
    rules: rules.map((r: ModeratorRule) => ({
      id: r.id,
      careerId: r.careerId,
      careerName: careerName.get(r.careerId) ?? r.careerId,
      questionId: r.questionId,
      questionText: questionTextById.get(r.questionId) ?? "(pergunta nao encontrada na base)",
      weight: r.weight,
      inBaseKnowledge: validQuestionIds.has(r.questionId)
    })),
    questionOptions: BASE_KB.questions.map((q) => ({ id: q.id, text: q.text }))
  });
}

export async function POST(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }
  const dbErr = requireDb();
  if (dbErr) return dbErr;

  const body = (await request.json()) as {
    careerId?: string;
    questionId?: string;
    weight?: unknown;
  };

  if (!body.careerId || !body.questionId) {
    return NextResponse.json({ ok: false, error: "careerId e questionId obrigatorios" }, { status: 400 });
  }

  if (!validQuestionIds.has(body.questionId)) {
    return NextResponse.json({ ok: false, error: "questionId invalido" }, { status: 400 });
  }

  const weight = parseIntWeight(body.weight ?? 3);
  if (weight === null) {
    return NextResponse.json(
      { ok: false, error: `Peso deve ser inteiro entre ${WEIGHT_MIN} e ${WEIGHT_MAX}` },
      { status: 400 }
    );
  }

  const career = await prisma.moderatorCareer.findUnique({ where: { id: body.careerId } });
  if (!career) {
    return NextResponse.json({ ok: false, error: "Carreira nao encontrada" }, { status: 404 });
  }

  const row = await prisma.moderatorRule.upsert({
    where: {
      careerId_questionId: {
        careerId: body.careerId,
        questionId: body.questionId
      }
    },
    create: {
      careerId: body.careerId,
      questionId: body.questionId,
      weight
    },
    update: { weight }
  });

  invalidateKnowledgeCache();

  return NextResponse.json({
    ok: true,
    rule: {
      id: row.id,
      careerId: row.careerId,
      careerName: career.name,
      questionId: row.questionId,
      questionText: questionTextById.get(row.questionId) ?? "",
      weight: row.weight,
      inBaseKnowledge: true
    }
  });
}

export async function PATCH(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }
  const dbErr = requireDb();
  if (dbErr) return dbErr;

  const body = (await request.json()) as { ruleId?: string; weight?: unknown };
  if (!body.ruleId) {
    return NextResponse.json({ ok: false, error: "ruleId obrigatorio" }, { status: 400 });
  }

  const weight = parseIntWeight(body.weight);
  if (weight === null) {
    return NextResponse.json(
      { ok: false, error: `Peso deve ser inteiro entre ${WEIGHT_MIN} e ${WEIGHT_MAX}` },
      { status: 400 }
    );
  }

  const row = await prisma.moderatorRule.update({
    where: { id: body.ruleId },
    data: { weight }
  });

  invalidateKnowledgeCache();

  const career = await prisma.moderatorCareer.findUnique({ where: { id: row.careerId } });

  return NextResponse.json({
    ok: true,
    rule: {
      id: row.id,
      careerId: row.careerId,
      careerName: career?.name ?? row.careerId,
      questionId: row.questionId,
      questionText: questionTextById.get(row.questionId) ?? "",
      weight: row.weight,
      inBaseKnowledge: validQuestionIds.has(row.questionId)
    }
  });
}

export async function DELETE(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }
  const dbErr = requireDb();
  if (dbErr) return dbErr;

  const ruleId = new URL(request.url).searchParams.get("ruleId");
  if (!ruleId) {
    return NextResponse.json({ ok: false, error: "ruleId obrigatorio" }, { status: 400 });
  }

  try {
    await prisma.moderatorRule.delete({ where: { id: ruleId } });
  } catch {
    return NextResponse.json({ ok: false, error: "Regra nao encontrada" }, { status: 404 });
  }

  invalidateKnowledgeCache();
  return NextResponse.json({ ok: true });
}
