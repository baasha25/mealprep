import { getAnthropic } from "@/lib/anthropic";

export type MenuMealExtract = {
  name: string;
  description: string | null;
  priceCents: number | null;
  diet: string | null;
};

export type MenuExtract = {
  businessName: string | null;
  meals: MenuMealExtract[];
};

// Structured-output tool: forces Claude to return machine-readable meals instead
// of prose, so a menu photo/flyer/PDF becomes ready-to-create menu items.
const RECORD_TOOL = {
  name: "record_menu",
  description: "Record the meals listed on a meal-prep menu / flyer.",
  input_schema: {
    type: "object" as const,
    properties: {
      businessName: { type: ["string", "null"], description: "The kitchen/brand name if shown, else null." },
      meals: {
        type: "array",
        description: "One entry per distinct meal/dish on the menu.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The dish name, e.g. 'Grilled Chicken & Quinoa'." },
            description: { type: ["string", "null"], description: "The short description under the name, if any (max ~200 chars), else null." },
            price: { type: ["number", "null"], description: "The customer price in dollars (e.g. 12.5 for $12.50), or null if none is shown." },
            diet: { type: ["string", "null"], description: "A diet/category tag if clearly indicated (e.g. 'High Protein', 'Vegan', 'Keto', 'Low Carb'), else null." },
          },
          required: ["name"],
        },
      },
    },
    required: ["meals"],
  },
};

/**
 * Read a meal-prep menu (photo, flyer, or PDF) and return its dishes, ready to
 * create as menu items. Uses Claude Opus vision with a forced structured tool.
 */
export async function extractMenu(input: { base64: string; mediaType: string }): Promise<MenuExtract> {
  const anthropic = getAnthropic();
  const isPdf = input.mediaType === "application/pdf";

  const fileBlock = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: input.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: input.base64 } };

  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3072,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_menu" },
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text:
              "This is a meal-prep kitchen's menu (photo, flyer, or PDF). Extract every distinct meal: its name, the short description if shown, the customer price in dollars, and a diet/category tag only if clearly indicated. Do not invent prices or descriptions — use null when not shown. Then call record_menu.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No structured result returned.");
  }
  const data = toolUse.input as { businessName?: string | null; meals?: Array<{ name?: string; description?: string | null; price?: number | null; diet?: string | null }> };
  const meals: MenuMealExtract[] = (data.meals ?? [])
    .filter((m) => m && typeof m.name === "string" && m.name.trim())
    .map((m) => ({
      name: m.name!.trim().slice(0, 120),
      description: m.description ? String(m.description).trim().slice(0, 280) : null,
      priceCents: typeof m.price === "number" && m.price >= 0 ? Math.round(m.price * 100) : null,
      diet: m.diet ? String(m.diet).trim().slice(0, 40) : null,
    }));

  return { businessName: data.businessName ?? null, meals };
}
