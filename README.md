# Career Compass

Sistema especialista para carreiras em TI com **motor probabilístico no servidor**:

- **Seleção de perguntas por entropia**: a cada estado, escolhe a pergunta não respondida que minimiza a entropia esperada da distribuição sobre as carreiras (prior sim/não/talvez).
- **Pesos e normalização**: Sim = +peso, Não = −peso, Talvez = fração do peso. A probabilidade exibida no top 4 vem de scores normalizados (**score atual ÷ soma dos pesos das regras da carreira**) para reduzir viés de carreiras com mais regras.
- **Sessão**: estado (`respostas` + `carreiras descartadas`) em **MongoDB** (`QuizSession`) ou memória em dev sem `DATABASE_URL`.
- **API única**: `POST /api/quiz` com `action`: `start` | `answer` | `discard`.

Resposta JSON inclui: `proximaPergunta`, `rankingAtual` (top 4 com %), `status` (`em_andamento` | `conclusao_encontrada` | `esgotado`), `carreiraProposta` quando aplicável.

## Conhecimento

- Fonte: `data/knowledge.json` — `questions`, `careers` e `rules` (uma regra liga `careerId` + `questionId` com `weight`; uma resposta afeta várias carreiras via várias regras).

## Rodar localmente

Requisitos: Node.js 20+, MongoDB Atlas (recomendado) e `DATABASE_URL` no `.env`.

```bash
cp .env.example .env
# Cole DATABASE_URL

npm install
npx prisma db push
npm run dev
```

Sem `DATABASE_URL`, o quiz usa **sessão em memória** (perdida ao reiniciar o servidor); sugestões para o moderador ainda exigem MongoDB.

## Variáveis

| Variável        | Uso                          |
|----------------|------------------------------|
| `DATABASE_URL` | MongoDB (sessões + sugestões) |

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure `DATABASE_URL` (Atlas: Network Access `0.0.0.0/0` ou IP da Vercel).
3. Rode `npx prisma db push` uma vez contra o cluster (local ou CI).

## Scripts

```bash
npm run dev        # desenvolvimento
npm run dev:fresh  # apaga .next e sobe o dev (cache)
npm run build      # prisma generate + next build
npm run db:push    # sincroniza schema Prisma → MongoDB
```
