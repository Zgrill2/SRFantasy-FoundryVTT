# Shimmering Reach — FoundryVTT system

A d6 dicepool fantasy RPG system for FoundryVTT **v14**.

## Development

Requires Node 20+, Docker, and a foundryvtt.com account (the container downloads Foundry
using your credentials).

```bash
npm install
cp .env.example .env        # fill in your foundryvtt.com credentials
npm run build               # once, BEFORE the first `docker compose up`
docker compose up           # Foundry at http://localhost:30000
```

Then, in a second terminal:

```bash
npm run dev                 # vite --watch + tsc --watch
```

Edit code → Vite rewrites `dist/` → refresh the browser (F5).

`dist/` **is** the system folder: Docker bind-mounts it straight into the container at
`Data/systems/shimmeringreach`. Build once before the first `docker compose up`, or Docker
will create `dist/` as a root-owned empty directory and you'll spend an afternoon on
permissions.

### Scripts

| | |
|---|---|
| `npm run dev` | Vite watch + TypeScript watch, together. The everyday loop. |
| `npm run build` | One-off production build into `dist/`. |
| `npm run typecheck` | `tsc --noEmit`. Vite does **not** typecheck. |
| `npm test` | Vitest over the pure rules/chat cores. |
| `npm run lint` | ESLint. |

## Architecture

Game math and chat-card state transitions are **pure functions with no Foundry imports**:

- `src/module/rules/` — dicepools, soaks, defenses, wound penalties, damage splits, the
  initiative-pass scan.
- `src/module/chat/{recompute,mutations}.ts` — chat-card state is a reducer over plain data.

They're unit-tested in Vitest without booting Foundry. Only thin effectful shells
(`chat/handlers.ts`, `chat/render.ts`, `documents/`) touch Foundry documents. Keeping the
rules pure is what makes full rules-enforcement tractable later.

`src/module/config.ts` is the single source of truth for the game's nouns — abilities,
skills, groups, defenses, soaks, shields. Schemas, sheets, and the bonus system all derive
their key sets from it.

### Two things that will silently break the system

1. **`build.minify` must stay `false`** (`vite.config.ts`). `Roll.fromData` resolves dice
   subclasses by their *class name string*. Minify renames `RollDP` and every chat card
   fails to rehydrate — with no error.
2. **Chat-card state lives in `ChatMessage.flags.shimmeringreach`, and the HTML is a pure
   render of it.** Never patch card DOM in place; mutate the flags and re-render.
