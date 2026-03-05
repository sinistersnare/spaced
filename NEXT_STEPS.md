# Spaced — Statement of Intent & Next Steps

## What This Is

**Spaced** is a sovereign educational hub built on top of [Roomy](https://github.com/muni-town/roomy)
and the AT Protocol. Unlike Canvas or Moodle, a student's grades, assignments, and credentials live
on their own Personal Data Server (PDS) — they own them, and they take them if they leave.

The platform has two roles:

- **Teachers** — can start lectures, assign lessons, and issue signed grade records
- **Students** — can submit work for automated testing, receive grades, and maintain a portable academic record

---

## Current State

```
README.md                   — getting started guide

packages/lab-bridge/
├── src/
│   ├── env.ts              — environment variable declarations (PDS_URL, LEAF_URL, etc.)
│   ├── constants.ts        — NSID strings for edu.roomy.* record types
│   ├── index.ts            — entry point (HTTP health route + HubOrchestrator start)
│   ├── HubOrchestrator.ts  — event loop using real @roomy/sdk API (joinSpace, subscribe, createMessage)
│   ├── roomy/client.ts     — ATProto + RoomyClient init; session persistence to session.json
│   ├── roles/permissions.ts — teacher/student role checking (file-backed JSON)
│   ├── lexicons/
│   │   ├── lesson.ts       — edu.roomy.lesson record type
│   │   ├── assignment.ts   — edu.roomy.assignment record type
│   │   ├── verification.ts — edu.roomy.verification record type
│   │   └── labSession.ts   — edu.roomy.labSession record type
│   └── commands/
│       ├── submit.ts       — /submit <commithash> handler (writes to bot PDS via AtpAgent)
│       ├── lecture.ts      — /lecture [lessonUri] handler
│       └── grade.ts        — /grade <assignmentUri> <grade> [feedback] handler
├── Dockerfile              — multi-stage build (tsc → node:22-alpine runtime)

infra/
├── Caddyfile               — local HTTPS reverse proxy (localhost → PDS, app.localhost → Leaf/PLC/app)
├── compose.yml             — full local dev stack (Caddy, PDS, PLC directory, Leaf server)
├── compose.prod.yml        — production skeleton (lab-bridge → external managed services)
├── pds/                    — @atproto/pds wrapper for the local PDS container
│   ├── package.json
│   └── index.mjs           — env vars injected by compose.yml, no .env needed
└── scripts/
    └── setup-local.sh      — creates roomy-dev network, starts infra, provisions bot/teacher/student accounts
```

**Local dev workflow:**
```bash
cd infra && pnpm setup        # one-time: create network, start infra, create accounts
pnpm turbo compose:up         # daily: start infra stack
cd ~/github.com/muni-town/roomy && pnpm dev  # start Roomy web app (separate repo)
pnpm --filter lab-bridge dev  # start the bot
```

**SDK:** `@roomy/sdk` via `file:` reference to local `~/github.com/muni-town/roomy/packages/sdk`.
Not published to npm — for Docker builds, replace with a `git+https://` reference.

**Environment management:** `dotenvx` with layered env files:
- `packages/lab-bridge/.env` — committed defaults (non-secret)
- `packages/lab-bridge/.env.local` / `.env.dev` / `.env.prod` — gitignored overrides

---

## What Needs to Be Done Next (in priority order)

### 1. Delegated PDS writes for student records — HIGH PRIORITY

Currently `handleSubmit` writes `edu.roomy.assignment` records to the **bot's** PDS.
For true data sovereignty, records should live on the **student's** PDS.

**Options (cheapest to most sovereign):**
1. Bot writes to its own PDS, records reference `studentDid` by field — simplest, no auth required
2. Student sends a one-time token to the bot via DM — semi-manual, not scalable
3. Full ATProto OAuth2 delegated write — correct long-term solution, requires building an OAuth consent flow

**Decision needed from project owner** before implementing.

---

### 2. Fix `/grade` — `lessonUri` placeholder — BLOCKING

`grade.ts:43` has a hardcoded `at://todo/lookup-from-assignment` placeholder for `lessonUri`.
Every verification record written by `/grade` currently contains a bogus AT-URI, making the
command non-functional in practice.

**Action:** Fetch the assignment record via `ctx.agent.api.com.atproto.repo.getRecord`, read its
`lessonUri` field, and use that in the verification record.

**Files to change:** `src/commands/grade.ts`

---

### 3. OpenClaw integration — HIGH PRIORITY

`handleSubmit` queues a lab session but doesn't actually call anything. OpenClaw (or whatever
the sandbox runner is) needs to be integrated here.

**Unknowns:**
- What is the OpenClaw API surface? (HTTP? gRPC? CLI?)
- What does a "run tests on this commit" request look like?
- How does OpenClaw return results? (webhook? polling?)

**Action:** Define `src/openclaw/client.ts`, implement once API is known, wire into `handleSubmit`.

---

### 4. Lecture command — design decision needed

`/lecture <lessonUri>` currently just sets an in-memory active lesson for the channel.

**Options:**
- (a) Just the in-memory lesson context (current) — useful but minimal
- (b) Create a Roomy page/thread pinned in the channel with lesson markdown
- (c) Call a Zoom API to create a meeting and post the link
- (d) b + c

---

### 5. Teacher admin API

`roles/permissions.ts` grants/revokes teacher status but there's no HTTP endpoint.
Add a small admin API protected by a secret token (itty-router + @whatwg-node/server already in deps).

**Files to create:** `src/api.ts`

---

### 6. Lesson management commands

- `/lesson create <title>`
- `/lesson list`
- `/lesson show <uri>`

---

### 7. Publish / pin `@roomy/sdk`

The `file:` reference means Docker builds require a manual swap.
Once `@roomy/sdk` is published or tagged, update `packages/lab-bridge/package.json`.

---

### 8. Observability stack for local dev — FUTURE INFRA IMPROVEMENT

The Grafana stack (Loki, Tempo, Mimir, Pyroscope, Alloy) used in the roomy caddy branch
would be valuable for debugging the bot in local dev. Add it to `infra/compose.yml` behind a
`--profile observability` flag and add a `compose:observability` script to `infra/package.json`.

---

### 9. Self-hosted production infra — DEFERRED

`infra/compose.prod.yml` currently only runs lab-bridge, pointing at external managed services
(bsky.social PDS, leaf-dev.muni.town Leaf). A fully self-hosted production setup would add PDS,
PLC, Leaf, and Caddy to the prod compose with production-grade secrets and volumes.

---

### 10. Custom Leaf plugin (Rust) — DEFERRED

For stream-level access control or per-role event filtering we'd need to fork
[leaf](https://github.com/muni-town/leaf) and build a custom Docker image.

---

## Environment Setup

`packages/lab-bridge/.env` is committed with safe defaults. Create `.env.local` for secrets
(output by `infra/scripts/setup-local.sh` after running `pnpm setup` from `infra/`):

```env
BOT_DID=did:plc:...
BOT_APP_PASSWORD=password123
PDS_URL=http://localhost:2583
LEAF_URL=https://app.localhost/leaf
LEAF_SERVER_DID=did:web:app.localhost
SPACE_DIDS=did:plc:...   # DID of a space created in the Roomy web app
```

---

## Architecture Diagram

```
 Student / Teacher
       │
       │  Roomy web app (app.localhost)
       ▼
 ┌─────────────────────┐
 │   Roomy Space       │  ←── messages, threads, reactions
 │   (one per course)  │
 └─────────┬───────────┘
           │ Leaf event stream
           ▼
 ┌─────────────────────┐
 │  HubOrchestrator    │  ←── watches for /submit /lecture /grade
 │  (lab-bridge)       │
 └──┬──────────┬───────┘
    │          │
    │          │ write records
    ▼          ▼
 OpenClaw   ATProto PDS
 (sandbox)  (edu.roomy.* records)
    │          │
    │ results  │ student's portable
    └──────────┘ academic record
```

## Key constraints
- `@roomy/sdk` is a `file:` reference — Docker builds will fail unless replaced with a `git+https://` ref
- The local roomy repo (`~/github.com/muni-town/roomy`) is on the `caddy` branch
- Secrets (`BOT_APP_PASSWORD`, etc.) must never be committed; `.gitignore` covers `*.env.*`
