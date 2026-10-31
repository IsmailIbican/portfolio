import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Vercel Cron calls the route with `Authorization: Bearer <CRON_SECRET>`. Both sides are hashed first so the
 * comparison has a fixed length and takes the same time however much of the secret a caller got right.
 */
export function isCronAuthorized(authorizationHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authorizationHeader) return false;
  return timingSafeEqual(sha256(authorizationHeader), sha256(`Bearer ${secret}`));
}
