export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

interface SessionCheckInput {
  /** Values stored in the JWT at sign-in. */
  tokenVersion: number | undefined;
  loginAt: number | undefined;
  /** Current values from the database. */
  dbVersion: number;
  role: string;
  now?: number;
}

/**
 * A session is valid only if it was issued for the account's current sessionVersion,
 * is younger than the absolute lifetime, and belongs to an admin.
 */
export function isSessionValid({ tokenVersion, loginAt, dbVersion, role, now = Date.now() }: SessionCheckInput): boolean {
  if (role !== "ADMIN") return false;
  if (tokenVersion === undefined || tokenVersion !== dbVersion) return false;
  if (loginAt === undefined || now - loginAt > SESSION_MAX_AGE_MS) return false;
  return true;
}
