import fetch from "node-fetch";
import { logger } from "../logger/logger.js";
const solPriceInUSD = await getSolPriceInUSD();


interface CoinGeckoResponse {
  solana: {
    usd: number,
  };
}

interface DexScreenerPair {
  pairCreatedAt: EpochTimeStamp;
  priceNative: string;
  // Add other properties as needed
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[];
}

export async function getSolPriceInUSD(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const priceData: CoinGeckoResponse = await response.json() as CoinGeckoResponse;

    if (priceData && priceData.solana && priceData.solana.usd) {
      return priceData.solana.usd;
    } else {
      console.error("Error: Failed to retrieve SOL price from CoinGecko.");
      return 0;
    }
  } catch (error) {
    console.error("Error fetching SOL price from CoinGecko:", error);
    return 0;
  }
}

export async function getTokenInfo(tokenAddress: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const priceData: DexScreenerResponse = await response.json() as DexScreenerResponse;

    if (priceData && priceData.pairs && priceData.pairs.length > 0) {
      const pair = priceData.pairs[0];
      // console.log("Pair Created At:", creationDate.toUTCString());

      const priceInSOL = parseFloat(pair.priceNative);
      return priceInSOL;
    } else {
      logger.error(`Error: No price data found for token ${tokenAddress}.`);
      return 0;
    }
  } catch (error) {
    logger.error(
      `Error fetching price for token ${tokenAddress} from Dexscreener:`,
      error
    );
    return 0;
  }
}

export async function convertWSolToUSD(priceInSOL: number): Promise<number> {
  return priceInSOL * solPriceInUSD;
}
