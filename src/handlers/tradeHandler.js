import { getTokenPriceInSOL } from "../services/solanaService.js";
import { convertWSolToUSD } from "../utils/priceUtils.js";
import { solanaTracker } from "../services/solanaService.js";
import { logger } from "../logger/logger.js";
import { keypair } from "../services/solanaService.js";
import { CONFIG } from "../config/config.js";
import chalk from "chalk";

export function adjustTakeProfit(entryPrice) {
  return entryPrice * (1 + CONFIG.takeProfitPercentage);
}

export function adjustStopLoss(entryPrice) {
  return entryPrice * (1 - CONFIG.stopLossPercentage);
}

export async function sellToken(tokenAddress) {
  try {
    logger.info(chalk.yellow(`Attempting to sell token: ${tokenAddress}`));

    const swapResponse = await solanaTracker.getSwapInstructions(
      tokenAddress, // From Token (sniped token address)
      "So11111111111111111111111111111111111111112", // To Token (SOL)
      CONFIG.amountToSell, // Adjust this based on your logic
      CONFIG.slippage,
      keypair.publicKey.toBase58(), // Payer public key
      CONFIG.priorityFee
    );

    const txid = await solanaTracker.performSwap(swapResponse);
    logger.info(
      chalk.green(
        `Successfully sold token ${tokenAddress}. Transaction ID: ${txid}`
      )
    );
    return txid;
  } catch (error) {
    logger.error(chalk.red(`Failed to sell token ${tokenAddress}:`), error);
    throw new Error(`Failed to sell token ${tokenAddress}`);
  }
}

export async function monitorToken(tokenAddress, entryPrice) {
  const takeProfitPrice = adjustTakeProfit(entryPrice);
  const stopLossPrice = adjustStopLoss(entryPrice);

  logger.info(
    `Monitoring token: ${tokenAddress}, Entry Price: $${entryPrice.toFixed(
      2
    )}, TP: $${takeProfitPrice.toFixed(2)}, SL: $${stopLossPrice.toFixed(2)}`
  );

  while (true) {
    const currentPriceInSOL = await getTokenPriceInSOL(tokenAddress);
    const currentPriceInUSD = await convertWSolToUSD(currentPriceInSOL);

    if (currentPriceInUSD >= takeProfitPrice) {
      logger.info(`Take profit hit for token ${tokenAddress}. Selling...`);
      await sellToken(tokenAddress);
      return "Take Profit";
    } else if (currentPriceInUSD <= stopLossPrice) {
      logger.info(`Stop loss hit for token ${tokenAddress}. Selling...`);
      await sellToken(tokenAddress);
      return "Stop Loss";
    }

    // Wait before checking the price again
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.priceCheckInterval)
    );
  }
}
