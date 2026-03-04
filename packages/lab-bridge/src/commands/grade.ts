/**
 * /grade <assignmentUri> <grade> [feedback...]
 *
 * Teacher command. Issues a signed verification record for a student's assignment.
 * The verification is written to the *bot's* PDS for now (see NEXT_STEPS.md for
 * the path toward writing to the student's PDS as a true portable credential).
 *
 * Example:
 *   /grade at://did:plc:.../edu.roomy.assignment/rkey A+ "Great work on the binary tree!"
 */

import type { RoomyClient } from "@roomy/sdk";
import { isTeacher } from "../roles/permissions.js";
import { makeVerification } from "../lexicons/verification.js";
import { LEXICON } from "../constants.js";

export interface GradeContext {
  authorDid: string;
  args: string[];
  client: RoomyClient;
}

export async function handleGrade(ctx: GradeContext): Promise<string> {
  if (!isTeacher(ctx.authorDid)) {
    return "Only teachers can issue grades.";
  }

  const assignmentUri = ctx.args[0];
  const grade = ctx.args[1];
  const feedback = ctx.args.slice(2).join(" ") || undefined;

  if (!assignmentUri || !grade) {
    return "Usage: `/grade <assignmentUri> <grade> [feedback]`";
  }

  if (!assignmentUri.startsWith("at://")) {
    return "Assignment URI must be a valid AT-URI.";
  }

  // Look up the assignment to get the lessonUri and studentDid
  // TODO: Fetch the actual assignment record from the PDS
  // For now we require the caller to have the lessonUri available via a follow-up lookup
  const lessonUri = "at://todo/lookup-from-assignment"; // placeholder

  const record = makeVerification({
    assignmentUri,
    lessonUri,
    verifierDid: ctx.authorDid,
    grade,
    feedback,
  });

  const result = await ctx.client.agent.api.com.atproto.repo.createRecord({
    repo: ctx.client.agent.assertDid,
    collection: LEXICON.VERIFICATION,
    record,
  });

  return (
    `Grade issued!\n` +
    `Assignment: \`${assignmentUri}\`\n` +
    `Grade: **${grade}**${feedback ? `\nFeedback: ${feedback}` : ""}\n` +
    `Verification record: \`${result.data.uri}\``
  );
}
