interface WalletStats {
    wallet: string;
    tx_count: number;
    avg_priority_fee: number;
    median_network_fee: number;
    early_position_rate: number;
    top_pool_concentration: number;
    profit_rate: number;
    unique_pools: number;
    attack_count: number;
}
export declare function scoreWallets(): Promise<WalletStats[]>;
export declare function clusterEntities(): Promise<void>;
export declare function updatePoolToxicity(): Promise<void>;
export declare function updateStatsCache(): Promise<void>;
export {};
//# sourceMappingURL=fingerprint.d.ts.map