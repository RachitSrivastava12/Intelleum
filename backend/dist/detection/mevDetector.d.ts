export interface TxFlow {
    tx_sig: string;
    tx_index: number;
    signer: string;
    slot: number;
    block_time: Date;
    validator: string;
    priority_fee: number | null;
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
    attack_type: "sandwich" | "arbitrage" | "jit" | "liquidation" | "backrun";
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
export declare function detectSandwiches(slotTxs: TxFlow[], slot: number): Promise<DetectedAttack[]>;
export declare function detectArbitrage(slotTxs: TxFlow[], slot: number): Promise<DetectedAttack[]>;
export declare function detectJIT(slotTxs: TxFlow[], slot: number): Promise<DetectedAttack[]>;
export declare function detectWideSandwiches(recentTxs: TxFlow[], currentSlot: number): Promise<DetectedAttack[]>;
//# sourceMappingURL=mevDetector.d.ts.map