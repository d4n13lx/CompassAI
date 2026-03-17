import type { Answer, Regra } from "@/constants/knowledgeBase";

export type FatosColetados = Record<string, Answer>;

export type DisparoDeRegra = {
  regraId: string;
  regraNome: string;
  carreira: string;
};

export function forwardChainingInfer({
  regras,
  fatos
}: {
  regras: Regra[];
  fatos: FatosColetados;
}): { carreira?: string; fired: DisparoDeRegra[] } {
  const fired: DisparoDeRegra[] = [];
  const firedSet = new Set<string>();

  // Forward chaining "simples": dispara regras cujas condições estão satisfeitas.
  // Aqui o "then" conclui uma carreira final, então paramos na primeira conclusão.
  let progress = true;
  while (progress) {
    progress = false;

    for (const regra of regras) {
      if (firedSet.has(regra.id)) continue;

      const ok = regra.if.every((c) => fatos[c.fatoId] === c.valor);
      if (!ok) continue;

      firedSet.add(regra.id);
      fired.push({
        regraId: regra.id,
        regraNome: regra.nome,
        carreira: regra.then.carreira
      });
      progress = true;

      if (regra.then.carreira) {
        return { carreira: regra.then.carreira, fired };
      }
    }
  }

  return { fired };
}

