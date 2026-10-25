// Who customer email comes from — pure (tested).
//
// A kitchen can connect its own sending domain (Resend). Once verified, its
// mail goes out as "Gaia Kitchen <hello@gaiakitchen.ca>". Until then it goes
// out as "Gaia Kitchen via PrepFlow" from PrepFlow's own address. Either way
// replies land with the kitchen (reply-to), never in PrepFlow's inbox.

export type SenderInput = {
  businessName: string;
  emailDomain?: string | null;
  emailDomainStatus?: string | null;
  emailFromLocal?: string | null;
  replyTo?: string | null;
  /** PrepFlow's own sender, e.g. 'PrepFlow <orders@send.prepflow.ca>' or a bare address. */
  fallbackFrom: string;
};

export type Sender = { from: string; replyTo?: string };

/** "PrepFlow <x@y>" → "x@y"; a bare address passes through. */
export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/** A display name safe inside a From header: no quotes, brackets or line breaks. */
export function displayName(name: string): string {
  return name.replace(/["<>\r\n]/g, "").trim().slice(0, 60) || "Your kitchen";
}

/** Local part rules: letters, digits, dot, dash, underscore; 1–40 chars; no leading/trailing dot. */
export function isValidLocalPart(local: string | null | undefined): boolean {
  const v = (local ?? "").trim();
  return /^[a-z0-9_](?:[a-z0-9._-]{0,38}[a-z0-9_-])?$/i.test(v);
}

/** Owner-typed domain → bare lower-case host, or null when it isn't a usable sending domain. */
export function normalizeDomain(input: string): string | null {
  let d = (input ?? "").trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0].replace(/\.$/, "");
  if (!d || d.length > 253) return null;
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return null;
  if (/(^|\.)(prepflow\.ca|resend\.dev|localhost)$/.test(d)) return null;
  return d;
}

export function senderFor(o: SenderInput): Sender {
  const name = displayName(o.businessName);
  const replyTo = (o.replyTo ?? "").trim() || undefined;
  const local = (o.emailFromLocal ?? "hello").trim().toLowerCase();
  if (o.emailDomain && o.emailDomainStatus === "verified" && isValidLocalPart(local)) {
    return { from: `${name} <${local}@${o.emailDomain}>`, replyTo };
  }
  return { from: `${name} via PrepFlow <${addressOf(o.fallbackFrom)}>`, replyTo };
}

export type DnsRecordView = { record: string; type: string; name: string; value: string; ttl?: string; priority?: number; status?: string };

/** Resend's record objects → what Settings shows (and what we store). */
export function simplifyRecords(records: unknown): DnsRecordView[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
    .filter((r): r is Record<string, unknown> => Boolean(r))
    .map((r) => ({
      record: String(r.record ?? ""),
      type: String(r.type ?? ""),
      name: String(r.name ?? ""),
      value: String(r.value ?? ""),
      ttl: r.ttl == null ? undefined : String(r.ttl),
      priority: typeof r.priority === "number" ? r.priority : undefined,
      status: r.status == null ? undefined : String(r.status),
    }))
    .filter((r) => r.type && r.name && r.value);
}

export const DOMAIN_STATUS_LABEL: Record<string, string> = {
  not_started: "Waiting for DNS",
  pending: "Checking DNS",
  verified: "Verified",
  failed: "Failed — check the records",
  temporary_failure: "Retrying",
  partially_verified: "Partly verified",
  partially_failed: "Some records failed",
};
