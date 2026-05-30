import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TOKEN_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};

const PROTOCOL_LABELS: Record<string, string> = {
  raydium: "Raydium",
  raydium_amm: "Raydium AMM",
  raydium_amm_v4: "Raydium AMM v4",
  raydium_cpmm: "Raydium CPMM",
  raydium_clmm: "Raydium CLMM",
  raydium_launchlab: "Raydium LaunchLab",
  raydium_launchpad: "Raydium LaunchLab",
  raydium_router: "Raydium Router",
  raydium_stable_amm: "Raydium Stable AMM",
  orca_whirlpool: "Orca Whirlpool",
  meteora_dlmm: "Meteora DLMM",
};

export function truncateAddress(addr: string, start = 8, end = 4) {
  if (!addr) return "—";
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function protocolLabel(protocol?: string | null) {
  if (!protocol) return "Unknown";
  return PROTOCOL_LABELS[protocol] ?? protocol.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function tokenLabel(mint?: string | null) {
  if (!mint) return "UNKNOWN";
  return TOKEN_SYMBOLS[mint] ?? truncateAddress(mint, 6, 4);
}

export function isSyntheticPool(pool?: string | null) {
  return !!pool && (pool.startsWith("route:") || pool.startsWith("venue:") || pool.startsWith("pair:"));
}

export function looksLikeSolanaAddress(value?: string | null) {
  return !!value && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function canOpenSolscanAccount(value?: string | null) {
  return !!value && !isSyntheticPool(value) && looksLikeSolanaAddress(value);
}

export function formatPoolLabel(pool?: string | null) {
  if (!pool) return "Unknown venue";
  if (pool.startsWith("route:")) {
    const [, source, pair] = pool.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ");
    return prettyPair ? `${protocolLabel(source)} route • ${prettyPair}` : `${protocolLabel(source)} route`;
  }
  if (pool.startsWith("venue:")) {
    const [, venue, pair] = pool.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ");
    return prettyPair ? `${protocolLabel(venue)} venue • ${prettyPair}` : `${protocolLabel(venue)} venue`;
  }
  if (pool.startsWith("pair:")) {
    const [, pair] = pool.split(":");
    return pair ? `Pair • ${pair.split("->").map(tokenLabel).join(" / ")}` : "Pair";
  }
  return truncateAddress(pool);
}

export function surfaceProtocolLabel(pool?: string | null, fallbackProtocol?: string | null) {
  if (fallbackProtocol) return protocolLabel(fallbackProtocol);
  if (!pool) return "—";
  if (pool.startsWith("route:") || pool.startsWith("venue:")) {
    return protocolLabel(pool.split(":")[1]);
  }
  if (pool.startsWith("pair:")) return "PAIR";
  return "POOL";
}

export function formatRelativeTime(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) + " UTC";
}

export function formatDayLabel(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short" });
}

export function formatCalendarDate(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
