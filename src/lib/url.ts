// Browsers silently drop tabs and newlines inside URLs, so "/\t/evil.example" is read as "//evil.example".
// Rejecting every control character, whitespace and backslash closes that whole class of tricks.
const FORBIDDEN_CHARACTERS = /[\u0000- \u007f\\]/;
const PLACEHOLDER_ORIGIN = "https://placeholder.invalid";

/** True for absolute http(s) URLs only. Rejects javascript:, data:, etc. */
export function isHttpUrl(value: string): boolean {
  if (FORBIDDEN_CHARACTERS.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** http(s) URL, or a path on this site such as /uploads/cv.pdf. */
export function isHttpUrlOrSitePath(value: string): boolean {
  if (!value.startsWith("/")) return isHttpUrl(value);
  if (FORBIDDEN_CHARACTERS.test(value) || value.startsWith("//")) return false;
  try {
    // A real site path stays on the same origin once resolved (also catches encoded tricks).
    return new URL(value, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}
