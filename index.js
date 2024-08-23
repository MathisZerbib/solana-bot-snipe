import { logger } from "./src/logger/logger.js";
import { getLatestTokens } from "./src/services/solanaService.js";
import { snipe } from "./src/handlers/snipeHandler.js";
import { CONFIG } from "./src/config/config.js";
import fs from "fs";

const SKIPPED_TOKENS_FILE = "./skipped-tokens.json";

// Load skipped tokens from file
function loadSkippedTokens() {
  if (fs.existsSync(SKIPPED_TOKENS_FILE)) {
    const data = fs.readFileSync(SKIPPED_TOKENS_FILE, "utf-8");
    return new Set(JSON.parse(data));
  }
  return new Set();
}

// Save skipped tokens to file
function saveSkippedTokens(skippedTokens) {
  fs.writeFileSync(
    SKIPPED_TOKENS_FILE,
    JSON.stringify(Array.from(skippedTokens)),
    "utf-8"
  );
}

async function main() {
  const startDate = new Date();
  logger.info("Sniper bot started", { startDate });

  // Initialize skipped tokens set
  let skippedTokens = loadSkippedTokens();
  let snipedTokens = new Set();

  while (true) {
    try {
      const tokens = await getLatestTokens();
      const newTokens = tokens.filter(
        (token) =>
          !snipedTokens.has(token.address) && !skippedTokens.has(token.address)
      );

      if (newTokens.length > 0) {
        logger.info(`Found ${newTokens.length} new tokens`);

        const snipeResults = await Promise.all(
          newTokens.slice(0, CONFIG.maxConcurrentSnipes).map(async (token) => {
            const result = await snipe(token.address, token.name);

            // If sniping failed or token was skipped, add to skippedTokens
            if (!result) {
              skippedTokens.add(token.address);
              saveSkippedTokens(skippedTokens);
            }

            return result;
          })
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
