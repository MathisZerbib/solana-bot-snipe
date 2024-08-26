import { logger } from "./src/logger/logger.js";
import { getLatestTokens } from "./src/services/solanaService.js";
import { snipe } from "./src/handlers/tradeHandler.js";
import { CONFIG } from "./src/config/config.js";
import fs from "fs";
import { getLiquidityAndRisk } from "./src/utils/tokenUtils.js";

const SKIPPED_TOKENS_FILE = "./skipped-tokens.json";
const maxTokenAge = CONFIG.maxTokenAge || 1 * 60 * 1000; // Default to 1 minute
let hasSnipedSuccessfully = false;

function loadSkippedTokens() {
  if (fs.existsSync(SKIPPED_TOKENS_FILE)) {
    const data = fs.readFileSync(SKIPPED_TOKENS_FILE, "utf-8");
    return new Set(JSON.parse(data));
  }
  return new Set();
}

function saveSkippedTokens(skippedTokens) {
  fs.writeFileSync(
    SKIPPED_TOKENS_FILE,
    JSON.stringify(Array.from(skippedTokens)),
    "utf-8"
  );
}

function addTokenToSkipped(tokenAddress, skippedTokens) {
  skippedTokens.add(tokenAddress);
  saveSkippedTokens(skippedTokens);
}

function isTokenOld(token) {
  return (
    new Date().getTime() - new Date(token.createdAt).getTime() > maxTokenAge
  );
}

async function checkTokenSafety(token) {
  const {
    liquidity,
    priceUsd,
    priceNative,
    lockedLiquidity,
    pairAddress,
    highRisk,
  } = await getLiquidityAndRisk(token);

  if (liquidity < CONFIG.minLiquidity) {
    logger.info(
      `Skipping token ${token.name} due to insufficient liquidity: $${liquidity}`
    );
    return false;
  }

  console.log(
    `Liquidity: $${liquidity}, Price: $${priceUsd}, Locked Liquidity: ${lockedLiquidity}`,
    { pairAddress },
    { highRisk },
    { priceNative },
    { token }
  );
  if (highRisk) {
    logger.info(`Skipping token ${token.name}, ${priceUsd} due to high risk.`);
    return false;
  }

  if (liquidity < CONFIG.minLiquidity) {
    logger.info(
      `Skipping token ${token.name} due to insufficient liquidity: $${liquidity}`
    );
    return false;
  }

  return true;
}

async function processToken(token, skippedTokens) {
  if (isTokenOld(token)) {
    addTokenToSkipped(token.address, skippedTokens);
    return false;
  }

  logger.info(
    `Checking liquidity and risk for token: ${token.name} (${token.address})`
  );

  if (!(await checkTokenSafety(token))) {
    addTokenToSkipped(token.address, skippedTokens);
    return false;
  }

  const result = await snipe(token.address, token.name);

  if (!result) {
    addTokenToSkipped(token.address, skippedTokens);
  }

  if (result) {
    hasSnipedSuccessfully = true;
  }

  return result;
}

async function main() {
  const startDate = new Date();
  logger.info("Sniper bot started", { startDate });

  let skippedTokens = loadSkippedTokens();
  let snipedTokens = new Set();

  while (true && !hasSnipedSuccessfully) {
    try {
      if (hasSnipedSuccessfully) {
        logger.info(
          "A successful snipe occurred. Stopping further sniping attempts."
        );
        break;
      }

      const tokens = await getLatestTokens();
      const newTokens = tokens.filter(
        (token) =>
          !snipedTokens.has(token.address) && !skippedTokens.has(token.address)
      );

      if (newTokens.length > 0) {
        logger.info(`Found ${newTokens.length} new tokens`);

        const snipeResults = await Promise.all(
          newTokens
            .slice(0, CONFIG.maxConcurrentSnipes)
            .map((token) => processToken(token, skippedTokens))
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
