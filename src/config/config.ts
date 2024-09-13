import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import { SolanaTracker } from "solana-swap";

dotenv.config();

const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);



export const CONFIG: {
  errorRetryInterval: number,
  amountToSwap: number,
  amountToSell: number,
  slippage: number,
  priorityFee: number,
  maxConcurrentSnipes: number,
  maxTokenAge: number,
  checkInterval: number,
  riskScore: number,
  rpcUrl: string,
  poolFilePath: string,
  minBurntPercentage: number,
  logFile: string,
  successfulSnipesFile: string,
  minLiquidity: number,
  reinvestPercentage: number,
  takeProfitPercentage: number,
  stopLossPercentage: number,
  breakEvenPercentage: number,
  priceCheckInterval: number,
  keypair: Keypair,
  alchemyApiKey: string,
  alchemyNetwork: 'mainnet-beta' | 'devnet' | 'testnet',
} = {
  errorRetryInterval: 30000, // 30 seconds
  keypair: keypair,
  amountToSwap: 0.019,
  amountToSell: 0.019,
  slippage: 30,
  priorityFee: 0.00007,
  maxConcurrentSnipes: 2,
  maxTokenAge: 60000, // 1 minute
  checkInterval: 5000, // 5 seconds
  riskScore: 9000,
  alchemyApiKey: process.env.ALCHEMY_API_KEY || 'your-alchemy-api-key',
  alchemyNetwork: 'mainnet-beta' as 'mainnet-beta' | 'devnet' | 'testnet',
  rpcUrl: process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
  poolFilePath: process.env.POOL_FILE_PATH || "pools.json",
  minBurntPercentage: 95, // Minimum percentage of burnt tokens to consider liquidity locked
  logFile: "sniper-bot-liquidity.log",
  successfulSnipesFile: "successful-snipes-liquidity.json",
  minLiquidity: 10000, // Minimum liquidity in USD
  reinvestPercentage: 0.2, // 40% of profits for reinvestment
  takeProfitPercentage: 1.2, // Example TP: 20%
  stopLossPercentage: 0.2, // Example SL: 20%
  breakEvenPercentage: 0.4, // Move SL to BE at 40% gain
  priceCheckInterval: 10000, // 10 seconds for price monitoring
};
