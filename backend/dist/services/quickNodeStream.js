"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickNodeStreamService = void 0;
const liveChain_1 = require("./liveChain");
class QuickNodeStreamService {
    constructor() {
        this.requestsReceived = 0;
        this.heartbeatCount = 0;
        this.payloadCount = 0;
        this.queuedPayloads = 0;
        this.lastRequestAt = null;
        this.lastPayloadAt = null;
        this.lastHeaders = {};
        this.lastBodyPreview = null;
        this.lastSummary = null;
        this.debugLogging = process.env.QUICKNODE_DEBUG === "true";
    }
    getRawBody(req) {
        const rawBody = req.rawBody;
        if (Buffer.isBuffer(rawBody)) {
            return rawBody.toString("utf8");
        }
        if (Buffer.isBuffer(req.body)) {
            return req.body.toString("utf8");
        }
        if (typeof req.body === "string") {
            return req.body;
        }
        return JSON.stringify(req.body ?? {});
    }
    safeJsonParse(body) {
        try {
            return JSON.parse(body);
        }
        catch {
            return null;
        }
    }
    summarizePayload(payload) {
        if (!payload || typeof payload !== "object") {
            return { blocks: 0, transactions: 0, firstBlock: null, keys: [] };
        }
        const data = payload.data;
        const keys = data && typeof data === "object" && !Array.isArray(data)
            ? Object.keys(data).slice(0, 10)
            : [];
        const blocks = [];
        if (Array.isArray(payload)) {
            blocks.push(...payload);
        }
        else if (Array.isArray(payload.data)) {
            blocks.push(...payload.data);
        }
        else if (Array.isArray(payload.blocks)) {
            blocks.push(...payload.blocks);
        }
        else if (data && typeof data === "object") {
            for (const value of Object.values(data)) {
                if (value && typeof value === "object") {
                    blocks.push(value);
                }
            }
        }
        else if (payload.blockhash || payload.transactions || payload.blockHeight || payload.slot) {
            blocks.push(payload);
        }
        const transactions = blocks.reduce((sum, block) => {
            return sum + (Array.isArray(block?.transactions) ? block.transactions.length : 0);
        }, 0);
        const firstBlock = blocks[0]?.slot ??
            blocks[0]?.blockHeight ??
            blocks[0]?.blockNumber ??
            null;
        return {
            blocks: blocks.length,
            transactions,
            firstBlock,
            keys,
        };
    }
    extractBlocks(payload) {
        if (!payload || typeof payload !== "object")
            return [];
        if (Array.isArray(payload))
            return payload;
        if (Array.isArray(payload.data))
            return payload.data;
        if (Array.isArray(payload.blocks))
            return payload.blocks;
        if (payload.data && typeof payload.data === "object") {
            return Object.values(payload.data).filter((value) => value && typeof value === "object");
        }
        if (payload.blockhash || payload.transactions || payload.blockHeight || payload.slot) {
            return [payload];
        }
        return [];
    }
    extractHeaders(req) {
        return {
            "content-type": req.headers["content-type"] ?? null,
            "content-length": req.headers["content-length"] ?? null,
            "content-encoding": req.headers["content-encoding"] ?? null,
            "user-agent": req.headers["user-agent"] ?? null,
            "x-qn-nonce": req.headers["x-qn-nonce"] ?? null,
            "x-qn-signature": req.headers["x-qn-signature"] ?? null,
            "x-qn-timestamp": req.headers["x-qn-timestamp"] ?? null,
            authorization: req.headers.authorization ?? null,
        };
    }
    async receive(req) {
        const rawBody = this.getRawBody(req);
        const parsedBody = this.safeJsonParse(rawBody);
        const summary = this.summarizePayload(parsedBody);
        const blocks = this.extractBlocks(parsedBody);
        const headers = this.extractHeaders(req);
        const isHeartbeat = rawBody.trim() === "" ||
            rawBody.trim() === "{}" ||
            rawBody.includes('"message": "PING"') ||
            rawBody.includes('"message":"PING"');
        this.requestsReceived += 1;
        this.lastRequestAt = new Date().toISOString();
        this.lastHeaders = headers;
        this.lastBodyPreview = rawBody.slice(0, 300) || "<empty>";
        this.lastSummary = summary;
        if (isHeartbeat) {
            this.heartbeatCount += 1;
            if (this.debugLogging) {
                console.log("[streams] quicknode heartbeat/test received", {
                    bodyLength: rawBody.length,
                    bodyPreview: rawBody.slice(0, 120) || "<empty>",
                    headers,
                });
            }
            return {
                ok: true,
                heartbeat: true,
                summary,
            };
        }
        this.payloadCount += 1;
        this.lastPayloadAt = new Date().toISOString();
        this.queuedPayloads += 1;
        if (this.debugLogging) {
            console.log("[streams] quicknode headers", headers);
            console.log("[streams] quicknode body preview", this.lastBodyPreview);
        }
        console.log("[streams] quicknode summary", summary);
        void liveChain_1.liveChainService
            .ingestExternalBlocks(blocks)
            .catch((error) => {
            console.error("[streams] quicknode async ingestion failed", error);
        })
            .finally(() => {
            this.queuedPayloads = Math.max(0, this.queuedPayloads - 1);
        });
        return {
            ok: true,
            received: true,
            heartbeat: false,
            summary,
        };
    }
    getStatus() {
        return {
            enabled: true,
            requestsReceived: this.requestsReceived,
            heartbeatCount: this.heartbeatCount,
            payloadCount: this.payloadCount,
            queuedPayloads: this.queuedPayloads,
            lastRequestAt: this.lastRequestAt,
            lastPayloadAt: this.lastPayloadAt,
            lastHeaders: this.lastHeaders,
            lastBodyPreview: this.lastBodyPreview,
            lastSummary: this.lastSummary,
        };
    }
}
exports.quickNodeStreamService = new QuickNodeStreamService();
//# sourceMappingURL=quickNodeStream.js.map