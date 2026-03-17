import type { Regra } from "@/constants/knowledgeBase";

const STORAGE_KEY = "ti-career-expert.rules.v1";

export function loadUserRules(): Regra[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Regra[];
  } catch {
    return [];
  }
}

export function saveUserRules(rules: Regra[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

