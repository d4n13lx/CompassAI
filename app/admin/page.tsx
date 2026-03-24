"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

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

function answerLabel(a?: "yes" | "no" | "maybe") {
  if (a === "yes") return "Sim";
  if (a === "no") return "Não";
  return "Talvez / Não sei";
}

export default function AdminPage() {
  const [token, setToken] = React.useState("");
  const [items, setItems] = React.useState<SuggestionItem[]>([]);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/moderator/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-moderator-token": token },
        body: JSON.stringify({ action: "approve", suggestionId: id })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Falha ao aprovar");
      await loadSuggestions();
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
        headers: { "Content-Type": "application/json", "x-moderator-token": token },
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

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-10 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Painel de Administração</h1>
        <p className="mt-2 text-sm text-white/70">
          Revise sugestões, aprove para entrar no ranking do motor e exclua entradas inválidas.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <label className="mb-2 block text-sm text-white/70">Token de Acesso</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Informe MODERATOR_TOKEN"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none placeholder:text-white/40"
          />
          <Button onClick={() => void loadSuggestions()} disabled={!token.trim()}>
            Carregar sugestões
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="mt-6 space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold">{item.career}</p>
                <p className="text-xs text-white/60">
                  {new Date(item.createdAt).toLocaleString()} · status: {item.status} · fatos:{" "}
                  {item.factsCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                >
                  {open[item.id] ? "Ocultar fatos" : "Ver fatos"}
                </Button>
                <Button
                  disabled={busyId === item.id || item.status === "approved"}
                  onClick={() => void approve(item.id)}
                >
                  Aprovar
                </Button>
                <Button
                  variant="secondary"
                  disabled={busyId === item.id}
                  onClick={() => void removeSuggestion(item.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>

            {open[item.id] && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-xs font-semibold text-white/60">Pré-visualização (máx. 5)</p>
                <ul className="mt-2 space-y-1 text-sm text-white/80">
                  {item.factsPreview.length === 0 ? (
                    <li className="text-white/50">Sem fatos no contexto.</li>
                  ) : (
                    item.factsPreview.map((f, i) => (
                      <li key={`${item.id}_${i}`} className="space-y-0.5">
                        <span className="font-medium text-white/90">
                          {f.questionText?.trim() || f.questionId || "—"}
                        </span>
                        {f.questionText?.trim() && f.questionId ? (
                          <span className="block text-xs text-white/45">{f.questionId}</span>
                        ) : null}
                        <span className="block text-white/70">Resposta: {answerLabel(f.answer)}</span>
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
      </section>
    </main>
  );
}
