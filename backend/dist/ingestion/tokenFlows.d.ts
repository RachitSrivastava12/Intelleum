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
export declare function extractTokenFlows(block: any, slot: number, priceMap: Map<string, number>): Promise<TokenFlow[]>;
//# sourceMappingURL=tokenFlows.d.ts.map