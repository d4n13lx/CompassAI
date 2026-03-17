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
import {
  fatosIniciais,
  regrasIniciais,
  type Answer
} from "@/constants/knowledgeBase";
import { forwardChainingInfer, type FatosColetados } from "@/lib/forwardChaining";
import { loadUserRules, saveUserRules } from "@/lib/storage";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { WavyBackground } from "@/components/ui/wavy-background";
import { Button } from "@/components/ui/button";

type Screen = "home" | "quiz" | "result";

function answerLabel(a: Answer) {
  if (a === "yes") return "Sim";
  if (a === "no") return "Não";
  return "Talvez / Não sei";
}

export default function Page() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = React.useState<Screen>("home");
  const [questionIdx, setQuestionIdx] = React.useState(0);
  const [fatos, setFatos] = React.useState<FatosColetados>({});
  const [career, setCareer] = React.useState<string | undefined>(undefined);
  const [firedRules, setFiredRules] = React.useState<
    { regraId: string; regraNome: string; carreira: string }[]
  >([]);
  const [showReasoning, setShowReasoning] = React.useState(false);
  const [teachCareer, setTeachCareer] = React.useState("");
  const [userRules, setUserRules] = React.useState(regrasIniciais);

  React.useEffect(() => {
    const extra = loadUserRules();
    setUserRules([...regrasIniciais, ...extra]);
  }, []);

  const currentQuestion = fatosIniciais[questionIdx];

  function resetAll() {
    setScreen("home");
    setQuestionIdx(0);
    setFatos({});
    setCareer(undefined);
    setFiredRules([]);
    setShowReasoning(false);
    setTeachCareer("");
  }

  function start() {
    setScreen("quiz");
  }

  function inferNow(nextFatos: FatosColetados) {
    const result = forwardChainingInfer({ regras: userRules, fatos: nextFatos });
    setFiredRules(result.fired);
    setCareer(result.carreira);
    return result.carreira;
  }

  function answerCurrent(value: Answer) {
    if (!currentQuestion) return;
    const nextFatos = { ...fatos, [currentQuestion.id]: value };
    setFatos(nextFatos);

    const inferred = inferNow(nextFatos);
    const isLast = questionIdx >= fatosIniciais.length - 1;

    if (inferred || isLast) {
      setScreen("result");
      return;
    }

    setQuestionIdx((i) => i + 1);
  }

  function teach() {
    const trimmed = teachCareer.trim();
    if (!trimmed) return;

    const ifConds = Object.entries(fatos).map(([fatoId, valor]) => ({
      fatoId,
      valor: valor as Answer
    }));

    const newRule = {
      id: `U_${Date.now()}`,
      nome: `Aprendido: ${trimmed}`,
      if: ifConds,
      then: { carreira: trimmed }
    } as const;

    const extra = loadUserRules();
    const updatedExtra = [...extra, newRule];
    saveUserRules(updatedExtra);
    setUserRules([...regrasIniciais, ...updatedExtra]);
    setCareer(trimmed);
  }

  return (
    <AuroraBackground>
      <WavyBackground className="bg-transparent">
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion={reduce ? "always" : "user"}>
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
                    Sistema Especialista • Encadeamento para Frente
                  </p>
                  <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
                    Descubra sua carreira em TI.
                  </h1>
                  <p className="mt-4 text-pretty text-base text-white/70 sm:text-lg">
                    Responda a algumas perguntas objetivas e receba uma recomendação
                    baseada em regras — com transparência total do raciocínio por trás
                    do resultado.
                  </p>

                  <div className="mt-8 flex items-center justify-center gap-3">
                    <Button onClick={start} className="px-6 py-3 text-base">
                      Começar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowReasoning((s) => !s)}
                    >
                      Ver Raciocínio
                    </Button>
                  </div>

                  {showReasoning && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
                      <h2 className="text-sm font-semibold text-white">
                        Ver Raciocínio
                      </h2>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-white/60">
                            Fatos coletados
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-white/80">
                            {Object.keys(fatos).length === 0 ? (
                              <li className="text-white/50">Nenhum fato ainda.</li>
                            ) : (
                              Object.entries(fatos).map(([k, v]) => (
                                <li key={k}>
                                  <span className="font-semibold">{k}</span>:{" "}
                                  {answerLabel(v as Answer)}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white/60">
                            Regras disparadas
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-white/80">
                            {firedRules.length === 0 ? (
                              <li className="text-white/50">
                                Nenhuma regra disparada.
                              </li>
                            ) : (
                              firedRules.map((r) => (
                                <li key={r.regraId}>
                                  <span className="font-semibold">{r.regraId}</span>{" "}
                                  — {r.regraNome} →{" "}
                                  <span className="font-semibold">
                                    {r.carreira}
                                  </span>
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

                {screen === "quiz" && (
                  <m.section
                key="quiz"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                transition={{ duration: 0.35 }}
                className="w-full"
              >
                <div className="mx-auto max-w-xl">
                  <div className="rounded-3xl border border-white/10 bg-black/35 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold text-white/60">
                        Pergunta {questionIdx + 1} de {fatosIniciais.length}
                      </p>
                      <Button variant="ghost" onClick={resetAll}>
                        Reiniciar
                      </Button>
                    </div>

                    <h2 className="mt-4 text-balance text-2xl font-semibold text-white">
                      {currentQuestion?.descricao ?? "Fim do questionário"}
                    </h2>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Button onClick={() => answerCurrent("yes")}>Sim</Button>
                      <Button onClick={() => answerCurrent("no")} variant="secondary">
                        Não
                      </Button>
                      <Button onClick={() => answerCurrent("maybe")} variant="ghost">
                        Talvez / Não sei
                      </Button>
                    </div>

                    <div className="mt-6 flex items-center justify-between text-xs text-white/50">
                      <span>Tipo de motor: Forward chaining</span>
                      <span>Regras: {userRules.length}</span>
                    </div>
                  </div>
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
                      <p className="text-xs font-semibold text-white/60">
                        Resultado
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setShowReasoning((s) => !s)}
                        >
                          Ver Raciocínio
                        </Button>
                        <Button variant="ghost" onClick={resetAll}>
                          Voltar ao início
                        </Button>
                      </div>
                    </div>

                    {career ? (
                      <div className="mt-4">
                        <h2 className="text-3xl font-bold text-white">
                          {career}
                        </h2>
                        <p className="mt-2 text-white/70">
                          Com base nas suas respostas, essa é a carreira inferida.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <h2 className="text-2xl font-bold text-white">
                          Não consegui inferir uma carreira.
                        </h2>
                        <p className="mt-2 text-white/70">
                          Ensine ao sistema qual era a carreira correta. Vou salvar
                          localmente para usar em próximas execuções.
                        </p>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                          <input
                            value={teachCareer}
                            onChange={(e) => setTeachCareer(e.target.value)}
                            placeholder="Ex: DevOps, Mobile, QA, Back-end..."
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/20"
                          />
                          <Button onClick={teach} className="shrink-0">
                            Ensinar
                          </Button>
                        </div>
                      </div>
                    )}

                    {showReasoning && (
                      <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
                        <h3 className="text-sm font-semibold text-white">
                          Ver Raciocínio
                        </h3>
                        <div className="mt-3 grid gap-5 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-white/60">
                              Fatos coletados
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-white/80">
                              {Object.keys(fatos).length === 0 ? (
                                <li className="text-white/50">Nenhum fato.</li>
                              ) : (
                                Object.entries(fatos).map(([k, v]) => (
                                  <li key={k}>
                                    <span className="font-semibold">{k}</span>:{" "}
                                    {answerLabel(v as Answer)}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white/60">
                              Regras disparadas
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-white/80">
                              {firedRules.length === 0 ? (
                                <li className="text-white/50">
                                  Nenhuma regra disparada.
                                </li>
                              ) : (
                                firedRules.map((r) => (
                                  <li key={r.regraId}>
                                    <span className="font-semibold">
                                      {r.regraId}
                                    </span>{" "}
                                    — {r.regraNome} →{" "}
                                    <span className="font-semibold">
                                      {r.carreira}
                                    </span>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  </m.section>
                )}
              </AnimatePresence>
            </main>
          </MotionConfig>
        </LazyMotion>
      </WavyBackground>
    </AuroraBackground>
  );
}

