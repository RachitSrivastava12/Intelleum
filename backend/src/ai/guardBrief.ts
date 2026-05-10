import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface GuardBriefInput {
  action: string;
  route_label: string;
  protocol: string | null;
  notional_usd: number;
  expected_loss_at_risk_bps: number;
  expected_loss_at_risk_usd: number;
  reason_codes: string[];
  safer_alternatives: Array<{ label: string; estimated_bps_saved: number }>;
  objective: string;
}

export async function generateGuardBrief(input: GuardBriefInput): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  const reasonText = input.reason_codes.slice(0, 3).join(", ");
  const altText = input.safer_alternatives.length > 0
    ? `Safer alternative: ${input.safer_alternatives[0].label} saves ~${input.safer_alternatives[0].estimated_bps_saved.toFixed(1)} bps.`
    : "";

  const prompt = `You are Intelleum, a Solana MEV protection engine. Write a 2-sentence plain-English brief for this pre-trade guard decision.

Route: ${input.route_label} (${input.protocol ?? "unknown protocol"})
Trade size: $${input.notional_usd.toLocaleString()}
Decision: ${input.action.toUpperCase()}
Risk signals: ${reasonText}
Estimated loss at risk: ${input.expected_loss_at_risk_bps.toFixed(1)} bps ($${input.expected_loss_at_risk_usd.toFixed(0)})
Objective: ${input.objective}
${altText}

Write exactly 2 sentences. First: why this route is risky right now (cite specific signals). Second: what the trader/protocol should do. Be direct, no filler words. No markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
