# Career Compass

Sistema especialista para carreiras em TI com **encadeamento para frente** (fatos → regras → evidências por carreira), **próxima pergunta escolhida por entropia** e **API no servidor**:

- **Encadeamento para frente**: cada resposta satisfez premissas de regras em `data/knowledge.json` (e regras moderadas no MongoDB); a resposta da API inclui `cadeiaInferencia` com a ordem dos disparos.
- **Seleção por entropia**: entre perguntas ainda não respondidas, escolhe a que minimiza a entropia esperada da distribuição sobre as carreiras (prior Sim / Não / Talvez).
- **Pesos e ranking**: Sim = +peso, Não = −peso, Talvez = fração do peso; o top 4 usa scores normalizados e probabilidades derivadas.
- **Sessão**: estado (`respostas` + `carreiras descartadas`) em **MongoDB** (`QuizSession`) ou **memória** em dev sem `DATABASE_URL`.
- **API do quiz**: `POST /api/quiz` com `action`: `start` | `answer` | `discard`.

Resposta JSON inclui: `proximaPergunta`, `rankingAtual`, `status` (`em_andamento` | `conclusao_encontrada` | `esgotado`), `carreiraProposta`, `cadeiaInferencia`.

## Rotas

### Páginas (App Router)

| Rota     | Descrição                                      |
|----------|------------------------------------------------|
| `/`      | Quiz, resultado e fluxo “ensinar carreira”.    |
| `/admin` | Painel de moderação (token `MODERATOR_TOKEN`). |

`/moderador` redireciona permanentemente para `/admin` (ver `next.config.mjs`).

### API (Route Handlers)

| Método e caminho              | Descrição |
|-------------------------------|-----------|
| `POST /api/quiz`              | Corpo JSON: `{ "action": "start" }`, `{ "action": "answer", "sessionId", "questionId", "answer": "yes"\|"no"\|"maybe" }` ou `{ "action": "discard", "sessionId", "careerId" }`. |
| `POST /api/suggestions`       | Sugestão de carreira + contexto (requer `DATABASE_URL`). |
| `GET /api/moderator/suggestions` | Lista sugestões (header `x-moderator-token`). |
| `POST /api/moderator/suggestions`| `action`: `approve` ou `delete` + `suggestionId`. |

## Estrutura principal do projeto

```text
.
├── app/
│   ├── admin/page.tsx          # Painel /admin
│   ├── api/
│   │   ├── quiz/route.ts       # Motor + sessão
│   │   ├── suggestions/route.ts
│   │   └── moderator/suggestions/route.ts
│   ├── quiz/types.ts         # Tipos compartilhados com a UI do quiz
│   ├── layout.tsx
│   ├── page.tsx              # Home (quiz)
│   └── globals.css
├── components/ui/              # Aurora, Wavy, Button, cn, etc.
├── data/knowledge.json         # Perguntas, carreiras, regras (JSON)
├── lib/
│   ├── inference/
│   │   ├── engine.ts           # Orquestração, entropia, ranking, runEngine
│   │   ├── forward-chaining.ts
│   │   ├── knowledge-repository.ts  # Base efetiva (JSON + Mongo moderador)
│   │   ├── session-store.ts   # QuizSession ou memória
│   │   └── types.ts
│   ├── moderator-auth.ts
│   └── prisma.ts
├── prisma/
│   └── schema.prisma           # MongoDB (Prisma)
├── next.config.mjs
├── package.json
├── tsconfig.json
└── .env.example
```

## Stack, versões e bibliotecas

Requisito de runtime: **Node.js 20+** (alinhado ao motor do Prisma / Next).

Versões abaixo conforme `package.json` (intervalos `^`; o lockfile fixa resolução exata após `npm install`).

| Tecnologia        | Versão (package.json) | Uso |
|-------------------|------------------------|-----|
| **Next.js**       | ^15.2.3               | App Router, SSR/SSG, API Routes |
| **React**         | ^19.0.0               | UI |
| **React DOM**     | ^19.0.0               | |
| **TypeScript**    | ^5.8.2                | Tipagem |
| **Prisma**        | ^6.3.1 (`prisma` + `@prisma/client`) | ORM, MongoDB |
| **Tailwind CSS**  | ^3.4.17               | Estilos |
| **PostCSS**       | ^8.5.3                | Pipeline CSS |
| **Autoprefixer**  | ^10.4.21              | Prefixos CSS |
| **Framer Motion** | ^12.6.4               | Animações (quiz / fundo) |
| **clsx**          | ^2.1.1                | Classes condicionais |
| **tailwind-merge**| ^3.3.0                | Merge de classes Tailwind |
| **ESLint**        | ^9.22.0               | Lint |
| **eslint-config-next** | ^15.2.3          | Regras Next |

Tipos: `@types/node` ^22.13.10, `@types/react` ^19.0.12, `@types/react-dom` ^19.0.4.

### Referências conceituais

- Sistemas especialista baseados em regras e **encadeamento para frente** (working memory = respostas; regra dispara se a premissa correspondente está satisfeita).
- **Ganho de informação / entropia** na escolha da próxima pergunta (reduzir incerteza sobre hipóteses = carreiras).
- **Prisma + MongoDB**: [Connection URLs MongoDB](https://www.prisma.io/docs/orm/overview/databases/mongodb), [Prisma Client](https://www.prisma.io/docs/orm/prisma-client).
- **Next.js App Router**: [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers), [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables).

## Conhecimento

- Fonte: `data/knowledge.json` — `questions`, `careers` e `rules` (uma regra liga `careerId` + `questionId` com `weight`).
- Conteúdo moderado: modelos `ModeratorCareer` e `ModeratorRule` no `schema.prisma`, mesclados em `getEffectiveKnowledgeBase()`.

## Rodar localmente

Requisitos: Node.js 20+, MongoDB Atlas (recomendado) e `DATABASE_URL` no `.env`.

```bash
cp .env.example .env
# Cole DATABASE_URL e, para /admin, MODERATOR_TOKEN

npm install
npx prisma db push
npm run dev
```

Sem `DATABASE_URL`, o quiz usa **sessão em memória** (perdida ao reiniciar o servidor); **sugestões** e **painel admin** ainda exigem MongoDB.

## Variáveis

| Variável          | Uso |
|-------------------|-----|
| `DATABASE_URL`    | MongoDB (sessões, sugestões, moderação) |
| `MODERATOR_TOKEN` | Token para `GET`/`POST` `/api/moderator/suggestions` e campo na UI `/admin` (header `x-moderator-token`) |

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure `DATABASE_URL` e `MODERATOR_TOKEN` no painel.
3. Rode `npx prisma db push` uma vez contra o cluster (local ou CI).

## Scripts

```bash
npm run dev        # desenvolvimento
npm run dev:fresh  # apaga .next e sobe o dev (cache)
npm run build      # prisma generate + next build
npm run start      # produção (após build)
npm run lint       # ESLint
npm run typecheck  # prisma generate + tsc --noEmit
npm run db:push    # sincroniza schema Prisma → MongoDB
```
