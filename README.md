# Spaced

Educational hub bot built on [Roomy](https://github.com/muni-town/roomy) and AT Protocol.
Students and teachers interact via Roomy chat; the bot handles `/submit`, `/grade`, and `/lecture` commands and writes portable academic records to ATProto PDS.

## Prerequisites

- Docker + Docker Compose
- Node.js 22, pnpm 10 (`corepack enable`)
- `jq` and `curl` (for the setup script)
- The roomy repo cloned at `~/github.com/muni-town/roomy` on the `caddy` branch:
  ```
  git clone https://github.com/muni-town/roomy ~/github.com/muni-town/roomy
  cd ~/github.com/muni-town/roomy && git checkout caddy
  ```

## Setup (one-time)

```bash
git clone https://github.com/sinistersnare/spaced
cd spaced
pnpm install

# Start infrastructure and create local accounts
cd infra && pnpm setup
```

The setup script starts Caddy, PDS, PLC directory, and Leaf server, then creates three local accounts (`spaced-bot`, `teacher`, `student`) and prints the credentials. Copy the output block into `packages/lab-bridge/.env.local`:

```
BOT_DID=did:plc:...
BOT_APP_PASSWORD=password123
PDS_URL=http://localhost:2583
LEAF_URL=https://app.localhost/leaf
LEAF_SERVER_DID=did:web:app.localhost
```

You also need a `SPACE_DIDS` — the DID of a Roomy space to watch. Create one in the Roomy web app after completing the steps below, then add it to `.env.local`.

Trust the local Caddy CA cert (enables `https://localhost` and `https://app.localhost`):

```bash
# from infra/
docker compose exec caddy caddy trust
```

## Running

Three processes, three terminals:

```bash
# 1. Infrastructure (from repo root or infra/)
pnpm turbo compose:up

# 2. Roomy web app (separate repo)
cd ~/github.com/muni-town/roomy && pnpm install && pnpm dev

# 3. Bot
pnpm --filter lab-bridge dev
```

## URLs

| Service | URL |
|---|---|
| Roomy web app | https://app.localhost |
| PDS | https://localhost |
| Leaf server | http://localhost:5530 |

## Bot commands

In any Roomy space the bot is watching:

| Command | Who | What |
|---|---|---|
| `/submit <commithash>` | Student | Submit work for grading |
| `/lecture [lessonUri]` | Teacher | Start a lecture session |
| `/grade <assignmentUri> <grade> [feedback]` | Teacher | Issue a grade record |
