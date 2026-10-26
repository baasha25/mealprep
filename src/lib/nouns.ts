// What a kitchen sells, in its customers' words — pure (tested).
//
// PrepFlow started with meal-prep kitchens, but the same weekly cycle runs a
// juice company (bottles), a baby-food kitchen (pouches), a fresh pet-food
// maker (portions) or a bakery box. One setting swaps the noun everywhere a
// customer or the kitchen reads it; the data model is unchanged.

export type NounKey = "meal" | "portion" | "pouch" | "bottle" | "box" | "jar" | "loaf" | "bowl" | "pack" | "item";

export const NOUN_OPTIONS: { key: NounKey; one: string; many: string; hint: string }[] = [
  { key: "meal", one: "meal", many: "meals", hint: "Meal prep (default)" },
  { key: "portion", one: "portion", many: "portions", hint: "Fresh pet food, bulk prep" },
  { key: "pouch", one: "pouch", many: "pouches", hint: "Baby & toddler food" },
  { key: "bottle", one: "bottle", many: "bottles", hint: "Juice, smoothies, broth" },
  { key: "box", one: "box", many: "boxes", hint: "Farm boxes, bakery boxes" },
  { key: "jar", one: "jar", many: "jars", hint: "Overnight oats, salads in jars" },
  { key: "loaf", one: "loaf", many: "loaves", hint: "Bread subscriptions" },
  { key: "bowl", one: "bowl", many: "bowls", hint: "Bowl concepts" },
  { key: "pack", one: "pack", many: "packs", hint: "Snack packs, dumpling packs" },
  { key: "item", one: "item", many: "items", hint: "Anything else" },
];

export type Nouns = { key: NounKey; one: string; many: string; One: string; Many: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The noun set for a stored key; unknown/blank → meals. */
export function nounsFor(key: string | null | undefined): Nouns {
  const o = NOUN_OPTIONS.find((n) => n.key === (key ?? "").trim().toLowerCase()) ?? NOUN_OPTIONS[0];
  return { key: o.key, one: o.one, many: o.many, One: cap(o.one), Many: cap(o.many) };
}

/** "1 meal", "3 meals", "0 meals". */
export function countNoun(n: number, nouns: Nouns): string {
  return `${n} ${n === 1 ? nouns.one : nouns.many}`;
}

export function isNounKey(v: unknown): v is NounKey {
  return typeof v === "string" && NOUN_OPTIONS.some((n) => n.key === v);
}
