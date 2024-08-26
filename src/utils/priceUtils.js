import fetch from "node-fetch";
import { logger } from "../logger/logger.js";
// Function to fetch SOL price in USD from Dexscreener
export async function getSolPriceInUSD() {
  try {
    const response = await fetch(
      "https://api.dexscreener.com/latest/dex/search?q=SOL%20USDC"
    );
    const data = await response.json();

    // Find the pair where SOL is the base token and USDC is the quote token
    const pairData = data.pairs.find(
      (pair) =>
        pair.baseToken.symbol === "SOL" && pair.quoteToken.symbol === "USDC"
    );

    if (pairData) {
      const solPriceInUSD = parseFloat(pairData.priceUsd);
      logger.info(`SOL price in USD: $${solPriceInUSD}`);
      return solPriceInUSD;
    } else {
      throw new Error("Unable to retrieve SOL price from Dexscreener API");
    }
  } catch (error) {
    logger.error("Error fetching SOL price:", error);
    return null;
  }
}

// Function to convert wSOL amount to USD
export async function convertWSolToUSD(wSolAmount) {
  const solPriceInUSD = await getSolPriceInUSD();
  if (!solPriceInUSD) {
    return 0;
  }
  return wSolAmount * solPriceInUSD;
}

