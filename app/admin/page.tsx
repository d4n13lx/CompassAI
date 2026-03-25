"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type Tab = "suggestions" | "rules";

type SuggestionItem = {
  id: string;
  career: string;
  status: string;
  createdAt: string;
  factsCount: number;
  factsPreview: Array<{
    questionId?: string;
    questionText?: string | null;
    answer?: "yes" | "no" | "maybe";
  }>;
};

type ModeratorCareerRow = {
  id: string;
  name: string;
  slug: string;
  source: string;
};

type ModeratorRuleRow = {
  id: string;
  careerId: string;
  careerName: string;
  questionId: string;
  questionText: string;
  weight: number;
  inBaseKnowledge: boolean;
};

type RulesPayload = {
  weightBounds: { min: number; max: number };
  careers: ModeratorCareerRow[];
  rules: ModeratorRuleRow[];
  questionOptions: Array<{ id: string; text: string }>;
};

function answerLabel(a?: "yes" | "no" | "maybe") {
  if (a === "yes") return "Sim";
  if (a === "no") return "Não";
  return "Talvez / Não sei";
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "x-moderator-token": token
  } as const;
}

export default function AdminPage() {
  const [token, setToken] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("suggestions");
  const [items, setItems] = React.useState<SuggestionItem[]>([]);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [rulesPayload, setRulesPayload] = React.useState<RulesPayload | null>(null);
  const [rulesLoading, setRulesLoading] = React.useState(false);
  const [draftWeights, setDraftWeights] = React.useState<Record<string, string>>({});
  const [savingRuleId, setSavingRuleId] = React.useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = React.useState<string | null>(null);
  const [addForm, setAddForm] = React.useState<
    Record<string, { questionId: string; weight: string }>
  >({});

  async function loadSuggestions() {
    setError(null);
    const res = await fetch("/api/moderator/suggestions", {
      headers: { "x-moderator-token": token }
    });
    const data = (await res.json()) as { ok: boolean; items?: SuggestionItem[]; error?: string };
    if (!data.ok) {
      setError(data.error ?? "Falha ao carregar sugestões");
      return;
    }
    setItems(data.items ?? []);
  }

  const loadRules = React.useCallback(async () => {
    if (!token.trim()) return;
    setRulesLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/moderator/rules", {
        headers: { "x-moderator-token": token }
      });
      const data = (await res.json()) as { ok: boolean; error?: string } & Partial<RulesPayload>;
      if (!data.ok) {
        setError(data.error ?? "Falha ao carregar regras");
        setRulesPayload(null);
        return;
      }
      setRulesPayload({
        weightBounds: data.weightBounds!,
        careers: data.careers ?? [],
        rules: data.rules ?? [],
        questionOptions: data.questionOptions ?? []
      });
      setDraftWeights({});
    } finally {
      setRulesLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (tab !== "rules" || !token.trim()) return;
    void loadRules();
  }, [tab, token, loadRules]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/moderator/suggestions", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "approve", suggestionId: id })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Falha ao aprovar");
      await loadSuggestions();
      if (rulesPayload !== null) await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao aprovar");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSuggestion(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/moderator/suggestions", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ action: "delete", suggestionId: id })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Falha ao excluir");
      await loadSuggestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusyId(null);
    }
  }

  function displayWeight(rule: ModeratorRuleRow): string {
    return draftWeights[rule.id] ?? String(rule.weight);
  }

  function parsedDraft(rule: ModeratorRuleRow, bounds: { min: number; max: number }): number | null {
    const raw = displayWeight(rule).trim();
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < bounds.min || n > bounds.max) return null;
    return n;
  }

  function isDirty(rule: ModeratorRuleRow, bounds: { min: number; max: number }): boolean {
    const n = parsedDraft(rule, bounds);
    return n !== null && n !== rule.weight;
  }

  async function saveRule(rule: ModeratorRuleRow) {
    const bounds = rulesPayload?.weightBounds ?? { min: -50, max: 50 };
    const w = parsedDraft(rule, bounds);
    if (w === null) {
      setError(`Peso inválido (${bounds.min} a ${bounds.max}, inteiro).`);
      return;
    }
    setSavingRuleId(rule.id);
    setError(null);
    try {
      const res = await fetch("/api/moderator/rules", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ ruleId: rule.id, weight: w })
      });
      const data = (await res.json()) as { ok: boolean; error?: string; rule?: ModeratorRuleRow };
      if (!data.ok) throw new Error(data.error ?? "Falha ao guardar");
      setRulesPayload((prev) => {
        if (!prev || !data.rule) return prev;
        return {
          ...prev,
          rules: prev.rules.map((r) => (r.id === data.rule!.id ? data.rule! : r))
        };
      });
      setDraftWeights((d) => {
        const next = { ...d };
        delete next[rule.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSavingRuleId(null);
    }
  }

  function revertRule(ruleId: string) {
    setDraftWeights((d) => {
      const next = { ...d };
      delete next[ruleId];
      return next;
    });
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("Remover esta regra do motor?")) return;
    setDeletingRuleId(ruleId);
    setError(null);
    try {
      const res = await fetch(
        `/api/moderator/rules?ruleId=${encodeURIComponent(ruleId)}`,
        { method: "DELETE", headers: { "x-moderator-token": token } }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Falha ao excluir");
      setRulesPayload((prev) =>
        prev ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) } : null
      );
      setDraftWeights((d) => {
        const next = { ...d };
        delete next[ruleId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeletingRuleId(null);
    }
  }

  async function addRule(careerId: string) {
    const form = addForm[careerId] ?? { questionId: "", weight: "3" };
    if (!form.questionId.trim()) {
      setError("Escolha uma pergunta para adicionar.");
      return;
    }
    const w = parseInt(form.weight.trim(), 10);
    const bounds = rulesPayload?.weightBounds ?? { min: -50, max: 50 };
    if (Number.isNaN(w) || w < bounds.min || w > bounds.max) {
      setError(`Peso inválido (${bounds.min} a ${bounds.max}).`);
      return;
    }
    setBusyId(`add_${careerId}`);
    setError(null);
    try {
      const res = await fetch("/api/moderator/rules", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ careerId, questionId: form.questionId, weight: w })
      });
      const data = (await res.json()) as { ok: boolean; error?: string; rule?: ModeratorRuleRow };
      if (!data.ok) throw new Error(data.error ?? "Falha ao adicionar");
      if (data.rule) {
        setRulesPayload((prev) =>
          prev
            ? {
                ...prev,
                rules: [...prev.rules.filter((r) => r.id !== data.rule!.id), data.rule!].sort((a, b) =>
                  a.questionText.localeCompare(b.questionText, "pt")
                )
              }
            : null
        );
      }
      setAddForm((f) => ({
        ...f,
        [careerId]: { questionId: "", weight: "3" }
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar");
    } finally {
      setBusyId(null);
    }
  }

  const bounds = rulesPayload?.weightBounds ?? { min: -50, max: 50 };

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-10 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Painel de Administração</h1>
        <p className="mt-2 text-sm text-white/70">
          Revise sugestões, aprove carreiras e ajuste pesos das regras moderadas (efeito no ranking do
          quiz).
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <label className="mb-2 block text-sm text-white/70">Token de acesso</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="MODERATOR_TOKEN"
            type="password"
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none placeholder:text-white/40"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={tab === "suggestions" ? "primary" : "secondary"}
              onClick={() => setTab("suggestions")}
            >
              Sugestões
            </Button>
            <Button
              type="button"
              variant={tab === "rules" ? "primary" : "secondary"}
              onClick={() => setTab("rules")}
            >
              Regras moderadas
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      {tab === "suggestions" && (
        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void loadSuggestions()} disabled={!token.trim()}>
              Carregar sugestões
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{item.career}</p>
                    <p className="text-xs text-white/60">
                      {new Date(item.createdAt).toLocaleString()} · {item.status} · {item.factsCount}{" "}
                      fatos
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                    >
                      {open[item.id] ? "Ocultar fatos" : "Ver fatos"}
                    </Button>
                    <Button
                      type="button"
                      disabled={busyId === item.id || item.status === "approved"}
                      onClick={() => void approve(item.id)}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void removeSuggestion(item.id)}
                      className="border-rose-500/40 text-rose-200 hover:bg-rose-950/40"
                    >
                      Excluir sugestão
                    </Button>
                  </div>
                </div>

                {open[item.id] && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs font-semibold text-white/60">Pré-visualização (máx. 5)</p>
                    <ul className="mt-2 space-y-2 text-sm text-white/80">
                      {item.factsPreview.length === 0 ? (
                        <li className="text-white/50">Sem fatos no contexto.</li>
                      ) : (
                        item.factsPreview.map((f, i) => (
                          <li key={`${item.id}_${i}`} className="border-b border-white/5 pb-2 last:border-0">
                            <span className="font-medium text-white/90">
                              {f.questionText?.trim() || f.questionId || "—"}
                            </span>
                            {f.questionText?.trim() && f.questionId ? (
                              <span className="mt-0.5 block text-xs text-white/45">{f.questionId}</span>
                            ) : null}
                            <span className="mt-1 block text-white/70">
                              Resposta: {answerLabel(f.answer)}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </article>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-white/60">Nenhuma sugestão carregada.</p>
            )}
          </div>
        </section>
      )}

      {tab === "rules" && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void loadRules()} disabled={!token.trim() || rulesLoading}>
              {rulesLoading ? "A carregar…" : "Atualizar regras"}
            </Button>
            <span className="text-xs text-white/50">
              Peso inteiro {bounds.min} … {bounds.max} (Sim alinha com peso positivo, Não com negativo no
              motor).
            </span>
          </div>

          {!rulesPayload && !rulesLoading && (
            <p className="text-sm text-white/60">Carregue com o token válido.</p>
          )}

          {rulesPayload && rulesPayload.careers.length === 0 && (
            <p className="text-sm text-white/60">
              Ainda não há carreiras moderadas. Aprove uma sugestão para criar regras editáveis aqui.
            </p>
          )}

          {rulesPayload &&
            rulesPayload.careers.map((career) => {
              const careerRules = rulesPayload.rules.filter((r) => r.careerId === career.id);
              const usedIds = new Set(careerRules.map((r) => r.questionId));
              const addChoices = rulesPayload.questionOptions.filter((q) => !usedIds.has(q.id));
              const addState = addForm[career.id] ?? { questionId: "", weight: "3" };

              return (
                <div
                  key={career.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{career.name}</h2>
                      <p className="text-xs text-white/45">
                        {career.slug} · {career.source}
                      </p>
                    </div>
                  </div>

                  {careerRules.length === 0 ? (
                    <p className="mt-3 text-sm text-white/50">Sem regras para esta carreira.</p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {careerRules.map((rule) => {
                        const dirty = isDirty(rule, bounds);
                        const invalid = displayWeight(rule).trim() !== "" && parsedDraft(rule, bounds) === null;
                        return (
                          <li
                            key={rule.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-snug text-white/90">{rule.questionText}</p>
                                <p className="mt-1 font-mono text-xs text-white/40">{rule.questionId}</p>
                                {!rule.inBaseKnowledge && (
                                  <p className="mt-2 text-xs text-amber-300/90">
                                    Esta pergunta não existe na base estática — o motor ignora a regra até
                                    alinhar os IDs.
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <label className="flex items-center gap-2 text-xs text-white/60">
                                  <span className="shrink-0">Peso</span>
                                  <input
                                    type="number"
                                    min={bounds.min}
                                    max={bounds.max}
                                    step={1}
                                    value={displayWeight(rule)}
                                    onChange={(e) =>
                                      setDraftWeights((d) => ({ ...d, [rule.id]: e.target.value }))
                                    }
                                    className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/30"
                                  />
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    disabled={!dirty || invalid || savingRuleId === rule.id}
                                    onClick={() => void saveRule(rule)}
                                  >
                                    {savingRuleId === rule.id ? "A guardar…" : "Guardar peso"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={!dirty || savingRuleId === rule.id}
                                    onClick={() => revertRule(rule.id)}
                                  >
                                    Repor
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={deletingRuleId === rule.id}
                                    onClick={() => void deleteRule(rule.id)}
                                    className="border-rose-500/35 text-rose-200 hover:bg-rose-950/35"
                                  >
                                    {deletingRuleId === rule.id ? "A remover…" : "Remover regra"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            {invalid && (
                              <p className="mt-2 text-xs text-rose-300">Valor inválido para o peso.</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/15 p-3">
                    <p className="text-xs font-semibold text-white/55">Adicionar regra</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/60">
                        Pergunta
                        <select
                          value={addState.questionId}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              [career.id]: { ...addState, questionId: e.target.value }
                            }))
                          }
                          className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none"
                        >
                          <option value="">— escolher —</option>
                          {addChoices.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.text.length > 72 ? `${q.text.slice(0, 72)}…` : q.text}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-white/60">
                        Peso
                        <input
                          type="number"
                          min={bounds.min}
                          max={bounds.max}
                          value={addState.weight}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              [career.id]: { ...addState, weight: e.target.value }
                            }))
                          }
                          className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white outline-none"
                        />
                      </label>
                      <Button
                        type="button"
                        disabled={busyId === `add_${career.id}` || addChoices.length === 0}
                        onClick={() => void addRule(career.id)}
                      >
                        {busyId === `add_${career.id}` ? "A adicionar…" : "Adicionar"}
                      </Button>
                    </div>
                    {addChoices.length === 0 && careerRules.length > 0 && (
                      <p className="mt-2 text-xs text-white/45">Todas as perguntas da base já têm regra.</p>
                    )}
                  </div>
                </div>
              );
            })}
        </section>
      )}
    </main>
  );
}
