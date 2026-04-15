type AttackType = "sandwich" | "arbitrage" | "jit" | "liquidation" | "backrun";
interface AttackRecord {
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
    frontrun_tx: string | null;
    victim_tx: string | null;
    backrun_tx: string | null;
}
interface EntityRecord {
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
interface PoolRecord {
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
interface RouteRiskRecord {
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
interface RouteRecommendationRecord {
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
interface LiveAlertRecord {
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
interface RouteEvaluationRequest {
    input_mint?: string | null;
    output_mint?: string | null;
    protocol?: string | null;
    route_key?: string | null;
    route_label?: string | null;
    notional_usd?: number | null;
    slippage_bps?: number | null;
    objective?: "best_execution" | "protect_users" | "protect_lp" | "monitor_only";
}
interface RouteEvaluationRecord {
    route_key: string | null;
    label: string;
    protocol: string | null;
    matched_on: "route_key" | "protocol_pair" | "pair" | "fallback";
    decision: "allow" | "monitor" | "penalize" | "avoid" | "reroute";
    risk_score: number;
    estimated_bps_at_risk: number;
    estimated_loss_usd: number;
    slippage_bps: number | null;
    objective: NonNullable<RouteEvaluationRequest["objective"]>;
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
interface RouteRankingRequest {
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
interface RouteRankingRecord {
    input_mint: string | null;
    output_mint: string | null;
    objective: NonNullable<RouteRankingRequest["objective"]>;
    selected_route_key: string | null;
    selected_label: string | null;
    primary_action: "route" | "monitor" | "reroute" | "block";
    estimated_loss_avoided_usd: number;
    ranked_candidates: Array<RouteEvaluationRecord & {
        rank: number;
    }>;
}
interface ValidatorRecord {
    validator: string;
    total_mev_attacks: number;
    unique_entities: number;
    unique_wallets: number;
    total_extracted: number;
    sandwich_count: number;
    jit_count: number;
    avg_tip_lamports: number;
}
export declare function getStats(): {
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
export declare function getAttacks(params: {
    type?: string;
    pool?: string;
    limit?: string;
    offset?: string;
    since?: string;
}): AttackRecord[];
export declare function getEntities(params: {
    strategy?: string;
    min_risk?: string;
    sort?: string;
    limit?: string;
    offset?: string;
}): EntityRecord[];
export declare function getEntity(id: string): {
    entity: EntityRecord;
    wallets: {
        wallet: string;
        role: string;
        tx_count: number;
        operator_label: string | null;
    }[];
    recent_attacks: AttackRecord[];
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
export declare function getPools(limit?: number): {
    protocol: string | null;
    pool_address: string;
    epoch: number;
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
}[];
export declare function getPoolDetails(address: string): {
    toxicity: PoolRecord[];
    top_attackers: {
        attacker_wallet: string;
        entity_id: string | null;
        entity_label: string | null;
        attack_count: number;
        profit: number;
    }[];
    recent_attacks: AttackRecord[];
};
export declare function getValidators(): ValidatorRecord[];
export declare function getRouteRisks(limit?: number): RouteRiskRecord[];
export declare function evaluateRoute(request: RouteEvaluationRequest): RouteEvaluationRecord;
export declare function rankRoutes(request: RouteRankingRequest): RouteRankingRecord;
export declare function getRouteRecommendations(limit?: number): RouteRecommendationRecord[];
export declare function getLiveAlerts(limit?: number): LiveAlertRecord[];
export declare function getIntegrationFeeds(limit?: number): {
    live_alerts: LiveAlertRecord[];
    route_risk: RouteRiskRecord[];
    pool_toxicity: {
        protocol: string | null;
        pool_address: string;
        epoch: number;
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
    }[];
    route_recommendations: RouteRecommendationRecord[];
};
export declare function getWallet(address: string): {
    wallet: string;
    is_mev_actor: boolean;
    entity: EntityRecord | null;
    attacks: {
        attacks: number;
        total_profit: number;
        dominant_type: AttackType;
    };
    label: {
        wallet: string;
        name: string | null;
        source: string;
        confidence: number;
    } | null;
};
export {};
//# sourceMappingURL=liveData.d.ts.map