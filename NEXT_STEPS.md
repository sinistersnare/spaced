# Spaced — Statement of Intent & Next Steps

## What This Is

**Spaced** is a sovereign educational hub built on top of [Roomy](https://github.com/muni-town/roomy)
and the AT Protocol. Unlike Canvas or Moodle, a student's grades, assignments, and credentials live
on their own Personal Data Server (PDS) — they own them, and they take them if they leave.

The platform has two roles:

- **Teachers** — can start lectures, assign lessons, and issue signed grade records
- **Students** — can submit work for automated testing, receive grades, and maintain a portable academic record

---

## Current State (what exists in this repo)

```
packages/lab-bridge/
├── src/
│   ├── env.ts              — environment variable declarations
│   ├── constants.ts        — NSID strings for edu.roomy.* record types
│   ├── index.ts            — entry point
│   ├── HubOrchestrator.ts  — main event loop (STUB — see below)
│   ├── roomy/client.ts     — ATProto + Roomy client init (copy of discord-bridge pattern)
│   ├── roles/permissions.ts — teacher/student role checking (file-backed JSON)
│   ├── lexicons/
│   │   ├── lesson.ts       — edu.roomy.lesson record type
│   │   ├── assignment.ts   — edu.roomy.assignment record type
│   │   ├── verification.ts — edu.roomy.verification record type
│   │   └── labSession.ts   — edu.roomy.labSession record type
│   └── commands/
│       ├── submit.ts       — /submit <commithash> handler
│       ├── lecture.ts      — /lecture [lessonUri] handler
│       └── grade.ts        — /grade <assignmentUri> <grade> [feedback] handler
```

---

## What Needs to Be Done Next (in priority order)

### 1. Wire the Roomy SDK event subscription — BLOCKING

`HubOrchestrator.ts` has a stub for `client.connectSpace()` and `space.on("message:create", ...)`.
**These method names are guesses based on reading the discord-bridge source.** Before anything else
works, the real API needs to be established.

**Action:** Read `packages/sdk/src/client/RoomyClient.ts` and `packages/sdk/src/connection/ConnectedSpace.ts`
in the [roomy repo](https://github.com/muni-town/roomy) and replace the stubs in `HubOrchestrator.ts`
with the real SDK calls. Also figure out how to post a reply message back into a room — the equivalent
of `bot.helpers.sendMessage` in the discord-bridge.

**Files to change:** `src/HubOrchestrator.ts`, possibly `src/commands/*.ts`

---

### 2. Sending messages back to Roomy — BLOCKING

The `HubOrchestrator.onMessage` handler currently logs replies to the console. It needs to call
the correct `@roomy/sdk` API to post a text message into the originating room.

**Action:** Find how `discord-bridge/src/roomy/from.ts` (or the discord-bridge services) write
messages into Roomy, and replicate the pattern for bot replies.

---

### 3. Delegated PDS writes for student records — HIGH PRIORITY

Currently `handleSubmit` writes the `edu.roomy.assignment` record to the **bot's** PDS under the
student's DID. For true data sovereignty, this record should live on the **student's** PDS.

ATProto supports this via OAuth2 authorization — the student must open a consent screen and
authorize the bot app to write to their PDS. The AT Protocol OAuth spec (ATPROTO-OAUTH) documents this.

**Options (cheapest to most sovereign):**
1. Bot writes to its own PDS, records reference `studentDid` by field — simplest, no auth required
2. Student sends a one-time token to the bot via DM — semi-manual, not scalable
3. Full ATProto OAuth2 delegated write — correct long-term solution, requires building an OAuth consent flow

**Decision needed from project owner** before implementing.

---

### 4. OpenClaw integration — HIGH PRIORITY

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

### 5. Lecture command — design decision needed

`/lecture <lessonUri>` currently just sets an in-memory active lesson for the channel. The user
has described wanting `/lecture` to also "start a Zoom call and create an object in the Roomy space
that can be replied to like a thread."

**Options:**
- (a) Just the in-memory lesson context (current) — useful but minimal
- (b) Create a Roomy page/thread pinned in the channel containing the lesson markdown
- (c) Call a Zoom API to create a meeting and post the link as a pinned message
- (d) b + c

**Action:** Get clarity on what /lecture should do, then implement. For (c), a Zoom API key
and OAuth app are needed. For (b), look at how Roomy pages/threads are created in the SDK.

---

### 6. Teacher admin API

The `roles/permissions.ts` grants/revokes teacher status but there's no HTTP endpoint to call it.
Add a small admin API (the discord-bridge uses `itty-router` + `@whatwg-node/server`, already
in our package.json) protected by a secret token.

**Files to create:** `src/api.ts`

---

### 7. Lesson management commands

Teachers need a way to create and list lessons without manually crafting AT-URIs.

**Commands to add:**
- `/lesson create <title>` — wizard-style or prompted via DM
- `/lesson list` — shows lessons on the teacher's PDS in the current space
- `/lesson show <uri>` — displays lesson content in the channel

---

### 8. Custom Leaf plugin (Rust) — DEFERRED

The compose.yaml in the roomy repo pulls a prebuilt Leaf image. For custom Leaf behavior
(stream-level access control, per-role event filtering, etc.) we'd need to:

1. Fork the [leaf repo](https://github.com/muni-town/leaf)
2. Implement a plugin implementing the Leaf plugin trait
3. Build a custom Docker image and reference it in this repo's compose.yaml

**This is deferred** because we don't yet know what behavior needs to live at the Leaf layer
vs. being handled in the lab-bridge service. Most of the above can be done without Leaf changes.
Revisit after steps 1–5 are complete.

---

## Environment Setup

Copy `.env.example` to `.env` in `packages/lab-bridge/` and fill in:

```env
BOT_DID=did:plc:...          # ATProto DID of the bot account
BOT_APP_PASSWORD=xxxx-...    # App password (not your main password)
TEACHER_DIDS=did:plc:...     # Comma-separated teacher DIDs (required to bootstrap)
SPACE_DIDS=did:plc:...       # Comma-separated Roomy space DIDs to watch
LEAF_URL=...                 # Leaf server URL
```

The Roomy dev stack (leaf-server, pds, plc-directory) can be run from the
[roomy repo](https://github.com/muni-town/roomy) via `docker compose up`.

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
