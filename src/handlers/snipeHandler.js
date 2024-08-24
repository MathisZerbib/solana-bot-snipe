import { CONFIG } from "../config/config.js";
import { solanaTracker } from "../services/solanaService.js";
import { getLiquidityAndRisk } from "../utils/tokenUtils.js";
import { convertWSolToUSD } from "../utils/priceUtils.js";
import { logger } from "../logger/logger.js";
import fs from "fs";
import { keypair } from "../services/solanaService.js";

export async function snipe(tokenAddress, tokenName) {
  logger.info(
    `Checking liquidity and risk for token: ${tokenName} (${tokenAddress})`
  );
  const { liquidity, highRisk } = await getLiquidityAndRisk(tokenAddress);

  if (highRisk) {
    logger.info(`Skipping token ${tokenName} due to high risk.`);
    return false;
  }

  if (liquidity < CONFIG.minLiquidity) {
    logger.info(
      `Skipping token ${tokenName} due to insufficient liquidity: $${liquidity}`
    );
    return false;
  }

  logger.info(
    `Sniping token: ${tokenName} (${tokenAddress}) with liquidity: $${liquidity}`
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
    logger.info(`Transaction successful for ${tokenName}:`, {
      txid,
      url: `https://explorer.solana.com/tx/${txid}`,
    });

    const entryPriceInSOL = await getTokenPriceInSOL(tokenAddress); // Ensure this function is defined
    const entryPriceInUSD = await convertWSolToUSD(entryPriceInSOL);

    const result = await monitorToken(tokenAddress, entryPriceInUSD); // Ensure this function is defined

    logger.info(`Result for ${tokenName}: ${result}`);

    const exitPriceInUSD =
      result === "Take Profit"
        ? adjustTakeProfit(entryPriceInUSD) // Ensure this function is defined
        : adjustStopLoss(entryPriceInUSD); // Ensure this function is defined

    const profitInUSD = exitPriceInUSD - entryPriceInUSD;

    currentCapital += profitInUSD;
    logger.info(`Profit from ${tokenName}: $${profitInUSD.toFixed(2)}`);
    logger.info(`Updated current capital: $${currentCapital.toFixed(2)}`);

    // Reinvest part of the profit
    reinvestProfits(profitInUSD); // Ensure this function is defined

    // Record successful snipe
    const snipeData = {
      tokenAddress,
      tokenName,
      txid,
      liquidity,
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(
      CONFIG.successfulSnipesFile,
      JSON.stringify(snipeData) + "\n"
    );

    return true;
  } catch (error) {
    logger.error(`Error sniping token ${tokenName}:`, error);
    return false;
  }
}
