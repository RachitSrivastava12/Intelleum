import { getProgramLabel, isDex, isLending } from "./programs";

export interface TokenFlow {
  tx_sig: string;
  slot: number;
  wallet: string;
  mint: string;
  delta_raw: bigint;
  delta_usd: number | null;
  pool_address: string | null;
  program_id: string | null;
}

function keyToAddress(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.pubkey === "string") return value.pubkey;
  return value.toBase58?.() ?? null;
}

function instructionProgramId(ix: any, accountKeys: any[]): string | null {
  if (typeof ix?.programId === "string") return ix.programId;
  if (typeof ix?.programIdIndex === "number") {
    return keyToAddress(accountKeys[ix.programIdIndex]);
  }
  return null;
}

function instructionAccounts(ix: any): Array<string | number> {
  if (Array.isArray(ix?.accounts)) return ix.accounts;
  if (Array.isArray(ix?.accountKeyIndexes)) return ix.accountKeyIndexes;
  return [];
}

function transactionAccountKeys(tx: any): any[] {
  const message: any = tx.transaction.message;
  if (!("compiledInstructions" in message)) return message.accountKeys ?? [];

  return [
    ...(message.staticAccountKeys ?? []),
    ...(tx.meta?.loadedAddresses?.writable ?? []),
    ...(tx.meta?.loadedAddresses?.readonly ?? []),
  ];
}

function transactionInstructions(tx: any): any[] {
  const message: any = tx.transaction.message;
  const topLevel = "compiledInstructions" in message
    ? message.compiledInstructions ?? []
    : message.instructions ?? [];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((entry: any) => entry.instructions ?? []);
  return [...topLevel, ...inner];
}

function preferredPoolPositions(programLabel: string | null): number[] {
  switch (programLabel) {
    case "raydium_amm":
    case "raydium_amm_v3":
    case "raydium_amm_v4":
    case "raydium_cpmm":
    case "raydium_stable_amm":
    case "raydium_clmm":
    case "raydium_launchlab":
      return [1, 2, 3, 4, 5, 6];
    case "orca_v1":
    case "orca_v2":
    case "orca_whirlpool":
      return [0, 1, 2, 3, 4, 5];
    case "meteora_pools":
    case "meteora_dlmm":
      return [0, 1, 2, 3, 4, 5];
    case "phoenix":
      return [0, 1, 2, 3];
    default:
      return [0, 1, 2, 3, 4];
  }
}

function isAggregatorLike(programLabel: string | null) {
  return (
    programLabel === "jupiter_v4" ||
    programLabel === "jupiter_v6" ||
    programLabel === "raydium_router"
  );
}

function derivePoolAddress(
  instructions: any[],
  accountKeys: any[],
  signer: string | null,
  dexProgram: string | null,
): string | null {
  if (!dexProgram || !instructions?.length) return null;
  const programLabel = getProgramLabel(dexProgram);
  if (isAggregatorLike(programLabel)) return null;

  const excluded = new Set([
    signer,
    dexProgram,
    "11111111111111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
    "SysvarC1ock11111111111111111111111111111111",
    "SysvarRent111111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFvGFMSEh5z1Q7P8GJj",
    "ATokenGPvbdGVxr1cW2hvZbsiqW5xWH25efTNsLJA8knL",
  ].filter(Boolean) as string[]);

  const scoreByAccount = new Map<string, number>();
  const preferred = preferredPoolPositions(programLabel);

  for (const ix of instructions) {
    const pid = instructionProgramId(ix, accountKeys);
    if (pid !== dexProgram) continue;

    for (const [position, ref] of instructionAccounts(ix).entries()) {
      const address =
        typeof ref === "number"
          ? keyToAddress(accountKeys[ref])
          : typeof ref === "string"
            ? ref
            : null;
      if (!address || excluded.has(address)) continue;
      if (address.length < 32 || address.length > 44) continue;

      const writable =
        typeof ref === "number"
          ? Boolean(accountKeys[ref]?.writable)
          : true;
      const executable =
        typeof ref === "number"
          ? Boolean(accountKeys[ref]?.executable)
          : false;
      if (executable) continue;

      let score = writable ? 4 : 1;
      if (preferred.includes(position)) {
        score += Math.max(2, preferred.length - preferred.indexOf(position));
      }
      if (position <= 2) score += 2;
      if (position === 0) score += 1;
      scoreByAccount.set(address, (scoreByAccount.get(address) ?? 0) + score);
    }
  }

  return [...scoreByAccount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function extractTokenFlows(
  block: any,
  slot: number,
  priceMap: Map<string, number>,
): Promise<TokenFlow[]> {
  const flows: TokenFlow[] = [];

  for (const tx of block.transactions ?? []) {
    const meta = tx.meta;
    if (!meta || meta.err !== null) continue;

    const sig = tx.transaction.signatures[0];
    const accountKeys = transactionAccountKeys(tx);
    if (!accountKeys?.length) continue;

    const instructions = transactionInstructions(tx);
    const programIds = new Set<string>();
    for (const ix of instructions ?? []) {
      const pid = instructionProgramId(ix, accountKeys);
      if (pid) programIds.add(pid);
    }

    const dexPrograms = [...programIds].filter((programId) => isDex(programId));
    const dexProgram =
      dexPrograms.find((programId) => !isAggregatorLike(getProgramLabel(programId))) ??
      dexPrograms[0] ??
      null;
    const lendingProgram =
      [...programIds].find((programId) => isLending(programId)) ?? null;
    const relevantProgram = dexProgram ?? lendingProgram;

    const signer = keyToAddress(accountKeys[0]);
    const poolAddress = derivePoolAddress(instructions ?? [], accountKeys, signer, dexProgram);

    const pre: any[] = meta.preTokenBalances ?? [];
    const post: any[] = meta.postTokenBalances ?? [];
    const preMap = new Map<number, { mint: string; amount: bigint }>();

    for (const balance of pre) {
      preMap.set(balance.accountIndex, {
        mint: balance.mint,
        amount: BigInt(balance.uiTokenAmount?.amount ?? "0"),
      });
    }

    for (const balance of post) {
      const preBalance = preMap.get(balance.accountIndex);
      const mint = balance.mint;
      const postAmt = BigInt(balance.uiTokenAmount?.amount ?? "0");
      const preAmt = preBalance?.amount ?? 0n;
      const delta = postAmt - preAmt;
      if (delta === 0n) continue;

      const owner = balance.owner ?? keyToAddress(accountKeys[balance.accountIndex]);
      if (!owner) continue;

      const price = priceMap.get(mint) ?? null;
      const decimals = balance.uiTokenAmount?.decimals ?? 6;
      const deltaUsd =
        price !== null ? (Number(delta) / Math.pow(10, decimals)) * price : null;

      flows.push({
        tx_sig: sig,
        slot,
        wallet: owner,
        mint,
        delta_raw: delta,
        delta_usd: deltaUsd,
        pool_address: poolAddress,
        program_id: relevantProgram,
      });
    }

    const preSOL: bigint[] = (meta.preBalances ?? []).map((balance: number) => BigInt(balance));
    const postSOL: bigint[] = (meta.postBalances ?? []).map((balance: number) => BigInt(balance));

    for (let i = 0; i < postSOL.length; i++) {
      const delta = postSOL[i] - (preSOL[i] ?? 0n);
      if (delta === 0n) continue;

      const wallet = keyToAddress(accountKeys[i]);
      if (!wallet) continue;

      const solPrice = priceMap.get("So11111111111111111111111111111111111111112") ?? null;
      const deltaUsd = solPrice !== null ? (Number(delta) / 1e9) * solPrice : null;

      flows.push({
        tx_sig: sig,
        slot,
        wallet,
        mint: "So11111111111111111111111111111111111111112",
        delta_raw: delta,
        delta_usd: deltaUsd,
        pool_address: poolAddress,
        program_id: relevantProgram,
      });
    }
  }

  return flows;
}
