export type Answer = "yes" | "no" | "maybe";

export interface Fato {
  id: string;
  descricao: string;
}

export interface Condicao {
  fatoId: string;
  valor: Answer;
}

export interface Regra {
  id: string;
  nome: string;
  if: Condicao[];
  then: {
    carreira: string;
  };
}

export const fatosIniciais: Fato[] = [
  { id: "likes_ui", descricao: "Gosta de construir interfaces (UI)?" },
  { id: "likes_data", descricao: "Gosta de trabalhar com dados, estatística e modelagem?" },
  { id: "likes_security", descricao: "Curte investigação, proteção e segurança de sistemas?" }
];

export const regrasIniciais: Regra[] = [
  {
    id: "R1",
    nome: "Front-end",
    if: [{ fatoId: "likes_ui", valor: "yes" }],
    then: { carreira: "Front-end" }
  },
  {
    id: "R2",
    nome: "Data Science",
    if: [{ fatoId: "likes_data", valor: "yes" }],
    then: { carreira: "Data Science" }
  },
  {
    id: "R3",
    nome: "Cyber Security",
    if: [{ fatoId: "likes_security", valor: "yes" }],
    then: { carreira: "Cyber Security" }
  }
];

