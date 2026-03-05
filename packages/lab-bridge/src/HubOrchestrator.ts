/**
 * HubOrchestrator
 *
 * The central coordinator for the Spaced educational hub. It:
 *   1. Connects to Roomy as the bot account
 *   2. Joins one or more Roomy spaces (configured via SPACE_DIDS env)
 *   3. Subscribes to live message events, skipping backfill history
 *   4. Routes slash commands to the appropriate handler
 *   5. Posts replies back to the originating room via createMessage
 */

import type { AtpAgent } from "@atproto/api";
import {
  type RoomyClient,
  type ConnectedSpace,
  type StreamDid,
  type DecodedStreamEvent,
  modules,
  createMessage,
  fromBytes,
} from "@roomy/sdk";
import { initRoomyClient } from "./roomy/client.js";
import { handleSubmit } from "./commands/submit.js";
import { handleLecture } from "./commands/lecture.js";
import { handleGrade } from "./commands/grade.js";

export class HubOrchestrator {
  private client!: RoomyClient;
  private agent!: AtpAgent;

  /** spaceDid → ConnectedSpace, kept so we can post replies */
  private spaces = new Map<string, ConnectedSpace>();

  /**
   * roomId → AT-URI of the active lesson in that room.
   * Set by /lecture, cleared by /lecture (no args).
   */
  private activeLessons = new Map<string, string>();

  async start(): Promise<void> {
    const init = await initRoomyClient();
    this.client = init.client;
    this.agent = init.agent;

    const spaceDids = (process.env["SPACE_DIDS"] ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean) as StreamDid[];

    if (spaceDids.length === 0) {
      console.warn(
        "No SPACE_DIDS configured. Set SPACE_DIDS=did:plc:... to subscribe to a space.",
      );
    }

    for (const spaceDid of spaceDids) {
      await this.subscribeToSpace(spaceDid);
    }

    console.log(`Hub watching ${spaceDids.length} space(s).`);
  }

  private async subscribeToSpace(spaceDid: StreamDid): Promise<void> {
    console.log(`Subscribing to space ${spaceDid}...`);

    const space = await this.client.joinSpace(spaceDid, modules.space);
    this.spaces.set(spaceDid, space);

    // subscribe() resolves after backfill completes; callback continues for live events
    await space.subscribe(async (events, meta) => {
      if (meta.isBackfill) return;
      for (const decoded of events) {
        await this.onEvent(space, decoded);
      }
    });
  }

  private async onEvent(
    space: ConnectedSpace,
    decoded: DecodedStreamEvent,
  ): Promise<void> {
    const { event, user } = decoded;

    if (event.$type !== "space.roomy.message.createMessage.v0") return;

    const text = new TextDecoder().decode(fromBytes(event.body.data));
    const roomId = event.room;
    const authorDid = user as string;

    if (!text.startsWith("/")) return;

    // Ignore our own messages to avoid loops
    if (authorDid === this.agent.did) return;

    const [rawCommand, ...args] = text.trim().split(/\s+/);
    const command = rawCommand?.toLowerCase();

    console.log(`[command] ${command} from ${authorDid} in room ${roomId}`);

    let reply: string;

    try {
      if (command === "/submit") {
        reply = await handleSubmit({
          authorDid,
          args,
          agent: this.agent,
          activeLessonUri: this.activeLessons.get(roomId),
        });
      } else if (command === "/lecture") {
        reply = await handleLecture({
          authorDid,
          args,
          roomId,
          setActiveLessonUri: (id, uri) => {
            if (uri) this.activeLessons.set(id, uri);
            else this.activeLessons.delete(id);
          },
        });
      } else if (command === "/grade") {
        reply = await handleGrade({
          authorDid,
          args,
          agent: this.agent,
        });
      } else {
        // Unknown command — silently ignore so the bot doesn't spam
        return;
      }
    } catch (err) {
      console.error(`Error handling ${command}:`, err);
      reply = `An error occurred while handling \`${command}\`. Check the server logs.`;
    }

    await createMessage(space, { roomId, body: reply });
  }
}
