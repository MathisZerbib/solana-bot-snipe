import { Connection, Keypair } from "@solana/web3.js";
import { SolanaTracker } from "solana-swap";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";
import { Token } from "types/token.js";
import bs58 from "bs58";

export const connection: Connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const solanaTracker: SolanaTracker = new SolanaTracker(
  CONFIG.keypair,
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
);

export async function getLatestTokens(): Promise<Token[]> {
  const response: Response = await fetch(
    "https://api.solanatracker.io/tokens/latest"
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const tokens: Token[] = await response.json();
  //   console.log("Tokens:", tokens);
  return tokens;
}
