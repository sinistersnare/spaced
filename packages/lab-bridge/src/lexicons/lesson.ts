/**
 * edu.roomy.lesson
 *
 * An ATProto record representing a unit of study. Written to the teacher's PDS.
 * Students discover lessons by following the teacher's handle.
 *
 * Future: lessons should reference a Roomy room/thread where students can ask questions.
 */

export interface EduLesson {
  $type: "edu.roomy.lesson";
  /** Short display title */
  title: string;
  /** Full lesson content in markdown */
  content: string;
  /** Optional ordered list of task descriptions students must complete */
  tasks?: string[];
  /** DID of the Roomy room where lesson discussion lives (optional) */
  roomDid?: string;
  createdAt: string; // ISO 8601
}

/** Construct a new lesson record (does not write to PDS — see RoomyClient.createRecord) */
export function makeLesson(fields: Omit<EduLesson, "$type" | "createdAt">): EduLesson {
  return {
    $type: "edu.roomy.lesson",
    createdAt: new Date().toISOString(),
    ...fields,
  };
}
