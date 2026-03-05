/**
 * /submit <commithash> [repoUrl]
 *
 * Student submits a git commit for automated testing.
 * Flow:
 *   1. Parse command args
 *   2. Write an edu.roomy.assignment record to the student's PDS (pending)
 *   3. Enqueue an OpenClaw lab session (placeholder)
 *   4. Reply in the Roomy channel with a confirmation
 *
 * OPEN QUESTION: Writing to the student's PDS requires the bot to hold a delegated
 * write credential for that student. ATProto's OAuth2 authorization flow supports this,
 * but it requires the student to authorize the bot via a consent screen. The simplest
 * interim approach is for the bot to write to its own PDS and link the student by DID.
 * See NEXT_STEPS.md for the full discussion.
 */

import type { AtpAgent } from "@atproto/api";
import { makeAssignment } from "../lexicons/assignment.js";
import { LEXICON } from "../constants.js";

export interface SubmitContext {
  /** DID of the student who ran the command */
  authorDid: string;
  /** Raw arguments after "/submit" */
  args: string[];
  /** ATProto agent for writing records to the PDS */
  agent: AtpAgent;
  /** AT-URI of the active lesson in this channel (set by the teacher via /lecture) */
  activeLessonUri: string | undefined;
}

/** Returns a reply string to post back into the Roomy channel. */
export async function handleSubmit(ctx: SubmitContext): Promise<string> {
  const commitHash = ctx.args[0];
  const repoUrl = ctx.args[1];

  if (!commitHash || !/^[0-9a-f]{7,40}$/i.test(commitHash)) {
    return "Usage: `/submit <commithash> [repoUrl]` — commit hash must be a valid short or full SHA.";
  }

  if (!ctx.activeLessonUri) {
    return "No active lesson is set for this channel. A teacher must run `/lecture <lessonUri>` first.";
  }

  const record = makeAssignment({
    lessonUri: ctx.activeLessonUri,
    commitHash,
    studentDid: ctx.authorDid,
    repoUrl,
  });

  // TODO: Write record to student's PDS via ctx.client.agent.api.com.atproto.repo.createRecord
  // Blocked on: delegated write auth (see NEXT_STEPS.md)
  // For now, write to the bot's own PDS under edu.roomy.assignment
  const assignmentUri = await writeToBotPds(ctx.agent, record);

  // TODO: Enqueue OpenClaw lab session (see NEXT_STEPS.md)
  console.log(`[submit] Queued lab session for ${ctx.authorDid} @ ${commitHash}`);

  return (
    `Submission received! Commit \`${commitHash}\` is queued for testing.\n` +
    `Assignment record: \`${assignmentUri}\`\n` +
    `I'll post results here when the lab runner finishes.`
  );
}

async function writeToBotPds(
  agent: AtpAgent,
  record: ReturnType<typeof makeAssignment>,
): Promise<string> {
  const result = await agent.api.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: LEXICON.ASSIGNMENT,
    record: record as unknown as Record<string, unknown>,
  });
  return result.data.uri;
}
