/** Lowercase, URL-safe slug. "C++" -> "cplusplus", "C#" -> "csharp" so common names do not collide. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
