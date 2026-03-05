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

infra/
├── compose.yml             — local dev compose (reads .env + .env.local)
└── compose.prod.yml        — production compose skeleton (env vars injected externally)

packages/lab-bridge/Dockerfile  — multi-stage build (tsc → node:22-alpine runtime)
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

**Action:** After writing the assignment record (or via a PDS lookup), derive `lessonUri` from
the actual `edu.roomy.assignment` record at `assignmentUri`. This requires fetching the record
via `ctx.agent.api.com.atproto.repo.getRecord` (or equivalent), then reading its `lessonUri` field.

**Files to change:** `src/commands/grade.ts`

---

### 3. OpenClaw integration — HIGH PRIORITY

`handleSubmit` queues a lab session but doesn't actually call anything. OpenClaw (or whatever
the sandbox runner is) needs to be integrated here.

**Unknowns:**
- What is the OpenClaw API surface? (HTTP? gRPC? CLI?)
- What does a "run tests on this commit" request look like?
- How does OpenClaw return results? (webhook? polling?)
- Does it need a repo URL, or just a commit hash + git remote?

**Action:** Define the OpenClaw client interface in `src/openclaw/client.ts`, implement it once
the API is known, and wire it into `handleSubmit`.

**Files to create:** `src/openclaw/client.ts`, `src/openclaw/types.ts`

---

### 4. Lecture command — design decision needed

`/lecture <lessonUri>` currently just sets an in-memory active lesson for the channel.

**Options:**
- (a) Just the in-memory lesson context (current) — useful but minimal
- (b) Create a Roomy page/thread pinned in the channel containing the lesson markdown
- (c) Call a Zoom API to create a meeting and post the link as a pinned message
- (d) b + c

**Action:** Decide what `/lecture` should do. For (c), a Zoom OAuth app is needed. For (b),
check how Roomy pages/threads are created in `@roomy/sdk`.

---

### 5. Teacher admin API

`roles/permissions.ts` grants/revokes teacher status but there's no HTTP endpoint to trigger it.
Add a small admin API protected by a secret token (`itty-router` + `@whatwg-node/server` are
already in `package.json`).

**Files to create:** `src/api.ts`

---

### 6. Lesson management commands

Teachers need a way to create and list lessons without manually crafting AT-URIs.

**Commands to add:**
- `/lesson create <title>`
- `/lesson list`
- `/lesson show <uri>`

---

### 7. Publish / pin `@roomy/sdk`

The `file:` reference to the local roomy repo means Docker builds require a manual swap.
Once `@roomy/sdk` is published to npm (or a stable git tag exists), update
`packages/lab-bridge/package.json` and remove the workaround comment from the Dockerfile.

---

### 8. Custom Leaf plugin (Rust) — DEFERRED

For stream-level access control or per-role event filtering we'd need to fork
[leaf](https://github.com/muni-town/leaf) and build a custom Docker image.

**Deferred** until it's clear what behavior belongs at the Leaf layer vs. lab-bridge.

---

## Environment Setup

`packages/lab-bridge/.env` is committed with safe defaults. Create `.env.local` for secrets:

```env
BOT_DID=did:plc:yourbot
BOT_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SPACE_DIDS=did:plc:yourspace
```

**For the local caddy stack** (user's `caddy` branch of roomy — self-hosted PDS + Leaf):
```env
PDS_URL=http://localhost:2583
LEAF_URL=https://app.localhost/leaf
LEAF_SERVER_DID=did:web:app.localhost
```

Run dev with: `pnpm --filter lab-bridge dev`
Run via compose: `cd infra && pnpm compose:up` (or `pnpm turbo compose:up` from root)

---

## Architecture Diagram

```
 Student / Teacher
       │
       │  Roomy (AT Protocol + Leaf)
       ▼
 ┌─────────────────────┐
 │   Roomy Space       │  ←── messages, threads, reactions
 │   (one per course)  │
 └─────────┬───────────┘
           │ event stream
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


## Added by Davis

The following was added by Claude into CLAUDE.md, but they seem like good things to keep in mind for what we need to work on to get this ready for prime-time.

## Key constraints
- `@roomy/sdk` is a `file:` reference — Docker builds will fail unless replaced with a `git+https://` ref
- The local roomy repo (`~/github.com/muni-town/roomy`) is on the `caddy` branch, which adds a self-hosted PDS + Leaf via Caddy
- Secrets (`BOT_APP_PASSWORD`, etc.) must never be committed; `.gitignore` covers `*.env.*`
