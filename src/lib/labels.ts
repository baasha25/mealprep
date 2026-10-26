// Meal-label design config — which fields print on the nutrition/allergen labels
// (paper and Zebra), plus layout choices. Stored per business on
// BusinessSettings.labelConfig; parsed defensively so a missing/partial value
// always yields a complete config.

export type StorageLine = "" | "refrigerate" | "freeze" | "reheat" | "shake";

export type LabelConfig = {
  showBusinessName: boolean;
  showLogo: boolean; // kitchen logo (paper labels only; Zebra prints text)
  showMacros: boolean;
  showAllergens: boolean;
  showBestBy: boolean;
  showDescription: boolean; // the meal's one-line description
  showIngredients: boolean; // ingredient list from the recipe
  showKitchenLine: boolean; // storefront address / "Reorder at …"
  storageLine: StorageLine; // preset handling instruction
  compact: boolean; // tighter type for small labels
  accentBar: boolean; // brand-colour bar down the left edge (paper)
  footer: string; // free-form line, e.g. "Keep refrigerated · Consume within 3 days"
};

export const STORAGE_LINES: { key: StorageLine; label: string; text: string }[] = [
  { key: "", label: "None", text: "" },
  { key: "refrigerate", label: "Keep refrigerated", text: "Keep refrigerated · 0–4°C" },
  { key: "freeze", label: "Keep frozen", text: "Keep frozen · thaw in fridge overnight" },
  { key: "reheat", label: "Reheat before eating", text: "Reheat to 74°C / 165°F before eating" },
  { key: "shake", label: "Shake well", text: "Shake well · keep cold · best within 3 days" },
];

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  showBusinessName: true,
  showLogo: false,
  showMacros: true,
  showAllergens: true,
  showBestBy: true,
  showDescription: false,
  showIngredients: false,
  showKitchenLine: false,
  storageLine: "",
  compact: false,
  accentBar: false,
  footer: "",
};

export function storageText(key: StorageLine): string {
  return STORAGE_LINES.find((s) => s.key === key)?.text ?? "";
}

/** Merge an unknown stored value onto the defaults so callers get a full config. */
export function parseLabelConfig(value: unknown): LabelConfig {
  const v = (value ?? {}) as Record<string, unknown>;
  const bool = (k: keyof LabelConfig, d: boolean) => (typeof v[k] === "boolean" ? (v[k] as boolean) : d);
  const storage = STORAGE_LINES.some((s) => s.key === v.storageLine) ? (v.storageLine as StorageLine) : "";
  return {
    showBusinessName: bool("showBusinessName", DEFAULT_LABEL_CONFIG.showBusinessName),
    showLogo: bool("showLogo", DEFAULT_LABEL_CONFIG.showLogo),
    showMacros: bool("showMacros", DEFAULT_LABEL_CONFIG.showMacros),
    showAllergens: bool("showAllergens", DEFAULT_LABEL_CONFIG.showAllergens),
    showBestBy: bool("showBestBy", DEFAULT_LABEL_CONFIG.showBestBy),
    showDescription: bool("showDescription", DEFAULT_LABEL_CONFIG.showDescription),
    showIngredients: bool("showIngredients", DEFAULT_LABEL_CONFIG.showIngredients),
    showKitchenLine: bool("showKitchenLine", DEFAULT_LABEL_CONFIG.showKitchenLine),
    storageLine: storage,
    compact: bool("compact", DEFAULT_LABEL_CONFIG.compact),
    accentBar: bool("accentBar", DEFAULT_LABEL_CONFIG.accentBar),
    footer: typeof v.footer === "string" ? (v.footer as string).slice(0, 120) : "",
  };
}
