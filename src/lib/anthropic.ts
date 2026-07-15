import Anthropic from "@anthropic-ai/sdk";

// Gated like the other vendor integrations: the app runs fine without a key,
// the invoice-scan feature just stays off until ANTHROPIC_API_KEY is set.
const key = process.env.ANTHROPIC_API_KEY ?? "";
export const ANTHROPIC_ENABLED = key.startsWith("sk-ant-");

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!ANTHROPIC_ENABLED) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}
