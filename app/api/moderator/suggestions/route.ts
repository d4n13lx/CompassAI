import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isModeratorAuthorized } from "@/lib/moderator-auth";
import { BASE_KB } from "@/lib/inference/engine";
import {
  allocateUniqueModeratorSlug,
  invalidateKnowledgeCache,
  slugFromCareerName
} from "@/lib/inference/knowledge-repository";

export const runtime = "nodejs";

type ApproveBody = {
  action: "approve";
  suggestionId: string;
};

type DeleteBody = {
  action: "delete";
  suggestionId: string;
};

type Body = ApproveBody | DeleteBody;

type SuggestionContext = {
  respostas?: Array<{
    questionId?: string;
    questionText?: string;
    answer?: "yes" | "no" | "maybe";
  }>;
};

const questionTextById = new Map(BASE_KB.questions.map((q) => [q.id, q.text]));

export async function GET(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL nao configurada" },
      { status: 503 }
    );
  }

  const rows = await prisma.userSuggestion.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({
    ok: true,
    items: rows.map((r) => {
      const context = (r.context ?? {}) as SuggestionContext;
      const respostas = context.respostas ?? [];
      return {
        id: r.id,
        career: r.career,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        factsCount: respostas.length,
        factsPreview: respostas.slice(0, 5).map((f) => {
          const qid = f.questionId;
          return {
            questionId: qid,
            questionText:
              f.questionText ?? (qid ? questionTextById.get(qid) : undefined) ?? null,
            answer: f.answer
          };
        })
      };
    })
  });
}

export async function POST(request: Request) {
  if (!isModeratorAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Nao autorizado" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL nao configurada" },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Body;

  if (body.action === "delete") {
    await prisma.userSuggestion.delete({ where: { id: body.suggestionId } });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "approve") {
    return NextResponse.json({ ok: false, error: "Acao invalida" }, { status: 400 });
  }

  const suggestion = await prisma.userSuggestion.findUnique({
    where: { id: body.suggestionId }
  });

  if (!suggestion) {
    return NextResponse.json({ ok: false, error: "Sugestao nao encontrada" }, { status: 404 });
  }

  if (suggestion.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error:
          suggestion.status === "approved"
            ? "Sugestao ja aprovada"
            : "Sugestao nao esta pendente"
      },
      { status: 409 }
    );
  }

  const context = (suggestion.context ?? {}) as SuggestionContext;
  const respostas = context.respostas ?? [];

  const careerName = suggestion.career.trim();
  const baseSlug = slugFromCareerName(careerName);

  const existing = await prisma.moderatorCareer.findFirst({
    where: { name: careerName }
  });

  const career =
    existing ??
    (await prisma.moderatorCareer.create({
      data: {
        name: careerName,
        slug: await allocateUniqueModeratorSlug(baseSlug),
        source: "suggestion",
        suggestionId: suggestion.id
      }
    }));

  const approvedRules = respostas
    .filter((f) => f.questionId && f.answer)
    .map((f) => ({
      careerId: career.id,
      questionId: f.questionId as string,
      weight: f.answer === "yes" ? 3 : f.answer === "maybe" ? 1 : -3
    }));

  for (const r of approvedRules) {
    await prisma.moderatorRule.upsert({
      where: {
        careerId_questionId: {
          careerId: r.careerId,
          questionId: r.questionId
        }
      },
      create: r,
      update: { weight: r.weight }
    });
  }

  await prisma.userSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "approved" }
  });

  invalidateKnowledgeCache();

  return NextResponse.json({ ok: true, careerId: career.id, rulesCreated: approvedRules.length });
}

