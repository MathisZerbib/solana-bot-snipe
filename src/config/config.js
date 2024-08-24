export const CONFIG = {
  amountToSwap: 0.019,
  slippage: 30,
  priorityFee: 0.00007,
  maxConcurrentSnipes: 2,
  maxTokenAge: 3600000 * 24, // 24 hours
  checkInterval: 5000, // 5 seconds
  riskScore: 8000,
  logFile: "sniper-bot-liquidity.log",
  successfulSnipesFile: "successful-snipes-liquidity.json",
  minLiquidity: 10000, // Minimum liquidity in USD
  reinvestPercentage: 0.4, // 40% of profits for reinvestment
  takeProfitPercentage: 2.0, // Example TP: 200%
  stopLossPercentage: 0.4, // Example SL: 40%
  breakEvenPercentage: 0.4, // Move SL to BE at 40% gain
  priceCheckInterval: 10000, // 10 seconds for price monitoring
};
