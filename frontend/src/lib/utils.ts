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

export function truncateAddress(addr: string, start = 8, end = 4) {
  if (!addr) return "—";
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
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
    return prettyPair ? `${source?.toUpperCase()} route • ${prettyPair}` : `${source?.toUpperCase()} route`;
  }
  if (pool.startsWith("venue:")) {
    const [, venue, pair] = pool.split(":");
    const prettyPair = pair?.split("->").map(tokenLabel).join(" / ");
    return prettyPair ? `${venue} venue • ${prettyPair}` : `${venue} venue`;
  }
  if (pool.startsWith("pair:")) {
    const [, pair] = pool.split(":");
    return pair ? `Pair • ${pair.split("->").map(tokenLabel).join(" / ")}` : "Pair";
  }
  return truncateAddress(pool);
}

export function surfaceProtocolLabel(pool?: string | null, fallbackProtocol?: string | null) {
  if (fallbackProtocol) return fallbackProtocol.toUpperCase();
  if (!pool) return "—";
  if (pool.startsWith("route:") || pool.startsWith("venue:")) {
    return pool.split(":")[1]?.toUpperCase() ?? "—";
  }
  if (pool.startsWith("pair:")) return "PAIR";
  return "POOL";
}

export function formatRelativeTime(ts?: string | null) {
  if (!ts) return "never";
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  if (diff < 30_000) return "just now";
  if (diff < 60_000) return "less than a minute ago";
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes} min ago`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours} hr ago`;
  }
  const days = Math.floor(diff / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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
