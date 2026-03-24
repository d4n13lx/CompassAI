# Career Compass
![Career Compass — início / landing](assets/1.png)

Sistema especialista para carreiras em TI com **encadeamento para frente** (fatos → regras → evidências por carreira), **próxima pergunta escolhida por entropia** e **API no servidor**:

- **Encadeamento para frente**: cada resposta satisfez premissas de regras em `data/knowledge.json` (e regras moderadas no MongoDB). O motor mantém a cadeia completa no servidor; na rede, o `POST /api/quiz` envia só o necessário (ver abaixo). Fatos resumidos (`cadeiaResumo`: pergunta + resposta) vêm opcionalmente ou via `GET /api/quiz/reasoning`.
- **Seleção por entropia**: entre perguntas ainda não respondidas, escolhe a que minimiza a entropia esperada da distribuição sobre as carreiras (prior Sim / Não / Talvez).
- **Pesos e ranking**: Sim = +peso, Não = −peso, Talvez = fração do peso;
- **Sessão**: estado (`respostas` + `carreiras descartadas`) em **MongoDB** (`QuizSession`). Em **Vercel** (ou qualquer ambiente serverless) é **obrigatório** `DATABASE_URL` apontando para um MongoDB acessível: sessões só em memória **não** funcionam entre requisições (cada instância tem seu próprio processo).
- **API do quiz**: `POST /api/quiz` com `action`: `start` | `answer` | `discard`. Opcional em qualquer ação: `includeReasoning: true` para incluir `cadeiaResumo` (fatos deduplicados) na mesma resposta.

Resposta JSON compacta do `POST`: `sessionId`, `proximaPergunta`, `rankingAtual` (top 4, sem score bruto), `status`, `carreiraProposta`; `cadeiaResumo` só se `includeReasoning` for `true`. Para carregar fatos e ranking após o fluxo normal, use `GET /api/quiz/reasoning?sessionId=...`.

![Career Compass — quiz / interface](assets/2.png)

## Rotas

### Páginas (App Router)

| Rota     | Descrição                                      |
|----------|------------------------------------------------|
| `/`      | Quiz, resultado e fluxo “ensinar carreira”.    |
| `/admin` | Painel de moderação (token `MODERATOR_TOKEN`). |

### API (Route Handlers)

| Método e caminho              | Descrição |
|-------------------------------|-----------|
| `POST /api/quiz`              | Corpo JSON: `{ "action": "start" }`, `{ "action": "answer", "sessionId", "questionId", "answer": "yes"\|"no"\|"maybe" }` ou `{ "action": "discard", "sessionId", "careerId" }`. Opcional: `includeReasoning: true`. |
| `GET /api/quiz/reasoning`     | Query `sessionId`: devolve `cadeiaResumo` e `rankingAtual` compactos para a sessão (útil para “Ver Raciocínio” sem inflar cada POST). |
| `POST /api/suggestions`       | Sugestão de carreira + contexto (requer `DATABASE_URL`). |
| `GET /api/moderator/suggestions` | Lista sugestões (header `x-moderator-token`). |
| `POST /api/moderator/suggestions`| `action`: `approve` ou `delete` + `suggestionId`. |
| `GET /api/moderator/rules`      | Lista carreiras moderadas, regras e opções de pergunta (mesmo header). |
| `PATCH /api/moderator/rules`    | `{ "ruleId", "weight" }` (inteiro −50…50). |
| `POST /api/moderator/rules`     | `{ "careerId", "questionId", "weight" }` (cria ou atualiza par único). |
| `DELETE /api/moderator/rules`   | Query `ruleId`. |

## Estrutura principal do projeto

```text
.
├── assets/                     # Screenshots .png para documentação (README)
├── app/
│   ├── admin/
│   │   └── page.tsx            # Painel /admin
│   ├── api/
│   │   ├── quiz/
│   │   │   ├── route.ts        # POST: motor + sessão (payload compacto)
│   │   │   └── reasoning/
│   │   │       └── route.ts    # GET: cadeiaResumo + ranking para sessionId
│   │   ├── suggestions/
│   │   │   └── route.ts
│   │   └── moderator/
│   │       ├── suggestions/
│   │       │   └── route.ts
│   │       └── rules/
│   │           └── route.ts    # GET/PATCH/POST; DELETE ?ruleId=
│   ├── quiz/
│   │   └── types.ts            # Tipos da UI / contrato do quiz na rede
│   ├── layout.tsx
│   ├── page.tsx                # Home (quiz)
│   └── globals.css
├── components/ui/              # Aurora, Wavy, Button, cn, etc.
├── data/
│   └── knowledge.json          # Perguntas, carreiras, regras (JSON)
├── perguntas.json              # Árvore de decisão (fundida em knowledge via merge:knowledge)
├── scripts/
│   └── merge-perguntas-into-knowledge.mjs
├── lib/
│   ├── quiz/
│   │   └── wire-payload.ts     # Serialização compacta (cadeiaResumo, ranking)
│   ├── inference/
│   │   ├── engine.ts           # Orquestração, entropia, ranking, runEngine
│   │   ├── forward-chaining.ts
│   │   ├── knowledge-repository.ts  # Base efetiva (JSON + Mongo moderador)
│   │   ├── session-store.ts    # QuizSession ou memória
│   │   └── types.ts
│   ├── moderator-auth.ts
│   ├── prisma.ts
│   └── with-timeout.ts         # Timeouts em chamadas Prisma (sessão, etc.)
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
| **React/DOM**         | ^19.0.0               | UI |
| **TypeScript**    | ^5.8.2                | Tipagem |
| **Prisma**        | ^6.3.1 (`prisma` + `@prisma/client`) | ORM, MongoDB |
| **Tailwind CSS**  | ^3.4.17               | Estilos |
| **PostCSS**       | ^8.5.3                | Pipeline CSS |
| **Autoprefixer**  | ^10.4.21              | Prefixos CSS |
| **Framer Motion** | ^12.6.4               | Animações (quiz / fundo) |
| **clsx**          | ^2.1.1                | Classes condicionais |

Tipos: `@types/node ^22.13.10`, `@types/react ^19.0.12`, `@types/react-dom ^19.0.4`.

## Conhecimento

- Fonte: `data/knowledge.json` — `questions`, `careers` e `rules` (uma regra liga `careerId` + `questionId` com `weight`).
- O ficheiro `perguntas.json` (árvore `sim`/`nao`/`talvez`) é fundido na base com `npm run merge:knowledge`, que gera `q_fluxo_*`, carreiras-folha e `r_fluxo_*` a partir de um caminho por carreira.
- Conteúdo moderado: modelos `ModeratorCareer` e `ModeratorRule` no `schema.prisma`, mesclados em `getEffectiveKnowledgeBase()`.

## Rodar localmente

Requisitos: Node.js 20+, MongoDB Atlas (recomendado) e `DATABASE_URL` no `.env`.
```
git clone https://github.com/d4n13lx/CompassAI.git
```
### Windows
```bash
copy .env.example .env

npm install
npx prisma db push
npm run dev
```
### Linux
```bash
cp .env.example .env

npm install
npx prisma db push
npm run dev
```

## Variáveis de Ambiente

| Variável          | Uso |
|-------------------|-----|
| `DATABASE_URL`    | MongoDB (sessões, sugestões, moderação) |
| `MODERATOR_TOKEN` | Token para rotas `/api/moderator/*` e UI `/admin` (header `x-moderator-token`) |

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure `DATABASE_URL` e `MODERATOR_TOKEN` no painel (**Environment**: Production e Preview, se usar deploy de branch).
3. Rode `npx prisma db push` uma vez contra o cluster (local ou CI) para criar coleções (`QuizSession`, etc.).

### Se `POST /api/quiz` retornar 500

- **MongoDB inacessível**: string `DATABASE_URL` errada, usuário/senha, ou IP bloqueado no Atlas (**Network Access** → permitir `0.0.0.0/0` para testar).
- **Schema não aplicado**: sem `db push`, o `create` em `QuizSession` pode falhar.
- **Resposta JSON**: o corpo costuma trazer `error` com uma dica (a Vercel também mostra o stack em *Functions → Logs*).

## Scripts

```bash
npm run dev        # desenvolvimento
npm run dev:fresh  # apaga .next e sobe o dev (cache)
npm run build      # prisma generate + next build
npm run start      # produção (após build)
npm run lint       # ESLint
npm run typecheck  # prisma generate + tsc --noEmit
npm run db:push    # sincroniza schema Prisma → MongoDB
npm run merge:knowledge  # funde perguntas.json → data/knowledge.json
```
