"use client";

import * as React from "react";
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useReducedMotion
} from "framer-motion";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { WavyBackground } from "@/components/ui/wavy-background";
import { Button } from "@/components/ui/button";
import type {
  InferenceChainStep,
  QuizAnswer,
  QuizApiPayload,
  RankingItem
} from "@/app/quiz/types";

type Screen = "home" | "quiz" | "result";

function answerLabel(a: QuizAnswer) {
  if (a === "yes") return "Sim";
  if (a === "no") return "Não";
  return "Talvez / Não sei";
}

/** Fatos exibidos como a cadeia (ordem do encadeamento): só pergunta + resposta, uma linha por pergunta. */
function ChainFactsOnly({ steps }: { steps: InferenceChainStep[] }) {
  if (steps.length === 0) {
    return <p className="text-white/50">Nenhum fato na cadeia ainda.</p>;
  }
  const seen = new Set<string>();
  const rows: { key: string; pergunta: string; resposta: QuizAnswer }[] = [];
  for (const s of steps) {
    if (seen.has(s.perguntaId)) continue;
    seen.add(s.perguntaId);
    rows.push({
      key: s.perguntaId,
      pergunta: s.textoPergunta ?? s.perguntaId,
      resposta: s.resposta
    });
  }
  return (
    <ol className="mt-2 max-h-64 list-decimal space-y-2 overflow-y-auto pl-5 text-sm text-white/80">
      {rows.map((r) => (
        <li key={r.key}>
          {r.pergunta} — {answerLabel(r.resposta)}
        </li>
      ))}
    </ol>
  );
}

async function postQuiz(body: object): Promise<QuizApiPayload & { ok: boolean; error?: string }> {
  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data: QuizApiPayload & { ok: boolean; error?: string };
  try {
    data = (text ? JSON.parse(text) : {}) as QuizApiPayload & { ok: boolean; error?: string };
  } catch {
    throw new Error(
      response.ok ? "Resposta inválida do servidor" : `HTTP ${response.status}: ${text.slice(0, 120)}`
    );
  }
  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return data;
}

export default function Page() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = React.useState<Screen>("home");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<QuizApiPayload | null>(null);
  const [reasoning, setReasoning] = React.useState<
    { questionId: string; questionText: string; answer: QuizAnswer }[]
  >([]);
  const [showReasoning, setShowReasoning] = React.useState(false);
  const [teachCareer, setTeachCareer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmedCareer, setConfirmedCareer] = React.useState<string | null>(null);

  function applyPayload(data: QuizApiPayload & { ok: boolean; error?: string }) {
    if (!data.ok) {
      throw new Error(data.error ?? "Erro na API");
    }
    setPayload({
      sessionId: data.sessionId,
      proximaPergunta: data.proximaPergunta,
      rankingAtual: data.rankingAtual,
      status: data.status,
      carreiraProposta: data.carreiraProposta,
      cadeiaInferencia: data.cadeiaInferencia ?? []
    });
  }

  function resetAll() {
    setScreen("home");
    setSessionId(null);
    setPayload(null);
    setReasoning([]);
    setShowReasoning(false);
    setTeachCareer("");
    setError(null);
    setBusy(false);
    setConfirmedCareer(null);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const data = await postQuiz({ action: "start" });
      applyPayload(data);
      setSessionId(data.sessionId);
      setReasoning([]);
      setConfirmedCareer(null);
      setScreen("quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar");
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer(value: QuizAnswer) {
    if (!sessionId || !payload?.proximaPergunta) return;
    setBusy(true);
    setError(null);
    const q = payload.proximaPergunta;
    try {
      const data = await postQuiz({
        action: "answer",
        sessionId,
        questionId: q.id,
        answer: value
      });
      applyPayload(data);
      setReasoning((prev) => [
        ...prev,
        { questionId: q.id, questionText: q.texto, answer: value }
      ]);
      setScreen("quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao responder");
    } finally {
      setBusy(false);
    }
  }

  async function discardProposedCareer() {
    if (!sessionId || !payload?.rankingAtual[0]) return;
    const top = payload.rankingAtual.find(
      (r) => r.nome === payload.carreiraProposta
    );
    const careerId = top?.careerId ?? payload.rankingAtual[0].careerId;
    setBusy(true);
    setError(null);
    try {
      const data = await postQuiz({
        action: "discard",
        sessionId,
        careerId
      });
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao descartar");
    } finally {
      setBusy(false);
    }
  }

  function confirmCareer() {
    if (!payload?.carreiraProposta) return;
    setConfirmedCareer(payload.carreiraProposta);
    setScreen("result");
  }

  async function teach() {
    const trimmed = teachCareer.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          career: trimmed,
          sessionId: sessionId ?? undefined,
          context: reasoning.map((r) => ({
            questionId: r.questionId,
            questionText: r.questionText,
            answer: r.answer
          }))
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        throw new Error(data.error ?? "Nao foi possivel salvar");
      }
      setConfirmedCareer(trimmed);
      setTeachCareer("");
      setScreen("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  const ranking: RankingItem[] = payload?.rankingAtual ?? [];
  const statusLabel =
    payload?.status === "em_andamento"
      ? "Em andamento"
      : payload?.status === "conclusao_encontrada"
        ? "Conclusão sugerida"
        : payload?.status === "esgotado"
          ? "Inferência esgotada"
          : "";

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduce ? "always" : "user"}>
        <AuroraBackground>
          <WavyBackground className="bg-transparent">
            <main className="mx-auto flex min-h-dvh max-w-5xl items-center justify-center px-6 py-12">
              <AnimatePresence mode="wait">
                {screen === "home" && (
                  <m.section
                    key="home"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.99 }}
                    transition={{ duration: 0.35 }}
                    className="w-full"
                  >
                    <div className="mx-auto max-w-2xl text-center">
                      <p className="text-sm font-semibold tracking-wide text-white/70">
                        Career Compass • Sua Carreira em Dados
                      </p>
                      <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
                        Descubra sua carreira em TI.
                      </h1>
                      <p className="mt-4 text-pretty text-base text-white/70 sm:text-lg">
                      Nossa tecnologia mapeia o seu perfil técnico para entregar o caminho exato para a sua próxima grande oportunidade em TI.
                      </p>

                      <div className="mt-8 flex items-center justify-center gap-3">
                        <Button onClick={() => void start()} className="px-6 py-3 text-base" disabled={busy}>
                          Começar
                        </Button>
                        <Button variant="ghost" onClick={() => setShowReasoning((s) => !s)}>
                          Ver Raciocínio
                        </Button>
                      </div>

                      {showReasoning && (
                        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
                          <h2 className="text-sm font-semibold text-white">Ver Raciocínio</h2>
                          <p className="mt-2 text-sm text-white/50">
                            Inicie o quiz para ver fatos e ranking retornados pela API.
                          </p>
                        </div>
                      )}
                    </div>
                  </m.section>
                )}

                {screen === "quiz" && payload && (
                  <m.section
                    key="quiz"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.99 }}
                    transition={{ duration: 0.35 }}
                    className="w-full"
                  >
                    <div className="mx-auto max-w-xl space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-black/35 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-white/60">{statusLabel}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" onClick={() => setShowReasoning((s) => !s)}>
                              Ver Raciocínio
                            </Button>
                            <Button variant="ghost" onClick={resetAll}>
                              Reiniciar
                            </Button>
                          </div>
                        </div>

                        {payload.status === "em_andamento" && payload.proximaPergunta && (
                          <>
                            <h2 className="mt-4 text-balance text-2xl font-semibold text-white">
                              {payload.proximaPergunta.texto}
                            </h2>
                            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <Button disabled={busy} onClick={() => void sendAnswer("yes")}>
                                Sim
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() => void sendAnswer("no")}
                                variant="secondary"
                              >
                                Não
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() => void sendAnswer("maybe")}
                                variant="ghost"
                              >
                                Talvez / Não sei
                              </Button>
                            </div>
                          </>
                        )}

                        {payload.status === "conclusao_encontrada" && payload.carreiraProposta && (
                          <div className="mt-4">
                            <p className="text-sm text-white/70">Sua carreira é esta?</p>
                            <h2 className="mt-2 text-3xl font-bold text-white">
                              {payload.carreiraProposta}
                            </h2>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                              <Button disabled={busy} onClick={confirmCareer}>
                                Sim, é minha carreira
                              </Button>
                              <Button
                                disabled={busy}
                                variant="secondary"
                                onClick={() => void discardProposedCareer()}
                              >
                                Não é minha carreira
                              </Button>
                            </div>
                          </div>
                        )}

                        {payload.status === "esgotado" && (
                          <div className="mt-4">
                            <h2 className="text-xl font-semibold text-white">
                              Não há mais inferência automática
                            </h2>
                            <p className="mt-2 text-sm text-white/70">
                              Informe manualmente sua carreira. Enviaremos ao servidor para o moderador.
                            </p>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                              <input
                                value={teachCareer}
                                onChange={(e) => setTeachCareer(e.target.value)}
                                placeholder="Ex.: DevOps, QA, Back-end..."
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/20"
                              />
                              <Button disabled={busy} onClick={() => void teach()} className="shrink-0">
                                Enviar sugestão
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mt-6 flex items-center justify-between text-xs text-white/50">
                          <span>Clique em um dos botões</span>
                          <span>{busy ? "Processando..." : "Pronto"}</span>
                        </div>
                        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
                      </div>

                      {showReasoning && (
                        <div className="rounded-3xl border border-white/10 bg-black/30 p-5 text-left">
                          <h3 className="text-sm font-semibold text-white">Ver Raciocínio</h3>
                          <div className="mt-3 grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold text-white/60">
                                Encadeamento para frente (fatos)
                              </p>
                              <ChainFactsOnly steps={payload.cadeiaInferencia} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white/60">Ranking (servidor)</p>
                              <ul className="mt-2 space-y-1 text-sm text-white/80">
                                {ranking.length === 0 ? (
                                  <li className="text-white/50">Sem ranking ainda.</li>
                                ) : (
                                  ranking.map((r) => (
                                    <li key={r.careerId}>
                                      <span className="font-semibold">{r.nome}</span> —{" "}
                                      {(r.probabilidade * 100).toFixed(1)}%
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </m.section>
                )}

                {screen === "result" && (
                  <m.section
                    key="result"
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.99 }}
                    transition={{ duration: 0.35 }}
                    className="w-full"
                  >
                    <div className="mx-auto max-w-2xl">
                      <div className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs font-semibold text-white/60">Resultado</p>
                          <Button variant="ghost" onClick={resetAll}>
                            Voltar ao início
                          </Button>
                        </div>
                        <h2 className="mt-4 text-3xl font-bold text-white">
                          {confirmedCareer ?? "—"}
                        </h2>
                        <p className="mt-2 text-white/70">
                          Registro concluído. Obrigado por usar o Career Compass.
                        </p>
                        <Button className="mt-6" variant="ghost" onClick={() => setShowReasoning((s) => !s)}>
                          Ver Raciocínio
                        </Button>
                        {showReasoning && (
                          <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-left text-sm text-white/80 lg:grid-cols-2">
                            <div>
                              <p className="font-semibold text-white">Fatos</p>
                              <ChainFactsOnly steps={payload?.cadeiaInferencia ?? []} />
                            </div>
                            <div>
                              <p className="font-semibold text-white">Ranking</p>
                              <ul className="mt-2 space-y-1">
                                {ranking.length === 0 ? (
                                  <li className="text-white/50">Sem dados de ranking.</li>
                                ) : (
                                  ranking.map((r) => (
                                    <li key={r.careerId}>
                                      {r.nome} — {(r.probabilidade * 100).toFixed(1)}%
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </m.section>
                )}
              </AnimatePresence>
            </main>
          </WavyBackground>
        </AuroraBackground>
      </MotionConfig>
    </LazyMotion>
  );
}
