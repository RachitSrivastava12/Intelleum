"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveChainService = void 0;
const web3_js_1 = require("@solana/web3.js");
const mevDetector_1 = require("../detection/mevDetector");
const programs_1 = require("../ingestion/programs");
const tokenFlows_1 = require("../ingestion/tokenFlows");
const MAX_ATTACKS = 500;
const MAX_SWAP_HISTORY = 2000;
const MAX_LIQUIDITY_HISTORY = 2000;
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const PARSE_BATCH_SIZE = 100;
const MAX_PARSE_CANDIDATES_PER_SLOT = 160;
const STABLE_AND_MAJOR_MINTS = new Set([
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);
const MATERIAL_THRESHOLDS = {
    sandwich: { minProfitUsd: 8, minVictimLossUsd: 15, requireKnownPool: true, minConfidence: 0.84 },
    arbitrage: { minProfitUsd: 25, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.82 },
    jit: { minProfitUsd: 8, minVictimLossUsd: 5, requireKnownPool: true, minConfidence: 0.78 },
    liquidation: { minProfitUsd: 20, minVictimLossUsd: 0, requireKnownPool: false, minConfidence: 0.78 },
    backrun: { minProfitUsd: 12, minVictimLossUsd: 25, requireKnownPool: false, minConfidence: 0.78 },
};
function attackScore(attack) {
    return ((attack.confidence ?? 0) * 1000 +
        (attack.victim_loss_usd ?? 0) * 2 +
        (attack.profit_usd ?? 0));
}
const TOKEN_SYMBOLS = {
    So11111111111111111111111111111111111111112: "SOL",
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};
function tokenLabel(mint) {
    if (!mint)
        return "UNKNOWN";
    return TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}
function parseSurface(poolAddress) {
    const parseMints = (pair) => pair?.split("->").filter(Boolean) ?? [];
    if (poolAddress.startsWith("route:")) {
        const [, protocol, pair] = poolAddress.split(":");
        const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
        return {
            route_kind: "route",
            protocol: protocol ?? null,
            label: `${protocol?.toUpperCase() ?? "UNKNOWN"} route • ${prettyPair}`,
            mints: parseMints(pair),
        };
    }
    if (poolAddress.startsWith("venue:")) {
        const [, protocol, pair] = poolAddress.split(":");
        const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
        return {
            route_kind: "venue",
            protocol: protocol ?? null,
            label: `${protocol?.toUpperCase() ?? "UNKNOWN"} venue • ${prettyPair}`,
            mints: parseMints(pair),
        };
    }
    if (poolAddress.startsWith("pair:")) {
        const [, pair] = poolAddress.split(":");
        const prettyPair = pair?.split("->").map(tokenLabel).join(" / ") ?? "UNKNOWN";
        return {
            route_kind: "pair",
            protocol: null,
            label: `Pair • ${prettyPair}`,
            mints: parseMints(pair),
        };
    }
    return {
        route_kind: "pool",
        protocol: null,
        label: poolAddress,
        mints: [],
    };
}
function surfacePrecision(poolAddress) {
    if (poolAddress.startsWith("route:"))
        return "route-inferred";
    if (poolAddress.startsWith("venue:"))
        return "venue-inferred";
    if (poolAddress.startsWith("pair:"))
        return "pair-inferred";
    return "exact-pool";
}
class LiveChainService {
    constructor() {
        this.connection = null;
        this.heliusKey = null;
        this.heliusRpcUrl = null;
        this.started = false;
        this.syncing = false;
        this.latestChainSlot = null;
        this.lastProcessedSlot = null;
        this.lastSyncAt = null;
        this.lastError = null;
        this.attacksDetected = 0;
        this.blocksProcessed = 0;
        this.nextId = 1;
        this.attacks = [];
        this.attackKeys = new Set();
        this.attackIndexByKey = new Map();
        this.pollTimer = null;
        this.externalStreamActive = false;
        this.recentSwaps = [];
        this.recentLiquidityLegs = [];
        this.recentSlotTxs = [];
        this.lastSnapshotPersistAt = 0;
        this.recentMetrics = {
            candidateRows: 0,
            parsedTransactions: 0,
            parsedSwaps: 0,
            rawSlotTxs: 0,
            detectedAttacks: 0,
            sandwichCandidates: 0,
            arbitrageCandidates: 0,
            jitCandidates: 0,
            liquidationCandidates: 0,
            suspiciousCandidates: 0,
            backrunCandidates: 0,
        };
    }
    ensureHeliusConfig() {
        const rpcUrl = process.env.HELIUS_RPC_URL;
        if (!rpcUrl) {
            if (!this.lastError) {
                this.lastError = "HELIUS_RPC_URL is not configured";
            }
            return false;
        }
        this.heliusRpcUrl = rpcUrl;
        this.heliusKey = this.extractApiKey(rpcUrl);
        return true;
    }
    start() {
        if (this.started)
            return;
        this.started = true;
        const hasHeliusConfig = this.ensureHeliusConfig();
        if (!hasHeliusConfig || !this.heliusRpcUrl) {
            console.warn("[chain] Helius disabled: HELIUS_RPC_URL missing");
            return;
        }
        this.connection = new web3_js_1.Connection(this.heliusRpcUrl, {
            commitment: "confirmed",
            wsEndpoint: this.heliusRpcUrl.replace("https", "wss"),
        });
        console.log("[chain] live ingestion started");
        this.scheduleNextSync(0);
    }
    extractApiKey(rpcUrl) {
        try {
            const url = new URL(rpcUrl);
            return url.searchParams.get("api-key");
        }
        catch {
            return null;
        }
    }
    scheduleNextSync(delayMs) {
        if (this.pollTimer)
            clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(() => {
            this.sync().catch((error) => {
                this.lastError = error instanceof Error ? error.message : String(error);
                console.error("[chain] sync failed", error);
                this.scheduleNextSync(4000);
            });
        }, delayMs);
    }
    async sync() {
        if (!this.connection || this.syncing)
            return;
        this.syncing = true;
        try {
            this.latestChainSlot = await this.connection.getSlot("confirmed");
            if (this.lastProcessedSlot === null) {
                this.lastProcessedSlot = Math.max(0, this.latestChainSlot - 20);
            }
            const maxCatchup = this.latestChainSlot - this.lastProcessedSlot > 800 ? 16 : 8;
            const targetSlot = Math.min(this.latestChainSlot, this.lastProcessedSlot + maxCatchup);
            for (let slot = this.lastProcessedSlot + 1; slot <= targetSlot; slot++) {
                await this.processSlot(slot);
                this.lastProcessedSlot = slot;
            }
            this.lastSyncAt = new Date().toISOString();
            this.lastError = null;
            void this.persistSnapshot();
            this.scheduleNextSync(900);
        }
        finally {
            this.syncing = false;
        }
    }
    async processSlot(slot) {
        if (!this.connection)
            return;
        let block;
        try {
            block = await this.connection.getBlock(slot, {
                maxSupportedTransactionVersion: 0,
                rewards: true,
                transactionDetails: "full",
            });
        }
        catch (error) {
            console.warn(`[chain] skipped slot ${slot}`, error instanceof Error ? error.message : error);
            return;
        }
        await this.processBlock(slot, block);
    }
    async ingestExternalBlocks(blocks) {
        if (!Array.isArray(blocks) || blocks.length === 0)
            return;
        this.ensureHeliusConfig();
        this.started = true;
        this.externalStreamActive = true;
        this.syncing = false;
        for (const block of blocks) {
            const slot = block?.slot ??
                block?.blockNumber ??
                block?.block_number ??
                block?.parentSlot + 1;
            if (typeof slot !== "number" || Number.isNaN(slot))
                continue;
            this.latestChainSlot = Math.max(this.latestChainSlot ?? 0, slot);
            await this.processBlock(slot, block);
            this.lastProcessedSlot = slot;
        }
        this.lastSyncAt = new Date().toISOString();
        this.lastError = null;
    }
    keyToAddress(value) {
        if (!value)
            return null;
        if (typeof value === "string")
            return value;
        if (typeof value.pubkey === "string")
            return value.pubkey;
        return value.toBase58?.() ?? null;
    }
    instructionProgramId(ix, accountKeys) {
        if (typeof ix?.programId === "string")
            return ix.programId;
        if (typeof ix?.programIdIndex === "number") {
            return this.keyToAddress(accountKeys[ix.programIdIndex]);
        }
        return null;
    }
    async processBlock(slot, block) {
        if (!block?.transactions?.length)
            return;
        const leaderIdentity = block.rewards?.find((reward) => reward.rewardType === "Fee")?.pubkey ?? "unknown";
        const blockTime = new Date((block.blockTime ?? Math.floor(Date.now() / 1000)) * 1000);
        const priceMap = await this.fetchPrices([
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ]);
        const flows = await (0, tokenFlows_1.extractTokenFlows)(block, slot, priceMap);
        const flowsByTx = new Map();
        for (const flow of flows) {
            if (!flowsByTx.has(flow.tx_sig))
                flowsByTx.set(flow.tx_sig, []);
            flowsByTx.get(flow.tx_sig).push(flow);
        }
        const txRows = block.transactions
            .map((tx, index) => {
            if (!tx.meta || tx.meta.err !== null)
                return null;
            const signature = tx.transaction.signatures[0];
            const message = tx.transaction.message;
            const isV0 = "compiledInstructions" in message;
            const accountKeys = isV0 ? message.staticAccountKeys : message.accountKeys;
            const signer = this.keyToAddress(accountKeys?.[0]);
            if (!signature || !signer)
                return null;
            const instructions = isV0 ? message.compiledInstructions : message.instructions;
            const touchedPrograms = new Set();
            for (const ix of instructions ?? []) {
                const programId = this.instructionProgramId(ix, accountKeys);
                if (programId)
                    touchedPrograms.add(programId);
            }
            const hasDexProgram = [...touchedPrograms].some((programId) => (0, programs_1.isDex)(programId));
            const hasLendingProgram = [...touchedPrograms].some((programId) => (0, programs_1.isLending)(programId));
            const tokenBalanceChanges = (tx.meta.preTokenBalances?.length ?? 0) + (tx.meta.postTokenBalances?.length ?? 0);
            const priorityFee = this.extractPriorityFee(tx);
            const flowSummary = flowsByTx.get(signature) ?? [];
            const hasDexFlow = flowSummary.some((flow) => flow.program_id && (0, programs_1.isDex)(flow.program_id));
            const hasLendingFlow = flowSummary.some((flow) => flow.program_id && (0, programs_1.isLending)(flow.program_id));
            const stableFlowCount = flowSummary.filter((flow) => flow.wallet === signer && flow.delta_usd !== null && STABLE_AND_MAJOR_MINTS.has(flow.mint)).length;
            const routedPoolCount = new Set(flowSummary.map((flow) => flow.pool_address).filter(Boolean)).size;
            const hasSwapLikeFlow = flowSummary.some((flow) => flow.wallet === signer && flow.delta_raw < 0n) &&
                flowSummary.some((flow) => flow.wallet === signer && flow.delta_raw > 0n) &&
                stableFlowCount >= 1;
            return {
                signature,
                tx_index: index,
                signer,
                priority_fee: priorityFee,
                hasDexProgram: hasDexProgram || hasDexFlow,
                hasLendingProgram: hasLendingProgram || hasLendingFlow,
                tokenBalanceChanges,
                isHighPriority: (priorityFee ?? 0) >= 8000,
                hasSwapLikeFlow,
                stableFlowCount,
                routedPoolCount,
                candidateScore: ((hasDexProgram || hasDexFlow) ? 5 : 0) +
                    ((hasLendingProgram || hasLendingFlow) ? 3 : 0) +
                    (hasSwapLikeFlow ? 4 : 0) +
                    Math.min(2, routedPoolCount) +
                    Math.min(2, stableFlowCount) +
                    (priorityFee && priorityFee > 20000 ? 2 : priorityFee && priorityFee > 8000 ? 1 : 0) +
                    Math.min(3, Math.floor(tokenBalanceChanges / 2)),
            };
        })
            .filter(Boolean);
        const parseBudget = txRows.length > 1400 ? 128 :
            txRows.length > 1100 ? 144 :
                MAX_PARSE_CANDIDATES_PER_SLOT;
        const candidateRows = txRows
            .filter((row) => row.hasDexProgram ||
            row.hasLendingProgram ||
            row.hasSwapLikeFlow ||
            row.stableFlowCount >= 2 ||
            row.routedPoolCount >= 2 ||
            (row.isHighPriority && row.tokenBalanceChanges >= 2) ||
            row.tokenBalanceChanges >= 5)
            .sort((a, b) => b.candidateScore - a.candidateScore ||
            (b.priority_fee ?? 0) - (a.priority_fee ?? 0) ||
            b.tokenBalanceChanges - a.tokenBalanceChanges)
            .slice(0, parseBudget);
        const slotTxs = candidateRows.map((row) => ({
            tx_sig: row.signature,
            tx_index: row.tx_index,
            signer: row.signer,
            slot,
            block_time: blockTime,
            validator: leaderIdentity,
            priority_fee: row.priority_fee,
            flows: flowsByTx.get(row.signature) ?? [],
        }));
        this.recentSlotTxs.unshift(...slotTxs);
        if (this.recentSlotTxs.length > 5000) {
            this.recentSlotTxs.length = 5000;
        }
        const parsedBySig = await this.fetchParsedTransactions(candidateRows.map((row) => row.signature));
        const parsedSwaps = this.extractParsedSwaps(candidateRows, parsedBySig, slot, blockTime, leaderIdentity, flowsByTx, priceMap);
        const liquidityLegs = this.extractLiquidityLegs(slotTxs, parsedBySig);
        const rawSandwiches = await (0, mevDetector_1.detectSandwiches)(slotTxs, slot);
        const wideRawSandwiches = await (0, mevDetector_1.detectWideSandwiches)(this.recentSlotTxs, slot);
        const rawArbs = await (0, mevDetector_1.detectArbitrage)(slotTxs, slot);
        const rawJits = await (0, mevDetector_1.detectJIT)(slotTxs, slot);
        const parsedSandwiches = this.detectParsedSandwiches(parsedSwaps);
        const parsedArbs = this.detectParsedArbitrage(parsedSwaps, flowsByTx, blockTime, leaderIdentity, slot);
        const parsedJits = this.detectLiquidityJIT(liquidityLegs);
        const parsedLiquidations = this.detectParsedLiquidations(candidateRows, parsedBySig, flowsByTx, blockTime, leaderIdentity, slot);
        const parsedBackruns = this.detectParsedBackruns(parsedSwaps, flowsByTx, blockTime, leaderIdentity, slot);
        const suspiciousOrderflow = this.detectSuspiciousOrderflow(parsedSwaps, slot, blockTime, leaderIdentity);
        this.recentMetrics = {
            candidateRows: candidateRows.length,
            parsedTransactions: parsedBySig.size,
            parsedSwaps: parsedSwaps.length,
            rawSlotTxs: txRows.length,
            detectedAttacks: 0,
            sandwichCandidates: parsedSandwiches.length,
            arbitrageCandidates: parsedArbs.length,
            jitCandidates: rawJits.length + parsedJits.length,
            liquidationCandidates: parsedLiquidations.length,
            suspiciousCandidates: suspiciousOrderflow.length,
            backrunCandidates: parsedBackruns.length,
        };
        const detected = this.filterDetectedAttacks([
            ...rawSandwiches,
            ...wideRawSandwiches,
            ...rawArbs,
            ...rawJits,
            ...parsedSandwiches,
            ...parsedArbs,
            ...parsedJits,
            ...parsedLiquidations,
            ...parsedBackruns,
        ]);
        this.recentMetrics.detectedAttacks = detected.length;
        this.blocksProcessed += 1;
        if (detected.length === 0) {
            console.log(`[chain] slot ${slot}: totalTx=${txRows.length} candidates=${slotTxs.length} parsedSwaps=${parsedSwaps.length} attacks=0`);
            return;
        }
        for (const attack of detected) {
            this.insertAttack(attack);
        }
        this.attacksDetected += detected.length;
        console.log(`[chain] slot ${slot}: totalTx=${txRows.length} candidates=${slotTxs.length} parsedSwaps=${parsedSwaps.length} detected=${detected.length}`);
    }
    extractPriorityFee(tx) {
        const message = tx.transaction.message;
        const isV0 = "compiledInstructions" in message;
        const accountKeys = isV0 ? message.staticAccountKeys : message.accountKeys;
        const instructions = isV0 ? message.compiledInstructions : message.instructions;
        let cuLimit = null;
        let cuPriceMicroLamports = null;
        for (const ix of instructions ?? []) {
            const programId = this.instructionProgramId(ix, accountKeys);
            if (programId !== COMPUTE_BUDGET_PROGRAM)
                continue;
            const rawData = ix.data;
            const data = Buffer.from(rawData, "base64");
            const tag = data[0];
            if (tag === 2 && data.length >= 5) {
                cuLimit = data.readUInt32LE(1);
            }
            if (tag === 3 && data.length >= 9) {
                cuPriceMicroLamports = Number(data.readBigUInt64LE(1));
            }
        }
        if (!cuLimit || !cuPriceMicroLamports)
            return null;
        return Math.floor((cuLimit * cuPriceMicroLamports) / 1000000);
    }
    async fetchParsedTransactions(signatures) {
        const parsed = new Map();
        if (!this.heliusKey || signatures.length === 0)
            return parsed;
        for (let i = 0; i < signatures.length; i += PARSE_BATCH_SIZE) {
            const batch = signatures.slice(i, i + PARSE_BATCH_SIZE);
            try {
                const response = await fetch(`https://api-mainnet.helius-rpc.com/v0/transactions?api-key=${this.heliusKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transactions: batch }),
                });
                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`Helius parse failed with ${response.status}: ${body.slice(0, 200)}`);
                }
                const payload = (await response.json());
                for (const item of payload) {
                    if (item.signature)
                        parsed.set(item.signature, item);
                }
            }
            catch (error) {
                console.warn(`[chain] parsed tx fetch failed for batch ${i / PARSE_BATCH_SIZE + 1}`, error instanceof Error ? error.message : error);
            }
        }
        return parsed;
    }
    extractParsedSwaps(txRows, parsedBySig, slot, blockTime, validator, flowsByTx, priceMap) {
        const swaps = [];
        for (const row of txRows) {
            const parsed = parsedBySig.get(row.signature);
            const swap = parsed?.events?.swap;
            const tokenInputs = swap?.tokenInputs ?? swap?.innerSwaps?.flatMap((inner) => inner.tokenInputs ?? []) ?? [];
            const tokenOutputs = swap?.tokenOutputs ?? swap?.innerSwaps?.flatMap((inner) => inner.tokenOutputs ?? []) ?? [];
            const flows = flowsByTx.get(row.signature) ?? [];
            const flowPoolAddress = flows.find((flow) => flow.pool_address)?.pool_address ?? null;
            const programId = flows.find((flow) => flow.program_id)?.program_id ?? null;
            const swapFromFlows = !swap ? this.inferSwapFromFlows(flows, row.signer, priceMap, parsed) : null;
            const input = tokenInputs[0];
            const output = tokenOutputs[0];
            const inputAmount = this.readTokenAmount(input) ?? swapFromFlows?.input_amount ?? null;
            const outputAmount = this.readTokenAmount(output) ?? swapFromFlows?.output_amount ?? null;
            const inputMint = input?.mint ?? input?.tokenAddress ?? swapFromFlows?.input_mint ?? null;
            const outputMint = output?.mint ?? output?.tokenAddress ?? swapFromFlows?.output_mint ?? null;
            if (!inputMint || !outputMint || inputMint === outputMint)
                continue;
            const inputUsd = inputAmount && inputMint && priceMap.has(inputMint)
                ? Number((inputAmount * (priceMap.get(inputMint) ?? 0)).toFixed(2))
                : swapFromFlows?.input_usd ?? null;
            const outputUsd = outputAmount && outputMint && priceMap.has(outputMint)
                ? Number((outputAmount * (priceMap.get(outputMint) ?? 0)).toFixed(2))
                : swapFromFlows?.output_usd ?? null;
            const notionalUsd = Math.max(inputUsd ?? 0, outputUsd ?? 0) || null;
            const signerStableDeltaUsd = this.computeSignerStableDelta(flows, row.signer);
            const source = this.inferSourceFromFlows(flows, parsed);
            const poolAddress = this.normalizePoolAddress(flowPoolAddress, source, inputMint, outputMint, programId);
            const parsedType = (parsed?.type ?? "").toUpperCase();
            const parsedDescription = (parsed?.description ?? "").toLowerCase();
            const swapLikeMetadata = !!swap ||
                parsedType.includes("SWAP") ||
                parsedDescription.includes(" swap") ||
                parsedDescription.startsWith("swap") ||
                !!swapFromFlows;
            if (!swapLikeMetadata)
                continue;
            swaps.push({
                signature: row.signature,
                slot,
                tx_index: row.tx_index,
                signer: row.signer,
                validator,
                block_time: new Date((parsed?.timestamp ?? Math.floor(blockTime.getTime() / 1000)) * 1000),
                pool_address: poolAddress,
                source,
                input_mint: inputMint,
                output_mint: outputMint,
                input_amount: inputAmount,
                output_amount: outputAmount,
                input_usd: inputUsd,
                output_usd: outputUsd,
                notional_usd: notionalUsd,
                price_impact_hint: this.computePriceImpactHint(inputUsd, outputUsd),
                priority_fee: row.priority_fee,
                signer_stable_delta_usd: signerStableDeltaUsd,
            });
        }
        this.recentSwaps.unshift(...swaps);
        if (this.recentSwaps.length > MAX_SWAP_HISTORY) {
            this.recentSwaps.length = MAX_SWAP_HISTORY;
        }
        return swaps;
    }
    inferSwapFromFlows(flows, signer, priceMap, parsed) {
        const signerFlows = flows.filter((flow) => flow.wallet === signer);
        const negative = signerFlows
            .filter((flow) => flow.delta_raw < 0n)
            .sort((a, b) => Math.abs(b.delta_usd ?? 0) - Math.abs(a.delta_usd ?? 0));
        const positive = signerFlows
            .filter((flow) => flow.delta_raw > 0n)
            .sort((a, b) => Math.abs(b.delta_usd ?? 0) - Math.abs(a.delta_usd ?? 0));
        const input = negative.find((flow) => flow.mint && (flow.delta_usd !== null || priceMap.has(flow.mint)));
        const output = positive.find((flow) => flow.mint && (flow.delta_usd !== null || priceMap.has(flow.mint)));
        if (!input || !output)
            return null;
        if (input.mint === output.mint)
            return null;
        const inputUsd = input.delta_usd !== null ? Math.abs(Number(input.delta_usd.toFixed(2))) : null;
        const outputUsd = output.delta_usd !== null ? Number(output.delta_usd.toFixed(2)) : null;
        const isSwapLikeDescription = (parsed?.description ?? "").toLowerCase();
        const isDexLikeSource = parsed?.source && ["JUPITER", "RAYDIUM", "ORCA", "METEORA", "PHOENIX"].includes(parsed.source.toUpperCase());
        const touchesDexFlow = flows.some((flow) => flow.program_id && (0, programs_1.isDex)(flow.program_id));
        if (!touchesDexFlow && !isDexLikeSource && !isSwapLikeDescription.includes("swap"))
            return null;
        const inputPrice = priceMap.get(input.mint) ?? null;
        const outputPrice = priceMap.get(output.mint) ?? null;
        const inputAmount = inputUsd !== null && inputPrice && inputPrice > 0 ? Number((inputUsd / inputPrice).toFixed(6)) : null;
        const outputAmount = outputUsd !== null && outputPrice && outputPrice > 0 ? Number((outputUsd / outputPrice).toFixed(6)) : null;
        return {
            input_mint: input.mint,
            output_mint: output.mint,
            input_amount: inputAmount,
            output_amount: outputAmount,
            input_usd: inputUsd,
            output_usd: outputUsd,
        };
    }
    inferSourceFromFlows(flows, parsed) {
        if (parsed?.source)
            return parsed.source;
        const programLabels = flows
            .map((flow) => (0, programs_1.getProgramLabel)(flow.program_id))
            .filter((value) => Boolean(value));
        return programLabels[0] ?? null;
    }
    extractLiquidityLegs(slotTxs, parsedBySig) {
        const legs = [];
        for (const tx of slotTxs) {
            const parsed = parsedBySig.get(tx.tx_sig);
            const parsedType = (parsed?.type ?? "").toUpperCase();
            const parsedDescription = (parsed?.description ?? "").toLowerCase();
            const inferredSource = this.inferSourceFromFlows(tx.flows, parsed);
            const parsedAddLiquidity = parsedType.includes("ADD") && parsedType.includes("LIQUID") ||
                parsedDescription.includes("add liquidity");
            const parsedRemoveLiquidity = parsedType.includes("REMOVE") && parsedType.includes("LIQUID") ||
                parsedDescription.includes("remove liquidity");
            const byPool = new Map();
            for (const flow of tx.flows) {
                if (!flow.pool_address || flow.wallet !== tx.signer)
                    continue;
                if (!byPool.has(flow.pool_address)) {
                    byPool.set(flow.pool_address, {
                        negativeMints: new Set(),
                        positiveMints: new Set(),
                        stableValueDelta: 0,
                    });
                }
                const summary = byPool.get(flow.pool_address);
                if (flow.delta_raw < 0n)
                    summary.negativeMints.add(flow.mint);
                if (flow.delta_raw > 0n)
                    summary.positiveMints.add(flow.mint);
                if (flow.delta_usd !== null &&
                    [
                        "So11111111111111111111111111111111111111112",
                        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                    ].includes(flow.mint)) {
                    summary.stableValueDelta += flow.delta_usd ?? 0;
                }
            }
            for (const [poolAddress, summary] of byPool) {
                const added = summary.negativeMints.size >= 2 || parsedAddLiquidity;
                const removed = summary.positiveMints.size >= 2 || parsedRemoveLiquidity;
                if (!added && !removed)
                    continue;
                legs.push({
                    signature: tx.tx_sig,
                    slot: tx.slot,
                    tx_index: tx.tx_index,
                    signer: tx.signer,
                    validator: tx.validator,
                    block_time: tx.block_time,
                    pool_address: poolAddress,
                    source: inferredSource,
                    added,
                    removed,
                    token_mints: [...new Set([...summary.negativeMints, ...summary.positiveMints])],
                    stableValueDelta: Number(summary.stableValueDelta.toFixed(2)),
                    priority_fee: tx.priority_fee,
                });
            }
        }
        this.recentLiquidityLegs.unshift(...legs);
        if (this.recentLiquidityLegs.length > MAX_LIQUIDITY_HISTORY) {
            this.recentLiquidityLegs.length = MAX_LIQUIDITY_HISTORY;
        }
        return legs;
    }
    readTokenAmount(token) {
        if (!token)
            return null;
        const rawAmount = token.rawTokenAmount?.tokenAmount;
        const decimals = token.rawTokenAmount?.decimals ?? 0;
        if (!rawAmount)
            return null;
        return Number(rawAmount) / Math.pow(10, decimals);
    }
    computePriceImpactHint(inputUsd, outputUsd) {
        if (!inputUsd || !outputUsd || inputUsd <= 0 || outputUsd <= 0)
            return null;
        const ratio = outputUsd / inputUsd;
        return Number(Math.abs(1 - ratio).toFixed(4));
    }
    normalizePoolAddress(poolAddress, source, inputMint, outputMint, programId) {
        const programLabel = (0, programs_1.getProgramLabel)(programId);
        const normalizedSource = source?.toLowerCase() ?? null;
        const exactPoolAvailable = !!poolAddress && poolAddress !== "unknown";
        const sourceIsAggregator = normalizedSource?.includes("jupiter") || normalizedSource?.includes("router") || false;
        const programIsAggregator = programLabel === "jupiter_v4" || programLabel === "jupiter_v6" || programLabel === "raydium_router";
        if (exactPoolAvailable && programLabel && !programIsAggregator && !sourceIsAggregator) {
            return poolAddress;
        }
        if (source) {
            const routeMints = [inputMint, outputMint].filter(Boolean).join("->") || "unknown-route";
            return `route:${source.toLowerCase()}:${routeMints}`;
        }
        if (programLabel) {
            if (exactPoolAvailable && !programIsAggregator)
                return poolAddress;
            const routeMints = [inputMint, outputMint].filter(Boolean).join("->");
            return routeMints ? `venue:${programLabel}:${routeMints}` : `venue:${programLabel}`;
        }
        if (poolAddress && poolAddress !== "unknown")
            return poolAddress;
        if (inputMint || outputMint) {
            const pair = [inputMint, outputMint].filter(Boolean).join("->");
            if (pair)
                return `pair:${pair}`;
        }
        return "unknown";
    }
    computeSignerStableDelta(flows, signer) {
        return Number(flows
            .filter((flow) => flow.wallet === signer &&
            flow.delta_usd !== null &&
            STABLE_AND_MAJOR_MINTS.has(flow.mint))
            .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0)
            .toFixed(2));
    }
    passesMaterialThreshold(attack) {
        const thresholds = MATERIAL_THRESHOLDS[attack.attack_type];
        if (!thresholds)
            return false;
        if (attack.confidence < thresholds.minConfidence)
            return false;
        if (thresholds.requireKnownPool &&
            (!attack.pool_address || attack.pool_address === "unknown")) {
            return false;
        }
        const profit = attack.profit_usd ?? 0;
        const victimLoss = attack.victim_loss_usd ?? 0;
        return profit >= thresholds.minProfitUsd || victimLoss >= thresholds.minVictimLossUsd;
    }
    filterDetectedAttacks(attacks) {
        const filtered = attacks.filter((attack) => this.passesMaterialThreshold(attack));
        const bestByFamily = new Map();
        for (const attack of filtered) {
            const familyKey = this.attackFamilyKey(attack);
            const existing = bestByFamily.get(familyKey);
            if (!existing || attackScore(attack) > attackScore(existing)) {
                bestByFamily.set(familyKey, attack);
            }
        }
        return [...bestByFamily.values()];
    }
    attackFamilyKey(attack) {
        if (attack.attack_type === "sandwich" || attack.attack_type === "jit") {
            return [
                attack.attack_type,
                attack.attacker_wallet,
                attack.pool_address,
                attack.frontrun_tx ?? "no-front",
                attack.backrun_tx ?? "no-back",
            ].join(":");
        }
        if (attack.attack_type === "arbitrage") {
            return [
                attack.attack_type,
                attack.attacker_wallet,
                attack.pool_address,
                attack.backrun_tx ?? attack.victim_tx ?? `slot-${attack.slot}`,
            ].join(":");
        }
        return [
            attack.attack_type,
            attack.attacker_wallet,
            attack.pool_address,
            attack.victim_tx ?? attack.backrun_tx ?? `slot-${attack.slot}`,
            attack.detector ?? "unknown-detector",
        ].join(":");
    }
    entityIdFromWallets(wallets) {
        const seed = wallets.slice().sort().join("|");
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
        }
        return `entity_${hash.toString(16).padStart(8, "0")}`;
    }
    sanitizeMoney(value, minimum = 1) {
        if (value == null || !Number.isFinite(value))
            return null;
        const rounded = Number(value.toFixed(2));
        return Math.abs(rounded) >= minimum ? rounded : null;
    }
    inferAttackQuality(attack) {
        const profit = attack.profit_usd ?? 0;
        const victimLoss = attack.victim_loss_usd ?? 0;
        const strongDetector = attack.detector.includes("parsed") ||
            attack.detector.includes("liquidation") ||
            attack.detector.includes("wide");
        const hasFullBracket = !!attack.frontrun_tx &&
            !!attack.backrun_tx &&
            (attack.attack_type === "sandwich" || attack.attack_type === "jit");
        const hasKnownVenue = !!attack.pool_address && attack.pool_address !== "unknown";
        const hasVictim = !!attack.victim_wallet;
        if (attack.attack_type === "sandwich") {
            if (attack.confidence >= 0.9 &&
                hasKnownVenue &&
                hasFullBracket &&
                (strongDetector || victimLoss >= 50) &&
                (profit >= 25 || victimLoss >= 75)) {
                return "confirmed";
            }
            return "likely";
        }
        if (attack.attack_type === "jit") {
            if (attack.confidence >= 0.88 &&
                hasKnownVenue &&
                hasFullBracket &&
                hasVictim &&
                (profit >= 25 || victimLoss >= 50)) {
                return "confirmed";
            }
            return "likely";
        }
        if (attack.attack_type === "arbitrage") {
            if (attack.confidence >= 0.9 && hasKnownVenue && profit >= 50) {
                return "confirmed";
            }
            return "likely";
        }
        if (attack.attack_type === "liquidation") {
            if (attack.confidence >= 0.86 && hasKnownVenue && hasVictim && profit >= 25) {
                return "confirmed";
            }
            return "likely";
        }
        return "likely";
    }
    buildEntityContext(attacks = this.attacks) {
        const wallets = [...new Set(attacks.map((attack) => attack.attacker_wallet))];
        const parent = new Map();
        const find = (wallet) => {
            const current = parent.get(wallet) ?? wallet;
            if (current === wallet) {
                parent.set(wallet, wallet);
                return wallet;
            }
            const root = find(current);
            parent.set(wallet, root);
            return root;
        };
        const union = (a, b) => {
            const rootA = find(a);
            const rootB = find(b);
            if (rootA !== rootB)
                parent.set(rootB, rootA);
        };
        for (const wallet of wallets)
            parent.set(wallet, wallet);
        const profileByWallet = new Map();
        for (const attack of attacks) {
            if (!profileByWallet.has(attack.attacker_wallet)) {
                profileByWallet.set(attack.attacker_wallet, {
                    pools: new Set(),
                    validators: new Set(),
                    strategies: new Set(),
                    tokens: new Set(),
                    attacks: [],
                });
            }
            const profile = profileByWallet.get(attack.attacker_wallet);
            if (attack.pool_address && attack.pool_address !== "unknown")
                profile.pools.add(attack.pool_address);
            if (attack.validator)
                profile.validators.add(attack.validator);
            if (attack.attack_type)
                profile.strategies.add(attack.attack_type);
            if (attack.token_mint)
                profile.tokens.add(attack.token_mint);
            profile.attacks.push(attack);
        }
        for (let i = 0; i < wallets.length; i++) {
            for (let j = i + 1; j < wallets.length; j++) {
                const a = wallets[i];
                const b = wallets[j];
                const profileA = profileByWallet.get(a);
                const profileB = profileByWallet.get(b);
                if (!profileA || !profileB)
                    continue;
                const sharedPools = [...profileA.pools].filter((pool) => profileB.pools.has(pool)).length;
                const sharedValidators = [...profileA.validators].filter((validator) => profileB.validators.has(validator)).length;
                const sharedStrategies = [...profileA.strategies].filter((strategy) => profileB.strategies.has(strategy)).length;
                const sharedTokens = [...profileA.tokens].filter((token) => profileB.tokens.has(token)).length;
                const coordinatedWindows = profileA.attacks.filter((attackA) => profileB.attacks.some((attackB) => attackA.attack_type === attackB.attack_type &&
                    attackA.pool_address === attackB.pool_address &&
                    Math.abs(attackA.slot - attackB.slot) <= 8)).length;
                const score = sharedPools * 2 +
                    sharedValidators * 1.5 +
                    sharedStrategies * 1.5 +
                    sharedTokens +
                    coordinatedWindows * 2;
                if (score >= 6)
                    union(a, b);
            }
        }
        const grouped = new Map();
        for (const wallet of wallets) {
            const root = find(wallet);
            if (!grouped.has(root))
                grouped.set(root, []);
            grouped.get(root).push(wallet);
        }
        const groups = [...grouped.values()]
            .map((memberWallets) => {
            const sortedWallets = memberWallets.slice().sort();
            const labelSeed = sortedWallets[0]?.slice(0, 6).toUpperCase() ?? "MEV";
            return {
                id: this.entityIdFromWallets(sortedWallets),
                label: `ENT-${labelSeed}`,
                wallets: sortedWallets,
            };
        })
            .sort((a, b) => b.wallets.length - a.wallets.length || a.id.localeCompare(b.id));
        const entityByWallet = new Map();
        for (const group of groups) {
            for (const wallet of group.wallets) {
                entityByWallet.set(wallet, group);
            }
        }
        return { entityByWallet, groups };
    }
    detectParsedSandwiches(swaps) {
        const attacks = [];
        for (const victim of swaps) {
            if (!victim.input_mint || !victim.output_mint)
                continue;
            const sharesVenue = (candidate) => (victim.pool_address &&
                candidate.pool_address &&
                candidate.pool_address === victim.pool_address) ||
                (!!victim.source && !!candidate.source && candidate.source === victim.source);
            const beforeCandidates = this.recentSwaps
                .filter((candidate) => candidate.signature !== victim.signature &&
                sharesVenue(candidate) &&
                candidate.signer !== victim.signer &&
                candidate.slot >= victim.slot - 8 &&
                (candidate.slot < victim.slot ||
                    (candidate.slot === victim.slot && candidate.tx_index < victim.tx_index)))
                .sort((a, b) => (b.priority_fee ?? 0) - (a.priority_fee ?? 0) ||
                new Date(b.block_time).getTime() - new Date(a.block_time).getTime());
            const before = beforeCandidates.find((candidate) => (candidate.input_mint === victim.input_mint &&
                candidate.output_mint === victim.output_mint) ||
                candidate.output_mint === victim.input_mint ||
                candidate.input_mint === victim.output_mint);
            if (!before)
                continue;
            const afterCandidates = this.recentSwaps
                .filter((candidate) => candidate.signature !== victim.signature &&
                candidate.signer === before.signer &&
                sharesVenue(candidate) &&
                candidate.slot <= victim.slot + 8 &&
                (candidate.slot > victim.slot ||
                    (candidate.slot === victim.slot && candidate.tx_index > victim.tx_index)))
                .sort((a, b) => new Date(a.block_time).getTime() - new Date(b.block_time).getTime());
            const after = afterCandidates.find((candidate) => candidate.input_mint === before.output_mint ||
                candidate.output_mint === before.input_mint ||
                (candidate.input_mint === victim.output_mint &&
                    candidate.output_mint === victim.input_mint));
            if (!after)
                continue;
            const priorityFee = Math.max(before.priority_fee ?? 0, after.priority_fee ?? 0);
            const priceImpact = victim.price_impact_hint ?? 0;
            const slotSpan = Math.max(victim.slot - before.slot, after.slot - victim.slot);
            const validatorAligned = before.validator === victim.validator && victim.validator === after.validator;
            let confidence = priceImpact >= 0.02
                ? 0.92
                : priceImpact >= 0.0075 || priorityFee >= 20000
                    ? 0.86
                    : 0;
            if (slotSpan >= 2)
                confidence += 0.02;
            if (slotSpan >= 4)
                confidence += 0.01;
            if (validatorAligned)
                confidence += 0.01;
            confidence = Math.min(0.96, Number(confidence.toFixed(2)));
            if (confidence === 0)
                continue;
            const detector = slotSpan >= 2 ? "wide_parsed_sandwich" : "parsed_swap_sandwich";
            attacks.push({
                attack_type: "sandwich",
                slot: victim.slot,
                block_time: victim.block_time,
                validator: victim.validator,
                attacker_wallet: before.signer,
                victim_wallet: victim.signer,
                pool_address: this.normalizePoolAddress(victim.pool_address ?? before.pool_address ?? after.pool_address, victim.source ?? before.source ?? after.source, victim.input_mint, victim.output_mint),
                token_mint: victim.output_mint,
                profit_usd: this.estimateParsedProfit(before, after),
                victim_loss_usd: priceImpact > 0 && victim.notional_usd ? Number((priceImpact * victim.notional_usd).toFixed(2)) : null,
                frontrun_tx: before.signature,
                victim_tx: victim.signature,
                backrun_tx: after.signature,
                tip_lamports: priorityFee,
                confidence,
                detector,
                evidence: [
                    victim.pool_address
                        ? "parsed swap route bracketed victim in same pool"
                        : "parsed swap route bracketed victim in same venue window",
                    "same attacker wallet reappeared after victim in a narrow slot window",
                    slotSpan >= 2
                        ? `wide bracket spanned ${slotSpan + 1} slot(s)`
                        : "tight bracket occurred inside one slot window",
                    validatorAligned
                        ? "all attack legs shared the same leader context"
                        : "legs remained venue-consistent across the bracket window",
                    priceImpact >= 0.02
                        ? "victim price-impact hint exceeded 2%"
                        : priorityFee >= 20000
                            ? "attacker legs carried elevated priority fees"
                            : "victim swap showed measurable adverse execution",
                ],
            });
        }
        return attacks;
    }
    estimateParsedProfit(front, back) {
        const gross = front.signer_stable_delta_usd + back.signer_stable_delta_usd;
        if (gross <= 0)
            return null;
        return Number(gross.toFixed(2));
    }
    detectParsedArbitrage(swaps, flowsByTx, blockTime, validator, slot) {
        const attacks = [];
        const grouped = new Map();
        for (const swap of swaps) {
            if (!grouped.has(swap.signer))
                grouped.set(swap.signer, []);
            grouped.get(swap.signer).push(swap);
        }
        for (const [signer, signerSwaps] of grouped) {
            const candidateWindow = this.recentSwaps.filter((swap) => swap.signer === signer &&
                swap.slot >= slot - 2 &&
                swap.slot <= slot);
            const candidatePools = new Set(candidateWindow.map((swap) => swap.pool_address).filter(Boolean));
            const candidateSources = new Set(candidateWindow.map((swap) => swap.source).filter(Boolean));
            if (candidateWindow.length < 2 || candidatePools.size < 2)
                continue;
            const stableNetGain = candidateWindow.reduce((sum, swap) => {
                const flows = flowsByTx.get(swap.signature) ?? [];
                return sum + this.computeSignerStableDelta(flows, signer);
            }, 0);
            const feeAggression = Math.max(...candidateWindow.map((swap) => swap.priority_fee ?? 0));
            const inventoryBalanced = candidateWindow.every((swap) => {
                const flows = flowsByTx.get(swap.signature) ?? [];
                const residualByMint = new Map();
                for (const flow of flows) {
                    if (flow.wallet !== signer || flow.delta_usd === null)
                        continue;
                    if (STABLE_AND_MAJOR_MINTS.has(flow.mint))
                        continue;
                    residualByMint.set(flow.mint, (residualByMint.get(flow.mint) ?? 0) + flow.delta_usd);
                }
                const significantResiduals = [...residualByMint.values()].filter((value) => Math.abs(value) >= 15);
                return significantResiduals.length <= 1;
            });
            const confidence = stableNetGain >= 75
                ? 0.92
                : stableNetGain >= 30 && inventoryBalanced && candidateSources.size >= 2
                    ? 0.88
                    : 0;
            if (confidence === 0)
                continue;
            attacks.push({
                attack_type: "arbitrage",
                slot,
                block_time: blockTime,
                validator,
                attacker_wallet: signer,
                victim_wallet: null,
                pool_address: this.normalizePoolAddress(candidateWindow[0].pool_address, candidateWindow[0].source, candidateWindow[0].input_mint, candidateWindow[0].output_mint),
                token_mint: candidateWindow[0].output_mint,
                profit_usd: stableNetGain > 0 ? Number(stableNetGain.toFixed(2)) : null,
                victim_loss_usd: null,
                frontrun_tx: null,
                victim_tx: null,
                backrun_tx: candidateWindow[candidateWindow.length - 1]?.signature ?? candidateWindow[0].signature,
                tip_lamports: feeAggression > 0 ? feeAggression : null,
                confidence,
                detector: "parsed_swap_arbitrage",
                evidence: [
                    "same signer touched multiple pools in a narrow slot window",
                    "realized stable or major-token gain remained after the route closed",
                    inventoryBalanced
                        ? "non-stable inventory ended approximately flat across the route window"
                        : "inventory shape remained bounded despite multi-pool route activity",
                    candidateSources.size >= 2
                        ? "multiple venues were involved in the route cycle"
                        : "multiple pools were traversed inside one venue family",
                    `multi-pool window size ${candidateWindow.length} tx`,
                ],
            });
        }
        return attacks;
    }
    detectParsedLiquidations(txRows, parsedBySig, flowsByTx, blockTime, validator, slot) {
        const attacks = [];
        for (const row of txRows) {
            const parsed = parsedBySig.get(row.signature);
            const type = (parsed?.type ?? "").toUpperCase();
            const looksLikeLiquidation = type.includes("LIQUID") ||
                (parsed?.description ?? "").toLowerCase().includes("liquidat");
            if (!looksLikeLiquidation)
                continue;
            const flows = flowsByTx.get(row.signature) ?? [];
            const profit = flows
                .filter((flow) => flow.wallet === row.signer &&
                flow.delta_raw > 0n &&
                flow.delta_usd !== null)
                .reduce((sum, flow) => sum + (flow.delta_usd ?? 0), 0);
            const poolAddress = this.normalizePoolAddress(flows.find((flow) => flow.pool_address)?.pool_address, parsed?.source ?? null, flows.find((flow) => flow.wallet === row.signer && flow.delta_raw < 0n)?.mint ?? null, flows.find((flow) => flow.wallet === row.signer && flow.delta_raw > 0n)?.mint ?? null, flows.find((flow) => flow.program_id)?.program_id ?? null);
            const victimWallet = parsed?.tokenTransfers?.find((transfer) => transfer.toUserAccount !== row.signer)?.toUserAccount ??
                null;
            const hasKnownVenue = poolAddress !== "unknown";
            const hasObservedGain = profit >= 5;
            if (!hasObservedGain && !victimWallet)
                continue;
            if (!hasKnownVenue && !victimWallet)
                continue;
            const confidence = hasObservedGain && victimWallet && hasKnownVenue
                ? 0.87
                : hasObservedGain && (victimWallet || hasKnownVenue)
                    ? 0.82
                    : 0.76;
            attacks.push({
                attack_type: "liquidation",
                slot,
                block_time: new Date((parsed?.timestamp ?? Math.floor(blockTime.getTime() / 1000)) * 1000),
                validator,
                attacker_wallet: row.signer,
                victim_wallet: victimWallet,
                pool_address: poolAddress,
                token_mint: flows.find((flow) => flow.wallet === row.signer && flow.delta_raw > 0n)?.mint ?? null,
                profit_usd: profit > 0 ? Number(profit.toFixed(2)) : null,
                victim_loss_usd: null,
                frontrun_tx: null,
                victim_tx: row.signature,
                backrun_tx: null,
                tip_lamports: row.priority_fee && row.priority_fee > 0 ? row.priority_fee : null,
                confidence,
                detector: "parsed_liquidation",
                evidence: [
                    "Helius parsed transaction labeled liquidation-like activity",
                    hasObservedGain
                        ? "positive wallet delta observed on liquidator wallet"
                        : "liquidation label observed even though realized gain was not fully measurable",
                    victimWallet
                        ? "token transfer graph indicates third-party loss flow"
                        : "counterparty account was not fully attributable from parsed transfers",
                ],
            });
        }
        return attacks;
    }
    detectParsedBackruns(swaps, flowsByTx, blockTime, validator, slot) {
        const attacks = [];
        for (const victim of swaps) {
            const victimImpact = victim.price_impact_hint ?? 0;
            const victimNotional = victim.notional_usd ?? Math.max(victim.input_usd ?? 0, victim.output_usd ?? 0, 0);
            const victimIsMaterial = victimImpact >= 0.004 || victimNotional >= 750;
            if (!victimIsMaterial)
                continue;
            const sharesVenue = (candidate) => (victim.pool_address &&
                candidate.pool_address &&
                candidate.pool_address === victim.pool_address) ||
                (!!victim.source && !!candidate.source && candidate.source === victim.source);
            const afterWindow = this.recentSwaps
                .filter((candidate) => candidate.signature !== victim.signature &&
                candidate.signer !== victim.signer &&
                sharesVenue(candidate) &&
                candidate.slot >= victim.slot &&
                candidate.slot <= victim.slot + 2 &&
                (candidate.slot > victim.slot ||
                    (candidate.slot === victim.slot && candidate.tx_index > victim.tx_index)))
                .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);
            let best = null;
            for (const candidate of afterWindow) {
                const sameSignerWindow = this.recentSwaps.filter((item) => item.signer === candidate.signer &&
                    item.slot >= victim.slot &&
                    item.slot <= candidate.slot + 1);
                const routeCount = new Set(sameSignerWindow
                    .map((item) => item.pool_address ?? item.source)
                    .filter(Boolean)).size;
                const stableGain = sameSignerWindow.reduce((sum, item) => {
                    const flows = flowsByTx.get(item.signature) ?? [];
                    return sum + this.computeSignerStableDelta(flows, candidate.signer);
                }, 0);
                const feeSignal = Math.max(...sameSignerWindow.map((item) => item.priority_fee ?? 0), 0);
                const candidateProfit = Number(stableGain.toFixed(2));
                if (candidateProfit < 12)
                    continue;
                if (routeCount < 1)
                    continue;
                if (!best ||
                    candidateProfit > best.profit ||
                    (candidateProfit === best.profit && routeCount > best.routeCount)) {
                    best = {
                        swap: candidate,
                        profit: candidateProfit,
                        routeCount,
                        feeSignal,
                    };
                }
            }
            if (!best)
                continue;
            let confidence = 0.78;
            if (best.profit >= 40)
                confidence += 0.04;
            if (best.routeCount >= 2)
                confidence += 0.03;
            if (victimImpact >= 0.01)
                confidence += 0.03;
            if (best.feeSignal >= 15000)
                confidence += 0.02;
            if (best.swap.validator === victim.validator)
                confidence += 0.02;
            confidence = Math.min(0.92, Number(confidence.toFixed(2)));
            attacks.push({
                attack_type: "backrun",
                slot: victim.slot,
                block_time: victim.block_time ?? blockTime,
                validator: victim.validator ?? validator,
                attacker_wallet: best.swap.signer,
                victim_wallet: victim.signer,
                pool_address: this.normalizePoolAddress(victim.pool_address ?? best.swap.pool_address, victim.source ?? best.swap.source, victim.input_mint, victim.output_mint),
                token_mint: best.swap.output_mint ?? victim.output_mint,
                profit_usd: best.profit,
                victim_loss_usd: victimImpact > 0 && victimNotional > 0
                    ? Number((victimImpact * victimNotional).toFixed(2))
                    : null,
                frontrun_tx: null,
                victim_tx: victim.signature,
                backrun_tx: best.swap.signature,
                tip_lamports: best.feeSignal > 0 ? best.feeSignal : null,
                confidence,
                detector: "parsed_post_swap_backrun",
                evidence: [
                    "distinct searcher swapped after a material victim swap in the same venue window",
                    best.routeCount >= 2
                        ? "searcher route expanded across multiple pools immediately after victim"
                        : "searcher captured post-swap opportunity in the same venue window",
                    `realized stable or major-token gain ${best.profit.toFixed(2)} USD after victim`,
                    best.swap.validator === victim.validator
                        ? "victim and backrun aligned under the same validator context"
                        : "backrun occurred within a tight post-victim slot window",
                ],
            });
        }
        return attacks;
    }
    detectLiquidityJIT(currentLegs) {
        const attacks = [];
        for (const addLeg of currentLegs.filter((leg) => leg.added)) {
            const sharesVenue = (candidate) => candidate.pool_address === addLeg.pool_address ||
                (!!candidate.source && !!addLeg.source && candidate.source === addLeg.source);
            const removalCandidates = this.recentLiquidityLegs
                .filter((candidate) => candidate.removed &&
                candidate.signature !== addLeg.signature &&
                candidate.signer === addLeg.signer &&
                sharesVenue(candidate) &&
                candidate.slot >= addLeg.slot &&
                candidate.slot <= addLeg.slot + 8 &&
                (candidate.slot > addLeg.slot ||
                    (candidate.slot === addLeg.slot && candidate.tx_index > addLeg.tx_index)))
                .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);
            const removeLeg = removalCandidates[0];
            if (!removeLeg)
                continue;
            const victimCandidates = this.recentSwaps
                .filter((swap) => (swap.pool_address === addLeg.pool_address ||
                (!!swap.source && !!addLeg.source && swap.source === addLeg.source)) &&
                swap.signer !== addLeg.signer &&
                swap.slot >= addLeg.slot &&
                swap.slot <= removeLeg.slot &&
                (swap.slot > addLeg.slot ||
                    (swap.slot === addLeg.slot && swap.tx_index > addLeg.tx_index)) &&
                (swap.slot < removeLeg.slot ||
                    (swap.slot === removeLeg.slot && swap.tx_index < removeLeg.tx_index)))
                .sort((a, b) => a.slot - b.slot || a.tx_index - b.tx_index);
            const victim = victimCandidates.find((candidate) => (candidate.price_impact_hint ?? 0) >= 0.003 ||
                (candidate.input_amount ?? 0) >= 100 ||
                (candidate.output_amount ?? 0) >= 100 ||
                (candidate.notional_usd ?? 0) >= 250);
            if (!victim)
                continue;
            const mintOverlap = addLeg.token_mints.filter((mint) => removeLeg.token_mints.includes(mint)).length;
            if (mintOverlap < 1)
                continue;
            const priorityFee = Math.max(addLeg.priority_fee ?? 0, removeLeg.priority_fee ?? 0);
            let confidence = 0.76;
            if (addLeg.slot === removeLeg.slot)
                confidence += 0.04;
            if (priorityFee >= 10000)
                confidence += 0.03;
            if (victim.price_impact_hint && victim.price_impact_hint >= 0.003)
                confidence += 0.03;
            if (addLeg.validator === removeLeg.validator)
                confidence += 0.02;
            if (removeLeg.slot - addLeg.slot <= 3)
                confidence += 0.03;
            if (addLeg.source && removeLeg.source && addLeg.source === removeLeg.source)
                confidence += 0.02;
            if (confidence < 0.78)
                continue;
            attacks.push({
                attack_type: "jit",
                slot: victim.slot,
                block_time: addLeg.block_time,
                validator: addLeg.validator,
                attacker_wallet: addLeg.signer,
                victim_wallet: victim.signer,
                pool_address: this.normalizePoolAddress(addLeg.pool_address, addLeg.source ?? removeLeg.source ?? victim.source ?? null, victim.input_mint, victim.output_mint),
                token_mint: victim.output_mint ?? victim.input_mint,
                profit_usd: removeLeg.stableValueDelta > 0
                    ? removeLeg.stableValueDelta
                    : addLeg.stableValueDelta + removeLeg.stableValueDelta > 0
                        ? Number((addLeg.stableValueDelta + removeLeg.stableValueDelta).toFixed(2))
                        : null,
                victim_loss_usd: victim.price_impact_hint && victim.notional_usd
                    ? Number((victim.price_impact_hint * victim.notional_usd).toFixed(2))
                    : null,
                frontrun_tx: addLeg.signature,
                victim_tx: victim.signature,
                backrun_tx: removeLeg.signature,
                tip_lamports: priorityFee > 0 ? priorityFee : null,
                confidence: Number(Math.min(0.93, confidence).toFixed(2)),
                detector: "liquidity_window_jit",
                evidence: [
                    "same signer added and removed multi-asset liquidity around a victim swap",
                    `liquidity window spanned ${removeLeg.slot - addLeg.slot + 1} slot(s) in same pool`,
                    victim.price_impact_hint && victim.price_impact_hint >= 0.003
                        ? `victim swap price-impact hint ${(victim.price_impact_hint * 100).toFixed(2)}%`
                        : "sized victim swap observed between LP entry and exit legs",
                ],
            });
        }
        return attacks;
    }
    detectSuspiciousOrderflow(swaps, slot, blockTime, validator) {
        const attacks = [];
        const scored = swaps
            .map((swap) => {
            let score = 0;
            const evidence = [];
            const signerWindow = this.recentSwaps.filter((candidate) => candidate.signer === swap.signer &&
                candidate.signature !== swap.signature &&
                candidate.slot >= swap.slot - 2 &&
                candidate.slot <= swap.slot &&
                candidate.pool_address !== swap.pool_address);
            if (!swap.pool_address || swap.pool_address === "unknown") {
                return { swap, score: -1, evidence };
            }
            if (swap.priority_fee && swap.priority_fee >= 25000) {
                score += 2;
                evidence.push("priority fee elevated above typical retail flow");
            }
            if (swap.source && ["JUPITER", "RAYDIUM", "ORCA", "METEORA"].includes(swap.source.toUpperCase())) {
                score += 1;
                evidence.push(`parsed dex source ${swap.source.toLowerCase()}`);
            }
            if (swap.price_impact_hint && swap.price_impact_hint >= 0.015) {
                score += 2;
                evidence.push(`price impact hint ${(swap.price_impact_hint * 100).toFixed(2)}%`);
            }
            if ((swap.input_amount ?? 0) >= 250 || (swap.output_amount ?? 0) >= 250) {
                score += 1;
                evidence.push("notional swap size above heuristic threshold");
            }
            if (signerWindow.length > 0) {
                score += 2;
                evidence.push("same signer routed across multiple pools in a narrow window");
            }
            const routeCount = new Set(signerWindow.map((candidate) => candidate.pool_address).filter(Boolean)).size;
            if (routeCount >= 2) {
                score += 1;
                evidence.push("multi-pool routing path observed");
            }
            const majorSwap = (swap.input_amount ?? 0) >= 1000 ||
                (swap.output_amount ?? 0) >= 1000;
            const strongPriceImpact = (swap.price_impact_hint ?? 0) >= 0.03;
            const strongFee = (swap.priority_fee ?? 0) >= 25000;
            const qualifiesCandidate = routeCount >= 1 && (strongPriceImpact || strongFee || majorSwap);
            if (!qualifiesCandidate) {
                return { swap, score: -1, evidence };
            }
            return { swap, score, evidence };
        })
            .filter((item) => item.score >= 6)
            .sort((a, b) => b.score - a.score ||
            (b.swap.priority_fee ?? 0) - (a.swap.priority_fee ?? 0) ||
            (b.swap.price_impact_hint ?? 0) - (a.swap.price_impact_hint ?? 0))
            .slice(0, 2);
        for (const item of scored) {
            const confidence = Math.min(0.76, 0.56 + item.score * 0.03);
            attacks.push({
                attack_type: "backrun",
                slot,
                block_time: item.swap.block_time ?? blockTime,
                validator: item.swap.validator ?? validator,
                attacker_wallet: item.swap.signer,
                victim_wallet: null,
                pool_address: item.swap.pool_address ?? "unknown",
                token_mint: item.swap.output_mint,
                profit_usd: null,
                victim_loss_usd: null,
                frontrun_tx: null,
                victim_tx: item.swap.signature,
                backrun_tx: item.swap.signature,
                tip_lamports: item.swap.priority_fee,
                confidence,
                detector: "suspicious_orderflow_candidate",
                evidence: [...item.evidence, "heuristic candidate only; realized extraction not yet confirmed"],
            });
        }
        return attacks;
    }
    async fetchPrices(mints) {
        const fallbackPrices = new Map([
            ["So11111111111111111111111111111111111111112", 150],
            ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 1],
            ["Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 1],
        ]);
        if (mints.length === 0)
            return fallbackPrices;
        try {
            const ids = mints.slice(0, 100).join(",");
            const response = await fetch(`https://api.jup.ag/price/v3?ids=${ids}`);
            const payload = await response.json();
            const priceMap = new Map(fallbackPrices);
            for (const [mint, info] of Object.entries(payload ?? {})) {
                const price = typeof info === "object" && info !== null
                    ? Number(info.usdPrice ?? info.price ?? 0)
                    : 0;
                if (price > 0)
                    priceMap.set(mint, price);
            }
            return priceMap;
        }
        catch (error) {
            console.warn("[chain] price fetch failed, using fallback majors", error instanceof Error ? error.message : error);
            return fallbackPrices;
        }
    }
    insertAttack(attack) {
        const key = this.attackFamilyKey(attack);
        const attackQuality = this.inferAttackQuality(attack);
        const campaignId = `camp:${attack.attack_type}:${attack.attacker_wallet}:${attack.pool_address}`;
        const sanitizedProfit = this.sanitizeMoney(attack.profit_usd, 1);
        const sanitizedVictimLoss = this.sanitizeMoney(attack.victim_loss_usd, 1);
        const sanitizedPriorityFee = attack.tip_lamports && attack.tip_lamports > 0 ? attack.tip_lamports : null;
        const surface = parseSurface(attack.pool_address);
        const executionLane = this.inferExecutionLane(attack);
        const precision = surfacePrecision(attack.pool_address);
        const detectionBasis = this.inferDetectionBasis(attack);
        const persistedAttack = {
            id: this.nextId++,
            attack_type: attack.attack_type,
            slot: attack.slot,
            block_time: attack.block_time.toISOString(),
            validator: attack.validator,
            attacker_wallet: attack.attacker_wallet,
            entity_id: attack.attacker_wallet,
            entity_label: `ENT-${attack.attacker_wallet.slice(0, 6).toUpperCase()}`,
            entity_risk: this.estimateRisk(attack),
            victim_wallet: attack.victim_wallet,
            victim_loss_usd: sanitizedVictimLoss,
            pool_address: attack.pool_address,
            token_mint: attack.token_mint,
            profit_usd: sanitizedProfit,
            tip_lamports: sanitizedPriorityFee,
            confidence: attack.confidence,
            detector: attack.detector,
            attack_quality: attackQuality,
            campaign_id: campaignId,
            protocol: surface.protocol,
            surface_kind: surface.route_kind,
            surface_precision: precision,
            surface_label: surface.label,
            surface_mints: surface.mints,
            detection_basis: detectionBasis,
            bundle_likelihood: this.estimateBundleLikelihood(attack),
            execution_lane: executionLane,
            evidence: attack.evidence,
            frontrun_tx: attack.frontrun_tx,
            victim_tx: attack.victim_tx,
            backrun_tx: attack.backrun_tx,
        };
        const existingIndex = this.attackIndexByKey.get(key);
        if (existingIndex !== undefined) {
            const existing = this.attacks[existingIndex];
            if (!existing)
                return;
            const existingScore = attackScore(existing);
            const nextScore = attackScore(persistedAttack);
            if (nextScore > existingScore) {
                this.attacks[existingIndex] = {
                    ...persistedAttack,
                    id: existing.id,
                };
            }
            return;
        }
        this.attackKeys.add(key);
        this.attacks.unshift(persistedAttack);
        this.attackIndexByKey = new Map(this.attacks.map((item, index) => {
            const itemKey = item.attack_type === "sandwich" || item.attack_type === "jit"
                ? [item.attack_type, item.slot, item.attacker_wallet, item.pool_address, item.frontrun_tx, item.backrun_tx].join(":")
                : [item.attack_type, item.slot, item.attacker_wallet, item.pool_address, item.victim_tx, item.backrun_tx].join(":");
            return [itemKey, index];
        }));
        void this.persistAttack(key, persistedAttack);
        if (this.attacks.length > MAX_ATTACKS) {
            const removed = this.attacks.splice(MAX_ATTACKS);
            for (const item of removed) {
                const itemKey = this.attackFamilyKey(item);
                this.attackKeys.delete(itemKey);
                this.attackIndexByKey.delete(itemKey);
            }
            this.attackIndexByKey = new Map(this.attacks.map((item, index) => {
                const itemKey = this.attackFamilyKey(item);
                return [itemKey, index];
            }));
        }
    }
    async persistAttack(attackKey, attack) {
        void attackKey;
        void attack;
    }
    async persistSnapshot() {
        if (Date.now() - this.lastSnapshotPersistAt < 15000)
            return;
        this.lastSnapshotPersistAt = Date.now();
    }
    estimateRisk(attack) {
        const base = attack.attack_type === "sandwich"
            ? 0.72
            : attack.attack_type === "jit"
                ? 0.6
                : attack.attack_type === "liquidation"
                    ? 0.55
                    : 0.48;
        const profitBoost = Math.min(0.08, Math.max(0, (attack.profit_usd ?? 0) / 10000));
        const confidenceBoost = Math.min(0.12, Math.max(0, attack.confidence - 0.75));
        const evidenceBoost = attack.detector.includes("wide") || attack.detector.includes("parsed") ? 0.04 : 0;
        return Math.min(0.96, Number((base + profitBoost + confidenceBoost + evidenceBoost).toFixed(2)));
    }
    inferExecutionLane(attack) {
        const validator = attack.validator.toLowerCase();
        if (validator.includes("jito"))
            return "jito-aligned";
        if ((attack.tip_lamports ?? 0) >= 20000)
            return "priority-fee";
        return "standard";
    }
    inferDetectionBasis(attack) {
        if (attack.detector.includes("parsed") || attack.detector.includes("liquidation")) {
            return "parsed";
        }
        if (attack.detector.includes("flow") || attack.detector.includes("raw")) {
            return "flow";
        }
        return "heuristic";
    }
    estimateBundleLikelihood(attack) {
        let score = 0.18;
        const validator = attack.validator.toLowerCase();
        if (validator.includes("jito"))
            score += 0.32;
        if ((attack.tip_lamports ?? 0) >= 25000)
            score += 0.16;
        if (attack.frontrun_tx && attack.backrun_tx)
            score += 0.14;
        if (attack.detector.includes("parsed"))
            score += 0.08;
        if (attack.detector.includes("wide"))
            score -= 0.08;
        return Number(Math.max(0.05, Math.min(0.92, score)).toFixed(2));
    }
    hasLiveData() {
        return this.started && (Boolean(this.connection) || this.externalStreamActive);
    }
    getStatus() {
        return {
            mode: this.hasLiveData() ? "chain" : "fallback",
            heliusConfigured: Boolean(this.heliusRpcUrl),
            started: this.started,
            syncing: this.syncing,
            lastProcessedSlot: this.lastProcessedSlot,
            latestChainSlot: this.latestChainSlot,
            blocksProcessed: this.blocksProcessed,
            attacksDetected: this.attacksDetected,
            lastSyncAt: this.lastSyncAt,
            lastError: this.lastError,
            recentMetrics: this.recentMetrics,
            recentAttackPreview: this.attacks.slice(0, 5).map((attack) => ({
                attack_type: attack.attack_type,
                detector: attack.detector,
                confidence: attack.confidence,
                slot: attack.slot,
            })),
            recentValidatorPreview: this.getValidators().slice(0, 3).map((item) => ({
                validator: item.validator,
                risk_score: item.risk_score,
                sandwich_share: item.sandwich_share,
                wide_sandwich_count: item.wide_sandwich_count,
                total_mev_attacks: item.total_mev_attacks,
                unique_entities: item.unique_entities,
            })),
        };
    }
    getStats() {
        const entityContext = this.buildEntityContext();
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const last1h = Date.now() - 60 * 60 * 1000;
        const attacks24h = this.attacks.filter((attack) => new Date(attack.block_time).getTime() >= last24h);
        const attacks1h = this.attacks.filter((attack) => new Date(attack.block_time).getTime() >= last1h);
        return {
            total_attacks: this.attacks.length,
            attacks_24h: attacks24h.length,
            attacks_1h: attacks1h.length,
            total_extracted_usd: this.sumProfit(this.attacks),
            extracted_24h: this.sumProfit(attacks24h),
            total_entities: entityContext.groups.length,
            total_wallets: new Set(this.attacks.map((attack) => attack.attacker_wallet)).size,
            total_victims: new Set(this.attacks.map((attack) => attack.victim_wallet).filter(Boolean)).size,
            sandwich_count: this.attacks.filter((attack) => attack.attack_type === "sandwich").length,
            arb_count: this.attacks.filter((attack) => attack.attack_type === "arbitrage").length,
            jit_count: this.attacks.filter((attack) => attack.attack_type === "jit").length,
        };
    }
    getAttacks(params) {
        const entityContext = this.buildEntityContext();
        let results = [...this.attacks];
        if (params.type)
            results = results.filter((attack) => attack.attack_type === params.type);
        if (params.pool)
            results = results.filter((attack) => attack.pool_address === params.pool);
        if (params.since) {
            const sinceTs = new Date(params.since).getTime();
            if (!Number.isNaN(sinceTs)) {
                results = results.filter((attack) => new Date(attack.block_time).getTime() > sinceTs);
            }
        }
        const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
        const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
        return results.slice(offset, offset + limit).map((attack) => {
            const group = entityContext.entityByWallet.get(attack.attacker_wallet);
            return {
                ...attack,
                entity_id: group?.id ?? attack.entity_id,
                entity_label: group?.label ?? attack.entity_label,
            };
        });
    }
    getEntities(params) {
        const entityContext = this.buildEntityContext();
        const results = entityContext.groups.map((group) => {
            const groupAttacks = this.attacks.filter((attack) => group.wallets.includes(attack.attacker_wallet));
            const profit = this.sumProfit(groupAttacks);
            const attacks24h = groupAttacks.filter((attack) => new Date(attack.block_time).getTime() >= Date.now() - 24 * 60 * 60 * 1000);
            const attacks7d = groupAttacks.filter((attack) => new Date(attack.block_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
            const strategies = [...new Set(groupAttacks.map((attack) => attack.attack_type))];
            const uniquePools = new Set(groupAttacks.map((attack) => attack.pool_address).filter((pool) => pool && pool !== "unknown"));
            const uniqueValidators = new Set(groupAttacks.map((attack) => attack.validator).filter(Boolean));
            const topWallet = [...group.wallets]
                .sort((a, b) => this.sumProfit(groupAttacks.filter((attack) => attack.attacker_wallet === b)) -
                this.sumProfit(groupAttacks.filter((attack) => attack.attacker_wallet === a)))[0] ?? group.wallets[0];
            return {
                id: group.id,
                label: group.label,
                operator_wallet: topWallet,
                first_seen: groupAttacks.reduce((earliest, attack) => (new Date(attack.block_time) < new Date(earliest) ? attack.block_time : earliest), groupAttacks[0]?.block_time ?? new Date().toISOString()),
                last_seen: groupAttacks.reduce((latest, attack) => (new Date(attack.block_time) > new Date(latest) ? attack.block_time : latest), groupAttacks[0]?.block_time ?? new Date().toISOString()),
                total_profit_usd: profit,
                profit_24h_usd: this.sumProfit(attacks24h),
                profit_7d_usd: this.sumProfit(attacks7d),
                attack_count: groupAttacks.length,
                victim_count: new Set(groupAttacks.map((attack) => attack.victim_wallet).filter(Boolean)).size,
                dominant_strategy: [...strategies].sort((a, b) => groupAttacks.filter((attack) => attack.attack_type === b).length -
                    groupAttacks.filter((attack) => attack.attack_type === a).length)[0] ?? null,
                strategies_used: strategies,
                risk_score: Math.min(0.99, Number((Math.max(...groupAttacks.map((attack) => attack.entity_risk ?? 0.5), 0.45) +
                    Math.min(0.18, group.wallets.length * 0.04)).toFixed(2))),
                fee_aggression: groupAttacks.length > 0
                    ? Math.min(1, groupAttacks.reduce((sum, attack) => sum + (attack.tip_lamports ?? 0), 0) /
                        groupAttacks.length /
                        300000)
                    : 0,
                position_dominance: groupAttacks.filter((attack) => attack.attack_type === "sandwich").length >= Math.max(2, Math.ceil(groupAttacks.length / 2))
                    ? 0.88
                    : 0.58,
                pool_concentration: groupAttacks.length > 0 ? Number((Math.min(0.98, 0.35 + uniquePools.size / Math.max(1, groupAttacks.length))).toFixed(2)) : 0.35,
                profit_consistency: groupAttacks.length > 0 ? Number((Math.min(0.98, 0.4 + attacks24h.length / Math.max(1, groupAttacks.length) * 0.4)).toFixed(2)) : 0.4,
                wallet_count: group.wallets.length,
                sample_wallets: group.wallets.slice(0, 6),
            };
        });
        let filtered = [...results];
        if (params.strategy) {
            const strategy = params.strategy;
            filtered = filtered.filter((entity) => entity.strategies_used.includes(strategy));
        }
        if (params.min_risk) {
            const minRisk = Number.parseFloat(params.min_risk);
            if (!Number.isNaN(minRisk)) {
                filtered = filtered.filter((entity) => entity.risk_score >= minRisk);
            }
        }
        const sort = params.sort ?? "profit";
        if (sort === "attacks")
            filtered.sort((a, b) => b.attack_count - a.attack_count);
        else if (sort === "risk")
            filtered.sort((a, b) => b.risk_score - a.risk_score);
        else
            filtered.sort((a, b) => b.total_profit_usd - a.total_profit_usd);
        const offset = Number.parseInt(params.offset ?? "0", 10) || 0;
        const limit = Number.parseInt(params.limit ?? "50", 10) || 50;
        return filtered.slice(offset, offset + limit);
    }
    getEntity(id) {
        const entity = this.getEntities({ limit: String(MAX_ATTACKS) }).find((item) => item.id === id);
        if (!entity)
            return null;
        const targetWallets = new Set(entity.sample_wallets);
        const recent_attacks = this.attacks.filter((attack) => targetWallets.has(attack.attacker_wallet));
        const poolMap = new Map();
        const validatorMap = new Map();
        for (const attack of recent_attacks) {
            poolMap.set(attack.pool_address, {
                attack_count: (poolMap.get(attack.pool_address)?.attack_count ?? 0) + 1,
                total_profit: (poolMap.get(attack.pool_address)?.total_profit ?? 0) + (attack.profit_usd ?? 0),
            });
            validatorMap.set(attack.validator, (validatorMap.get(attack.validator) ?? 0) + 1);
        }
        return {
            entity,
            wallets: entity.sample_wallets.map((wallet) => ({
                wallet,
                role: "operator",
                tx_count: recent_attacks.filter((attack) => attack.attacker_wallet === wallet).length,
                operator_label: wallet === entity.operator_wallet ? entity.label : null,
            })),
            recent_attacks,
            targeted_pools: [...poolMap.entries()].map(([pool_address, values]) => ({
                pool_address,
                attack_count: values.attack_count,
                total_profit: values.total_profit,
            })),
            validator_correlation: [...validatorMap.entries()]
                .map(([validator, attacks]) => ({ validator, attacks }))
                .sort((a, b) => b.attacks - a.attacks),
            profit_timeline: Array.from({ length: 7 }, (_, idx) => {
                const start = new Date();
                start.setUTCHours(0, 0, 0, 0);
                start.setUTCDate(start.getUTCDate() - (6 - idx));
                const dayStart = start.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                const dayAttacks = recent_attacks.filter((attack) => {
                    const timestamp = new Date(attack.block_time).getTime();
                    return timestamp >= dayStart && timestamp < dayEnd;
                });
                return {
                    day: new Date(dayStart).toISOString(),
                    profit: dayAttacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0),
                    attacks: dayAttacks.length,
                };
            }),
        };
    }
    getPools(limit = 50) {
        const entityContext = this.buildEntityContext();
        const map = new Map();
        for (const attack of this.attacks) {
            const existing = map.get(attack.pool_address);
            if (!existing) {
                map.set(attack.pool_address, {
                    pool_address: attack.pool_address,
                    epoch: Math.floor(attack.slot / 432000),
                    protocol: parseSurface(attack.pool_address).protocol,
                    sandwich_count: attack.attack_type === "sandwich" ? 1 : 0,
                    arbitrage_count: attack.attack_type === "arbitrage" ? 1 : 0,
                    jit_count: attack.attack_type === "jit" ? 1 : 0,
                    total_attacks: 1,
                    total_extracted_usd: attack.profit_usd ?? 0,
                    unique_attackers: 1,
                    toxicity_score: 0,
                    top_entity_id: entityContext.entityByWallet.get(attack.attacker_wallet)?.id ?? attack.attacker_wallet,
                    top_entity_label: entityContext.entityByWallet.get(attack.attacker_wallet)?.label ?? attack.entity_label,
                    top_entity_risk: attack.entity_risk,
                });
                continue;
            }
            existing.total_attacks += 1;
            existing.total_extracted_usd += attack.profit_usd ?? 0;
            existing.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
            existing.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
            existing.jit_count += attack.attack_type === "jit" ? 1 : 0;
        }
        return [...map.values()]
            .map((pool) => ({
            ...pool,
            unique_attackers: new Set(this.attacks
                .filter((attack) => attack.pool_address === pool.pool_address)
                .map((attack) => attack.attacker_wallet)).size,
            toxicity_score: Math.min(100, Number((pool.sandwich_count * 14 +
                pool.arbitrage_count * 6 +
                pool.jit_count * 8 +
                pool.total_extracted_usd / 75).toFixed(1))),
        }))
            .sort((a, b) => b.toxicity_score - a.toxicity_score)
            .slice(0, limit);
    }
    getRouteRisks(limit = 25) {
        const grouped = new Map();
        for (const attack of this.attacks) {
            const surface = parseSurface(attack.pool_address);
            const existing = grouped.get(attack.pool_address);
            if (!existing) {
                grouped.set(attack.pool_address, {
                    route_key: attack.pool_address,
                    route_kind: surface.route_kind,
                    protocol: surface.protocol,
                    label: surface.label,
                    sandwich_count: attack.attack_type === "sandwich" ? 1 : 0,
                    arbitrage_count: attack.attack_type === "arbitrage" ? 1 : 0,
                    jit_count: attack.attack_type === "jit" ? 1 : 0,
                    liquidation_count: attack.attack_type === "liquidation" ? 1 : 0,
                    backrun_count: attack.attack_type === "backrun" ? 1 : 0,
                    total_attacks: 1,
                    total_extracted_usd: attack.profit_usd ?? 0,
                    confidence_sum: attack.confidence ?? 0,
                    bundle_sum: attack.bundle_likelihood ?? 0,
                    attackers: new Set([attack.attacker_wallet]),
                });
                continue;
            }
            existing.total_attacks += 1;
            existing.total_extracted_usd += attack.profit_usd ?? 0;
            existing.confidence_sum += attack.confidence ?? 0;
            existing.bundle_sum += attack.bundle_likelihood ?? 0;
            existing.attackers.add(attack.attacker_wallet);
            existing.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
            existing.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
            existing.jit_count += attack.attack_type === "jit" ? 1 : 0;
            existing.liquidation_count += attack.attack_type === "liquidation" ? 1 : 0;
            existing.backrun_count += attack.attack_type === "backrun" ? 1 : 0;
        }
        return [...grouped.values()]
            .map((item) => {
            const avgConfidence = item.total_attacks > 0 ? item.confidence_sum / item.total_attacks : 0;
            const bundleShare = item.total_attacks > 0 ? item.bundle_sum / item.total_attacks : 0;
            const riskScore = Math.min(100, Number((item.sandwich_count * 16 +
                item.backrun_count * 10 +
                item.jit_count * 8 +
                item.liquidation_count * 7 +
                item.arbitrage_count * 5 +
                item.total_extracted_usd / 90 +
                item.attackers.size * 2 +
                avgConfidence * 10 +
                bundleShare * 8).toFixed(1)));
            return {
                route_key: item.route_key,
                route_kind: item.route_kind,
                protocol: item.protocol,
                label: item.label,
                sandwich_count: item.sandwich_count,
                arbitrage_count: item.arbitrage_count,
                jit_count: item.jit_count,
                liquidation_count: item.liquidation_count,
                backrun_count: item.backrun_count,
                total_attacks: item.total_attacks,
                total_extracted_usd: item.total_extracted_usd,
                unique_attackers: item.attackers.size,
                avg_confidence: Number((avgConfidence * 100).toFixed(1)),
                bundle_share: Number((bundleShare * 100).toFixed(1)),
                risk_score: riskScore,
                recommendation: riskScore >= 80 ? "avoid" : riskScore >= 55 ? "penalize" : "monitor",
            };
        })
            .sort((a, b) => b.risk_score - a.risk_score || b.total_extracted_usd - a.total_extracted_usd)
            .slice(0, limit);
    }
    estimateBpsAtRisk(route, objective) {
        const objectiveMultiplier = objective === "protect_users" ? 1.18 : objective === "protect_lp" ? 1.1 : objective === "monitor_only" ? 0.82 : 1;
        const base = route.risk_score * 0.11 +
            route.bundle_share * 0.035 +
            Math.min(route.total_attacks, 12) * 0.35 +
            route.avg_confidence * 0.018;
        return Number(Math.max(1, Math.min(36, base * objectiveMultiplier)).toFixed(2));
    }
    classifyRouteDecision(route, objective, estimatedBpsAtRisk, saferAlternativesCount) {
        const avoidThreshold = objective === "protect_users" ? 74 : objective === "protect_lp" ? 78 : 82;
        const penalizeThreshold = objective === "monitor_only" ? 68 : 56;
        const rerouteThreshold = objective === "monitor_only" ? 88 : 72;
        if (saferAlternativesCount > 0 && (route.risk_score >= rerouteThreshold || estimatedBpsAtRisk >= 12)) {
            return "reroute";
        }
        if (route.risk_score >= avoidThreshold || estimatedBpsAtRisk >= 15 || route.bundle_share >= 72) {
            return "avoid";
        }
        if (route.risk_score >= penalizeThreshold || estimatedBpsAtRisk >= 8) {
            return "penalize";
        }
        if (route.risk_score >= 28 || estimatedBpsAtRisk >= 3.5) {
            return "monitor";
        }
        return "allow";
    }
    confidenceBand(route) {
        if (route.total_attacks >= 5 && route.avg_confidence >= 78)
            return "high";
        if (route.total_attacks >= 2 && route.avg_confidence >= 58)
            return "medium";
        return "exploratory";
    }
    matchRouteRisk(query, routeRisks) {
        if (query.route_key) {
            const exact = routeRisks.find((route) => route.route_key === query.route_key);
            if (exact)
                return { route: exact, matched_on: "route_key" };
        }
        const inputMint = query.input_mint ?? null;
        const outputMint = query.output_mint ?? null;
        if (query.protocol && inputMint && outputMint) {
            const protocolPair = routeRisks.find((route) => {
                const surface = parseSurface(route.route_key);
                return (route.protocol === query.protocol &&
                    surface.mints[0] === inputMint &&
                    surface.mints[1] === outputMint);
            });
            if (protocolPair)
                return { route: protocolPair, matched_on: "protocol_pair" };
        }
        if (inputMint && outputMint) {
            const pairMatch = routeRisks.find((route) => {
                const surface = parseSurface(route.route_key);
                return surface.mints[0] === inputMint && surface.mints[1] === outputMint;
            });
            if (pairMatch)
                return { route: pairMatch, matched_on: "pair" };
        }
        return { route: routeRisks[0] ?? null, matched_on: "fallback" };
    }
    evaluateRoute(request) {
        const objective = request.objective ?? "best_execution";
        const routeRisks = this.getRouteRisks(MAX_ATTACKS);
        const { route, matched_on } = this.matchRouteRisk(request, routeRisks);
        const fallbackRoute = routeRisks[0];
        const selected = route ?? fallbackRoute;
        if (!selected) {
            return {
                route_key: null,
                label: request.route_label ?? "Unknown route",
                protocol: request.protocol ?? null,
                matched_on,
                decision: "monitor",
                risk_score: 0,
                estimated_bps_at_risk: 0,
                estimated_loss_usd: 0,
                slippage_bps: request.slippage_bps ?? null,
                objective,
                confidence_band: "exploratory",
                safer_alternatives: [],
                rationale: ["no route history is available yet for this surface"],
                integration_actions: ["log the route for future evaluation", "fallback to monitor-only mode"],
            };
        }
        const selectedSurface = parseSurface(selected.route_key);
        const pairMatches = routeRisks
            .filter((route) => {
            const surface = parseSurface(route.route_key);
            return (surface.mints[0] === selectedSurface.mints[0] &&
                surface.mints[1] === selectedSurface.mints[1] &&
                route.route_key !== selected.route_key &&
                route.risk_score < selected.risk_score);
        })
            .sort((a, b) => a.risk_score - b.risk_score)
            .slice(0, 2);
        const estimatedBpsAtRisk = this.estimateBpsAtRisk(selected, objective);
        const notionalUsd = Math.max(0, request.notional_usd ?? 25000);
        const estimatedLossUsd = Number(((notionalUsd * estimatedBpsAtRisk) / 10000).toFixed(2));
        const saferAlternatives = pairMatches.map((route) => ({
            route_key: route.route_key,
            label: route.label,
            protocol: route.protocol,
            risk_score: route.risk_score,
            estimated_bps_saved: Number(Math.max(0, estimatedBpsAtRisk - this.estimateBpsAtRisk(route, objective)).toFixed(2)),
        }));
        const decision = this.classifyRouteDecision(selected, objective, estimatedBpsAtRisk, saferAlternatives.length);
        return {
            route_key: selected.route_key,
            label: selected.label,
            protocol: selected.protocol,
            matched_on,
            decision,
            risk_score: selected.risk_score,
            estimated_bps_at_risk: estimatedBpsAtRisk,
            estimated_loss_usd: estimatedLossUsd,
            slippage_bps: request.slippage_bps ?? null,
            objective,
            confidence_band: this.confidenceBand(selected),
            safer_alternatives: saferAlternatives,
            rationale: [
                `matched against ${matched_on.replace("_", " ")} intel for ${selected.label}`,
                `${selected.total_attacks} detections and ${selected.unique_attackers} unique operators are attached to this surface`,
                `bundle-heavy share is ${selected.bundle_share.toFixed(0)}% and average detector confidence is ${selected.avg_confidence.toFixed(0)}%`,
            ],
            integration_actions: [
                decision === "reroute" || decision === "avoid"
                    ? "prefer the safer alternative or remove this venue from the active route set"
                    : decision === "penalize"
                        ? "downrank this route in the scoring function before order submission"
                        : "attach route intel to the trade record and continue monitoring",
                "emit this decision into routing logs and user-protection analytics",
                decision === "avoid" || decision === "reroute"
                    ? "trigger a high-severity ops alert for repeated toxic execution on this pair"
                    : "keep this surface under live alert monitoring",
            ],
        };
    }
    rankRoutes(request) {
        const objective = request.objective ?? "best_execution";
        const ranked = request.candidates
            .map((candidate) => this.evaluateRoute({
            input_mint: candidate.input_mint ?? request.input_mint,
            output_mint: candidate.output_mint ?? request.output_mint,
            protocol: candidate.protocol ?? null,
            route_key: candidate.route_key ?? null,
            route_label: candidate.label ?? null,
            notional_usd: request.notional_usd,
            slippage_bps: request.slippage_bps,
            objective,
        }))
            .sort((a, b) => a.estimated_bps_at_risk - b.estimated_bps_at_risk || a.risk_score - b.risk_score)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));
        const chosen = ranked.find((entry) => entry.decision === "allow") ??
            ranked.find((entry) => entry.decision === "monitor") ??
            ranked.find((entry) => entry.decision === "penalize") ??
            ranked[0] ??
            null;
        const worstLoss = ranked.reduce((max, entry) => Math.max(max, entry.estimated_loss_usd), 0);
        const chosenLoss = chosen?.estimated_loss_usd ?? 0;
        const primary_action = !chosen || chosen.decision === "avoid"
            ? "block"
            : chosen.decision === "reroute"
                ? "reroute"
                : chosen.decision === "monitor"
                    ? "monitor"
                    : "route";
        const chosenSurface = chosen?.route_key ? parseSurface(chosen.route_key) : null;
        return {
            input_mint: request.input_mint ?? chosenSurface?.mints[0] ?? null,
            output_mint: request.output_mint ?? chosenSurface?.mints[1] ?? null,
            objective,
            selected_route_key: chosen?.route_key ?? null,
            selected_label: chosen?.label ?? null,
            primary_action,
            estimated_loss_avoided_usd: Number(Math.max(0, worstLoss - chosenLoss).toFixed(2)),
            ranked_candidates: ranked,
        };
    }
    getRouteRecommendations(limit = 12) {
        const grouped = new Map();
        for (const route of this.getRouteRisks(MAX_ATTACKS)) {
            const mints = parseSurface(route.route_key).mints;
            const inputMint = mints[0] ?? null;
            const outputMint = mints[1] ?? null;
            const pairKey = [inputMint ?? "unknown", outputMint ?? "unknown"].join("->");
            if (!grouped.has(pairKey)) {
                grouped.set(pairKey, {
                    input_mint: inputMint,
                    output_mint: outputMint,
                    routes: [],
                });
            }
            grouped.get(pairKey).routes.push(route);
        }
        return [...grouped.values()]
            .map((group) => {
            const ranked = [...group.routes].sort((a, b) => a.risk_score - b.risk_score || a.total_extracted_usd - b.total_extracted_usd);
            const recommended_routes = ranked
                .filter((route) => route.recommendation !== "avoid")
                .slice(0, 2)
                .map((route) => ({
                route_key: route.route_key,
                label: route.label,
                protocol: route.protocol,
                recommendation: route.risk_score <= 32 ? "prefer" : "monitor",
                risk_score: route.risk_score,
                rationale: [
                    route.risk_score <= 32
                        ? "lowest observed route-risk surface for this pair"
                        : "currently safer than the higher-toxicity alternatives in this pair",
                    route.bundle_share >= 45
                        ? `bundle exposure is still elevated at ${route.bundle_share.toFixed(0)}%`
                        : `bundle exposure is moderate at ${route.bundle_share.toFixed(0)}%`,
                    route.sandwich_count > 0
                        ? `${route.sandwich_count} sandwich detections observed on this surface`
                        : "no sandwich detections observed in the current sample",
                ],
            }));
            const avoid_routes = ranked
                .filter((route) => route.recommendation === "avoid")
                .slice(0, 2)
                .map((route) => ({
                route_key: route.route_key,
                label: route.label,
                protocol: route.protocol,
                risk_score: route.risk_score,
                rationale: [
                    `route risk score is elevated at ${route.risk_score.toFixed(0)}`,
                    `${route.total_attacks} detections and ${route.unique_attackers} unique operators observed`,
                    route.bundle_share >= 50
                        ? "bundle-aligned execution concentration is elevated"
                        : "repeat hostile execution pressure remains elevated",
                ],
            }));
            return {
                input_mint: group.input_mint,
                output_mint: group.output_mint,
                recommended_routes,
                avoid_routes,
            };
        })
            .filter((item) => item.recommended_routes.length > 0 || item.avoid_routes.length > 0)
            .sort((a, b) => {
            const aRisk = a.avoid_routes[0]?.risk_score ?? a.recommended_routes[0]?.risk_score ?? 0;
            const bRisk = b.avoid_routes[0]?.risk_score ?? b.recommended_routes[0]?.risk_score ?? 0;
            return bRisk - aRisk;
        })
            .slice(0, limit);
    }
    getLiveAlerts(limit = 20) {
        return this.attacks
            .slice(0, limit)
            .map((attack) => {
            const severity = attack.attack_type === "sandwich" && (attack.victim_loss_usd ?? 0) >= 100
                ? "critical"
                : attack.confidence >= 0.86 || (attack.profit_usd ?? 0) >= 400
                    ? "high"
                    : "medium";
            const action = severity === "critical"
                ? "block"
                : attack.execution_lane === "jito-aligned" || (attack.bundle_likelihood ?? 0) >= 0.55
                    ? "penalize"
                    : "monitor";
            const route = parseSurface(attack.pool_address);
            const rationale = [
                `${attack.attack_type} detector fired at ${(attack.confidence * 100).toFixed(0)}% confidence`,
                attack.bundle_likelihood && attack.bundle_likelihood >= 0.55
                    ? `bundle likelihood is elevated at ${(attack.bundle_likelihood * 100).toFixed(0)}%`
                    : `execution lane classified as ${attack.execution_lane ?? "standard"}`,
                attack.victim_loss_usd
                    ? `estimated user harm: $${attack.victim_loss_usd.toFixed(0)}`
                    : `estimated extracted value: $${(attack.profit_usd ?? 0).toFixed(0)}`,
            ];
            return {
                id: attack.id,
                attack_type: attack.attack_type,
                severity,
                summary: `${route.label} ${attack.attack_type} activity detected`,
                action,
                route_key: attack.pool_address,
                route_label: route.label,
                protocol: route.protocol,
                validator: attack.validator,
                attacker_wallet: attack.attacker_wallet,
                confidence: Number((attack.confidence * 100).toFixed(1)),
                bundle_likelihood: Number(((attack.bundle_likelihood ?? 0) * 100).toFixed(1)),
                block_time: attack.block_time,
                rationale,
            };
        });
    }
    getIntegrationFeeds(limit = 20) {
        return {
            live_alerts: this.getLiveAlerts(limit),
            route_risk: this.getRouteRisks(limit),
            pool_toxicity: this.getPools(limit),
            route_recommendations: this.getRouteRecommendations(Math.min(limit, 12)),
        };
    }
    getPoolDetails(address) {
        const toxicity = this.getPools(MAX_ATTACKS).filter((pool) => pool.pool_address === address);
        const recent_attacks = this.attacks.filter((attack) => attack.pool_address === address);
        const top_attackers = this.getEntities({ limit: String(MAX_ATTACKS) })
            .filter((entity) => recent_attacks.some((attack) => entity.sample_wallets.includes(attack.attacker_wallet)))
            .map((entity) => ({
            attacker_wallet: entity.operator_wallet ?? entity.sample_wallets[0] ?? entity.id,
            entity_id: entity.id,
            entity_label: entity.label,
            attack_count: entity.attack_count,
            profit: entity.total_profit_usd,
        }));
        return { toxicity, top_attackers, recent_attacks };
    }
    getValidators() {
        const entityContext = this.buildEntityContext();
        const map = new Map();
        for (const attack of this.attacks) {
            if (!map.has(attack.validator)) {
                map.set(attack.validator, {
                    validator: attack.validator,
                    total_mev_attacks: 0,
                    unique_entities: new Set(),
                    unique_wallets: new Set(),
                    total_extracted: 0,
                    sandwich_count: 0,
                    arbitrage_count: 0,
                    jit_count: 0,
                    liquidation_count: 0,
                    wide_sandwich_count: 0,
                    confirmed_count: 0,
                    tips: [],
                });
            }
            const item = map.get(attack.validator);
            item.total_mev_attacks += 1;
            item.unique_entities.add(entityContext.entityByWallet.get(attack.attacker_wallet)?.id ?? attack.attacker_wallet);
            item.unique_wallets.add(attack.attacker_wallet);
            item.total_extracted += attack.profit_usd ?? 0;
            item.sandwich_count += attack.attack_type === "sandwich" ? 1 : 0;
            item.arbitrage_count += attack.attack_type === "arbitrage" ? 1 : 0;
            item.jit_count += attack.attack_type === "jit" ? 1 : 0;
            item.liquidation_count += attack.attack_type === "liquidation" ? 1 : 0;
            item.wide_sandwich_count += attack.detector?.includes("wide") ? 1 : 0;
            item.confirmed_count += attack.attack_quality === "confirmed" ? 1 : 0;
            if (attack.tip_lamports)
                item.tips.push(attack.tip_lamports);
        }
        return [...map.values()]
            .map((item) => {
            const sandwichShare = item.total_mev_attacks > 0 ? item.sandwich_count / item.total_mev_attacks : 0;
            const wideShare = item.sandwich_count > 0 ? item.wide_sandwich_count / item.sandwich_count : 0;
            const confirmedShare = item.total_mev_attacks > 0 ? item.confirmed_count / item.total_mev_attacks : 0;
            const entityConcentration = item.total_mev_attacks > 0 ? item.unique_entities.size / item.total_mev_attacks : 1;
            const avgTip = item.tips.length > 0 ? item.tips.reduce((sum, value) => sum + value, 0) / item.tips.length : 0;
            const feeSignal = avgTip > 0 ? Math.min(0.12, avgTip / 250000) : 0;
            const concentrationSignal = Math.max(0, 1 - entityConcentration);
            const extractionSignal = item.total_extracted > 0 ? Math.min(0.12, Math.log10(item.total_extracted + 1) * 0.03) : 0;
            const diversityCount = [
                item.sandwich_count,
                item.arbitrage_count,
                item.jit_count,
                item.liquidation_count,
            ].filter((count) => count > 0).length;
            const diversitySignal = diversityCount > 1 ? Math.min(0.08, (diversityCount - 1) * 0.025) : 0;
            const activitySignal = item.total_mev_attacks >= 5 ? 1 : item.total_mev_attacks / 5;
            const riskScore = Math.min(0.99, Number(((0.08 +
                sandwichShare * 0.22 +
                wideShare * 0.16 +
                confirmedShare * 0.18 +
                diversitySignal +
                extractionSignal +
                feeSignal +
                concentrationSignal * 0.12) *
                activitySignal).toFixed(2)));
            return {
                validator: item.validator,
                total_mev_attacks: item.total_mev_attacks,
                unique_entities: item.unique_entities.size,
                unique_wallets: item.unique_wallets.size,
                total_extracted: item.total_extracted,
                sandwich_count: item.sandwich_count,
                arbitrage_count: item.arbitrage_count,
                jit_count: item.jit_count,
                liquidation_count: item.liquidation_count,
                wide_sandwich_count: item.wide_sandwich_count,
                wide_sandwich_share: Number((wideShare * 100).toFixed(1)),
                confirmed_share: Number((confirmedShare * 100).toFixed(1)),
                sandwich_share: Number((sandwichShare * 100).toFixed(1)),
                risk_score: riskScore,
                avg_tip_lamports: avgTip,
            };
        })
            .sort((a, b) => b.risk_score - a.risk_score || b.total_mev_attacks - a.total_mev_attacks);
    }
    getWallet(address) {
        const entity = this.getEntities({ limit: String(MAX_ATTACKS) }).find((item) => item.sample_wallets.includes(address));
        const walletAttacks = this.attacks.filter((attack) => attack.attacker_wallet === address);
        return {
            wallet: address,
            is_mev_actor: walletAttacks.length > 0,
            entity: entity ?? null,
            attacks: {
                attacks: walletAttacks.length,
                total_profit: this.sumProfit(walletAttacks),
                dominant_type: walletAttacks[0]?.attack_type ?? null,
            },
            label: entity
                ? {
                    wallet: address,
                    name: entity.label,
                    source: "chain",
                    confidence: entity.risk_score,
                }
                : null,
        };
    }
    sumProfit(attacks) {
        return attacks.reduce((sum, attack) => sum + (attack.profit_usd ?? 0), 0);
    }
}
exports.liveChainService = new LiveChainService();
//# sourceMappingURL=liveChain.js.map