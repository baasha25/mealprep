// Verticals — what a kitchen mainly sells (pure, tested).
//
// One product, four front doors. The tag is asked once at sign-up ("What do
// you mainly sell?"), sets sensible defaults, and decides what the dashboard
// shows first. It never locks a feature out: every hidden page is a Settings
// switch away, and a kitchen that is two of these at once just turns the
// second one on.

export const VERTICALS = ["meal_prep", "catering", "prepared_foods", "boxes"] as const;
export type Vertical = (typeof VERTICALS)[number];

export type VerticalMeta = {
  key: Vertical;
  label: string;
  blurb: string;
  /** Settings defaults applied at sign-up (the kitchen can change any of them). */
  defaults: { itemNoun: string; subscriptionsOnly: boolean; cateringEnabled: boolean };
  /** Sidebar pages hidden unless the matching feature is switched on. */
  hiddenNav: string[];
  /** Storefront headline when the kitchen hasn't written a tagline. */
  storeBlurb: string;
  /** What the dashboard's "to get started" line suggests first. */
  firstSteps: string[];
};

export const VERTICAL_META: Record<Vertical, VerticalMeta> = {
  meal_prep: {
    key: "meal_prep",
    label: "Meal prep",
    blurb: "Weekly meals, sold one-off or on a plan, with a cut-off and delivery days.",
    defaults: { itemNoun: "meal", subscriptionsOnly: false, cateringEnabled: false },
    hiddenNav: ["/dashboard/catering"],
    storeBlurb: "Browse the menu, build your order, and subscribe to save every week.",
    firstSteps: ["Add your menu and recipes", "Set delivery days and the cut-off", "Create a meal plan", "Connect Stripe"],
  },
  catering: {
    key: "catering",
    label: "Catering & large orders",
    blurb: "Office lunches, platters and events: requests, quotes, deposits and invoices.",
    defaults: { itemNoun: "item", subscriptionsOnly: false, cateringEnabled: true },
    hiddenNav: ["/dashboard/plans", "/dashboard/subscriptions"],
    storeBlurb: "Tell us the date and headcount and we'll send a quote. Nothing is charged until you approve it.",
    firstSteps: ["Add your menu and recipes", "Set your catering terms (notice, deposit, invoicing)", "Connect Stripe", "Share your catering link"],
  },
  prepared_foods: {
    key: "prepared_foods",
    label: "Prepared foods & soups",
    blurb: "Batch products such as soups, sauces, broths and frozen meals, sold retail and to shops.",
    defaults: { itemNoun: "item", subscriptionsOnly: false, cateringEnabled: false },
    hiddenNav: ["/dashboard/plans", "/dashboard/subscriptions", "/dashboard/catering"],
    storeBlurb: "Small-batch, made here. Order for pickup or delivery.",
    firstSteps: ["Add your products and recipes", "Set shelf life and labels", "Set pickup or delivery", "Connect Stripe"],
  },
  boxes: {
    key: "boxes",
    label: "Box subscriptions",
    blurb: "A recurring box: bakery, farm, juice, pet or baby food. Plans first, no weekly picking.",
    defaults: { itemNoun: "box", subscriptionsOnly: true, cateringEnabled: false },
    hiddenNav: ["/dashboard/catering", "/dashboard/pos"],
    storeBlurb: "Choose a plan and we'll deliver on your day, every week.",
    firstSteps: ["Add what goes in the box", "Create your plans", "Set delivery days", "Connect Stripe"],
  },
};

export const VERTICAL_LABEL: Record<Vertical, string> = Object.fromEntries(VERTICALS.map((v) => [v, VERTICAL_META[v].label])) as Record<Vertical, string>;

export function isVertical(v: unknown): v is Vertical {
  return typeof v === "string" && (VERTICALS as readonly string[]).includes(v);
}

export function toVertical(v: unknown, fallback: Vertical = "meal_prep"): Vertical {
  return isVertical(v) ? v : fallback;
}

/**
 * Which sidebar pages to hide for a kitchen. A page hidden by the vertical
 * comes back as soon as its feature is on (catering enabled, a plan exists),
 * so a meal-prep kitchen that starts catering sees Catering without touching
 * the tag.
 */
export function hiddenNavFor(vertical: Vertical, features: { cateringEnabled: boolean; hasPlans: boolean; subscriptionsOnly: boolean }): string[] {
  const hidden = new Set(VERTICAL_META[vertical].hiddenNav);
  if (features.cateringEnabled) hidden.delete("/dashboard/catering");
  if (features.hasPlans || features.subscriptionsOnly) {
    hidden.delete("/dashboard/plans");
    hidden.delete("/dashboard/subscriptions");
  }
  return Array.from(hidden);
}
