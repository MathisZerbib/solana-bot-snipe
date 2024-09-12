import { Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { SolanaTracker } from "solana-swap";
import { logger } from "../logger/logger.js";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SOLANA_PRIVATE_KEY) {
  throw new Error("SOLANA_PRIVATE_KEY is not set in the environment variables");
}

export const keypair: Keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);

export const connection: Connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const solanaTracker: SolanaTracker = new SolanaTracker(
  keypair,
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

interface Token {
  // Define the structure of your token object here
  // For example:
  address: string;
  name: string;
  // Add other properties as needed
}

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
