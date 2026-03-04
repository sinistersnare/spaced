/**
 * HubOrchestrator
 *
 * The central coordinator for the Spaced educational hub. It:
 *   1. Connects to Roomy as the bot account
 *   2. Subscribes to one or more Roomy spaces (configured via SPACE_DIDS env)
 *   3. Watches incoming message events for slash commands
 *   4. Routes commands to the appropriate handler
 *   5. Posts replies back to the originating room
 *
 * This is the rough equivalent of BridgeOrchestrator in the discord-bridge package.
 *
 * NOTE: The Roomy SDK's event subscription API (ConnectedSpace) is used here at a
 * conceptual level. The exact method names for subscribing to message events and
 * posting replies need to be verified against the live SDK — see the TODO comments
 * below and NEXT_STEPS.md.
 */

import { RoomyClient, type StreamDid } from "@roomy/sdk";
import { initRoomyClient } from "./roomy/client.js";
import { handleSubmit } from "./commands/submit.js";
import { handleLecture } from "./commands/lecture.js";
import { handleGrade } from "./commands/grade.js";

export class HubOrchestrator {
  private client!: RoomyClient;

  /**
   * roomId → AT-URI of the active lesson in that room.
   * Set by /lecture, cleared by /lecture (no args).
   */
  private activeLessons = new Map<string, string>();

  async start(): Promise<void> {
    this.client = await initRoomyClient();

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

    // TODO: The exact ConnectedSpace API needs to be verified against @roomy/sdk.
    // Based on reading the discord-bridge source, the pattern is:
    //   const space = await this.client.connectSpace(spaceDid);
    //   space.on("message", (event) => this.onMessage(event));
    //
    // The real implementation should mirror how Bridge.ts uses ConnectedSpace.
    // Leaving as a typed stub so the shape is clear.

    const space = await (this.client as any).connectSpace(spaceDid);

    space.on?.("message:create", async (event: MessageEvent) => {
      await this.onMessage(spaceDid, event);
    });
  }

  private async onMessage(spaceDid: StreamDid, event: MessageEvent): Promise<void> {
    const { text, authorDid, roomId, messageId } = event;

    // Only respond to messages starting with /
    if (!text.startsWith("/")) return;

    // Ignore our own messages to avoid loops
    if (authorDid === this.client.agent.assertDid) return;

    const [rawCommand, ...args] = text.trim().split(/\s+/);
    const command = rawCommand?.toLowerCase();

    console.log(`[command] ${command} from ${authorDid} in room ${roomId}`);

    let reply: string;

    try {
      if (command === "/submit") {
        reply = await handleSubmit({
          authorDid,
          args,
          client: this.client,
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
          client: this.client,
        });
      } else {
        // Unknown command — silently ignore so the bot doesn't spam
        return;
      }
    } catch (err) {
      console.error(`Error handling ${command}:`, err);
      reply = `An error occurred while handling \`${command}\`. Check the server logs.`;
    }

    // TODO: Post reply back to the Roomy room
    // The discord-bridge sends back via bot.helpers.sendMessage — Roomy equivalent TBD.
    // Likely: this.client.sendMessage(spaceDid, roomId, reply)
    console.log(`[reply → ${roomId}] ${reply}`);
    await (this.client as any).sendMessage?.(spaceDid, roomId, reply);
  }
}

/** Minimal shape of incoming message events from the Roomy SDK. To be refined. */
interface MessageEvent {
  messageId: string;
  roomId: string;
  authorDid: string;
  text: string;
}
