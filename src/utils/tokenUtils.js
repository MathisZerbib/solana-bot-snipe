import { PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import fetch from "node-fetch";
import { connection } from "../services/solanaService.js";
import { logger } from "../logger/logger.js";

const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens/";
const MAX_RISK_SCORE = 600; // Define your threshold for risk score

// Function to fetch the risk score for a token
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




// Function to get liquidity and check risk score
export async function getLiquidityAndRisk(tokenAddress) {
  try {
    console.log("Getting liquidity and risk for token:", tokenAddress);
    const tokenMint = new PublicKey(tokenAddress);
    const mintInfo = await spl.getMint(connection, tokenMint);
    const liquidity = Number(mintInfo.supply) / 10 ** mintInfo.decimals;

    // Fetch risk score
    const riskScore = await getRiskScore(tokenAddress);

    // Check if the risk score is too high
    if (riskScore > MAX_RISK_SCORE) {
      logger.warn(
        `Token ${tokenAddress} is considered high risk with a score of ${riskScore}.`
      );
      return { liquidity: 0, highRisk: true };
    }

    return { liquidity, highRisk: false };
  } catch (error) {
    logger.error(
      `Error getting liquidity or risk for token ${tokenAddress}:`,
      error
    );
    return { liquidity: 0, highRisk: true };
  }
}
