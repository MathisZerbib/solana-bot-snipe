import { getTokenInfo } from "../utils/priceUtils.js";
import { solanaTracker } from "../services/solanaService.js";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";
import chalk from "chalk";
import { SwapResponse } from "solana-swap/dist/types/types.js";
import { Token } from "../types/token.js";
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

export async function buyToken(token: Token): Promise<boolean> {
  try {
    const { address: tokenAddress } = token;
    if (token.liquidity < CONFIG.minLiquidity || token.highRisk) {
      return false;
    }

    let createdAt = new Date(token.createdAt);

    console.log(chalk.green(`Token ${token.name} is eligible for sniping. Proceeding... liquidity ${token.liquidity} risk ${token.highRisk} créé le ${createdAt}  ${token.address}`));
    logger.info(`Sniping token: ${tokenAddress}`);
    const swapResponse: SwapResponse = await solanaTracker.getSwapInstructions(
      "So11111111111111111111111111111111111111112", // From Token (SOL)
      tokenAddress,
      CONFIG.amountToSwap,
      CONFIG.slippage,
      CONFIG.keypair.publicKey.toString(), // Use toString() instead of toBase58()
      CONFIG.priorityFee
    );

    const txid: string = await solanaTracker.performSwap(swapResponse);
    return true;
  } catch (error) {
    logger.error(`Failed to snipe token ${token.address}:`, error);
    return false;
  }
}

export async function sellToken(tokenAddress: string, amountToSell: number): Promise<boolean> {
  if (typeof tokenAddress !== "string" || tokenAddress.trim() === "") {
    throw new Error("Invalid token address");
  }

  try {
    const swapResponse: SwapResponse = await solanaTracker.getSwapInstructions(
      tokenAddress,
      "So11111111111111111111111111111111111111112",
      amountToSell,
      CONFIG.slippage,
      CONFIG.keypair.publicKey.toString(),
      CONFIG.priorityFee
    );

    const txid: string = await solanaTracker.performSwap(swapResponse);
    console.log(txid);
    if (txid) {
      logger.info(
        `Successfully sold ${amountToSell} tokens of ${tokenAddress}. Transaction ID: ${txid}`
      );
    } else {
      logger.error(`Failed to sell token ${tokenAddress}`);
    }
    return true;
  } catch (error) {
    logger.error(chalk.red(`Failed to sell token ${tokenAddress}:`), error);
    return false;
  }
}

type MonitorResult = "Take Profit" | "Stop Loss" | "Partial Sell";
export async function monitorToken(
  tokenName: string,
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
  let highestPrice = entryPrice;

  logger.info(
    `Monitoring token: ${tokenAddress}, Entry Price: $${entryPrice.toFixed(6)}, Initial TP: $${takeProfitPrice.toFixed(6)}, Initial SL: $${stopLossPrice.toFixed(6)}`
  );

  while (remainingAmount > 0) {
    try {
      let currentPriceInSOL = await getTokenInfo(tokenAddress);

      logger.info(`Current price of ${tokenName}: ${currentPriceInSOL.toFixed(6)} SOL`);

      // Update highest price and adjust stop loss
      if (currentPriceInSOL > highestPrice) {
        highestPrice = currentPriceInSOL;
        stopLossPrice = adjustStopLoss(entryPrice, highestPrice);
        takeProfitPrice = Math.max(takeProfitPrice, currentPriceInSOL * CONFIG.takeProfitPercentage); // Adjust take profit based on new high
        logger.info(`SL: ${stopLossPrice.toFixed(6)} TP: ${takeProfitPrice.toFixed(6)} Price: ${highestPrice.toFixed(6)}`);
      }

      // Reset stop loss if price drops below entry
      if (currentPriceInSOL < entryPrice && stopLossPrice > entryPrice * CONFIG.stopLossPercentage) {
        stopLossPrice = adjustStopLoss(entryPrice, currentPriceInSOL);
        logger.info(`Reset SL: ${stopLossPrice.toFixed(6)}`);
      }

      if (currentPriceInSOL >= takeProfitPrice) {
        const sellPercentage = sellStage === 0 ? SELL_STRATEGY.initialSellPercentage : SELL_STRATEGY.subsequentSellPercentages[sellStage - 1];
        const amountToSell = remainingAmount * sellPercentage;

        logger.info(`Take profit triggered for ${tokenAddress}. Selling ${sellPercentage * 100}%...`);
        const sellSuccess = await sellToken(tokenAddress, amountToSell);

        if (sellSuccess) {
          remainingAmount -= amountToSell;
          sellStage++;

          if (remainingAmount > 0 && sellStage < SELL_STRATEGY.priceIncrementTriggers.length) {
            takeProfitPrice = currentPriceInSOL * SELL_STRATEGY.priceIncrementTriggers[sellStage];
            logger.info(`New take profit price: ${takeProfitPrice.toFixed(6)}, Remaining amount: ${remainingAmount}`);
          } else {
            if (remainingAmount > 0) {
              await sellToken(tokenAddress, remainingAmount);
            }
            logger.info(`All ${tokenAddress} tokens sold. Monitoring complete.`);
            return "Take Profit";
          }
        }
      } else if (currentPriceInSOL <= stopLossPrice) {
        logger.info(`Stop loss hit for ${tokenAddress}. Selling remaining amount...`);
        await sellToken(tokenAddress, remainingAmount);
        logger.info(`All ${tokenAddress} tokens sold due to stop loss. Monitoring complete.`);
        return "Stop Loss";
      }

      await new Promise((resolve) => setTimeout(resolve, CONFIG.priceCheckInterval));
    } catch (error) {
      logger.error(`Error monitoring ${tokenAddress}:`, error);
      await new Promise((resolve) => setTimeout(resolve, CONFIG.errorRetryInterval));
    }
  }

  return "Take Profit"; // All amount sold
}