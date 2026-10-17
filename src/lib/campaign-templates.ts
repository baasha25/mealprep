// Seasonal campaign templates — pure (tested). Each template is a ready-to-send
// email for a moment in the Canadian meal-prep calendar, with a suggested
// coupon. Tokens are filled from the kitchen's own facts; the owner can then
// edit, or ask Claude to rewrite it in their voice (src/lib/campaign-copy.ts).

export type CampaignSegment = "all" | "lapsed" | "subscribers";
export type CouponSuggestion = { code: string; type: "percent" | "flat"; value: number }; // value: whole % or cents

export type CampaignTemplate = {
  key: string;
  label: string;
  /** Months (1–12) when this is timely; empty = any time. */
  months: number[];
  segment: CampaignSegment;
  /** One line for the owner: when to send it and why it works. */
  brief: string;
  subject: string;
  body: string;
  coupon?: CouponSuggestion;
};

export type TemplateVars = {
  kitchen: string;
  /** " in Durham Region" or "" — already includes the leading " in ". */
  areaPhrase: string;
  storeUrl: string;
  /** The order cut-off as the kitchen writes it, e.g. "Sat 8:00 PM". */
  deadline: string;
  meal1: string;
  meal2: string;
  code: string;
  offer: string;
};

export const TEMPLATES: CampaignTemplate[] = [
  {
    key: "new-year",
    label: "New year reset",
    months: [1],
    segment: "all",
    brief: "First two weeks of January, when everyone has decided to eat better and nobody wants to cook.",
    subject: "New year, meals handled — {offer} this month",
    body: "The resolution is easy. The Sunday cooking is the part that fails.\n\nLet {kitchen} do that bit{areaPhrase}: real food, portioned, macros on the label, in your fridge each week. Use **{code}** at checkout for {offer} in January.\n\n[Order this week]({storeUrl}) — cut-off is {deadline}.",
    coupon: { code: "NEWYEAR15", type: "percent", value: 15 },
  },
  {
    key: "valentines",
    label: "Valentine's night in",
    months: [2],
    segment: "all",
    brief: "Send Feb 7–11. A dinner-for-two angle for people skipping the overbooked restaurants.",
    subject: "Dinner for two, no reservation needed",
    body: "Skip the 6:45 seating and the set menu. This week {kitchen} has **{meal1}** and **{meal2}** ready to plate at home.\n\nAdd two to your order with **{code}** for {offer}. Candles not included.\n\n[Order before {deadline}]({storeUrl})",
    coupon: { code: "VDAY10", type: "percent", value: 10 },
  },
  {
    key: "spring-reset",
    label: "Spring menu refresh",
    months: [3, 4],
    segment: "all",
    brief: "When the menu turns lighter. Lead with two dishes by name; new food is the best reason to email.",
    subject: "New on the menu: {meal1} and {meal2}",
    body: "Lighter plates are back at {kitchen}. **{meal1}** and **{meal2}** are on the menu now, and the rest of the lineup has moved with the season.\n\nFirst order of spring? **{code}** takes {offer}.\n\n[See the new menu]({storeUrl}) — order by {deadline}.",
    coupon: { code: "SPRING10", type: "percent", value: 10 },
  },
  {
    key: "mothers-day",
    label: "Mother's Day gift card",
    months: [5],
    segment: "all",
    brief: "Send ten days before Mother's Day. A week of meals is a gift people actually use; no coupon needed.",
    subject: "A week off cooking — the Mother's Day gift that gets used",
    body: "Flowers last a week. So does a week of {kitchen} meals, and she doesn't have to water them.\n\nGift cards are available in any amount from your account page; we email it to her, or to you to print. Pair it with her favourite: **{meal1}** goes down well.\n\n[Send a gift card]({storeUrl}/account)",
  },
  {
    key: "summer-heat",
    label: "Too hot to cook",
    months: [6, 7, 8],
    segment: "lapsed",
    brief: "Send during the first heat wave. Aimed at people who have drifted; the oven is the enemy.",
    subject: "Don't turn on the oven this week",
    body: "It's too hot to cook and too easy to order takeout three nights running. There's a middle option.\n\n{kitchen} meals are ready to heat (or eat cold: **{meal1}** works either way). Come back this week with **{code}** for {offer}.\n\n[Order before {deadline}]({storeUrl})",
    coupon: { code: "SUMMER15", type: "percent", value: 15 },
  },
  {
    key: "back-to-school",
    label: "Back to routine",
    months: [8, 9],
    segment: "all",
    brief: "Last week of August / first of September. Routines restart; weekday lunches are the pain point.",
    subject: "September is sorted: weekday lunches, done",
    body: "The lunch question is back, five days a week. {kitchen} answers it in one order.\n\nPick your week, we cook and label it, it's in the fridge Monday. **{code}** gives {offer} on your first September order.\n\n[Plan the week]({storeUrl}) — cut-off {deadline}.",
    coupon: { code: "SCHOOL10", type: "percent", value: 10 },
  },
  {
    key: "thanksgiving",
    label: "Thanksgiving week off",
    months: [10],
    segment: "all",
    brief: "Send the week before Canadian Thanksgiving. Pitch the days around the big meal, not the meal itself.",
    subject: "You're cooking Sunday. Let us cover the rest of the week.",
    body: "One big dinner is plenty. The Monday-to-Friday around it doesn't need to be leftovers and cereal.\n\nOrder your Thanksgiving-week meals from {kitchen} with **{code}** for {offer}, and spend the energy where it matters.\n\n[Order before {deadline}]({storeUrl})",
    coupon: { code: "THANKS10", type: "percent", value: 10 },
  },
  {
    key: "black-friday",
    label: "Black Friday · 48 hours",
    months: [11],
    segment: "all",
    brief: "Your one big discount of the year, with a hard 48-hour window. Turn the coupon off Sunday night.",
    subject: "{offer} for 48 hours — our only sale of the year",
    body: "We don't do discounts often, so this one is real: **{code}** takes {offer} your order, this weekend only.\n\nStock up on **{meal1}** and **{meal2}**, or start a weekly plan and lock in the saving on the first delivery.\n\n[Order now]({storeUrl}) — the code switches off Sunday at midnight.",
    coupon: { code: "BF20", type: "percent", value: 20 },
  },
  {
    key: "holiday-gift",
    label: "Holiday gift cards + December dates",
    months: [12],
    segment: "all",
    brief: "Early December. Two jobs in one email: gift cards for the hard-to-buy-for, and your holiday delivery dates.",
    subject: "Gift cards for the hard-to-buy-for, and our December dates",
    body: "For the person who has everything except time: a {kitchen} gift card, any amount, sent by email in a minute.\n\nAnd a note for regulars: holiday delivery dates and the last cut-off before the break are on the storefront. Subscribers can skip or pause any week from their account.\n\n[Gift cards and December dates]({storeUrl})",
  },
  {
    key: "win-back",
    label: "We miss you (win-back)",
    months: [],
    segment: "lapsed",
    brief: "Any time. Goes to customers with no order in 45+ days. Short, warm, one clear offer.",
    subject: "We miss you — {offer} to come back",
    body: "It's been a while since your last {kitchen} order, and the menu has moved on: **{meal1}** and **{meal2}** are both new since then.\n\nIf life got busy, this is the easy way back: **{code}** for {offer} on your next order.\n\n[See what's new]({storeUrl}) — cut-off {deadline}.",
    coupon: { code: "COMEBACK15", type: "percent", value: 15 },
  },
  {
    key: "new-menu",
    label: "New dishes this week",
    months: [],
    segment: "all",
    brief: "Whenever two or more dishes land. No discount needed; the food is the news.",
    subject: "New this week: {meal1}",
    body: "Two new plates at {kitchen} this week: **{meal1}** and **{meal2}**. Same portions, same labels, new reasons to look forward to lunch.\n\nThey're on the storefront now and in the plan picker for subscribers.\n\n[Try them this week]({storeUrl}) — order by {deadline}.",
  },
  {
    key: "referral",
    label: "Bring a friend",
    months: [],
    segment: "subscribers",
    brief: "To active subscribers every couple of months. Their referral code is on their account page.",
    subject: "Know someone who'd love this? You both get points",
    body: "You've already figured out the weekly meals thing. Someone in your group chat hasn't.\n\nYour personal referral code is on your account page. When a friend uses it on their first {kitchen} order, you both earn loyalty points toward free meals.\n\n[Find your code]({storeUrl}/account)",
  },
  {
    key: "subscriber-thanks",
    label: "Thank-you to subscribers",
    months: [],
    segment: "subscribers",
    brief: "Quarterly. No ask; a reminder of what they get and the one thing they can do (swap, skip, rate).",
    subject: "Thank you — and three things you might not know",
    body: "You're the reason {kitchen} gets to plan a week ahead, buy the right amount, and waste almost nothing. Thank you.\n\nThree things you can do from your account: swap meals before the {deadline} cut-off, skip or pause any week, and rate your meals (we read every one).\n\n[Your account]({storeUrl}/account)",
  },
];

export function templateByKey(key: string): CampaignTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/** "15% off" / "$10.00 off" for a coupon suggestion. */
export function offerLabel(c: CouponSuggestion | undefined): string {
  if (!c) return "";
  return c.type === "percent" ? `${c.value}% off` : `$${(c.value / 100).toFixed(2)} off`;
}

/** Replace {tokens}; anything unknown is left as-is so it's visible to the owner. */
export function fillTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k as keyof TemplateVars];
    return v === undefined || v === null ? m : String(v);
  });
}

/**
 * Templates ordered for right now: in-season first (this month, then next
 * month), then evergreen, then out-of-season. `now` marks the timely ones.
 */
export function templatesForDate(date: Date = new Date()): (CampaignTemplate & { now: boolean })[] {
  const month = date.getMonth() + 1;
  const next = (month % 12) + 1;
  const rank = (t: CampaignTemplate) => (t.months.includes(month) ? 0 : t.months.includes(next) ? 1 : t.months.length === 0 ? 2 : 3);
  return [...TEMPLATES]
    .map((t) => ({ ...t, now: t.months.includes(month) || t.months.includes(next) }))
    .sort((a, b) => rank(a) - rank(b));
}

/** Build the full variable set for a kitchen (what the page passes to the form). */
export function templateVars(input: {
  kitchen: string;
  serviceArea?: string | null;
  storeUrl: string;
  cutoff: string;
  topMeals: string[];
  coupon?: CouponSuggestion;
}): TemplateVars {
  const [m1, m2] = input.topMeals;
  return {
    kitchen: input.kitchen,
    areaPhrase: input.serviceArea?.trim() ? ` in ${input.serviceArea.trim()}` : "",
    storeUrl: input.storeUrl,
    deadline: input.cutoff || "the weekly cut-off",
    meal1: m1 ?? "this week's menu",
    meal2: m2 ?? "the rest of the menu",
    code: input.coupon?.code ?? "",
    offer: offerLabel(input.coupon),
  };
}
