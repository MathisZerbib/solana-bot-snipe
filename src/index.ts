

import { getLatestTokens } from "./services/solanaService";
import { snipe } from "./handlers/snipeHandler";
import { CONFIG } from "./config/config";
import fs from "fs";
import { Token } from "./types/token";
import { logger } from "./logger/logger";

const SKIPPED_TOKENS_FILE = "./skipped-tokens.json";
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

async function main(): Promise<void> {
  const startDate = new Date();
  logger.info("Sniper bot started", { startDate });

  // Initialize skipped tokens set
  let skippedTokens: Set<string> = loadSkippedTokens();
  let snipedTokens: Set<string> = new Set();

  while (true && !hasSnipedSuccessfully) {
    try {
      if (hasSnipedSuccessfully) {
        logger.info(
          "A successful snipe occurred. Stopping further sniping attempts."
        );
        break;
      }

      const tokens: Token[] = await getLatestTokens();
      const newTokens = tokens.filter(
        (token) =>
          !snipedTokens.has(token.address) &&
          !skippedTokens.has(token.address)
      );

      if (newTokens.length > 0) {
        logger.info(`Found ${newTokens.length} new tokens`);

        const snipeResults = await Promise.all(
          newTokens.slice(0, CONFIG.maxConcurrentSnipes).map(async (token) => {
            const tokenAddress = token.address;
            const result = await snipe(token);

            // If sniping failed or token was skipped, add to skippedTokens
            if (!result) {
              skippedTokens.add(tokenAddress);
              saveSkippedTokens(skippedTokens);
            }

            // If a successful snipe occurred, set the flag and stop further sniping
            if (result) {
              hasSnipedSuccessfully = true;
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
