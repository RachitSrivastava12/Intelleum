// ============================================================
// KNOWN DEX PROGRAM IDs ON SOLANA
// ============================================================

export const DEX_PROGRAMS: Record<string, string> = {
  // Raydium
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium_amm",
  "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h": "raydium_amm_v3",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "raydium_clmm",
  "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS":  "raydium_router",

  // Orca / Whirlpool
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": "orca_v1",
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1": "orca_v2",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc":  "orca_whirlpool",

  // Meteora
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EkRBj45":  "meteora_pools",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo":  "meteora_dlmm",

  // Jupiter (aggregator)
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB":   "jupiter_v4",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4":   "jupiter_v6",

  // Phoenix (CLOB)
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY":   "phoenix",

  // Lifinity
  "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S":   "lifinity",
};

export const LENDING_PROGRAMS: Record<string, string> = {
  "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo": "solend",
  "MFv2hWf31Z9kbCa1snEPdcgp168vLLAkezvaP73jE57":  "marginfi",
  "4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY": "kamino",
  "JD3bq9hGdy38PuWQ4h2YJpELmHVGPPfFSuFkpzAd9zfu": "solend_v2",
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH": "drift",
};

export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
export const USDC_MINT   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT   = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export function getDexName(programId: string): string | null {
  return DEX_PROGRAMS[programId] ?? null;
}

export function getLendingName(programId: string): string | null {
  return LENDING_PROGRAMS[programId] ?? null;
}

export function getProgramLabel(programId: string | null | undefined): string | null {
  if (!programId) return null;
  return DEX_PROGRAMS[programId] ?? LENDING_PROGRAMS[programId] ?? null;
}

export function isDex(programId: string): boolean {
  return programId in DEX_PROGRAMS;
}

export function isLending(programId: string): boolean {
  return programId in LENDING_PROGRAMS;
}

// Stablecoins + major tokens we can price
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  [WRAPPED_SOL]: { symbol: "SOL", decimals: 9 },
  [USDC_MINT]:   { symbol: "USDC", decimals: 6 },
  [USDT_MINT]:   { symbol: "USDT", decimals: 6 },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", decimals: 9 },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", decimals: 8 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", decimals: 9 },
};
