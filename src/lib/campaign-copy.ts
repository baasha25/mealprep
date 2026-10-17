import { getAnthropic } from "@/lib/anthropic";

export type CampaignDraftInput = {
  kitchen: string;
  serviceArea: string | null;
  segment: "all" | "lapsed" | "subscribers";
  /** The template the owner started from (label + brief), if any. */
  template: { label: string; brief: string } | null;
  /** What the owner already has in the boxes — rewrite it, don't ignore it. */
  currentSubject: string;
  currentMessage: string;
  /** "15% off with code NEWYEAR15" or null when there is no offer. */
  offer: string | null;
  topMeals: string[];
  storeUrl: string;
  cutoff: string;
};

export type CampaignDraft = { subject: string; message: string };

// Structured output: subject + message only, nothing to parse out of prose.
const WRITE_TOOL = {
  name: "write_campaign",
  description: "Return the finished marketing email for the kitchen.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string", description: "Email subject line, under 70 characters, no clickbait, at most one emoji." },
      message: {
        type: "string",
        description:
          "The email body: 60–130 words, 2–4 short paragraphs separated by a blank line. Light markdown only: **bold** and [link text](url). Must end with one link to the store URL. Include the offer code verbatim if one is given.",
      },
    },
    required: ["subject", "message"],
  },
};

const SEGMENT_NOTE: Record<CampaignDraftInput["segment"], string> = {
  all: "every customer on the list (mix of regulars and one-time buyers)",
  lapsed: "customers who have not ordered in 45+ days — warm, no guilt, one clear reason to come back",
  subscribers: "active weekly subscribers — they already buy; inform and thank, don't hard-sell",
};

/**
 * Write (or rewrite) a campaign email in the kitchen's voice from its real
 * facts. Uses only what it is given: no invented dishes, dates, prices or
 * claims. Costs one short Claude call; callers rate-limit per kitchen.
 */
export async function draftCampaignCopy(input: CampaignDraftInput): Promise<CampaignDraft> {
  const anthropic = getAnthropic();
  const facts = [
    `Kitchen: ${input.kitchen}${input.serviceArea ? ` (serves ${input.serviceArea})` : ""} — an independent meal-prep kitchen; customers order online, meals arrive portioned and labelled.`,
    `Audience: ${SEGMENT_NOTE[input.segment]}.`,
    input.template ? `Occasion: ${input.template.label}. Why now: ${input.template.brief}` : "Occasion: none in particular; a plain update.",
    input.offer ? `Offer: ${input.offer}. Include the code exactly as written.` : "Offer: none. Do not invent a discount.",
    input.topMeals.length ? `Dishes you may name (use at most two, exactly as written): ${input.topMeals.join("; ")}.` : "Do not name specific dishes.",
    `Order cut-off (quote exactly if you mention it): ${input.cutoff || "weekly"}.`,
    `Store URL for the closing link: ${input.storeUrl}`,
  ].join("\n");

  const current =
    input.currentSubject.trim() || input.currentMessage.trim()
      ? `\n\nThe owner's current draft (keep its intent and any specifics; improve the writing):\nSubject: ${input.currentSubject}\n\n${input.currentMessage}`
      : "";

  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 700,
    tools: [WRITE_TOOL],
    tool_choice: { type: "tool", name: "write_campaign" },
    system:
      "You write short marketing emails for small Canadian meal-prep kitchens. Voice: warm, direct, specific, a little dry; never salesy, never exclamation-heavy. Canadian spelling. Plain words over hype. Never invent facts: no dishes, prices, dates, ingredients or claims beyond the facts provided. One idea per paragraph. The last line is a single markdown link to the store URL with a concrete verb (\"Order this week\", \"See the new menu\").",
    messages: [{ role: "user", content: `Write the email.\n\nFacts:\n${facts}${current}` }],
  });

  const tool = message.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("No draft returned.");
  const out = tool.input as Partial<CampaignDraft>;
  const subject = String(out.subject ?? "").trim().slice(0, 140);
  const body = String(out.message ?? "").trim().slice(0, 4000);
  if (!subject || !body) throw new Error("Empty draft returned.");
  return { subject, message: body };
}
