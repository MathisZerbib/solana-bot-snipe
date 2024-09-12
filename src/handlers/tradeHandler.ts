import { Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { SolanaTracker } from "solana-swap";
import { logger } from "../logger/logger.js";

import dotenv from "dotenv";
import { CONFIG } from "../config/config";
import chalk from "chalk";

dotenv.config();

export const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
);

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export const solanaTracker = new SolanaTracker(
  keypair,
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

export async function getLatestTokens(): Promise<any[]> {
  const response = await fetch("https://api.solanatracker.io/tokens/latest");
  const tokens = await response.json();
  return tokens;
}

interface SellStrategy {
  initialSellPercentage: number;
  subsequentSellPercentages: number[];
  priceIncrementTriggers: number[];
}

const SELL_STRATEGY: SellStrategy = {
  initialSellPercentage: 0.25,
  subsequentSellPercentages: [0.25, 0.25, 0.25],
  priceIncrementTriggers: [1.1, 1.2, 1.3],
};

export function adjustTakeProfit(entryPrice: number): number {
  if (typeof entryPrice !== "number" || isNaN(entryPrice)) {
    throw new Error("Invalid entry price for take profit adjustment");
  }
  return entryPrice * (1 + CONFIG.takeProfitPercentage);
}

export function adjustStopLoss(entryPrice: number, currentPrice: number): number {
  if (typeof entryPrice !== "number" || isNaN(entryPrice) || typeof currentPrice !== "number" || isNaN(currentPrice)) {
    throw new Error("Invalid prices for stop loss adjustment");
  }
  const stopLossPercentage = Math.max(CONFIG.stopLossPercentage, 1 - (entryPrice / currentPrice));
  return currentPrice * (1 - stopLossPercentage);
}

export async function snipe(tokenAddress: string): Promise<string> {
  console.log("Sniping token:", tokenAddress);
  const swapInstructions = await solanaTracker.getSwapInstructions(
    "So11111111111111111111111111111111111111112", // From Token (SOL)
    tokenAddress, // To Token (new token address)
    CONFIG.amountToSwap,
    CONFIG.slippage,
    keypair.publicKey.toBase58(), // Payer public key
    CONFIG.priorityFee
  );

  const txid = await solanaTracker.performSwap(swapInstructions);
  console.log("Transaction ID:", txid);
  console.log("Transaction URL:", `https://explorer.solana.com/tx/${txid}`);
  return txid;
}

export async function sellToken(tokenAddress: string, amountToSell: number): Promise<string> {
  if (typeof tokenAddress !== "string" || tokenAddress.trim() === "") {
    throw new Error("Invalid token address");
  }

  try {
    logger.info(chalk.yellow(`Attempting to sell ${amountToSell} of token: ${tokenAddress}`));

    const swapInstructions = await solanaTracker.getSwapInstructions(
      tokenAddress,
      "So11111111111111111111111111111111111111112", // To SOL
      amountToSell,
      CONFIG.slippage,
      keypair.publicKey.toBase58(),
      CONFIG.priorityFee
    );

    const txid = await solanaTracker.performSwap(swapInstructions);
    logger.info(
      chalk.green(
        `Successfully sold ${amountToSell} of token ${tokenAddress}. Transaction ID: ${txid}`
      )
    );
    return txid;
  } catch (error) {
    logger.error(chalk.red(`Failed to sell token ${tokenAddress}:`), error);
    throw new Error(`Failed to sell token ${tokenAddress}`);
  }
}

type MonitorResult = "Take Profit" | "Stop Loss" | "Partial Sell";

export async function monitorToken(
  tokenAddress: string,
  entryPrice: number,
  initialAmount: number
): Promise<MonitorResult> {
  if (typeof tokenAddress !== "string" || tokenAddress.trim() === "" || typeof entryPrice !== "number" || isNaN(entryPrice) || typeof initialAmount !== "number" || isNaN(initialAmount)) {
    throw new Error("Invalid input parameters");
  }

  let takeProfitPrice = adjustTakeProfit(entryPrice);
  let stopLossPrice = adjustStopLoss(entryPrice, entryPrice);
  let remainingAmount = initialAmount;
  let sellStage = 0;

  logger.info(
    `Monitoring token: ${tokenAddress}, Entry Price: $${entryPrice.toFixed(2)}, Initial TP: $${takeProfitPrice.toFixed(2)}, Initial SL: $${stopLossPrice.toFixed(2)}`
  );

  while (remainingAmount > 0) {
    const currentPriceInSOL = getTokenPriceInSOL(tokenAddress);
    if (typeof currentPriceInSOL !== "number" || isNaN(currentPriceInSOL)) {
      throw new Error("Invalid current price in SOL");
    }

    const currentPriceInUSD = convertWSolToUSD(currentPriceInSOL);
    if (typeof currentPriceInUSD !== "number" || isNaN(currentPriceInUSD)) {
      throw new Error("Invalid current price in USD");
    }

    // Adjust stop loss
    stopLossPrice = adjustStopLoss(entryPrice, currentPriceInUSD);

    if (currentPriceInUSD >= takeProfitPrice) {
      const sellPercentage = sellStage === 0 ? SELL_STRATEGY.initialSellPercentage : SELL_STRATEGY.subsequentSellPercentages[sellStage - 1];
      const amountToSell = remainingAmount * sellPercentage;

      logger.info(`Partial sell triggered for token ${tokenAddress}. Selling ${sellPercentage * 100}%...`);
      await sellToken(tokenAddress, amountToSell);

      remainingAmount -= amountToSell;
      sellStage++;

      if (sellStage <= SELL_STRATEGY.priceIncrementTriggers.length) {
        takeProfitPrice = currentPriceInUSD * SELL_STRATEGY.priceIncrementTriggers[sellStage - 1];
      } else {
        // If all stages completed, sell remaining amount
        if (remainingAmount > 0) {
          await sellToken(tokenAddress, remainingAmount);
          remainingAmount = 0;
        }
        return "Take Profit";
      }

      logger.info(`New take profit price: $${takeProfitPrice.toFixed(2)}, Remaining amount: ${remainingAmount}`);
      return "Partial Sell";
    } else if (currentPriceInUSD <= stopLossPrice) {
      logger.info(`Stop loss hit for token ${tokenAddress}. Selling remaining amount...`);
      await sellToken(tokenAddress, remainingAmount);
      return "Stop Loss";
    }

    // Wait before checking the price again
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.priceCheckInterval)
    );
  }

  return "Take Profit"; // All amount sold
}

function getTokenPriceInSOL(tokenAddress: string) {
  throw new Error("Function not implemented.");
}


function convertWSolToUSD(currentPriceInSOL: number) {
  throw new Error("Function not implemented.");
}
