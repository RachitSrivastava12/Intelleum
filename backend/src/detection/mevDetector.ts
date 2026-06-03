// ============================================================
// MEV DETECTION ENGINE
// Pure in-memory detection over token flows for a given slot.
// DEX-specific confidence boosts: Raydium surfaces and Orca Whirlpools.
// ============================================================

import {
  MAX_PROFIT_USD,
  MAX_VICTIM_LOSS_USD,
  OrcaProgramMeta,
  RaydiumProgramMeta,
  getOrcaProgramMeta,
  getOrcaProgramMetaById,
  getRaydiumProgramMeta,
  getRaydiumProgramMetaById,
  isRaydiumConstantProduct,
} from "../ingestion/programs";

export interface TxFlow {
  tx_sig: string;
  tx_index: number;
  signer: string;
  slot: number;
  block_time: Date;
  validator: string;
  priority_fee: number | null;
  program_labels?: string[];
  log_text?: string;
  flows: Array<{
    wallet: string;
    mint: string;
    delta_raw: bigint;
    delta_usd: number | null;
    pool_address: string | null;
    program_id: string | null;
  }>;
}

export interface DetectedAttack {
  attack_type:
    | "sandwich"
    | "arbitrage"
    | "jit"
    | "liquidation"
    | "backrun"
    | "liquidity_snipe"
    | "liquidity_drain";
  slot: number;
  block_time: Date;
  validator: string;
  attacker_wallet: string;
  victim_wallet: string | null;
  pool_address: string;
  token_mint: string | null;
  profit_usd: number | null;
  victim_loss_usd: number | null;
  frontrun_tx: string | null;
  victim_tx: string | null;
  backrun_tx: string | null;
  tip_lamports: number | null;
  confidence: number;
  detector: string;
  evidence: string[];
}

const STABLE_AND_MAJOR_MINTS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

function compareTxOrder(a: TxFlow, b: TxFlow) {
  if (a.slot !== b.slot) return a.slot - b.slot;
  return a.tx_index - b.tx_index;
}

function estimateRoundTripProfit(front: TxFlow, back: TxFlow, signer: string) {
  const frontStableSpend = front.flows
    .filter(
      (flow) =>
        flow.wallet === signer &&
        flow.delta_raw < 0n &&
        flow.delta_usd !== null &&
        [
          "So11111111111111111111111111111111111111112",
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ].includes(flow.mint),
    )
    .reduce((sum, flow) => sum + Math.abs(flow.delta_usd ?? 0), 0);

  const backStableReceive = back.flows
    .filter(
      (flow) =>
        flow.wallet === signer &&
        flow.delta_raw > 0n &&
        flow.delta_usd !== null &&
        [
          "So11111111111111111111111111111111111111112",
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ].includes(flow.mint),
    )
    .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0);

  const pnl = backStableReceive - frontStableSpend;
  return pnl > 0 ? Number(pnl.toFixed(2)) : estimateProfit(back.flows, signer);
}

function hasAddLiquidityText(tx: TxFlow) {
  const text = `${tx.program_labels?.join(" ") ?? ""}\n${tx.log_text ?? ""}`.toLowerCase();
  return (
    text.includes("add_liquidity") ||
    text.includes("add liquidity") ||
    text.includes("increase_liquidity") ||
    text.includes("increase liquidity") ||
    text.includes("deposit liquidity") ||
    text.includes("instruction: increaseliquidity") ||
    // CLMM open_position / open_position_with_token22_nft — new position creation also
    // counts as adding liquidity for JIT purposes (attacker opens then immediately closes)
    text.includes("open_position") ||
    text.includes("openposition") ||
    text.includes("instruction: openposition")
  );
}

function hasRemoveLiquidityText(tx: TxFlow) {
  const text = `${tx.program_labels?.join(" ") ?? ""}\n${tx.log_text ?? ""}`.toLowerCase();
  return (
    text.includes("remove_liquidity") ||
    text.includes("remove liquidity") ||
    text.includes("decrease_liquidity") ||
    text.includes("decrease liquidity") ||
    text.includes("withdraw_liquidity") ||
    text.includes("withdraw liquidity") ||
    text.includes("close_position") ||
    text.includes("close position") ||
    text.includes("instruction: decreaseliquidity") ||
    // CLMM close_position — paired with open_position-based JIT
    text.includes("closeposition") ||
    text.includes("instruction: closeposition")
  );
}

function raydiumMetaForTx(...txs: TxFlow[]): RaydiumProgramMeta | null {
  for (const tx of txs) {
    for (const flow of tx.flows) {
      const byId = getRaydiumProgramMetaById(flow.program_id);
      if (byId) return byId;
    }
    for (const label of tx.program_labels ?? []) {
      const byLabel = getRaydiumProgramMeta(label);
      if (byLabel) return byLabel;
    }
  }
  return null;
}

function orcaMetaForTx(...txs: TxFlow[]): OrcaProgramMeta | null {
  for (const tx of txs) {
    for (const flow of tx.flows) {
      const byId = getOrcaProgramMetaById(flow.program_id);
      if (byId) return byId;
    }
    for (const label of tx.program_labels ?? []) {
      const byLabel = getOrcaProgramMeta(label);
      if (byLabel) return byLabel;
    }
  }
  return null;
}

function executionFeeSignal(lamports?: number | null) {
  if (!lamports || lamports <= 0) return null;
  if (lamports >= 120_000) return "high priority-fee / bundle-lane signal";
  if (lamports >= 25_000) return "elevated priority-fee signal";
  return "low priority-fee signal";
}

function raydiumEvidence(meta: RaydiumProgramMeta | null) {
  if (!meta) return null;
  if (meta.protocol === "raydium_cpmm" || meta.protocol === "raydium_clmm") {
    return `${meta.label} confirmed; fee and tick/config fields should be read from ${meta.configEndpoint}`;
  }
  if (meta.protocol === "raydium_launchlab") {
    return `${meta.label} confirmed; launch curve and graduation state should be read from LaunchState`;
  }
  return `${meta.label} confirmed; classify risk using the underlying pool state, not a hardcoded fee tier`;
}

function orcaEvidence(meta: OrcaProgramMeta | null) {
  if (!meta) return null;
  if (meta.protocol === "orca_whirlpool") {
    return `${meta.label} confirmed; read Whirlpool feeRate/protocolFeeRate, tickSpacing, TickArrays, and adaptive-fee Oracle state`;
  }
  return `${meta.label} confirmed; treat as legacy Orca flow and prefer cleaner Whirlpool alternatives when available`;
}

export async function detectSandwiches(
  slotTxs: TxFlow[],
  slot: number,
): Promise<DetectedAttack[]> {
  const attacks: DetectedAttack[] = [];
  const byPool = new Map<string, TxFlow[]>();

  for (const tx of slotTxs) {
    for (const flow of tx.flows) {
      if (!flow.pool_address) continue;
      if (!byPool.has(flow.pool_address)) byPool.set(flow.pool_address, []);
      const entries = byPool.get(flow.pool_address)!;
      if (!entries.find((candidate) => candidate.tx_sig === tx.tx_sig)) {
        entries.push(tx);
      }
    }
  }

  for (const [poolAddress, txs] of byPool) {
    txs.sort((a, b) => a.tx_index - b.tx_index);

    for (let i = 0; i < txs.length - 2; i++) {
      const frontrun = txs[i];
      for (let k = i + 2; k < txs.length; k++) {
        const backrun = txs[k];
        if (frontrun.signer !== backrun.signer) continue;

        let bestVictim:
          | {
              tx: TxFlow;
              loss: number;
              mint: string;
            }
          | null = null;

        for (let j = i + 1; j < k; j++) {
          const victim = txs[j];
          if (victim.signer === frontrun.signer) continue;

          const frontFlows = frontrun.flows.filter(
            (flow) => flow.pool_address === poolAddress,
          );
          const backFlows = backrun.flows.filter(
            (flow) => flow.pool_address === poolAddress,
          );

          const buy = frontFlows.find(
            (flow) => flow.wallet === frontrun.signer && flow.delta_raw > 0n,
          );
          const sell = backFlows.find(
            (flow) => flow.wallet === backrun.signer && flow.delta_raw < 0n,
          );

          if (!buy || !sell || buy.mint !== sell.mint) continue;
          const victimLoss = estimateVictimLoss(victim.flows, victim.signer) ?? 0;
          if (!bestVictim || victimLoss > bestVictim.loss) {
            bestVictim = {
              tx: victim,
              loss: victimLoss,
              mint: buy.mint,
            };
          }
        }

        if (bestVictim) {
          const attackerProfit = estimateProfit(backrun.flows, backrun.signer);
          const victimLoss = bestVictim.loss || null;
          const tipLamports = frontrun.priority_fee;
          const raydiumMeta = raydiumMetaForTx(frontrun, bestVictim.tx, backrun);
          const orcaMeta = orcaMetaForTx(frontrun, bestVictim.tx, backrun);
          const isRaydiumSandwichSurface = isRaydiumConstantProduct(raydiumMeta?.protocol);
          const isOrcaLegacySandwichSurface = orcaMeta?.product === "legacy_constant_product";
          const baseConfidence = isRaydiumSandwichSurface
            ? 0.94
            : isOrcaLegacySandwichSurface
              ? 0.93
              : raydiumMeta || orcaMeta
                ? 0.91
                : 0.92;
          const jitoBoost = tipLamports && tipLamports >= 10_000 ? 0.02 : 0;
          const protocolMeta = raydiumMeta ?? orcaMeta;
          const programBoost = protocolMeta ? Math.min(0.03, (protocolMeta.riskWeight - 1) * 0.18) : 0;
          const confidence = Math.min(0.97, baseConfidence + jitoBoost);
          const feeSignal = executionFeeSignal(tipLamports);

          attacks.push({
            attack_type: "sandwich",
            slot,
            block_time: frontrun.block_time,
            validator: frontrun.validator,
            attacker_wallet: frontrun.signer,
            victim_wallet: bestVictim.tx.signer,
            pool_address: poolAddress,
            token_mint: bestVictim.mint,
            profit_usd: attackerProfit,
            victim_loss_usd: victimLoss,
            frontrun_tx: frontrun.tx_sig,
            victim_tx: bestVictim.tx.tx_sig,
            backrun_tx: backrun.tx_sig,
            tip_lamports: tipLamports,
            confidence: Number(Math.min(0.97, confidence + programBoost).toFixed(2)),
            detector: protocolMeta ? `raw_delta_sandwich_${protocolMeta.protocol}` : "raw_delta_sandwich",
            evidence: [
              raydiumEvidence(raydiumMeta) ?? orcaEvidence(orcaMeta) ?? "same-pool same-signer frontrun/backrun pattern",
              "highest-loss victim selected from bracketed window",
              "token delta confirmed attacker buy then sell",
              victimLoss != null ? `victim loss estimate: $${victimLoss.toFixed(0)}` : null,
              feeSignal ? `${feeSignal}: ${tipLamports?.toLocaleString()} lamports` : null,
            ].filter((e): e is string => e != null),
          });
        }
      }
    }
  }

  return attacks;
}

export async function detectArbitrage(
  slotTxs: TxFlow[],
  slot: number,
): Promise<DetectedAttack[]> {
  const attacks: DetectedAttack[] = [];

  for (const tx of slotTxs) {
    const signerFlows = tx.flows.filter((flow) => flow.wallet === tx.signer);
    const byMint = new Map<string, bigint>();

    for (const flow of signerFlows) {
      byMint.set(flow.mint, (byMint.get(flow.mint) ?? 0n) + flow.delta_raw);
    }

    const pools = [...new Set(signerFlows.map((flow) => flow.pool_address).filter(Boolean))];
    if (pools.length < 2) continue;

    const netStableProfit = estimateNetStableProfit(signerFlows, tx.signer);
    const balancedInventory = hasBalancedNonStableInventory(signerFlows, tx.signer);
    const bestMint = inferPrimaryProfitMint(signerFlows, tx.signer);

    if (!balancedInventory || netStableProfit < 5 || !bestMint) continue;

    const confidence =
      netStableProfit >= 75 ? 0.92 : netStableProfit >= 30 ? 0.88 : netStableProfit >= 15 ? 0.82 : 0.74;

    attacks.push({
      attack_type: "arbitrage",
      slot,
      block_time: tx.block_time,
      validator: tx.validator,
      attacker_wallet: tx.signer,
      victim_wallet: null,
      pool_address: pools[0] as string,
      token_mint: bestMint,
      profit_usd: netStableProfit,
      victim_loss_usd: null,
      frontrun_tx: null,
      victim_tx: null,
      backrun_tx: null,
      tip_lamports: tx.priority_fee,
      confidence,
      detector: "raw_delta_arbitrage",
      evidence: [
        "single signer touched multiple pools",
        "net stable or major-token profit remained after all trade legs",
        "non-stable inventory ended approximately flat",
      ],
    });
  }

  return attacks;
}

export async function detectJIT(
  slotTxs: TxFlow[],
  slot: number,
): Promise<DetectedAttack[]> {
  const attacks: DetectedAttack[] = [];
  const lpAdds = new Map<string, { tx: TxFlow; pool: string }>();
  const lpRemoves = new Map<string, { tx: TxFlow; pool: string }>();

  for (const tx of slotTxs) {
    const poolFlows = new Map<string, { pos: number; neg: number; mints: Set<string> }>();

    for (const flow of tx.flows) {
      if (!flow.pool_address || flow.wallet !== tx.signer) continue;
      if (!poolFlows.has(flow.pool_address)) {
        poolFlows.set(flow.pool_address, { pos: 0, neg: 0, mints: new Set() });
      }
      const summary = poolFlows.get(flow.pool_address)!;
      if (flow.delta_raw > 0n) summary.pos++;
      if (flow.delta_raw < 0n) summary.neg++;
      summary.mints.add(flow.mint);
    }

    for (const [pool, summary] of poolFlows) {
      if ((summary.neg >= 2 && summary.mints.size >= 2) || (hasAddLiquidityText(tx) && summary.neg >= 1)) {
        lpAdds.set(`${tx.signer}:${pool}`, { tx, pool });
      }
      if ((summary.pos >= 2 && summary.mints.size >= 2) || (hasRemoveLiquidityText(tx) && summary.pos >= 1)) {
        lpRemoves.set(`${tx.signer}:${pool}`, { tx, pool });
      }
    }
  }

  for (const [key, add] of lpAdds) {
    const remove = lpRemoves.get(key);
    if (!remove || add.tx.tx_index >= remove.tx.tx_index) continue;

    const victimTx = slotTxs.find(
      (tx) =>
        tx.tx_index > add.tx.tx_index &&
        tx.tx_index < remove.tx.tx_index &&
        tx.signer !== add.tx.signer &&
        tx.flows.some((flow) => flow.pool_address === add.pool),
    );
    if (!victimTx) continue;

    const raydiumMeta = raydiumMetaForTx(add.tx, victimTx, remove.tx);
    const orcaMeta = orcaMetaForTx(add.tx, victimTx, remove.tx);
    const isRaydiumClmm = raydiumMeta?.protocol === "raydium_clmm";
    const isOrcaWhirlpool = orcaMeta?.protocol === "orca_whirlpool";
    const protocolMeta = raydiumMeta ?? orcaMeta;
    const priorityFee = Math.max(add.tx.priority_fee ?? 0, remove.tx.priority_fee ?? 0);

    attacks.push({
      attack_type: "jit",
      slot,
      block_time: add.tx.block_time,
      validator: add.tx.validator,
      attacker_wallet: add.tx.signer,
      victim_wallet: victimTx.signer,
      pool_address: add.pool,
      token_mint: null,
      profit_usd: estimateProfit(remove.tx.flows, remove.tx.signer),
      victim_loss_usd: null,
      frontrun_tx: add.tx.tx_sig,
      victim_tx: victimTx.tx_sig,
      backrun_tx: remove.tx.tx_sig,
      tip_lamports: priorityFee > 0 ? priorityFee : add.tx.priority_fee,
      confidence: Number(
        Math.min(0.97, 0.88 + (isRaydiumClmm ? 0.05 : 0) + (isOrcaWhirlpool ? 0.06 : 0) + (priorityFee >= 25_000 ? 0.02 : 0)).toFixed(2),
      ),
      detector: protocolMeta ? `raw_delta_jit_${protocolMeta.protocol}` : "raw_delta_jit",
      evidence: [
        raydiumEvidence(raydiumMeta) ?? orcaEvidence(orcaMeta),
        "same signer added and removed liquidity in-slot",
        "victim swap observed between LP legs",
        "profit leg detected on liquidity removal",
        isRaydiumClmm ? "CLMM JIT check: add/swap/remove ordering maps to concentrated range fee capture" : null,
        isOrcaWhirlpool ? "Whirlpool JIT check: add/swap/remove ordering maps to active tick-range fee capture" : null,
        isOrcaWhirlpool ? "Whirlpool guardrail: verify tick arrays, adaptive fee state, and Token-2022 V2 path before routing" : null,
        executionFeeSignal(priorityFee),
      ].filter((entry): entry is string => entry != null),
    });
  }

  return attacks;
}

export async function detectWideSandwiches(
  recentTxs: TxFlow[],
  currentSlot: number,
): Promise<DetectedAttack[]> {
  const attacks: DetectedAttack[] = [];
  const byPool = new Map<string, TxFlow[]>();

  for (const tx of recentTxs) {
    for (const flow of tx.flows) {
      if (!flow.pool_address) continue;
      if (!byPool.has(flow.pool_address)) byPool.set(flow.pool_address, []);
      const entries = byPool.get(flow.pool_address)!;
      if (!entries.find((candidate) => candidate.tx_sig === tx.tx_sig)) {
        entries.push(tx);
      }
    }
  }

  for (const [poolAddress, txs] of byPool) {
    txs.sort(compareTxOrder);

    for (let i = 0; i < txs.length - 2; i++) {
      const frontrun = txs[i];
      if (currentSlot - frontrun.slot > 8) continue;

      for (let k = i + 2; k < txs.length; k++) {
        const backrun = txs[k];
        if (frontrun.signer !== backrun.signer) continue;

        const slotSpan = backrun.slot - frontrun.slot;
        if (slotSpan < 2 || slotSpan > 8) continue;

        let bestVictim:
          | {
              tx: TxFlow;
              loss: number;
              mint: string;
            }
          | null = null;

        for (let j = i + 1; j < k; j++) {
          const victim = txs[j];
          if (victim.signer === frontrun.signer) continue;

          const frontFlows = frontrun.flows.filter((flow) => flow.pool_address === poolAddress);
          const backFlows = backrun.flows.filter((flow) => flow.pool_address === poolAddress);

          const buy = frontFlows.find(
            (flow) => flow.wallet === frontrun.signer && flow.delta_raw > 0n,
          );
          const sell = backFlows.find(
            (flow) => flow.wallet === backrun.signer && flow.delta_raw < 0n,
          );

          if (!buy || !sell || buy.mint !== sell.mint) continue;
          const victimLoss = estimateVictimLoss(victim.flows, victim.signer) ?? 0;
          if (!bestVictim || victimLoss > bestVictim.loss) {
            bestVictim = { tx: victim, loss: victimLoss, mint: buy.mint };
          }
        }

        if (!bestVictim) continue;

        const estimatedProfit = estimateRoundTripProfit(frontrun, backrun, frontrun.signer);
        const validatorAligned =
          frontrun.validator === bestVictim.tx.validator &&
          bestVictim.tx.validator === backrun.validator;
        if (!estimatedProfit || estimatedProfit < 20) continue;
        if ((bestVictim.loss ?? 0) < 15) continue;
        if (!validatorAligned && (frontrun.priority_fee ?? 0) < 20_000 && (backrun.priority_fee ?? 0) < 20_000) {
          continue;
        }

        const priorityFee = Math.max(frontrun.priority_fee ?? 0, backrun.priority_fee ?? 0);
        const raydiumMeta = raydiumMetaForTx(frontrun, bestVictim.tx, backrun);
        const confidence = Math.min(
          0.97,
          0.84 +
            (slotSpan >= 4 ? 0.03 : 0.01) +
            (priorityFee >= 20_000 ? 0.03 : 0) +
            (validatorAligned ? 0.03 : 0) +
            (raydiumMeta ? Math.min(0.03, (raydiumMeta.riskWeight - 1) * 0.18) : 0),
        );

        attacks.push({
          attack_type: "sandwich",
          slot: bestVictim.tx.slot,
          block_time: frontrun.block_time,
          validator: bestVictim.tx.validator,
          attacker_wallet: frontrun.signer,
          victim_wallet: bestVictim.tx.signer,
          pool_address: poolAddress,
          token_mint: bestVictim.mint,
          profit_usd: estimatedProfit,
          victim_loss_usd: bestVictim.loss || null,
          frontrun_tx: frontrun.tx_sig,
          victim_tx: bestVictim.tx.tx_sig,
          backrun_tx: backrun.tx_sig,
          tip_lamports: priorityFee || null,
          confidence: Number(confidence.toFixed(2)),
          detector: raydiumMeta ? `wide_raw_sandwich_${raydiumMeta.protocol}` : "wide_raw_sandwich",
          evidence: [
            raydiumEvidence(raydiumMeta),
            "same-pool same-signer bracket persisted across multiple slots",
            `bracket spanned ${slotSpan + 1} slot(s) before attacker exit`,
            "highest-loss victim selected from cross-slot bracket window",
            validatorAligned
              ? "attacker legs and victim aligned under one validator context"
              : "elevated priority-fee legs supported cross-slot bracket attribution",
          ].filter((entry): entry is string => entry != null),
        });
      }
    }
  }

  return attacks;
}

function estimateProfit(flows: TxFlow["flows"], signer: string): number | null {
  let profit = 0;
  for (const flow of flows) {
    if (flow.wallet !== signer || !STABLE_AND_MAJOR_MINTS.has(flow.mint) || flow.delta_raw <= 0n) continue;
    if (flow.delta_usd !== null) profit += flow.delta_usd;
  }

  if (profit <= 0) return null;
  // Cap at research-validated maximum — values above this are decimal/price artifacts
  return Math.min(profit, MAX_PROFIT_USD);
}

function estimateNetStableProfit(flows: TxFlow["flows"], signer: string): number {
  const net = flows.reduce((sum, flow) => {
    if (flow.wallet !== signer || flow.delta_usd === null) return sum;
    if (!STABLE_AND_MAJOR_MINTS.has(flow.mint)) return sum;
    return sum + flow.delta_usd;
  }, 0);
  return Number(net.toFixed(2));
}

function hasBalancedNonStableInventory(flows: TxFlow["flows"], signer: string) {
  const residualByMint = new Map<string, number>();

  for (const flow of flows) {
    if (flow.wallet !== signer || flow.delta_usd === null) continue;
    if (STABLE_AND_MAJOR_MINTS.has(flow.mint)) continue;
    residualByMint.set(flow.mint, (residualByMint.get(flow.mint) ?? 0) + flow.delta_usd);
  }

  const significantResiduals = [...residualByMint.values()].filter(
    (value) => Math.abs(value) >= 10,
  );
  return significantResiduals.length <= 1;
}

function inferPrimaryProfitMint(flows: TxFlow["flows"], signer: string): string | null {
  const positiveStableOrMajor = flows
    .filter(
      (flow) =>
        flow.wallet === signer &&
        flow.delta_raw > 0n &&
        flow.delta_usd !== null &&
        STABLE_AND_MAJOR_MINTS.has(flow.mint),
    )
    .sort((a, b) => (b.delta_usd ?? 0) - (a.delta_usd ?? 0));

  return positiveStableOrMajor[0]?.mint ?? null;
}

function estimateVictimLoss(flows: TxFlow["flows"], victim: string): number | null {
  let loss = 0;

  for (const flow of flows) {
    if (flow.wallet !== victim || flow.delta_raw >= 0n || flow.delta_usd === null) continue;
    // Only count stable/major tokens as losses — prevents inflated SOL fee accounting
    if (!STABLE_AND_MAJOR_MINTS.has(flow.mint)) continue;
    loss += Math.abs(flow.delta_usd);
  }

  if (loss <= 0) return null;
  // Cap at research-validated maximum — values above this are decimal/price artifacts
  return Math.min(loss, MAX_VICTIM_LOSS_USD);
}
