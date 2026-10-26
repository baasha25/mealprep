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
  description?: string | null;
  ingredients?: string[];
  kitchenLine?: string | null;
};

export type ZplSize = "2x1" | "4x2";

import { DEFAULT_LABEL_CONFIG, storageText, type LabelConfig } from "@/lib/labels";

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

/** One label definition, printed `qty` times via ^PQ. Honors the label config. */
export function labelZpl(l: ZplLabel, size: ZplSize = "4x2", cfg: LabelConfig = DEFAULT_LABEL_CONFIG): string {
  const s = SIZES[size];
  const qty = Math.max(1, Math.min(100000, Math.round(l.qty || 1)));
  const gap = Math.round(s.title * 0.5);
  let y = Math.round(s.body * 0.6);
  const lines: string[] = ["^XA", "^CI28", `^PW${s.pw}`, `^LL${s.ll}`];

  if (cfg.showBusinessName) {
    lines.push(`^FO${s.x},${y}^A0N,${s.biz},${s.biz}^FD${clean(l.businessName)}^FS`);
    y += s.biz + 6;
  }
  lines.push(`^FO${s.x},${y}^A0N,${s.title},${s.title}^FD${clean(l.name)}^FS`);
  y += s.title + gap;
  const small = Math.round(s.body * 0.8);
  if (cfg.showDescription && l.description) {
    lines.push(`^FO${s.x},${y}^A0N,${small},${small}^FB${s.pw - 2 * s.x},2,0,L^FD${clean(l.description).slice(0, 140)}^FS`);
    y += small * 2 + 4;
  }
  if (cfg.showIngredients && l.ingredients?.length) {
    lines.push(`^FO${s.x},${y}^A0N,${small},${small}^FB${s.pw - 2 * s.x},2,0,L^FDIngredients: ${clean(l.ingredients.join(", ")).slice(0, 160)}^FS`);
    y += small * 2 + 4;
  }
  if (cfg.showMacros) {
    lines.push(
      `^FO${s.x},${y}^A0N,${s.body},${s.body}^FD${l.calories} cal  ${l.proteinG}P  ${l.carbsG}C  ${l.fatG}F^FS`,
    );
    y += s.body + 8;
  }
  if (cfg.showBestBy) {
    lines.push(`^FO${s.x},${y}^A0N,${s.body},${s.body}^FDBest by ${clean(l.bestByLabel)}^FS`);
    y += s.body + 6;
  }
  if (cfg.showAllergens && l.allergens.length > 0) {
    lines.push(
      `^FO${s.x},${y}^A0N,${s.body},${s.body}^FDContains: ${clean(l.allergens.join(", "))}^FS`,
    );
    y += s.body + 6;
  }
  const storage = storageText(cfg.storageLine);
  if (storage) {
    lines.push(`^FO${s.x},${y}^A0N,${s.body},${s.body}^FD${clean(storage)}^FS`);
    y += s.body + 6;
  }
  if (cfg.footer.trim()) {
    lines.push(`^FO${s.x},${y}^A0N,${s.body},${s.body}^FD${clean(cfg.footer)}^FS`);
    y += s.body + 6;
  }
  if (cfg.showKitchenLine && l.kitchenLine) {
    lines.push(`^FO${s.x},${y}^A0N,${small},${small}^FD${clean(l.kitchenLine)}^FS`);
  }

  lines.push(`^PQ${qty}`, "^XZ");
  return lines.join("\n");
}

/** A whole batch — one label block per meal, each with its own print quantity. */
export function batchZpl(labels: ZplLabel[], size: ZplSize = "4x2", cfg: LabelConfig = DEFAULT_LABEL_CONFIG): string {
  return labels
    .filter((l) => (l.qty || 0) > 0)
    .map((l) => labelZpl(l, size, cfg))
    .join("\n");
}
