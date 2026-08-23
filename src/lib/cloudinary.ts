import { createHash } from "node:crypto";

// Cloudinary image hosting for meal photos. Env-gated: inert until all three
// vars are set, so the app builds and runs fine without it (like our other
// integrations). Uploads are SIGNED — the browser uploads the file directly to
// Cloudinary, but the signature is minted here so the API secret never ships to
// the client. No SDK dependency: the signing + delivery-URL rules are simple.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

export const CLOUDINARY_ENABLED = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

export function cloudinaryPublicConfig() {
  return { cloudName: CLOUD_NAME, apiKey: API_KEY };
}

/**
 * Sign a set of upload params (Cloudinary's scheme: sort keys, join as
 * `k=v&k=v`, append the API secret, SHA-1). The exact same params must be sent
 * to the upload endpoint alongside the returned signature.
 */
export function signCloudinaryParams(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + API_SECRET).digest("hex");
}

/**
 * Rewrite a Cloudinary secure URL to deliver an optimized, correctly-cropped
 * image (auto format + quality, filled to the box). Safe on non-Cloudinary or
 * empty values — returns the input unchanged so callers can pass anything.
 */
export function cldImage(
  url: string | null | undefined,
  { w, h }: { w?: number; h?: number } = {},
): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const t = ["c_fill", "g_auto", "f_auto", "q_auto", w ? `w_${w}` : "", h ? `h_${h}` : ""]
    .filter(Boolean)
    .join(",");
  return url.replace("/upload/", `/upload/${t}/`);
}

/** Guard for what we accept as a stored image URL (defends against arbitrary URLs). */
export function isCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\/[\w.-]+\/image\/upload\//.test(url);
}

/**
 * Image URLs we trust to store on a meal: Cloudinary (real merchant uploads) OR
 * Unsplash (the demo seed's stock food photos). Anything else is rejected so an
 * arbitrary URL can't be persisted — and, importantly, so a valid seeded demo
 * photo isn't silently wiped when a meal is edited and saved.
 */
export function isAllowedMealImageUrl(url: string): boolean {
  return isCloudinaryUrl(url) || /^https:\/\/images\.unsplash\.com\/photo-/.test(url);
}
