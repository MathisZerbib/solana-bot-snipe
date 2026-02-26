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

import fs from "fs";
import { keypair } from "../services/solanaService";
import { Token } from "../types/token";

interface SnipeData {
  tokenAddress: string;
  tokenName: string;
  txid: string;
  liquidity: number;
  timestamp: string;
}

type MonitorResult = "Take Profit" | "Stop Loss" | "Partial Sell";

let currentCapital: number = 1000; // Initialize with dummy capital

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

  const { connection } = require("../services/solanaService");
  const { AntiRugEngine } = require("../services/antiRug");
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
    // Uncomment and use these when needed
    // const swapResponse: SwapResponse = await solanaTracker.getSwapInstructions(
    //   "So11111111111111111111111111111111111111112", // From Token (SOL)
    //   tokenAddress, // To Token (new token address)
    //   CONFIG.amountToSwap,
    //   CONFIG.slippage,
    //   keypair.publicKey.toBase58(), // Payer public key
    //   CONFIG.priorityFee
    // );

    // const txid: string = await solanaTracker.performSwap(swapResponse);
    // logger.info(chalk.yellow(`Transaction successful for ${tokenName}:`), {
    //   txid,
    //   url: `https://explorer.solana.com/tx/${txid}`,
    // });

    console.log("Fake TX is DONE for", token);
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
      txid: "dummy-txid", // Replace with actual txid when uncommenting related code
      liquidity: 0, // Replace with actual liquidity when uncommenting related code
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