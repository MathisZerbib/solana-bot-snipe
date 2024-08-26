import fetch from "node-fetch";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";
import chalk from "chalk";
import { solanaTracker } from "../services/solanaService.js";
import { keypair } from "../services/solanaService.js";

const DEX_SCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens/";
const MAX_RISK_SCORE = CONFIG.riskScore || 9000; // Define your threshold for risk score
const MIN_LIQUIDITY = CONFIG.minLiquidity || 10000; // Set the minimum liquidity threshold
const MONITOR_INTERVAL = CONFIG.checkInterval || 30000; // Interval in milliseconds for continuous monitoring

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logAndConsole(message, level = "info", color = "green") {
  logger[level](message);
  console.log(chalk[color](message));
}

async function fetchRiskScore(tokenAddress) {
  const response = await fetch(`${RUGCHECK_URL}${tokenAddress}/report/summary`);
  const data = await response.json();
  return data.score || 0; // Default to 0 if no score is available
}

export async function validateRiskScore(token) {
  const tokenAddress = token.address;

  try {
    const firstRiskScore = await fetchRiskScore(tokenAddress);
    await delay(CONFIG.priceCheckInterval);
    const secondRiskScore = await fetchRiskScore(tokenAddress);

    if (firstRiskScore > MAX_RISK_SCORE || secondRiskScore > MAX_RISK_SCORE) {
      logAndConsole(
        `Token ${tokenAddress} failed risk validation with scores: ${firstRiskScore} and ${secondRiskScore}.`,
        "warn",
        "red"
      );
      return false;
    }

    logAndConsole(
      `Token ${tokenAddress} passed risk validation with scores: ${firstRiskScore} and ${secondRiskScore}.`,
      "info",
      "green"
    );
    return true;
  } catch (error) {
    logger.error(
      `Error validating risk score for token ${tokenAddress}:`,
      error
    );
    return false;
  }
}

export async function fetchDexScreenerData(tokenAddress) {
  try {
    const response = await fetch(`${DEX_SCREENER_API_URL}${tokenAddress}`);
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      const { liquidity, priceUsd, priceNative, pairAddress } = data.pairs[0];
      return {
        liquidity: liquidity?.usd || 0,
        priceUsd: typeof priceUsd === "number" ? priceUsd : 0,
        priceNative: typeof priceNative === "number" ? priceNative : 0,
        lockedLiquidity: liquidity && liquidity.usd > 0,
        pairAddress,
      };
    } else {
      logAndConsole(
        `No pair data found for token ${tokenAddress} on DEX Screener.`,
        "warn",
        "yellow"
      );
      return false;
    }
  } catch (error) {
    logger.error(
      `Error fetching data from DEX Screener for token ${tokenAddress}:`,
      error
    );
    return false;
  }
}

export async function getLiquidityAndRisk(token) {
  const tokenAddress = token.address;
  const tokenName = token.name;
  try {
    const isSafe = await validateRiskScore(token);
    if (!isSafe) return { liquidity: 0, highRisk: true };

    const dexData = await fetchDexScreenerData(tokenAddress);

    if (!dexData) return { liquidity: 0, highRisk: true };

    if (dexData.liquidity < MIN_LIQUIDITY) {
      logAndConsole(
        `Token ${tokenName} ${tokenAddress} has insufficient liquidity: $${dexData.liquidity} (Minimum required: $${MIN_LIQUIDITY}).`,
        "warn",
        "yellow"
      );
      return { liquidity: dexData.liquidity, highRisk: true };
    }

    logAndConsole(
      `Liquidity: $${dexData.liquidity}, Price: $${dexData.priceUsd}, Locked Liquidity: ${dexData.lockedLiquidity}`,
      "info",
      "green"
    );

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
      `Error getting liquidity, price, or risk for token ${tokenName}, ${tokenAddress}:`,
      error
    );
    return { liquidity: 0, highRisk: true };
  }
}

export async function monitorToken(tokenAddress, entryPriceUsd) {
  try {
    const PRICE_ALERT_THRESHOLD = CONFIG.takeProfitPercentage || 0.02;
    let previousPrice = entryPriceUsd;

    while (true) {
      const priceChangePercentage = (priceUsd - previousPrice) / previousPrice;

      if (priceChangePercentage >= PRICE_ALERT_THRESHOLD) {
        logAndConsole(
          `Profit-taking condition met for token ${tokenAddress}: Price increased by ${(
            priceChangePercentage * 100
          ).toFixed(2)}%`,
          "info",
          "green"
        );
        await sellToken(tokenAddress);
        return true;
      }

      if (priceChangePercentage <= -STOP_LOSS_THRESHOLD) {
        logAndConsole(
          `Stop-loss condition met for token ${tokenAddress}: Price decreased by ${(
            priceChangePercentage * 100
          ).toFixed(2)}%`,
          "info",
          "red"
        );
        await sellToken(tokenAddress);
        return true;
      }

      logAndConsole(
        `Monitoring token: ${tokenAddress} - Liquidity: $${liquidity.toFixed(
          2
        )}, Price: $${priceUsd}`,
        "info",
        "green"
      );

      previousPrice = priceUsd;
      await delay(MONITOR_INTERVAL);
    }
  } catch (error) {
    logger.error(`Error monitoring token ${tokenAddress}:`, error);
    return false;
  }
}

async function sellToken(tokenAddress) {
  try {
    const swapResponse = await solanaTracker.getSwapInstructions(
      tokenAddress,
      "So11111111111111111111111111111111111111112",
      CONFIG.amountToSwap,
      CONFIG.slippage,
      keypair.publicKey.toBase58(),
      CONFIG.priorityFee
    );

    const txid = await solanaTracker.performSwap(swapResponse);
    logger.info(`Sold token ${tokenAddress}:`, {
      txid,
      url: `https://explorer.solana.com/tx/${txid}`,
    });
  } catch (error) {
    logger.error(`Error selling token ${tokenAddress}:`, error);
  }
}

// Function to get token price in SOL using Dexscreener API
export async function getTokenPriceInSOL(tokenSymbol) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${tokenSymbol}%20SOL`
    );
    const data = await response.json();

    const pairData = data.pairs.find(
      (pair) =>
        pair.baseToken.symbol === tokenSymbol &&
        pair.quoteToken.symbol === "SOL"
    );

    if (pairData) {
      const priceInSOL = parseFloat(pairData.priceNative);
      logger.info(`${tokenSymbol} price in SOL: ${priceInSOL}`);
      return priceInSOL;
    } else {
      throw new Error(
        `Unable to retrieve ${tokenSymbol} price in SOL from Dexscreener API`
      );
    }
  } catch (error) {
    logger.error(`Error fetching price for token ${tokenSymbol}:`, error);
    return 0;
  }
}
