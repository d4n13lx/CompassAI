#!/usr/bin/env node
/**
 * Lê `perguntas.json` (árvore fluxo_carreira_ti_completo), gera questions/careers/rules
 * compatíveis com o motor e funde em `data/knowledge.json` (mantém entradas já existentes).
 *
 * Uso: node scripts/merge-perguntas-into-knowledge.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const perguntasPath = path.join(root, "perguntas.json");
const knowledgePath = path.join(root, "data/knowledge.json");

const data = JSON.parse(fs.readFileSync(perguntasPath, "utf8"));
const fluxo = data.fluxo_carreira_ti_completo;

function slugify(s) {
  const base = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 72);
  return base || "career";
}

function isNextNode(v) {
  if (typeof v === "number") return true;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return true;
  return false;
}

function isLeafCareer(v) {
  return typeof v === "string" && !/^\d+$/.test(v.trim());
}

const leafSet = new Set();
function collectLeaves(nodeKey) {
  const node = fluxo[nodeKey];
  if (!node) return;
  for (const dir of ["sim", "nao", "talvez"]) {
    const next = node[dir];
    if (next === undefined) continue;
    if (isLeafCareer(next)) leafSet.add(next);
    else if (isNextNode(next)) collectLeaves(String(next));
  }
}
collectLeaves("1");

function findPathToCareer(targetCareer, startKey) {
  function dfs(nodeKey, path) {
    const node = fluxo[nodeKey];
    if (!node) return null;
    const qid = `q_fluxo_${nodeKey}`;
    for (const dir of ["sim", "nao", "talvez"]) {
      const next = node[dir];
      if (next === undefined) continue;
      if (isLeafCareer(next)) {
        if (next === targetCareer) return [...path, { qid, dir }];
        continue;
      }
      if (isNextNode(next)) {
        const r = dfs(String(next), [...path, { qid, dir }]);
        if (r) return r;
      }
    }
    return null;
  }
  return dfs(startKey, []);
}

const paths = [];
for (const career of leafSet) {
  const steps = findPathToCareer(career, "1");
  if (!steps) {
    console.error("Sem caminho para:", career);
    continue;
  }
  paths.push({ career, steps });
}

const slugCount = new Map();
const careerIdByName = new Map();
for (const { career } of paths) {
  let slug = slugify(career);
  const n = (slugCount.get(slug) ?? 0) + 1;
  slugCount.set(slug, n);
  if (n > 1) slug = `${slug}_${n}`;
  careerIdByName.set(career, slug);
}

const fluxQuestions = [];
const nodeKeys = Object.keys(fluxo).sort((a, b) => Number(a) - Number(b));
for (const k of nodeKeys) {
  const n = fluxo[k];
  if (!n.pergunta) continue;
  fluxQuestions.push({ id: `q_fluxo_${k}`, text: n.pergunta });
}

const fluxCareers = paths.map(({ career }) => ({
  id: careerIdByName.get(career),
  name: career
}));

let rid = 1;
const fluxRules = [];
for (const { career, steps } of paths) {
  const careerId = careerIdByName.get(career);
  for (const { qid, dir } of steps) {
    const w = dir === "nao" ? -5 : 5;
    fluxRules.push({
      id: `r_fluxo_${rid++}`,
      careerId,
      questionId: qid,
      weight: w
    });
  }
}

const existing = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));

const fluxCareerIds = new Set(paths.map((p) => careerIdByName.get(p.career)));
const baseQuestions = existing.questions.filter((q) => !q.id.startsWith("q_fluxo_"));
const baseRules = existing.rules.filter((r) => !r.id.startsWith("r_fluxo_"));
const baseCareers = existing.careers.filter((c) => !fluxCareerIds.has(c.id));

const merged = {
  questions: [...baseQuestions, ...fluxQuestions],
  careers: [...baseCareers, ...fluxCareers],
  rules: [...baseRules, ...fluxRules]
};

fs.writeFileSync(knowledgePath, JSON.stringify(merged, null, 2));
console.log(
  "Atualizado",
  knowledgePath,
  "→",
  merged.questions.length,
  "perguntas,",
  merged.careers.length,
  "carreiras,",
  merged.rules.length,
  "regras"
);
