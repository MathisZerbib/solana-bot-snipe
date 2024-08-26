import { logger } from "../logger/logger.js";
import chalk from "chalk";
import { snipe } from "./tradeHandler.js";

export async function snipeToken(tokenAddress, tokenName) {
  logger.info(`Initiating snipe for token: ${tokenName} (${tokenAddress})`);
  console.log(
    chalk.green(`Initiating snipe for token: ${tokenName} (${tokenAddress})`)
  );

  const result = await snipe(tokenAddress, tokenName);

  if (result) {
    logger.info(`Snipe successful for token: ${tokenName} (${tokenAddress})`);
    console.log(
      chalk.green(`Snipe successful for token: ${tokenName} (${tokenAddress})`)
    );
  } else {
    logger.error(`Snipe failed for token: ${tokenName} (${tokenAddress})`);
    console.error(
      chalk.red(`Snipe failed for token: ${tokenName} (${tokenAddress})`)
    );
  }
}
