import { CONFIG } from "../config/config.js";
// import { solanaTracker, SwapResponse } from "../services/solanaService.js";
// import { getLiquidityAndRisk, LiquidityRiskResult } from "../utils/tokenUtils";
import {
  monitorToken,
  adjustTakeProfit,
  adjustStopLoss,
} from "./tradeHandler";
import { convertWSolToUSD, getTokenPriceInSOL } from "../utils/priceUtils";
import { logger } from "../logger/logger.js";
import { solanaTracker } from "../services/solanaService.js";
import chalk from "chalk";

import { keypair } from "../services/solanaService";
import { Token } from "../types/token";
import { addSnipedTokenDb, getSnipedTokensDb } from "../utils/db.js";
import { broadcastEvent } from "../api/server.js";

interface SnipeData {
  tokenAddress: string;
  tokenName: string;
  txid: string;
  liquidity: number;
  timestamp: string;
}

type MonitorResult = "Take Profit" | "Stop Loss" | "Partial Sell";

let currentCapital: number = 1000; // Initialize with dummy capital

import { connection } from "../services/solanaService";
import { AntiRugEngine } from "../services/antiRug";

export async function snipe(token: Token): Promise<boolean> {
  if (!token || !token.name || !token.address) {
    logger.error("Invalid token object provided");
    return false;
  }

  const { name: tokenName, address: tokenAddress } = token;

  if (typeof tokenName !== 'string' || typeof tokenAddress !== 'string') {
    logger.error("Invalid token name or address");
    return false;
  }

  const antiRug = new AntiRugEngine(connection.rpcEndpoint);

  logger.info(`[Module 1 & 2] Running Anti-Rug Engine on ${tokenAddress}...`);
  const isSafe = await antiRug.analyzeToken(tokenAddress);
  if (!isSafe) {
    logger.warn(`[Sniperbot] Token ${tokenName} failed Anti-Rug analysis. Bailing.`);
    return false;
  }

  try {
    // ----------------------------------------------------
    // Module 3: MEV & Execution Blueprint Implementation
    // Use Jito instead of standard RPC if possible
    // ----------------------------------------------------
    let snipeTxid = "simulated_buy_txid";
    if (!CONFIG.paperTrade) {
      const swapResponse = await solanaTracker.getSwapInstructions(
        "So11111111111111111111111111111111111111112", // From Token (SOL)
        tokenAddress, // To Token (new token address)
        CONFIG.amountToSwap,
        CONFIG.slippage,
        keypair.publicKey.toBase58(), // Payer public key
        CONFIG.priorityFee
      );

      snipeTxid = await solanaTracker.performSwap(swapResponse);
      logger.info(chalk.yellow(`Live Transaction successful for ${tokenName}:`), {
        txid: snipeTxid,
        url: `https://explorer.solana.com/tx/${snipeTxid}`,
      });
    } else {
      logger.info(chalk.yellow(`[Paper Trade] Simulated buy for ${tokenName} done.`));
    }
    // Here tell to stop other snipes
    // Calculate prices for stop-loss and take-profit

    const entryPriceInSOL: number = await getTokenPriceInSOL(tokenAddress);
    if (isNaN(entryPriceInSOL)) {
      throw new Error("Invalid entry price in SOL");
    }

    const entryPriceInUSD: number = await convertWSolToUSD(entryPriceInSOL);
    if (isNaN(entryPriceInUSD)) {
      throw new Error("Invalid entry price in USD");
    }

    const currentTokenPriceInUSD: number = await convertWSolToUSD(await getTokenPriceInSOL(tokenAddress));


    console.log("Entry price in USD", entryPriceInUSD);
    console.log("Entry price in SOL", entryPriceInSOL);

    const result: MonitorResult = await monitorToken(tokenAddress, entryPriceInUSD, CONFIG.amountToSwap);

    logger.info(`Result for ${tokenName}: ${result}`);

    const exitPriceInUSD: number =
      result === "Take Profit"
        ? adjustTakeProfit(entryPriceInUSD)
        : adjustStopLoss(entryPriceInUSD, currentTokenPriceInUSD);

    if (isNaN(exitPriceInUSD)) {
      throw new Error("Invalid exit price");
    }

    const profitInUSD: number = exitPriceInUSD - entryPriceInUSD;

    if (typeof currentCapital !== 'number') {
      throw new Error("Invalid current capital");
    }

    currentCapital += profitInUSD;
    logger.info(`Profit from ${tokenName}: $${profitInUSD.toFixed(2)}`);
    logger.info(`Updated current capital: $${currentCapital.toFixed(2)}`);

    // Record successful snipe
    const snipeData: SnipeData = {
      tokenAddress,
      tokenName,
      txid: snipeTxid,
      liquidity: 0, // Replace with actual liquidity when uncommenting related code
      timestamp: new Date().toISOString(),
    };

    await addSnipedTokenDb(
      tokenAddress,
      tokenName,
      snipeData.txid,
      snipeData.liquidity,
      profitInUSD
    );

    // Push live execution data across the WebSocket layer asynchronously
    getSnipedTokensDb().then((updatedTokens) => {
      broadcastEvent('TOKENS', updatedTokens);
    }).catch((e) => logger.error('[WS] Failed to broadcast new snipe data:', e));

    return true;
  } catch (error) {
    logger.error(`Error sniping token ${tokenName}:`, error);
    return false;
  }
}