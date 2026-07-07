/**
 * Turn a kitchen name into a URL-safe storefront slug: lowercase, alphanumeric
 * words joined by hyphens, trimmed to 40 chars. Uniqueness is enforced by the
 * caller (append -2, -3, … on collision).
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "kitchen";
}
