// Meal-label design config — which fields print on the nutrition/allergen labels
// (paper and Zebra), plus an optional custom footer line. Stored per business on
// BusinessSettings.labelConfig; parsed defensively so a missing/partial value
// always yields a complete config.

export type LabelConfig = {
  showBusinessName: boolean;
  showMacros: boolean;
  showAllergens: boolean;
  showBestBy: boolean;
  footer: string; // free-form line, e.g. "Keep refrigerated · Consume within 3 days"
};

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  showBusinessName: true,
  showMacros: true,
  showAllergens: true,
  showBestBy: true,
  footer: "",
};

/** Merge an unknown stored value onto the defaults so callers get a full config. */
export function parseLabelConfig(value: unknown): LabelConfig {
  const v = (value ?? {}) as Record<string, unknown>;
  const bool = (k: keyof LabelConfig, d: boolean) =>
    typeof v[k] === "boolean" ? (v[k] as boolean) : d;
  return {
    showBusinessName: bool("showBusinessName", DEFAULT_LABEL_CONFIG.showBusinessName),
    showMacros: bool("showMacros", DEFAULT_LABEL_CONFIG.showMacros),
    showAllergens: bool("showAllergens", DEFAULT_LABEL_CONFIG.showAllergens),
    showBestBy: bool("showBestBy", DEFAULT_LABEL_CONFIG.showBestBy),
    footer: typeof v.footer === "string" ? (v.footer as string).slice(0, 120) : "",
  };
}
