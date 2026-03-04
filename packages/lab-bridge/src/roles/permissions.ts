/**
 * Role management for the educational hub.
 *
 * Roles are stored in a flat JSON file on the server (roles.json) mapping DIDs to roles.
 * This is intentionally simple — a future version could use an ATProto record (edu.roomy.role)
 * stored on the teacher's PDS so role grants are themselves sovereign and auditable.
 *
 * Teacher DIDs can also be set via TEACHER_DIDS env var as a comma-separated list
 * for zero-config deployments.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROLES_FILE = join(__dirname, "../../roles.json");

export type Role = "teacher" | "student";

interface RolesStore {
  teachers: string[]; // DIDs
  students: string[]; // DIDs — optional: unlisted users are implicitly students
}

function loadRoles(): RolesStore {
  // Seed teachers from env first
  const envTeachers = (process.env["TEACHER_DIDS"] ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  if (existsSync(ROLES_FILE)) {
    const stored = JSON.parse(readFileSync(ROLES_FILE, "utf-8")) as RolesStore;
    // Merge env teachers so they're always authoritative
    const merged = Array.from(new Set([...envTeachers, ...stored.teachers]));
    return { ...stored, teachers: merged };
  }

  return { teachers: envTeachers, students: [] };
}

function saveRoles(store: RolesStore): void {
  writeFileSync(ROLES_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Returns the role for a given DID. Any DID not in teachers list is a student. */
export function getRole(did: string): Role {
  const store = loadRoles();
  return store.teachers.includes(did) ? "teacher" : "student";
}

export function isTeacher(did: string): boolean {
  return getRole(did) === "teacher";
}

/** Grant teacher role to a DID. Only callable by existing teachers via the admin API. */
export function grantTeacher(did: string): void {
  const store = loadRoles();
  if (!store.teachers.includes(did)) {
    store.teachers.push(did);
    saveRoles(store);
  }
}

export function revokeTeacher(did: string): void {
  const store = loadRoles();
  store.teachers = store.teachers.filter((d) => d !== did);
  saveRoles(store);
}
