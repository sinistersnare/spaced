/**
 * /lecture [lessonUri]
 *
 * Teacher command. Sets the active lesson for the current Roomy channel (room).
 * This lesson URI is stored in memory by the HubOrchestrator and used by /submit
 * to know which lesson a submission is for.
 *
 * Future enhancements:
 * - Create an ATProto record on the teacher's PDS marking this room as a lecture room
 * - Potentially trigger a Zoom/video link creation and post it to the channel
 * - Pin the lesson content in the channel (Roomy page/thread)
 *
 * OPEN QUESTION: What does "start a lecture" actually mean? Options:
 *   a) Just set the active lesson context (implemented here)
 *   b) Create a Zoom meeting and post the link (requires Zoom API key)
 *   c) Create a Roomy page/thread with the lesson content embedded
 *   d) All of the above
 * See NEXT_STEPS.md.
 */

import { isTeacher } from "../roles/permissions.js";

export interface LectureContext {
  authorDid: string;
  args: string[];
  /** Mutable ref: HubOrchestrator updates this when the command succeeds */
  setActiveLessonUri: (roomId: string, uri: string | undefined) => void;
  /** The Roomy room ID this message was sent in */
  roomId: string;
}

export async function handleLecture(ctx: LectureContext): Promise<string> {
  if (!isTeacher(ctx.authorDid)) {
    return "Only teachers can start a lecture.";
  }

  const lessonUri = ctx.args[0];

  if (!lessonUri) {
    // /lecture with no args clears the active lesson
    ctx.setActiveLessonUri(ctx.roomId, undefined);
    return "Lecture ended. This channel no longer has an active lesson.";
  }

  // Minimal validation: AT-URIs look like at://did:.../collection/rkey
  if (!lessonUri.startsWith("at://")) {
    return (
      "Please provide a valid AT-URI for the lesson (e.g. `at://did:plc:.../edu.roomy.lesson/rkey`).\n" +
      "Run `/lesson list` to see available lessons."
    );
  }

  ctx.setActiveLessonUri(ctx.roomId, lessonUri);

  return (
    `Lecture started! Active lesson set to:\n\`${lessonUri}\`\n\n` +
    `Students can now use \`/submit <commithash>\` to submit work for this lesson.`
  );
}
