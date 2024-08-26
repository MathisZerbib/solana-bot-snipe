export const CONFIG = {
  amountToSwap: 0.03,
  slippage: 30,
  priorityFee: 0.00005,
  maxConcurrentSnipes: 2,
  // make sure to set the maxTokenAge to a value that is greater than the time it takes to snipe a token
  maxTokenAge: 300000, // 5 minutes
  checkInterval: 2000, // 2 seconds
  riskScore: 9000,
  logFile: "sniper-bot-liquidity.log",
  successfulSnipesFile: "successful-snipes-liquidity.json",
  baseTakeProfitPercentage: 2.0, // 2%
  minLiquidity: 10000, // Minimum liquidity in USD
  reinvestPercentage: 0.4, // 40% of profits for reinvestment
  takeProfitPercentage: 2.0, // Example TP: 200%
  breakEvenPercentage: 0.4, // Move SL to BE at 40% gain
  priceCheckInterval: 2000, // 2 seconds for price monitoring
};
