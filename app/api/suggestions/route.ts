import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { QuizAnswer } from "@/lib/inference/types";

export const runtime = "nodejs";

type Body = {
  career?: string;
  sessionId?: string;
  context?: {
    questionId: string;
    questionText: string;
    answer: QuizAnswer;
  }[];
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL nao configurada. Adicione no .env local e nas variaveis da Vercel."
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as Body;
    const career = typeof body.career === "string" ? body.career.trim() : "";
    if (!career) {
      return NextResponse.json({ ok: false, error: "Campo career obrigatorio" }, { status: 400 });
    }

    const record = await prisma.userSuggestion.create({
      data: {
        career,
        context: {
          sessionId: body.sessionId,
          respostas: body.context
        },
        status: "pending"
      }
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    console.error("[suggestions]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao gravar sugestao"
      },
      { status: 500 }
    );
  }
}
