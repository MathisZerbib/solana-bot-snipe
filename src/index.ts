

import { getLatestTokens } from "./services/solanaService";
import { snipe } from "./handlers/snipeHandler";
import { CONFIG } from "./config/config";
import { Token } from "./types/token";
import { logger } from "./logger/logger";
import { initDb, loadSkippedTokensDb, addSkippedTokenDb } from "./utils/db.js";
import { startApiServer } from "./api/server.js";

const maxTokenAge = CONFIG.maxTokenAge || 1 * 60 * 1000; // Default to 1 minute
let hasSnipedSuccessfully = false;

async function main(): Promise<void> {
  const startDate = new Date();
  logger.info("Sniper bot started", { startDate });

  // Boot GUI Configuration API Endpoint Handler Space
  startApiServer(3001);

  await initDb();
  let skippedTokens: Set<string> = await loadSkippedTokensDb();
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
              await addSkippedTokenDb(tokenAddress);
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
