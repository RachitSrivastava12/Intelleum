import { Connection } from "@solana/web3.js";

export const connection = new Connection(
  "https://blissful-dry-dust.solana-mainnet.quiknode.pro/6500bbec28756372448da40af47a0b3e7d0ecc8e/",
  {
    commitment: "finalized",
    confirmTransactionInitialTimeout: 60_000,
  }
);
