import { Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { SolanaTracker } from "solana-swap";
import { logger } from "../logger/logger.js";
import dotenv from "dotenv";

dotenv.config();

export const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const solanaTracker = new SolanaTracker(
  keypair,
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export async function getLatestTokens() {
  const response = await fetch("https://api.solanatracker.io/tokens/latest");
  const tokens = await response.json();
  //   console.log("Tokens:", tokens);
  return tokens;
}

export async function getTokenPriceInSOL(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solanatracker.io/price/${tokenAddress}`
    );
    const priceData = await response.json();
    return priceData.priceInSOL;
  } catch (error) {
    logger.error(`Error fetching price for token ${tokenAddress}:`, error);
    return 0;
  }
}
