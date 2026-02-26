import dotenv from "dotenv";
dotenv.config();

export const CONFIG: {
  [x: string]: string | number | boolean;
  amountToSwap: number,
  amountToSell: number,
  slippage: number,
  priorityFee: number,
  maxConcurrentSnipes: number,
  maxTokenAge: number,
  checkInterval: number,
  riskScore: number,
  logFile: string,
  successfulSnipesFile: string,
  minLiquidity: number,
  reinvestPercentage: number,
  takeProfitPercentage: number,
  stopLossPercentage: number,
  breakEvenPercentage: number,
  priceCheckInterval: number,
  paperTrade: boolean,
} = {
  // Config Strategy Mode
  paperTrade: process.env.PAPER_TRADE_MODE !== "false", // Default to true (paper trading) unless strictly false
  // Sniping Limits (Tier-1 Optimizations)
  amountToSwap: 0.1,   // Increased to 0.1 SOL for a realistic snipe
  amountToSell: 0.1,
  slippage: 5,         // Tightened to 5% safe slippage because Jito avoids sandwiching
  priorityFee: 0.005,  // Scaled tip for priority Jito MEV inclusion

  // Target Constraints
  maxConcurrentSnipes: 1,      // Focus execution natively on one optimal token at a time
  maxTokenAge: 10 * 60 * 1000, // Limit to tokens under 10 minutes old (was 1 hour)
  checkInterval: 2000,         // Reduced to 2s loop to catch new pairs faster
  riskScore: 9000,

  // Logging & State
  logFile: "sniper-bot-liquidity.log",
  successfulSnipesFile: "successful-snipes-liquidity.json",

  // Liquidity & Risk Management (Strict limits)
  minLiquidity: 15000,         // Minimum pool depth increased to $15k USD
  reinvestPercentage: 0.4,
  takeProfitPercentage: 2.0,   // TP at 200%
  stopLossPercentage: 0.2,     // Tighter Stop Loss cut at 20%
  breakEvenPercentage: 0.3,
  priceCheckInterval: 5000,    // Hardened check intervals to 5 seconds
};
