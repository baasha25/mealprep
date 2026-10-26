// Which "Kitchens near you" region to open for a kitchen — pure (tested).
// Derived from the kitchen's own facts: the postal-code prefixes of its
// delivery zones first (the strongest signal), then the service-area text it
// typed in Settings → Brand, then the first region in the list.

export type KitchenEntry = { name: string; domain: string; city: string; region: string; platform: string; province: string };

/** Canadian postal-code first letter → province/territory. */
export function provinceForPostal(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toUpperCase()[0];
  if (!c) return null;
  if (/^\d$/.test(c)) return "US";
  const map: Record<string, string> = { A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC", K: "ON", L: "ON", M: "ON", N: "ON", P: "ON", R: "MB", S: "SK", T: "AB", V: "BC", X: "NT", Y: "YT" };
  return map[c] ?? null;
}

/** Metro-level hint from the first characters of a Canadian postal code; null when the province has one list only. */
export function regionHintForPostal(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (!c) return null;
  if (c[0] === "T") {
    if (/^T[23]/.test(c)) return "Calgary";
    if (/^T[56]/.test(c) || /^T8[A-HN]/.test(c)) return "Edmonton";
    return null;
  }
  if (c[0] === "G") return "Québec City / Lévis";
  if (c[0] === "H") return "Montréal / Laval / Rive-Sud";
  if (c[0] === "J") {
    if (/^J[89]/.test(c)) return "Gatineau / Outaouais";
    return "Montréal / Laval / Rive-Sud";
  }
  if (c[0] === "V") return "Vancouver / Lower Mainland";
  return null;
}

/**
 * Pick the default region. `postalPrefixes` are the kitchen's zone prefixes
 * (any), `serviceArea` is free text like "Surrey & Langley", `entries` is the
 * kitchens list. Returns a region name present in `entries`, or null when the
 * list is empty.
 */
export function regionForKitchen(input: { postalPrefixes: string[]; serviceArea: string | null | undefined }, entries: KitchenEntry[]): string | null {
  if (!entries.length) return null;
  const regions = [...new Set(entries.map((e) => e.region))];
  // 1. Province from the zones' postal prefixes → the first region in that province.
  const provinces = new Map<string, number>();
  for (const p of input.postalPrefixes) {
    const prov = provinceForPostal(p);
    if (prov) provinces.set(prov, (provinces.get(prov) ?? 0) + 1);
  }
  const topProvince = [...provinces.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topProvince) {
    // Within a province, the postal prefix can name the metro (T5/T6 = Edmonton, G = Québec City, J8/J9 = Outaouais…).
    const hinted = input.postalPrefixes.map(regionHintForPostal).find((r): r is string => !!r && regions.includes(r));
    if (hinted) return hinted;
    const r = entries.find((e) => e.province === topProvince)?.region;
    if (r) return r;
  }
  // 2. Service-area text mentions a region or a city we know.
  const text = String(input.serviceArea ?? "").toLowerCase();
  if (text) {
    const byRegion = regions.find((r) => r.toLowerCase().split(/[\/,&]+/).some((part) => part.trim().length > 2 && text.includes(part.trim())));
    if (byRegion) return byRegion;
    const byCity = entries.find((e) => e.city && text.includes(e.city.toLowerCase()))?.region;
    if (byCity) return byCity;
  }
  return regions[0];
}
