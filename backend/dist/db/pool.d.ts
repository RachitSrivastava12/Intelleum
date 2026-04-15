import "dotenv/config";
import { Pool } from "pg";
export declare const pool: Pool;
export declare function ensureAccessSchema(): Promise<void>;
export declare function initDb(): Promise<void>;
export declare function ensureIntelligenceSchema(): Promise<void>;
//# sourceMappingURL=pool.d.ts.map