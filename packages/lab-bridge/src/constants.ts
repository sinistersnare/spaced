/** Version tag embedded in ATProto record rkeys so we can migrate schemas later. */
export const EDU_SCHEMA_VERSION = "v0";

/** NSID prefixes for all edu.roomy.* record types. */
export const LEXICON = {
  LESSON:       "edu.roomy.lesson",
  ASSIGNMENT:   "edu.roomy.assignment",
  VERIFICATION: "edu.roomy.verification",
  LAB_SESSION:  "edu.roomy.labSession",
  ROLE:         "edu.roomy.role",
} as const;
