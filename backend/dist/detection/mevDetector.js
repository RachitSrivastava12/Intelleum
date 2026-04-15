"use strict";
// ============================================================
// MEV DETECTION ENGINE
// Pure in-memory detection over token flows for a given slot.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSandwiches = detectSandwiches;
exports.detectArbitrage = detectArbitrage;
exports.detectJIT = detectJIT;
exports.detectWideSandwiches = detectWideSandwiches;
const STABLE_AND_MAJOR_MINTS = new Set([
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);
function compareTxOrder(a, b) {
    if (a.slot !== b.slot)
        return a.slot - b.slot;
    return a.tx_index - b.tx_index;
}
function estimateRoundTripProfit(front, back, signer) {
    const frontStableSpend = front.flows
        .filter((flow) => flow.wallet === signer &&
        flow.delta_raw < 0n &&
        flow.delta_usd !== null &&
        [
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ].includes(flow.mint))
        .reduce((sum, flow) => sum + Math.abs(flow.delta_usd ?? 0), 0);
    const backStableReceive = back.flows
        .filter((flow) => flow.wallet === signer &&
        flow.delta_raw > 0n &&
        flow.delta_usd !== null &&
        [
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ].includes(flow.mint))
        .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0);
    const pnl = backStableReceive - frontStableSpend;
    return pnl > 0 ? Number(pnl.toFixed(2)) : estimateProfit(back.flows, signer);
}
async function detectSandwiches(slotTxs, slot) {
    const attacks = [];
    const byPool = new Map();
    for (const tx of slotTxs) {
        for (const flow of tx.flows) {
            if (!flow.pool_address)
                continue;
            if (!byPool.has(flow.pool_address))
                byPool.set(flow.pool_address, []);
            const entries = byPool.get(flow.pool_address);
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
                if (frontrun.signer !== backrun.signer)
                    continue;
                let bestVictim = null;
                for (let j = i + 1; j < k; j++) {
                    const victim = txs[j];
                    if (victim.signer === frontrun.signer)
                        continue;
                    const frontFlows = frontrun.flows.filter((flow) => flow.pool_address === poolAddress);
                    const backFlows = backrun.flows.filter((flow) => flow.pool_address === poolAddress);
                    const buy = frontFlows.find((flow) => flow.wallet === frontrun.signer && flow.delta_raw > 0n);
                    const sell = backFlows.find((flow) => flow.wallet === backrun.signer && flow.delta_raw < 0n);
                    if (!buy || !sell || buy.mint !== sell.mint)
                        continue;
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
                    attacks.push({
                        attack_type: "sandwich",
                        slot,
                        block_time: frontrun.block_time,
                        validator: frontrun.validator,
                        attacker_wallet: frontrun.signer,
                        victim_wallet: bestVictim.tx.signer,
                        pool_address: poolAddress,
                        token_mint: bestVictim.mint,
                        profit_usd: estimateProfit(backrun.flows, backrun.signer),
                        victim_loss_usd: bestVictim.loss || null,
                        frontrun_tx: frontrun.tx_sig,
                        victim_tx: bestVictim.tx.tx_sig,
                        backrun_tx: backrun.tx_sig,
                        tip_lamports: frontrun.priority_fee,
                        confidence: 0.92,
                        detector: "raw_delta_sandwich",
                        evidence: [
                            "same-pool same-signer frontrun/backrun pattern",
                            "highest-loss victim selected from bracketed window",
                            "token delta confirmed attacker buy then sell",
                        ],
                    });
                }
            }
        }
    }
    return attacks;
}
async function detectArbitrage(slotTxs, slot) {
    const attacks = [];
    for (const tx of slotTxs) {
        const signerFlows = tx.flows.filter((flow) => flow.wallet === tx.signer);
        const byMint = new Map();
        for (const flow of signerFlows) {
            byMint.set(flow.mint, (byMint.get(flow.mint) ?? 0n) + flow.delta_raw);
        }
        const pools = [...new Set(signerFlows.map((flow) => flow.pool_address).filter(Boolean))];
        if (pools.length < 2)
            continue;
        const netStableProfit = estimateNetStableProfit(signerFlows, tx.signer);
        const balancedInventory = hasBalancedNonStableInventory(signerFlows, tx.signer);
        const bestMint = inferPrimaryProfitMint(signerFlows, tx.signer);
        if (!balancedInventory || netStableProfit < 15 || !bestMint)
            continue;
        const confidence = netStableProfit >= 75 ? 0.92 : netStableProfit >= 30 ? 0.88 : 0.82;
        attacks.push({
            attack_type: "arbitrage",
            slot,
            block_time: tx.block_time,
            validator: tx.validator,
            attacker_wallet: tx.signer,
            victim_wallet: null,
            pool_address: pools[0],
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
async function detectJIT(slotTxs, slot) {
    const attacks = [];
    const lpAdds = new Map();
    const lpRemoves = new Map();
    for (const tx of slotTxs) {
        const poolFlows = new Map();
        for (const flow of tx.flows) {
            if (!flow.pool_address || flow.wallet !== tx.signer)
                continue;
            if (!poolFlows.has(flow.pool_address)) {
                poolFlows.set(flow.pool_address, { pos: 0, neg: 0, mints: new Set() });
            }
            const summary = poolFlows.get(flow.pool_address);
            if (flow.delta_raw > 0n)
                summary.pos++;
            if (flow.delta_raw < 0n)
                summary.neg++;
            summary.mints.add(flow.mint);
        }
        for (const [pool, summary] of poolFlows) {
            if (summary.neg >= 2 && summary.mints.size >= 2) {
                lpAdds.set(`${tx.signer}:${pool}`, { tx, pool });
            }
            if (summary.pos >= 2 && summary.mints.size >= 2) {
                lpRemoves.set(`${tx.signer}:${pool}`, { tx, pool });
            }
        }
    }
    for (const [key, add] of lpAdds) {
        const remove = lpRemoves.get(key);
        if (!remove || add.tx.tx_index >= remove.tx.tx_index)
            continue;
        const victimTx = slotTxs.find((tx) => tx.tx_index > add.tx.tx_index &&
            tx.tx_index < remove.tx.tx_index &&
            tx.signer !== add.tx.signer &&
            tx.flows.some((flow) => flow.pool_address === add.pool));
        if (!victimTx)
            continue;
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
            tip_lamports: add.tx.priority_fee,
            confidence: 0.88,
            detector: "raw_delta_jit",
            evidence: [
                "same signer added and removed liquidity in-slot",
                "victim swap observed between LP legs",
                "profit leg detected on liquidity removal",
            ],
        });
    }
    return attacks;
}
async function detectWideSandwiches(recentTxs, currentSlot) {
    const attacks = [];
    const byPool = new Map();
    for (const tx of recentTxs) {
        for (const flow of tx.flows) {
            if (!flow.pool_address)
                continue;
            if (!byPool.has(flow.pool_address))
                byPool.set(flow.pool_address, []);
            const entries = byPool.get(flow.pool_address);
            if (!entries.find((candidate) => candidate.tx_sig === tx.tx_sig)) {
                entries.push(tx);
            }
        }
    }
    for (const [poolAddress, txs] of byPool) {
        txs.sort(compareTxOrder);
        for (let i = 0; i < txs.length - 2; i++) {
            const frontrun = txs[i];
            if (currentSlot - frontrun.slot > 8)
                continue;
            for (let k = i + 2; k < txs.length; k++) {
                const backrun = txs[k];
                if (frontrun.signer !== backrun.signer)
                    continue;
                const slotSpan = backrun.slot - frontrun.slot;
                if (slotSpan < 2 || slotSpan > 8)
                    continue;
                let bestVictim = null;
                for (let j = i + 1; j < k; j++) {
                    const victim = txs[j];
                    if (victim.signer === frontrun.signer)
                        continue;
                    const frontFlows = frontrun.flows.filter((flow) => flow.pool_address === poolAddress);
                    const backFlows = backrun.flows.filter((flow) => flow.pool_address === poolAddress);
                    const buy = frontFlows.find((flow) => flow.wallet === frontrun.signer && flow.delta_raw > 0n);
                    const sell = backFlows.find((flow) => flow.wallet === backrun.signer && flow.delta_raw < 0n);
                    if (!buy || !sell || buy.mint !== sell.mint)
                        continue;
                    const victimLoss = estimateVictimLoss(victim.flows, victim.signer) ?? 0;
                    if (!bestVictim || victimLoss > bestVictim.loss) {
                        bestVictim = { tx: victim, loss: victimLoss, mint: buy.mint };
                    }
                }
                if (!bestVictim)
                    continue;
                const estimatedProfit = estimateRoundTripProfit(frontrun, backrun, frontrun.signer);
                const validatorAligned = frontrun.validator === bestVictim.tx.validator &&
                    bestVictim.tx.validator === backrun.validator;
                if (!estimatedProfit || estimatedProfit < 20)
                    continue;
                if ((bestVictim.loss ?? 0) < 15)
                    continue;
                if (!validatorAligned && (frontrun.priority_fee ?? 0) < 20000 && (backrun.priority_fee ?? 0) < 20000) {
                    continue;
                }
                const priorityFee = Math.max(frontrun.priority_fee ?? 0, backrun.priority_fee ?? 0);
                const confidence = Math.min(0.97, 0.84 +
                    (slotSpan >= 4 ? 0.03 : 0.01) +
                    (priorityFee >= 20000 ? 0.03 : 0) +
                    (validatorAligned ? 0.03 : 0));
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
                    detector: "wide_raw_sandwich",
                    evidence: [
                        "same-pool same-signer bracket persisted across multiple slots",
                        `bracket spanned ${slotSpan + 1} slot(s) before attacker exit`,
                        "highest-loss victim selected from cross-slot bracket window",
                        validatorAligned
                            ? "attacker legs and victim aligned under one validator context"
                            : "elevated priority-fee legs supported cross-slot bracket attribution",
                    ],
                });
            }
        }
    }
    return attacks;
}
function estimateProfit(flows, signer) {
    let profit = 0;
    for (const flow of flows) {
        if (flow.wallet !== signer || !STABLE_AND_MAJOR_MINTS.has(flow.mint) || flow.delta_raw <= 0n)
            continue;
        if (flow.delta_usd !== null)
            profit += flow.delta_usd;
    }
    return profit > 0 ? profit : null;
}
function estimateNetStableProfit(flows, signer) {
    const net = flows.reduce((sum, flow) => {
        if (flow.wallet !== signer || flow.delta_usd === null)
            return sum;
        if (!STABLE_AND_MAJOR_MINTS.has(flow.mint))
            return sum;
        return sum + flow.delta_usd;
    }, 0);
    return Number(net.toFixed(2));
}
function hasBalancedNonStableInventory(flows, signer) {
    const residualByMint = new Map();
    for (const flow of flows) {
        if (flow.wallet !== signer || flow.delta_usd === null)
            continue;
        if (STABLE_AND_MAJOR_MINTS.has(flow.mint))
            continue;
        residualByMint.set(flow.mint, (residualByMint.get(flow.mint) ?? 0) + flow.delta_usd);
    }
    const significantResiduals = [...residualByMint.values()].filter((value) => Math.abs(value) >= 10);
    return significantResiduals.length <= 1;
}
function inferPrimaryProfitMint(flows, signer) {
    const positiveStableOrMajor = flows
        .filter((flow) => flow.wallet === signer &&
        flow.delta_raw > 0n &&
        flow.delta_usd !== null &&
        STABLE_AND_MAJOR_MINTS.has(flow.mint))
        .sort((a, b) => (b.delta_usd ?? 0) - (a.delta_usd ?? 0));
    return positiveStableOrMajor[0]?.mint ?? null;
}
function estimateVictimLoss(flows, victim) {
    let loss = 0;
    for (const flow of flows) {
        if (flow.wallet !== victim || flow.delta_raw >= 0n || flow.delta_usd === null)
            continue;
        loss += Math.abs(flow.delta_usd);
    }
    return loss > 0 ? loss : null;
}
//# sourceMappingURL=mevDetector.js.map