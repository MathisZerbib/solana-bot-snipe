import fetch from "node-fetch";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";

const DEX_SCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens/";
const MAX_RISK_SCORE = CONFIG.riskScore; // Define your threshold for risk score
const MIN_LIQUIDITY = CONFIG.minLiquidity || 10000; // Set the minimum liquidity threshold

interface RiskScoreResponse {
  score?: number;
}

interface DexScreenerPair {
  liquidity?: {
    usd: number,
  };
  priceUsd?: string;
  priceNative?: string;
  pairAddress: string;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

interface DexScreenerData {
  liquidity: number;
  priceUsd: number;
  priceNative: number;
  lockedLiquidity: boolean;
  pairAddress: string;
}

interface LiquidityAndRiskResult {
  liquidity: number;
  priceUsd?: number;
  priceNative?: number;
  lockedLiquidity?: boolean;
  pairAddress?: string;
  highRisk: boolean;
}

async function getRiskScore(tokenAddress: string): Promise<number> {
  try {
    const response = await fetch(
      `${RUGCHECK_URL}${tokenAddress}/report/summary`
    );
    const data: RiskScoreResponse = await response.json() as RiskScoreResponse;
    return data.score || 0; // Default to 0 if no score is available
  } catch (error) {
    logger.error(`Error fetching risk score for token ${tokenAddress}:`, error);
    return 0;
  }
}

async function getDexScreenerData(
  tokenAddress: string
): Promise<DexScreenerData | null> {
  try {
    const response = await fetch(`${DEX_SCREENER_API_URL}${tokenAddress}`);
    const data: DexScreenerResponse = await response.json() as DexScreenerResponse;

    if (data.pairs && data.pairs.length > 0) {
      const { liquidity, priceUsd, priceNative, pairAddress } = data.pairs[0];
      return {
        liquidity: liquidity?.usd || 0,
        priceUsd: parseFloat(priceUsd || "0"),
        priceNative: parseFloat(priceNative || "0"),
        lockedLiquidity: !!(liquidity && liquidity.usd > 0),
        pairAddress: pairAddress,
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

export async function getLiquidityAndRisk(
  tokenAddress: string
): Promise<LiquidityAndRiskResult> {
  try {
    console.log("Getting liquidity, price, and risk for token:", tokenAddress);

    const dexData = await getDexScreenerData(tokenAddress);

    if (!dexData) {
      return { liquidity: 0, highRisk: true };
    }

    const riskScore = await getRiskScore(tokenAddress);

    if (riskScore > MAX_RISK_SCORE) {
      logger.warn(
        `Token ${tokenAddress} is considered high risk with a score of ${riskScore}.`
      );
      return { liquidity: 0, highRisk: true };
    }

    if (dexData.liquidity < MIN_LIQUIDITY) {
      logger.warn(
        `Token ${tokenAddress} has insufficient liquidity: $${dexData.liquidity.toFixed(
          2
        )} (Minimum required: $${MIN_LIQUIDITY}).`
      );
      return { liquidity: dexData.liquidity, highRisk: true };
    }

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
