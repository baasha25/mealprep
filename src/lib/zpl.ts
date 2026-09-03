// ZPL (Zebra Programming Language) generation for meal labels. Zebra thermal
// printers accept raw ZPL directly — no Microsoft Word, no driver quirks — so a
// kitchen can print a whole batch by sending this text to the printer (via Zebra
// Browser Print, the Zebra utilities, or `lpr`). We generate it from the same
// label data the on-screen labels use, so it always reflects the current batch.
//
// All coordinates are in dots at 203 dpi (the common desktop-Zebra density).

export type ZplLabel = {
  businessName: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  bestByLabel: string;
  qty: number;
};

export type ZplSize = "2x1" | "4x2";

type SizeSpec = { pw: number; ll: number; x: number; biz: number; title: number; body: number };

// 203 dpi: 2"x1" = 406x203 dots, 4"x2" = 812x406 dots.
const SIZES: Record<ZplSize, SizeSpec> = {
  "2x1": { pw: 406, ll: 203, x: 16, biz: 22, title: 30, body: 20 },
  "4x2": { pw: 812, ll: 406, x: 24, biz: 32, title: 52, body: 28 },
};

/**
 * ZPL treats ^ and ~ as command prefixes and \ as an escape, so strip them from
 * user text (meal names, allergens) to keep the label well-formed. Also drop
 * non-ASCII since not all Zebra fonts render it without extra setup.
 */
function clean(s: string): string {
  return (s ?? "")
    .replace(/[\^~\\]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** One label definition, printed `qty` times via ^PQ. */
export function labelZpl(l: ZplLabel, size: ZplSize = "4x2"): string {
  const s = SIZES[size];
  const qty = Math.max(1, Math.min(100000, Math.round(l.qty || 1)));
  const gap = Math.round(s.title * 0.5);
  let y = Math.round(s.body * 0.6);
  const lines: string[] = ["^XA", "^CI28", `^PW${s.pw}`, `^LL${s.ll}`];

  lines.push(`^FO${s.x},${y}^A0N,${s.biz},${s.biz}^FD${clean(l.businessName)}^FS`);
  y += s.biz + 6;
  lines.push(`^FO${s.x},${y}^A0N,${s.title},${s.title}^FD${clean(l.name)}^FS`);
  y += s.title + gap;
  lines.push(
    `^FO${s.x},${y}^A0N,${s.body},${s.body}^FD${l.calories} cal  ${l.proteinG}P  ${l.carbsG}C  ${l.fatG}F^FS`,
  );
  y += s.body + 8;
  lines.push(`^FO${s.x},${y}^A0N,${s.body},${s.body}^FDBest by ${clean(l.bestByLabel)}^FS`);
  if (l.allergens.length > 0) {
    y += s.body + 6;
    lines.push(
      `^FO${s.x},${y}^A0N,${s.body},${s.body}^FDContains: ${clean(l.allergens.join(", "))}^FS`,
    );
  }

  lines.push(`^PQ${qty}`, "^XZ");
  return lines.join("\n");
}

/** A whole batch — one label block per meal, each with its own print quantity. */
export function batchZpl(labels: ZplLabel[], size: ZplSize = "4x2"): string {
  return labels
    .filter((l) => (l.qty || 0) > 0)
    .map((l) => labelZpl(l, size))
    .join("\n");
}
