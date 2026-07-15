import { getAnthropic } from "@/lib/anthropic";

export type InvoiceLine = {
  name: string;
  qty: number;
  unit: string;
  totalCostCents: number;
};

export type InvoiceExtract = {
  vendor: string | null;
  date: string | null;
  lines: InvoiceLine[];
};

// Structured-output tool: forces Claude to return machine-readable line items
// instead of prose, so we never have to parse free text.
const RECORD_TOOL = {
  name: "record_invoice",
  description: "Record the structured line items of a food/supplier invoice.",
  input_schema: {
    type: "object" as const,
    properties: {
      vendor: { type: ["string", "null"], description: "Supplier/vendor name, or null if unclear." },
      date: { type: ["string", "null"], description: "Invoice date as YYYY-MM-DD, or null if unclear." },
      lines: {
        type: "array",
        description: "One entry per purchased line item.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Product/ingredient name, e.g. 'Chicken breast'." },
            qty: { type: "number", description: "Quantity received, in the stated unit." },
            unit: { type: "string", description: "Unit of measure, e.g. kg, lb, g, oz, L, ea, case." },
            totalCostCents: { type: "integer", description: "Total cost for this line in integer cents (e.g. $12.50 = 1250)." },
          },
          required: ["name", "qty", "unit", "totalCostCents"],
        },
      },
    },
    required: ["lines"],
  },
};

/**
 * Read a supplier invoice image or PDF and return its line items.
 * Uses Claude Opus vision with a forced structured-output tool call.
 */
export async function extractInvoice(input: {
  base64: string;
  mediaType: string;
}): Promise<InvoiceExtract> {
  const anthropic = getAnthropic();
  const isPdf = input.mediaType === "application/pdf";

  const fileBlock = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: input.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: input.base64 } };

  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_invoice" },
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text:
              "This is a supplier/food invoice for a meal-prep kitchen. Extract every purchased line item: product name, quantity with its unit, and the TOTAL cost for that line (in cents). Combine obvious duplicates. If a number is unclear, give your best estimate rather than skipping the line. Then call record_invoice.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No structured result returned.");
  }
  const data = toolUse.input as Partial<InvoiceExtract>;
  const lines = (data.lines ?? []).filter(
    (l) => l && typeof l.name === "string" && l.name.trim() && Number.isFinite(l.qty),
  );
  return { vendor: data.vendor ?? null, date: data.date ?? null, lines };
}
