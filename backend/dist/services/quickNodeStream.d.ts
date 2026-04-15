import { Request } from "express";
export interface QuickNodeStreamStatus {
    enabled: boolean;
    requestsReceived: number;
    heartbeatCount: number;
    payloadCount: number;
    queuedPayloads: number;
    lastRequestAt: string | null;
    lastPayloadAt: string | null;
    lastHeaders: Record<string, string | null>;
    lastBodyPreview: string | null;
    lastSummary: {
        blocks: number;
        transactions: number;
        firstBlock: number | null;
        keys: string[];
    } | null;
}
declare class QuickNodeStreamService {
    private requestsReceived;
    private heartbeatCount;
    private payloadCount;
    private queuedPayloads;
    private lastRequestAt;
    private lastPayloadAt;
    private lastHeaders;
    private lastBodyPreview;
    private lastSummary;
    private debugLogging;
    private getRawBody;
    private safeJsonParse;
    private summarizePayload;
    private extractBlocks;
    private extractHeaders;
    receive(req: Request): Promise<{
        ok: boolean;
        heartbeat: boolean;
        summary: {
            blocks: number;
            transactions: any;
            firstBlock: any;
            keys: string[];
        };
        received?: undefined;
    } | {
        ok: boolean;
        received: boolean;
        heartbeat: boolean;
        summary: {
            blocks: number;
            transactions: any;
            firstBlock: any;
            keys: string[];
        };
    }>;
    getStatus(): QuickNodeStreamStatus;
}
export declare const quickNodeStreamService: QuickNodeStreamService;
export {};
//# sourceMappingURL=quickNodeStream.d.ts.map