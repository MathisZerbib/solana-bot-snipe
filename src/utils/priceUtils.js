import fetch from "node-fetch";
import { logger } from "../logger/logger.js";

export async function getSolPriceInUSD() {
  try {
    const response = await fetch("https://public-api.solscan.io/market");
    const marketData = await response.json();
    if (marketData && marketData.data && marketData.data.priceUsdt) {
      return marketData.data.priceUsdt;
    } else {
      logger.error("Error: Failed to retrieve SOL price from Solscan.");
      return 0;
    }
  } catch (error) {
    logger.error("Error fetching SOL price from Solscan:", error);
    return 0;
  }
}

export async function convertWSolToUSD(wSolAmount) {
  const solPriceInUSD = await getSolPriceInUSD();
  return wSolAmount * solPriceInUSD;
}
