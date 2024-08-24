import fetch from "node-fetch";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";

const DEX_SCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens/";
const MAX_RISK_SCORE = CONFIG.riskScore; // Define your threshold for risk score
const MIN_LIQUIDITY = CONFIG.minLiquidity || 10000; // Set the minimum liquidity threshold

// Function to fetch the risk score for a token using RugChecker
async function getRiskScore(tokenAddress) {
  try {
    const response = await fetch(
      `${RUGCHECK_URL}${tokenAddress}/report/summary`
    );
    const data = await response.json();
    const riskScore = data.score || 0; // Default to 0 if no score is available
    return riskScore;
  } catch (error) {
    logger.error(`Error fetching risk score for token ${tokenAddress}:`, error);
    return 0;
  }
}

// Function to get liquidity, price data, and locked liquidity status using DEX Screener
async function getDexScreenerData(tokenAddress) {
  try {
    const response = await fetch(`${DEX_SCREENER_API_URL}${tokenAddress}`);
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      const { liquidity, priceUsd, priceNative, pairAddress } = data.pairs[0]; // Assuming we're interested in the first pair
      return {
        liquidity: liquidity?.usd || 0,
        priceUsd: priceUsd || 0,
        priceNative: priceNative || 0,
        lockedLiquidity: liquidity && liquidity.usd > 0, // Assuming locked liquidity is reflected by positive liquidity
        pairAddress,
      };
    } else {
      logger.warn(
        `No pair data found for token ${tokenAddress} on DEX Screener.`
      );
      return null;
    }
  } catch (error) {
    logger.error(
      `Error fetching data from DEX Screener for token ${tokenAddress}:`,
      error
    );
    return null;
  }
}

// Function to get liquidity, price, and risk assessment for a token
export async function getLiquidityAndRisk(tokenAddress) {
  try {
    console.log("Getting liquidity, price, and risk for token:", tokenAddress);

    // Fetch DEX Screener data
    const dexData = await getDexScreenerData(tokenAddress);

    if (!dexData) {
      return { liquidity: 0, highRisk: true };
    }

    // Fetch risk score from RugChecker
    const riskScore = await getRiskScore(tokenAddress);

    // Check if the risk score is too high
    if (riskScore > MAX_RISK_SCORE) {
      logger.warn(
        `Token ${tokenAddress} is considered high risk with a score of ${riskScore}.`
      );
      return { liquidity: 0, highRisk: true };
    }

    // Check if the liquidity is below the minimum threshold
    if (dexData.liquidity < MIN_LIQUIDITY) {
      logger.warn(
        `Token ${tokenAddress} has insufficient liquidity: $${dexData.liquidity.toFixed(
          2
        )} (Minimum required: $${MIN_LIQUIDITY}).`
      );
      return { liquidity: dexData.liquidity, highRisk: true };
    }

    // Return liquidity and risk assessment
    return {
      liquidity: dexData.liquidity,
      priceUsd: dexData.priceUsd,
      priceNative: dexData.priceNative,
      lockedLiquidity: dexData.lockedLiquidity,
      pairAddress: dexData.pairAddress,
      highRisk: false,
    };
  } catch (error) {
    logger.error(
      `Error getting liquidity, price, or risk for token ${tokenAddress}:`,
      error
    );
    return { liquidity: 0, highRisk: true };
  }
}
