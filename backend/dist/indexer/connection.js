"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = void 0;
const web3_js_1 = require("@solana/web3.js");
exports.connection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=866ca2a0-db6a-4527-adfe-3a1aa6682c65", "confirmed");
