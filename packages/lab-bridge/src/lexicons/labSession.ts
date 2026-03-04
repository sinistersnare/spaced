/**
 * edu.roomy.labSession
 *
 * Represents an OpenClaw (or compatible) sandbox execution session triggered
 * for a student's submitted commit. Written to the bot's own PDS as an audit log.
 *
 * OpenClaw integration is a placeholder — the actual interface depends on the
 * OpenClaw API (HTTP, gRPC, etc.) which is TBD. See NEXT_STEPS.md.
 */

export interface EduLabSession {
  $type: "edu.roomy.labSession";
  /** AT-URI of the assignment that triggered this session */
  assignmentUri: string;
  /** DID of the student */
  studentDid: string;
  /** Git repo URL cloned into the sandbox */
  repoUrl: string;
  /** The specific commit checked out */
  commitHash: string;
  /** Session state */
  status: "queued" | "running" | "completed" | "error";
  /** Opaque ID from the sandbox provider (e.g. OpenClaw job ID) */
  sessionId?: string;
  /** Raw stdout/stderr from the test runner */
  output?: string;
  /** Exit code of the test runner */
  exitCode?: number;
  startedAt: string;
  completedAt?: string;
}

export function makeLabSession(
  fields: Omit<EduLabSession, "$type" | "status" | "startedAt">,
): EduLabSession {
  return {
    $type: "edu.roomy.labSession",
    status: "queued",
    startedAt: new Date().toISOString(),
    ...fields,
  };
}
