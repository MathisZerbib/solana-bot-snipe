import { CONFIG } from "../config/config.js";
import { solanaTracker } from "../services/solanaService.js";
import {
  getLiquidityAndRisk,
  getTokenPriceInSOL,
} from "../utils/tokenUtils.js";
import { convertWSolToUSD, getSolPriceInUSD } from "../utils/priceUtils.js";
import { logger } from "../logger/logger.js";
import fs from "fs";
import { keypair } from "../services/solanaService.js";
import chalk from "chalk";

let currentCapital = CONFIG.initialCapital;

export async function snipe(tokenAddress, tokenName) {
  // Fetch the current SOL price in USD and log it
  const solPriceInUSD = await getSolPriceInUSD();
  logInfo(`Current SOL price: $${solPriceInUSD.toFixed(6)}`);

  logInfo(
    `Checking liquidity and risk for token: ${tokenName} (${tokenAddress})`
  );

  try {
    const swapResponse = await solanaTracker.getSwapInstructions(
      "So11111111111111111111111111111111111111112", // From Token (SOL)
      tokenAddress, // To Token (new token address)
      CONFIG.amountToSwap,
      CONFIG.slippage,
      keypair.publicKey.toBase58(), // Payer public key
      CONFIG.priorityFee
    );

    const txid = await solanaTracker.performSwap(swapResponse);
    logInfo(`Transaction successful for ${tokenName}: ${txid}`);

    // Calculate entry price in SOL and convert it to USD
    const entryPriceInSOL = await getTokenPriceInSOL(tokenAddress);
    const entryPriceInUSD = entryPriceInSOL * solPriceInUSD;
    logInfo(
      `Entry price for ${tokenName}: ${entryPriceInSOL.toFixed(
        4
      )} SOL ($${entryPriceInUSD.toFixed(4)})`
    );

    // Monitor token for stop-loss or take-profit
    const result = await monitorToken(tokenAddress, entryPriceInUSD);

    logInfo(`Result for ${tokenName}: ${result}`);

    // Determine exit price in USD
    const exitPriceInUSD =
      result === "Take Profit"
        ? adjustTakeProfit(entryPriceInUSD)
        : entryPriceInUSD;

    // Calculate profit in USD and update capital
    const profitInUSD = exitPriceInUSD - entryPriceInUSD;
    currentCapital += profitInUSD;

    logInfo(`Profit from ${tokenName}: $${profitInUSD.toFixed(2)}`);
    logInfo(`Updated current capital: $${currentCapital.toFixed(2)}`);

    // Record successful snipe
    const snipeData = {
      tokenAddress,
      tokenName,
      txid,
      liquidity,
      entryPriceInUSD,
      exitPriceInUSD,
      profitInUSD,
      result,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(
      CONFIG.successfulSnipesFile,
      JSON.stringify(snipeData) + "\n"
    );

    return true;
  } catch (error) {
    logError(`Error sniping token ${tokenName}:`, error);
    return false;
  }
}

// Function to calculate the take-profit price based on entry price
export function adjustTakeProfit(entryPriceInUSD) {
  const takeProfitPercentage = CONFIG.takeProfitPercentage || 10; // Default to 10% if not specified
  return entryPriceInUSD * (1 + takeProfitPercentage / 100);
}

// Function to dynamically adjust the take-profit percentage based on current price
export function dynamicTakeProfit(entryPriceInUSD, currentPriceInUSD) {
  const priceIncreasePercentage =
    ((currentPriceInUSD - entryPriceInUSD) / entryPriceInUSD) * 100;
  const dynamicTakeProfitPercentage =
    CONFIG.baseTakeProfitPercentage +
    priceIncreasePercentage * CONFIG.adjustmentFactor;
  return entryPriceInUSD * (1 + dynamicTakeProfitPercentage / 100);
}

// Function to log information
function logInfo(message) {
  logger.info(message);
  console.log(chalk.cyan(message));
}

// Function to log errors
function logError(message, error) {
  logger.error(message, error);
  console.error(chalk.red(message), error);
  if (error.response) {
    console.error(chalk.red("Error response:"), error.response.data);
  }
}

// Function to monitor token and sell at different milestones
export async function monitorToken(tokenAddress, entryPriceInUSD) {
  const milestones = [2, 3, 10]; // Multipliers for selling portions
  let currentMilestoneIndex = 0;

  while (currentMilestoneIndex < milestones.length) {
    const currentPriceInSOL = await getTokenPriceInSOL(tokenAddress);
    const currentPriceInUSD = currentPriceInSOL * (await getSolPriceInUSD());

    if (
      currentPriceInUSD >=
      entryPriceInUSD * milestones[currentMilestoneIndex]
    ) {
      logInfo(
        `Selling portion of ${tokenAddress} at ${milestones[currentMilestoneIndex]}x the entry price.`
      );
      await sellToken(
        tokenAddress,
        milestones[currentMilestoneIndex],
        entryPriceInUSD
      );
      currentMilestoneIndex++;
    }

    await delay(CONFIG.monitorInterval);
  }

  return "Take Profit";
}

// Function to sell token
async function sellToken(tokenAddress, multiplier, entryPriceInUSD) {
  const portions = {
    2: 0.5, // Sell 50% at 2x
    3: 0.3, // Sell 30% at 3x
    10: 0.2, // Sell remaining 20% at 10x
  };

  const portionToSell = portions[multiplier];
  if (!portionToSell) {
    logError(`Invalid multiplier: ${multiplier}`);
    return;
  }

  try {
    const swapResponse = await solanaTracker.getSwapInstructions(
      tokenAddress, // From Token (new token address)
      "So11111111111111111111111111111111111111112", // To Token (SOL)
      CONFIG.amountToSwap * portionToSell,
      CONFIG.slippage,
      keypair.publicKey.toBase58(), // Payer public key
      CONFIG.priorityFee
    );

    const txid = await solanaTracker.performSwap(swapResponse);
    logInfo(
      `Sold ${
        portionToSell * 100
      }% of ${tokenAddress} at ${multiplier}x the entry price. Transaction ID: ${txid}`
    );

    // Flag final profits if this is the last portion
    if (multiplier === 10) {
      const currentPriceInSOL = await getTokenPriceInSOL(tokenAddress);
      const currentPriceInUSD = currentPriceInSOL * (await getSolPriceInUSD());
      const profitInUSD =
        (currentPriceInUSD - entryPriceInUSD) * CONFIG.amountToSwap;
      logInfo(`Final profit for ${tokenAddress}: $${profitInUSD.toFixed(6)}`);
    }
  } catch (error) {
    logError(`Error selling token ${tokenAddress} at ${multiplier}x:`, error);
  }
}

// Function to introduce delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
