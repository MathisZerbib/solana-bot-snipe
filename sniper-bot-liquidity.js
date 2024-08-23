import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { SolanaTracker } from "solana-swap";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import winston from "winston";
import * as spl from "@solana/spl-token";

dotenv.config();

const initialCapital = 50; // Initial capital in USD
let currentCapital = initialCapital; // Current capital in USD
let totalProfitUSD = 0; // Cumulative profit in USD

const CONFIG = {
  amountToSwap: 0.3, // Amount in wSOL to swap for each snipe
  slippage: 30,
  priorityFee: 0.00005,
  maxConcurrentSnipes: 3,
  checkInterval: 5000, // 5 seconds
  logFile: "sniper-bot-liquidity.log",
  successfulSnipesFile: "successful-snipes-liquidity.json",
  minLiquidity: 10000, // Minimum liquidity in USD
  reinvestPercentage: 0.4, // 40% of profits for reinvestment
  takeProfitPercentage: 2.0, // Example TP: 200%
  stopLossPercentage: 0.4, // Example SL: 40%
  breakEvenPercentage: 0.4, // Move SL to BE at 40% gain
  priceCheckInterval: 10000, // 10 seconds for price monitoring
};

// Setup logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: CONFIG.logFile }),
  ],
});

const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

const solanaTracker = new SolanaTracker(
  keypair,
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

// Function to get the current price of SOL in USD from Solscan API
async function getSolPriceInUSD() {
  try {
    const response = await fetch("https://public-api.solscan.io/market");
    const marketData = await response.json();

    if (marketData && marketData.data && marketData.data.priceUsdt) {
      return marketData.data.priceUsdt;
    } else {
      logger.error("Error: Failed to retrieve SOL price from Solscan.");
      return 0;
    }
  } catch (error) {
    logger.error("Error fetching SOL price from Solscan:", error);
    return 0; // Default to 0 if there's an error
  }
}

// Function to get the current price of a token in SOL
async function getTokenPriceInSOL(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.solanatracker.io/price/${tokenAddress}`
    );
    const priceData = await response.json();
    return priceData.priceInSOL;
  } catch (error) {
    logger.error(`Error fetching price for token ${tokenAddress}:`, error);
    return 0;
  }
}

async function getLatestTokens() {
  try {
    const response = await fetch("https://api.solanatracker.io/tokens/latest");
    const tokens = await response.json();
    return tokens;
  } catch (error) {
    logger.error("Error fetching latest tokens:", error);
    return [];
  }
}

// Function to get token liquidity
async function getLiquidity(tokenAddress) {
  try {
    const tokenMint = new PublicKey(tokenAddress);
    const mintInfo = await spl.getMint(connection, tokenMint);
    const liquidity = Number(mintInfo.supply) / 10 ** mintInfo.decimals;
    return liquidity;
  } catch (error) {
    logger.error(`Error getting liquidity for token ${tokenAddress}:`, error);
    return 0;
  }
}

// Function to adjust Take Profit (TP)
function adjustTakeProfit(entryPrice) {
  return entryPrice * (1 + CONFIG.takeProfitPercentage / 100);
}

// Function to adjust Stop Loss (SL)
function adjustStopLoss(entryPrice) {
  return entryPrice * (1 - CONFIG.stopLossPercentage / 100);
}

// Function to handle reinvestment
function reinvestProfits(profit) {
  const reinvestmentAmount = profit * CONFIG.reinvestPercentage;
  currentCapital += reinvestmentAmount;
  logger.info(
    `Reinvesting ${
      CONFIG.reinvestPercentage * 100
    }% of profits: $${reinvestmentAmount.toFixed(2)}`
  );
}

// Function to convert wSOL to USD using the live SOL price
async function convertWSolToUSD(wSolAmount) {
  const solPriceInUSD = await getSolPriceInUSD();
  return wSolAmount * solPriceInUSD;
}

// Function to monitor and manage the token price
async function monitorToken(
  tokenAddress,
  entryPrice,
  takeProfitPrice,
  stopLossPrice
) {
  logger.info(`Monitoring token: ${tokenAddress}`);

  while (true) {
    const currentPriceInSOL = await getTokenPriceInSOL(tokenAddress);
    const currentPriceInUSD = await convertWSolToUSD(currentPriceInSOL);

    // Check if stop loss or take profit is hit
    if (currentPriceInUSD >= takeProfitPrice) {
      logger.info(`Take profit hit for token ${tokenAddress}. Selling...`);
      await sellToken(tokenAddress);
      return "Take Profit";
    } else if (currentPriceInUSD <= stopLossPrice) {
      logger.info(`Stop loss hit for token ${tokenAddress}. Selling...`);
      await sellToken(tokenAddress);
      return "Stop Loss";
    }

    // Optionally, add logic here to buy more if conditions are favorable (e.g., price dips)
    // You can track price trends and average down if you want to accumulate more tokens.

    // Sleep before checking the price again
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.priceCheckInterval)
    );
  }
}

async function sellToken(tokenAddress) {
  try {
    const swapResponse = await solanaTracker.getSwapInstructions(
      tokenAddress, // From Token (new token address)
      "So11111111111111111111111111111111111111112", // To Token (SOL)
      CONFIG.amountToSwap,
      CONFIG.slippage,
      keypair.publicKey.toBase58(), // Payer public key
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

async function snipe(tokenAddress, tokenName) {
  logger.info(`Checking liquidity for token: ${tokenName} (${tokenAddress})`);
  const liquidity = await getLiquidity(tokenAddress);

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

    // Calculate prices for stop-loss and take-profit
    const entryPriceInUSD = await convertWSolToUSD(CONFIG.amountToSwap);
    const takeProfitPrice = adjustTakeProfit(entryPriceInUSD);
    const stopLossPrice = adjustStopLoss(entryPriceInUSD);

    logger.info(
      `Set TP: $${takeProfitPrice.toFixed(2)}, SL: $${stopLossPrice.toFixed(2)}`
    );

    // Monitor the token price
    const result = await monitorToken(
      tokenAddress,
      entryPriceInUSD,
      takeProfitPrice,
      stopLossPrice
    );

    logger.info(`Result for ${tokenName}: ${result}`);

    // Example profit calculation (adjust based on actual exit price)
    const exitPriceInUSD =
      result === "Take Profit" ? takeProfitPrice : stopLossPrice;
    const profitInUSD = exitPriceInUSD - entryPriceInUSD;

    // Update total profit and current capital
    totalProfitUSD += profitInUSD;
    currentCapital += profitInUSD;

    logger.info(`Profit from ${tokenName}: $${profitInUSD.toFixed(2)}`);
    logger.info(`Updated current capital: $${currentCapital.toFixed(2)}`);
    logger.info(`Total cumulative profit: $${totalProfitUSD.toFixed(2)}`);

    // Reinvest part of the profit
    reinvestProfits(profitInUSD);

    return true;
  } catch (error) {
    logger.error(`Error sniping token ${tokenName}:`, error);
    return false;
  }
}

async function main() {
  const startDate = new Date();
  logger.info("Sniper bot started", { startDate });

  let snipedTokens = new Set();

  while (true) {
    try {
      const tokens = await getLatestTokens();
      const newTokens = tokens.filter(
        (token) =>
          new Date(token.createdAt) > startDate &&
          !snipedTokens.has(token.address)
      );

      if (newTokens.length > 0) {
        logger.info(`Found ${newTokens.length} new tokens`);

        const snipeResults = await Promise.all(
          newTokens
            .slice(0, CONFIG.maxConcurrentSnipes)
            .map((token) => snipe(token.address, token.name))
        );

        snipedTokens = new Set([
          ...snipedTokens,
          ...newTokens.map((token) => token.address),
        ]);

        const successfulSnipes = snipeResults.filter((result) => result).length;
        logger.info(
          `Successfully sniped ${successfulSnipes} out of ${snipeResults.length} attempts`
        );
      }
    } catch (error) {
      logger.error("Error in main loop:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, CONFIG.checkInterval));
  }
}

main().catch((error) => {
  logger.error("Fatal error occurred:", error);
  process.exit(1);
});
