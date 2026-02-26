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
  const apiKey = process.env.SOLANA_TRACKER_API_KEY || "";
  const response: Response = await fetch(
    "https://data.solanatracker.io/search?page=1&limit=100&sortBy=createdAt&sortOrder=desc",
    {
      headers: {
        "x-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse response: ${text}`);
  }

  // The endpoint returns { status: "success", data: [...] }
  if (json.status !== "success" || !Array.isArray(json.data)) {
    throw new Error(`Unexpected API response structure`);
  }

  const tokens: Token[] = json.data.map((item: any) => ({
    address: item.mint,
    name: item.name,
  }));
  return tokens;
}
