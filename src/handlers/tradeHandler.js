import { getTokenPriceInSOL } from "../services/solanaService.js";
import { convertWSolToUSD } from "../utils/priceUtils.js";
import { adjustTakeProfit, adjustStopLoss } from "../utils/tokenUtils.js";
import { logger } from "../logger/logger.js";

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

    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.priceCheckInterval)
    );
  }
}

async function sellToken(tokenAddress) {
  // Logic to sell the token
  logger.info(`Selling token ${tokenAddress}`);
}
