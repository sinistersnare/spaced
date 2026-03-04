/**
 * edu.roomy.verification
 *
 * A teacher-signed credential written to the *student's* PDS that proves they completed
 * a lesson. This is the decentralized "grade" — the student owns it and can present it
 * to any future institution that understands the edu.roomy.* lexicon.
 *
 * The verifier field is the teacher's DID, and the record can be independently verified
 * by checking the teacher's published public key via ATProto DID resolution.
 */

export interface EduVerification {
  $type: "edu.roomy.verification";
  /** AT-URI of the assignment being verified */
  assignmentUri: string;
  /** AT-URI of the lesson this verifies completion of */
  lessonUri: string;
  /** DID of the teacher/grader who issued this verification */
  verifierDid: string;
  /** Human-readable grade or score (e.g. "A", "85/100", "pass") */
  grade: string;
  /** Optional feedback message from the teacher */
  feedback?: string;
  /** ISO 8601 */
  issuedAt: string;
}

export function makeVerification(
  fields: Omit<EduVerification, "$type" | "issuedAt">,
): EduVerification {
  return {
    $type: "edu.roomy.verification",
    issuedAt: new Date().toISOString(),
    ...fields,
  };
}
