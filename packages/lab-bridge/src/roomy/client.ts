/**
 * Initialize the Roomy client for the lab-bridge bot.
 * Authenticates using ATProto app password.
 */

import { AtpAgent } from "@atproto/api";
import { RoomyClient } from "@roomy/sdk";
import {
  BOT_DID,
  BOT_APP_PASSWORD,
  PDS_URL,
  LEAF_URL,
  LEAF_SERVER_DID,
  STREAM_HANDLE_NSID,
  STREAM_NSID,
} from "../env.js";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSION_FILE = join(__dirname, "../../session.json");

function loadSession(): unknown {
  try {
    return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to read session file:", err);
    }
    return undefined;
  }
}

function saveSession(session: unknown): void {
  try {
    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write session file:", err);
  }
}

function deleteSession(): void {
  try {
    unlinkSync(SESSION_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to delete session file:", err);
    }
  }
}

export interface RoomyInit {
  client: RoomyClient;
  agent: AtpAgent;
}

export async function initRoomyClient(): Promise<RoomyInit> {
  console.log("Initializing ATProto agent...");

  const existingSession = loadSession();

  const agent = new AtpAgent({
    service: PDS_URL,
    persistSession: (evt, session) => {
      if (evt === "create" || evt === "update") {
        saveSession(session);
      } else if (evt === "expired") {
        deleteSession();
      }
    },
  });

  if (existingSession) {
    try {
      await agent.resumeSession(existingSession as Parameters<typeof agent.resumeSession>[0]);
      console.log(`Session restored as ${agent.did}`);
    } catch {
      console.warn("Session restore failed, re-authenticating...");
      deleteSession();
      await agent.login({ identifier: BOT_DID, password: BOT_APP_PASSWORD });
      console.log(`Authenticated as ${agent.did}`);
    }
  } else {
    await agent.login({ identifier: BOT_DID, password: BOT_APP_PASSWORD });
    console.log(`Authenticated as ${agent.did}`);
  }

  if (!agent.did) {
    throw new Error("Authentication failed — no DID returned.");
  }

  const client = await RoomyClient.create({
    agent,
    leafUrl: LEAF_URL,
    leafDid: LEAF_SERVER_DID,
    profileSpaceNsid: STREAM_HANDLE_NSID,
    spaceNsid: STREAM_NSID,
  });

  console.log("Roomy client ready.");
  return { client, agent };
}
