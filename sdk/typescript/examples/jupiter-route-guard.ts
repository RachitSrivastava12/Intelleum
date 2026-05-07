import {
  IntelleumProtectClient,
  guardRequestFromJupiterQuote,
  type JupiterQuoteLike,
} from "../src/index";

const intelleum = new IntelleumProtectClient({
  baseUrl: process.env.INTELLEUM_API_URL ?? "http://localhost:8081",
  apiKey: process.env.INTELLEUM_API_KEY,
});

export async function guardJupiterQuote(quote: JupiterQuoteLike, notionalUsd: number) {
  const guard = await intelleum.guard(
    guardRequestFromJupiterQuote(quote, {
      notionalUsd,
      slippageBps: 50,
      objective: "protect_users",
    }),
  );

  if (guard.action === "block" || guard.action === "avoid") {
    throw new Error(
      `Blocked toxic route: ${guard.warning}. Expected loss at risk: $${guard.expected_loss_at_risk_usd}`,
    );
  }

  if (guard.action === "reroute" || guard.action === "penalize") {
    return {
      execute: false,
      reason: guard.warning,
      saferAlternatives: guard.safer_alternatives,
    };
  }

  return {
    execute: true,
    reason: guard.warning,
    saferAlternatives: guard.safer_alternatives,
  };
}
