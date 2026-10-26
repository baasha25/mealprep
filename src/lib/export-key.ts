// Live export links — pure helpers (tested).
//
// A kitchen can turn any CSV report into a live, read-only link for Google
// Sheets' IMPORTDATA. The link carries a per-kitchen secret; the route accepts
// it in place of the owner's session. Regenerating the key kills old links.

import { randomBytes } from "node:crypto";

export const EXPORT_KEY_PREFIX = "pfx_";

export function newExportKey(): string {
  return EXPORT_KEY_PREFIX + randomBytes(18).toString("base64url");
}

export function looksLikeExportKey(v: string | null | undefined): boolean {
  return typeof v === "string" && /^pfx_[A-Za-z0-9_-]{20,40}$/.test(v);
}

/** "pfx_abc…xyz" for display. */
export function maskExportKey(key: string): string {
  return key.length <= 10 ? key : `${key.slice(0, 7)}…${key.slice(-3)}`;
}

/** The Google Sheets formula for a live link. */
export function importDataFormula(url: string): string {
  return `=IMPORTDATA("${url}")`;
}
