import { getLatestTokens } from "./services/solanaService";
import { CONFIG } from "./config/config";
import { Token } from "./types/token";
import { logger } from "./logger/logger";
import { getLiquidityAndRisk } from "./utils/tokenUtils";
import { buyToken, monitorToken } from "./handlers/tradeHandler";
import { getTokenInfo, convertWSolToUSD } from "./utils/priceUtils";
import fs from "fs";
import path from "path";
import chalk from "chalk";


const __dirname = path.resolve();

const SKIPPED_TOKENS_FILE = path.join(__dirname, "skipped-tokens.json");
const PROCESSED_TOKENS_FILE = path.join(__dirname, "processed-tokens.json");
const maxTokenAge = CONFIG.maxTokenAge || 1 * 60 * 1000; // Default to 1 minute
let hasSnipedSuccessfully = false;

// Load skipped tokens from file
function loadSkippedTokens(): Set<string> {
  if (fs.existsSync(SKIPPED_TOKENS_FILE)) {
    const data = fs.readFileSync(SKIPPED_TOKENS_FILE, "utf-8");
    return new Set(JSON.parse(data));
  }
  return new Set();
}

// Save skipped tokens to file
function saveSkippedTokens(skippedTokens: Set<string>): void {
  fs.writeFileSync(
    SKIPPED_TOKENS_FILE,
    JSON.stringify(Array.from(skippedTokens)),
    "utf-8"
  );
}

// Load processed tokens from file
function loadProcessedTokens(): Set<string> {
  if (fs.existsSync(PROCESSED_TOKENS_FILE)) {
    const data = fs.readFileSync(PROCESSED_TOKENS_FILE, "utf-8");
    return new Set(JSON.parse(data));
  }
  return new Set();
}

// Save processed tokens to file
function saveProcessedTokens(processedTokens: Set<string>): void {
  fs.writeFileSync(
    PROCESSED_TOKENS_FILE,
    JSON.stringify(Array.from(processedTokens)),
    "utf-8"
  );
}

async function processToken(token: Token): Promise<boolean> {
  const { name: tokenName, address: tokenAddress } = token;

  try {
    const result = await getLiquidityAndRisk(tokenAddress);
    if (result !== null) {
      const { liquidity, highRisk, pairAddress, priceUsd, lockedLiquidity, pairCreatedAt } = result;

      if (highRisk || liquidity < CONFIG.minLiquidity && (pairCreatedAt ?? 0) < Date.now() - maxTokenAge) {
        // chalk.yellow(`Token ${tokenName} is considered high risk or has low liquidity. Skipping.`);
        console.warn(chalk.yellow(`Token ${tokenName} is considered high risk or has low liquidity. Skipping.`));
        return false;
      }

      const snipeSuccess = await buyToken(token);
      if (!snipeSuccess) {
        console.warn(chalk.yellow(`Failed to snipe token ${tokenName}. Skipping.`));
        saveSkippedTokens(new Set([tokenAddress]));
        return false;
      }

      const entryPriceInSOL = await getTokenInfo(tokenAddress);
      const entryPriceInUSD = await convertWSolToUSD(entryPriceInSOL);

      logger.info(`Token ${tokenName} bought at: ${entryPriceInUSD} USD for ${CONFIG.amountToSwap} SOL`);

      const monitorResult = await monitorToken(tokenName, tokenAddress, entryPriceInUSD, CONFIG.amountToSwap);

      if (monitorResult === "Take Profit") {
        logger.info(`Successfully monitored ${tokenName}. Adding to processed tokens.`);
        saveProcessedTokens(new Set([tokenAddress]));
      } else if (monitorResult === "Stop Loss") {
        logger.info(`Monitoring stopped for ${tokenName} due to stop loss.`);
      }

      return true;
    } else {
      // logger.warn(`Token ${tokenName} is not eligible for sniping. Skipping.`);
      return false;
    }
  } catch (error) {
    logger.error(`Error processing token ${tokenName}:`, error);
    return false;
  }
}

async function main(): Promise<void> {
  logger.info("Solana Sniper bot started");

  // Initialize sets of skipped and processed tokens
  let skippedTokens: Set<string> = loadSkippedTokens();
  let processedTokens: Set<string> = loadProcessedTokens();

  while (!hasSnipedSuccessfully) {
    try {
      if (hasSnipedSuccessfully) {
        logger.info(
          "A successful snipe occurred. Stopping further sniping attempts."
        );
        break;
      }

      const tokens: Token[] = await getLatestTokens();
      const newTokens = tokens.filter((token) =>
        !processedTokens.has(token.address) &&
        !skippedTokens.has(token.address)
      );

      if (newTokens.length > 0) {
        // logger.info(`Found ${newTokens.length} new tokens`);
        console.warn(chalk.green(`Found ${newTokens.length} new tokens`));
        const snipeResults = await Promise.all(
          newTokens.slice(0, CONFIG.maxConcurrentSnipes).map(async (token) => {
            console.warn(chalk.magenta(`Processing token ${token.name} (${token.address})`));
            const result = await processToken(token);

            if (!result) {
              skippedTokens.add(token.address);
              saveSkippedTokens(skippedTokens);
            }

            if (result) {
              hasSnipedSuccessfully = true;
              console.warn(chalk.green(`Successfully sniped token ${token.name} (${token.address})`));
            }

            return result;
          })
        );

        processedTokens = new Set([
          ...processedTokens,
          ...newTokens.map((token) => token.address),
        ]);

        const successfulSnipes = snipeResults.filter((result) => result).length;
        if (successfulSnipes > 0) {
          saveProcessedTokens(processedTokens);
          logger.info(`Successfully sniped ${successfulSnipes} tokens`);
        }
        if (successfulSnipes === 0) {
          hasSnipedSuccessfully = false;
        }
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
