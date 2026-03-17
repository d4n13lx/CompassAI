# Career Compass

Front-end (Next.js App Router) de um sistema especialista para descoberta de carreiras em TI, usando encadeamento para frente (forward chaining) e motor de explicação.

## Rodar localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

## O que já está pronto

- Home → Quiz → Resultado em uma única página (`app/page.tsx`)
- UI com Tailwind + Framer Motion e fundos estilo Aceternity (`components/ui/*`)
- Base de conhecimento inicial (`constants/knowledgeBase.ts`)
- Forward chaining simples + “Ver Raciocínio”
- “Ensinar” uma carreira quando não inferir (persistência via LocalStorage)

## Publicação no GitHub Pages (sem subpath)

Para publicar sem subpath, o repositório precisa se chamar **`d4n13lx.github.io`** (GitHub Pages “User site”).

