# Spaced — Agent Instructions

## Project maintenance

After completing any task, update `NEXT_STEPS.md` to reflect the current state: remove completed items (unless there are next steps), add newly discovered work, and keep the Current State file tree accurate.

## Tech stack
- **Monorepo:** pnpm workspaces + Turbo (`packages/*`, `infra/`)
- **Runtime:** Node.js 22, TypeScript (ESM), `tsx` for local dev
- **Env management:** `dotenvx` — layered `.env` (committed defaults) + `.env.local`/`.env.dev`/`.env.prod` (gitignored secrets)
- **Roomy SDK:** `@roomy/sdk` via `file:/Users/davis/github.com/muni-town/roomy/packages/sdk` — not on npm; this path is the local clone

