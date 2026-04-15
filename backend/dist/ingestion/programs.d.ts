export declare const DEX_PROGRAMS: Record<string, string>;
export declare const LENDING_PROGRAMS: Record<string, string>;
export declare const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
export declare const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export declare const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export declare function getDexName(programId: string): string | null;
export declare function getLendingName(programId: string): string | null;
export declare function getProgramLabel(programId: string | null | undefined): string | null;
export declare function isDex(programId: string): boolean;
export declare function isLending(programId: string): boolean;
export declare const KNOWN_TOKENS: Record<string, {
    symbol: string;
    decimals: number;
}>;
//# sourceMappingURL=programs.d.ts.map