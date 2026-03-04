/**
 * edu.roomy.assignment
 *
 * An ATProto record representing a student's work submission. Written to the *student's* PDS,
 * giving them ownership of their academic record. The bot creates this record on their behalf
 * when they run `/submit <commithash>` in a Roomy channel.
 *
 * The bot requires a delegated write token or the student must explicitly authorize the bot
 * on their PDS — this is an open design question (see NEXT_STEPS.md).
 */

export interface EduAssignment {
  $type: "edu.roomy.assignment";
  /** AT-URI of the lesson this is a submission for */
  lessonUri: string;
  /** Git commit hash of the submitted work */
  commitHash: string;
  /** DID of the student submitting */
  studentDid: string;
  /** Repository URL (e.g. https://github.com/user/repo) */
  repoUrl?: string;
  /** Status set by the lab runner after automated testing */
  status: "pending" | "running" | "passed" | "failed";
  /** Output from the automated test run, populated after OpenClaw finishes */
  testOutput?: string;
  createdAt: string;
  updatedAt: string;
}

export function makeAssignment(
  fields: Omit<EduAssignment, "$type" | "status" | "createdAt" | "updatedAt">,
): EduAssignment {
  const now = new Date().toISOString();
  return {
    $type: "edu.roomy.assignment",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}
