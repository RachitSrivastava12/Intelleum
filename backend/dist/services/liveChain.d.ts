import { DetectedAttack } from "../detection/mevDetector";
type AttackType = DetectedAttack["attack_type"];
interface ApiAttack {
    id: number;
    attack_type: AttackType;
    slot: number;
    block_time: string;
    validator: string;
    attacker_wallet: string;
    entity_id: string | null;
    entity_label: string | null;
    entity_risk: number | null;
    victim_wallet: string | null;
    victim_loss_usd: number | null;
    pool_address: string;
    token_mint: string | null;
    profit_usd: number | null;
    tip_lamports: number | null;
    confidence: number;
    detector: string;
    attack_quality?: "confirmed" | "likely";
    campaign_id?: string;
    protocol?: string | null;
    surface_kind?: "route" | "venue" | "pair" | "pool";
    surface_precision?: "exact-pool" | "venue-inferred" | "route-inferred" | "pair-inferred";
    surface_label?: string;
    surface_mints?: string[];
    detection_basis?: "parsed" | "flow" | "heuristic";
    bundle_likelihood?: number;
    execution_lane?: "jito-aligned" | "priority-fee" | "standard";
    evidence: string[];
    frontrun_tx: string | null;
    victim_tx: string | null;
    backrun_tx: string | null;
}
interface ApiEntity {
    id: string;
    label: string | null;
    operator_wallet: string | null;
    first_seen: string;
    last_seen: string;
    total_profit_usd: number;
    profit_24h_usd: number;
    profit_7d_usd: number;
    attack_count: number;
    victim_count: number;
    dominant_strategy: string | null;
    strategies_used: string[];
    risk_score: number;
    fee_aggression: number;
    position_dominance: number;
    pool_concentration: number;
    profit_consistency: number;
    wallet_count: number;
    sample_wallets: string[];
}
interface ApiPool {
    pool_address: string;
    epoch: number;
    protocol: string | null;
    sandwich_count: number;
    arbitrage_count: number;
    jit_count: number;
    total_attacks: number;
    total_extracted_usd: number;
    unique_attackers: number;
    toxicity_score: number;
    top_entity_id: string | null;
    top_entity_label: string | null;
    top_entity_risk: number | null;
}
interface ApiRouteRisk {
    route_key: string;
    route_kind: "route" | "venue" | "pair" | "pool";
    protocol: string | null;
    label: string;
    sandwich_count: number;
    arbitrage_count: number;
    jit_count: number;
    liquidation_count: number;
    backrun_count: number;
    total_attacks: number;
    total_extracted_usd: number;
    unique_attackers: number;
    avg_confidence: number;
    bundle_share: number;
    risk_score: number;
    recommendation: "avoid" | "penalize" | "monitor";
}
interface ApiRouteRecommendation {
    input_mint: string | null;
    output_mint: string | null;
    recommended_routes: Array<{
        route_key: string;
        label: string;
        protocol: string | null;
        recommendation: "prefer" | "monitor";
        risk_score: number;
        rationale: string[];
    }>;
    avoid_routes: Array<{
        route_key: string;
        label: string;
        protocol: string | null;
        risk_score: number;
        rationale: string[];
    }>;
}
interface ApiLiveAlert {
    id: number;
    attack_type: AttackType;
    severity: "critical" | "high" | "medium";
    summary: string;
    action: "block" | "penalize" | "monitor";
    route_key: string;
    route_label: string;
    protocol: string | null;
    validator: string;
    attacker_wallet: string;
    confidence: number;
    bundle_likelihood: number;
    block_time: string;
    rationale: string[];
}
interface ApiRouteEvaluationRequest {
    input_mint?: string | null;
    output_mint?: string | null;
    protocol?: string | null;
    route_key?: string | null;
    route_label?: string | null;
    notional_usd?: number | null;
    slippage_bps?: number | null;
    objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
}
interface ApiRouteEvaluation {
    route_key: string | null;
    label: string;
    protocol: string | null;
    matched_on: "route_key" | "protocol_pair" | "pair" | "fallback";
    decision: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
    risk_score: number;
    estimated_bps_at_risk: number;
    estimated_loss_usd: number;
    slippage_bps: number | null;
    objective: NonNullable<ApiRouteEvaluationRequest["objective"]>;
    confidence_band: "high" | "medium" | "exploratory";
    safer_alternatives: Array<{
        route_key: string;
        label: string;
        protocol: string | null;
        risk_score: number;
        estimated_bps_saved: number;
    }>;
    rationale: string[];
    integration_actions: string[];
}
interface ApiRouteRankingRequest {
    input_mint?: string | null;
    output_mint?: string | null;
    notional_usd?: number | null;
    slippage_bps?: number | null;
    objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
    candidates: Array<{
        route_key?: string | null;
        protocol?: string | null;
        label?: string | null;
        input_mint?: string | null;
        output_mint?: string | null;
    }>;
}
interface ApiRouteRanking {
    input_mint: string | null;
    output_mint: string | null;
    objective: NonNullable<ApiRouteRankingRequest["objective"]>;
    selected_route_key: string | null;
    selected_label: string | null;
    primary_action: "route" | "monitor" | "reroute" | "block";
    estimated_loss_avoided_usd: number;
    ranked_candidates: Array<ApiRouteEvaluation & {
        rank: number;
    }>;
}
interface DetectionMetrics {
    candidateRows: number;
    parsedTransactions: number;
    parsedSwaps: number;
    rawSlotTxs: number;
    detectedAttacks: number;
    sandwichCandidates: number;
    arbitrageCandidates: number;
    jitCandidates: number;
    liquidationCandidates: number;
    suspiciousCandidates: number;
    backrunCandidates: number;
}
interface LiveStatus {
    mode: "chain" | "fallback";
    heliusConfigured: boolean;
    started: boolean;
    syncing: boolean;
    lastProcessedSlot: number | null;
    latestChainSlot: number | null;
    blocksProcessed: number;
    attacksDetected: number;
    lastSyncAt: string | null;
    lastError: string | null;
    recentMetrics: DetectionMetrics;
    recentAttackPreview: Array<{
        attack_type: AttackType;
        detector: string;
        confidence: number;
        slot: number;
    }>;
    recentValidatorPreview?: Array<{
        validator: string;
        risk_score: number;
        sandwich_share: number;
        wide_sandwich_count: number;
        total_mev_attacks: number;
        unique_entities: number;
    }>;
}
declare class LiveChainService {
    private connection;
    private heliusKey;
    private heliusRpcUrl;
    private started;
    private syncing;
    private latestChainSlot;
    private lastProcessedSlot;
    private lastSyncAt;
    private lastError;
    private attacksDetected;
    private blocksProcessed;
    private nextId;
    private attacks;
    private attackKeys;
    private attackIndexByKey;
    private pollTimer;
    private externalStreamActive;
    private recentSwaps;
    private recentLiquidityLegs;
    private recentSlotTxs;
    private lastSnapshotPersistAt;
    private recentMetrics;
    private ensureHeliusConfig;
    start(): void;
    private extractApiKey;
    private scheduleNextSync;
    private sync;
    private processSlot;
    ingestExternalBlocks(blocks: any[]): Promise<void>;
    private keyToAddress;
    private instructionProgramId;
    private processBlock;
    private extractPriorityFee;
    private fetchParsedTransactions;
    private extractParsedSwaps;
    private inferSwapFromFlows;
    private inferSourceFromFlows;
    private extractLiquidityLegs;
    private readTokenAmount;
    private computePriceImpactHint;
    private normalizePoolAddress;
    private computeSignerStableDelta;
    private passesMaterialThreshold;
    private filterDetectedAttacks;
    private attackFamilyKey;
    private entityIdFromWallets;
    private sanitizeMoney;
    private inferAttackQuality;
    private buildEntityContext;
    private detectParsedSandwiches;
    private estimateParsedProfit;
    private detectParsedArbitrage;
    private detectParsedLiquidations;
    private detectParsedBackruns;
    private detectLiquidityJIT;
    private detectSuspiciousOrderflow;
    private fetchPrices;
    private insertAttack;
    private persistAttack;
    private persistSnapshot;
    private estimateRisk;
    private inferExecutionLane;
    private inferDetectionBasis;
    private estimateBundleLikelihood;
    hasLiveData(): boolean;
    getStatus(): LiveStatus;
    getStats(): {
        total_attacks: number;
        attacks_24h: number;
        attacks_1h: number;
        total_extracted_usd: number;
        extracted_24h: number;
        total_entities: number;
        total_wallets: number;
        total_victims: number;
        sandwich_count: number;
        arb_count: number;
        jit_count: number;
    };
    getAttacks(params: {
        type?: string;
        pool?: string;
        limit?: string;
        offset?: string;
        since?: string;
    }): {
        entity_id: string | null;
        entity_label: string | null;
        id: number;
        attack_type: AttackType;
        slot: number;
        block_time: string;
        validator: string;
        attacker_wallet: string;
        entity_risk: number | null;
        victim_wallet: string | null;
        victim_loss_usd: number | null;
        pool_address: string;
        token_mint: string | null;
        profit_usd: number | null;
        tip_lamports: number | null;
        confidence: number;
        detector: string;
        attack_quality?: "confirmed" | "likely";
        campaign_id?: string;
        protocol?: string | null;
        surface_kind?: "route" | "venue" | "pair" | "pool";
        surface_precision?: "exact-pool" | "venue-inferred" | "route-inferred" | "pair-inferred";
        surface_label?: string;
        surface_mints?: string[];
        detection_basis?: "parsed" | "flow" | "heuristic";
        bundle_likelihood?: number;
        execution_lane?: "jito-aligned" | "priority-fee" | "standard";
        evidence: string[];
        frontrun_tx: string | null;
        victim_tx: string | null;
        backrun_tx: string | null;
    }[];
    getEntities(params: {
        strategy?: string;
        min_risk?: string;
        sort?: string;
        limit?: string;
        offset?: string;
    }): ApiEntity[];
    getEntity(id: string): {
        entity: ApiEntity;
        wallets: {
            wallet: string;
            role: string;
            tx_count: number;
            operator_label: string | null;
        }[];
        recent_attacks: ApiAttack[];
        targeted_pools: {
            pool_address: string;
            attack_count: number;
            total_profit: number;
        }[];
        validator_correlation: {
            validator: string;
            attacks: number;
        }[];
        profit_timeline: {
            day: string;
            profit: number;
            attacks: number;
        }[];
    } | null;
    getPools(limit?: number): ApiPool[];
    getRouteRisks(limit?: number): ApiRouteRisk[];
    private estimateBpsAtRisk;
    private classifyRouteDecision;
    private confidenceBand;
    private matchRouteRisk;
    evaluateRoute(request: ApiRouteEvaluationRequest): ApiRouteEvaluation;
    rankRoutes(request: ApiRouteRankingRequest): ApiRouteRanking;
    getRouteRecommendations(limit?: number): ApiRouteRecommendation[];
    getLiveAlerts(limit?: number): ApiLiveAlert[];
    getIntegrationFeeds(limit?: number): {
        live_alerts: ApiLiveAlert[];
        route_risk: ApiRouteRisk[];
        pool_toxicity: ApiPool[];
        route_recommendations: ApiRouteRecommendation[];
    };
    getPoolDetails(address: string): {
        toxicity: ApiPool[];
        top_attackers: {
            attacker_wallet: string;
            entity_id: string;
            entity_label: string | null;
            attack_count: number;
            profit: number;
        }[];
        recent_attacks: ApiAttack[];
    };
    getValidators(): {
        validator: string;
        total_mev_attacks: number;
        unique_entities: number;
        unique_wallets: number;
        total_extracted: number;
        sandwich_count: number;
        arbitrage_count: number;
        jit_count: number;
        liquidation_count: number;
        wide_sandwich_count: number;
        wide_sandwich_share: number;
        confirmed_share: number;
        sandwich_share: number;
        risk_score: number;
        avg_tip_lamports: number;
    }[];
    getWallet(address: string): {
        wallet: string;
        is_mev_actor: boolean;
        entity: ApiEntity | null;
        attacks: {
            attacks: number;
            total_profit: number;
            dominant_type: "sandwich" | "arbitrage" | "jit" | "liquidation" | "backrun";
        };
        label: {
            wallet: string;
            name: string | null;
            source: string;
            confidence: number;
        } | null;
    };
    private sumProfit;
}
export declare const liveChainService: LiveChainService;
export {};
//# sourceMappingURL=liveChain.d.ts.map