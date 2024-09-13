import { Connection, PublicKey } from "@solana/web3.js";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import { logger } from "../logger/logger.js";
import { CONFIG } from "../config/config.js";
import axios from "axios";
import chalk from "chalk";

const DEX_SCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const RUGCHECK_URL = "https://api.rugcheck.xyz/v1/tokens/";
const MAX_RISK_SCORE = CONFIG.riskScore;
const MIN_LIQUIDITY = CONFIG.minLiquidity;

interface RiskScoreResponse {
  score?: number;
}

interface DexScreenerPair {
  liquidity?: {
    usd: number,
  };
  priceUsd?: string;
  priceNative?: string;
  pairAddress: string;
  pairCreatedAt: number;
  volume: number;
  priceChange: number;
  fdv: number;
  marketCap: number;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

interface DexScreenerData {
  liquidity: number;
  priceUsd: number;
  priceNative: number;
  pairAddress: string;
  volume: number;
  marketCap: number;
  pairCreatedAt: number;
  fdv: number;
  priceChange: number;
}

interface LiquidityAndRiskResult {
  liquidity: number;
  priceUsd?: number;
  priceNative?: number;
  lockedLiquidity?: boolean;
  pairAddress?: string;
  highRisk: boolean;
  marketCap?: number;
  volume?: number;
  priceChange?: number;
  fdv?: number;
  pairCreatedAt?: number;
  estimatedBurnPercentage?: number;
}

async function getRiskScore(tokenAddress: string): Promise<number> {
  try {
    const response = await axios.get(`${RUGCHECK_URL}${tokenAddress}/report/summary`);
    const score = response.data.score || 0;
    // console.log(chalk.green(`Risk score for token ${tokenAddress}: ${score}`));
    return score;
  } catch (error) {
    console.error(chalk.red(`Error fetching risk score for token ${tokenAddress}:`), error);
    return 0;
  }
}

async function getDexScreenerData(tokenAddress: string): Promise<DexScreenerData | null> {
  try {
    const response = await axios.get(`${DEX_SCREENER_API_URL}${tokenAddress}`);
    const data: DexScreenerResponse = response.data;

    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const dexData = {
        liquidity: pair.liquidity?.usd || 0,
        priceUsd: parseFloat(pair.priceUsd || "0"),
        priceNative: parseFloat(pair.priceNative || "0"),
        pairAddress: pair.pairAddress,
        volume: pair.volume,
        priceChange: pair.priceChange,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairCreatedAt: pair.pairCreatedAt,
      };
      // console.log(chalk.cyan(`DEX Screener data for token ${tokenAddress}:`), JSON.stringify(dexData, null, 2));
      return dexData;
    } else {
      // console.warn(chalk.yellow(`No pairs found for token ${tokenAddress}`));
      return null;
    }
  } catch (error) {
    console.error(chalk.red(`Error fetching data from DEX Screener for token ${tokenAddress}:`), error);
    return null;
  }
}
async function checkLiquidityLock(pairAddress: string, connection: Connection, tokenAddress: string): Promise<boolean | null> {
  try {
    const pairPublicKey = new PublicKey(pairAddress);
    const tokenPublicKey = new PublicKey(tokenAddress);

    // Fetch the liquidity pool data
    let attempts = 0;
    let liquidityPoolData;
    while (!liquidityPoolData && attempts < 3) {
      liquidityPoolData = await connection.getAccountInfo(pairPublicKey);
      attempts++;
      if (!liquidityPoolData) {
        console.warn(chalk.yellow(`Attempt ${attempts}: No valid liquidity pool data found for pair ${pairAddress}. Retrying...`));
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retrying
      }
    }

    if (!liquidityPoolData || !liquidityPoolData.data) {
      console.warn(chalk.yellow(`No valid liquidity pool data found for pair ${pairAddress}`));
      return null;
    }

    // Decode the liquidity pool data using Raydium's layout
    try {
      const decodedData = LIQUIDITY_STATE_LAYOUT_V4.decode(liquidityPoolData.data);

      // Check if the token address matches one of the tokens in the pool
      const tokenIndex = decodedData.baseMint.equals(tokenPublicKey)
        ? 0
        : decodedData.quoteMint.equals(tokenPublicKey)
          ? 1
          : null;

      if (tokenIndex === null) {

        console.warn(chalk.yellow(`Token ${tokenAddress} not found in liquidity pool ${pairAddress}`));
        return null;
      }

      // Calculate the total supply of the token in the pool
      const totalSupply = decodedData.lpReserve[tokenIndex];

      // Fetch the token account info for the pair
      let tokenAccountInfo;
      attempts = 0;
      while (!tokenAccountInfo && attempts < 3) {
        tokenAccountInfo = await connection.getAccountInfo(decodedData.lpReserve[tokenIndex]);
        attempts++;
        if (!tokenAccountInfo) {
          console.warn(chalk.yellow(`Attempt ${attempts}: No valid token account info found for token ${tokenAddress} in pair ${pairAddress}. Retrying...`));
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retrying
        }
      }

      if (!tokenAccountInfo || !tokenAccountInfo.data) {
        console.warn(chalk.yellow(`No valid token account info found for token ${tokenAddress} in pair ${pairAddress}`));
        return null;
      }

      // Decode the token account data
      const decodedTokenAccount = LIQUIDITY_STATE_LAYOUT_V4.decode(tokenAccountInfo.data);

      // Calculate the liquidity locked percentage
      const liquidityLockedPercentage = (parseInt(decodedTokenAccount.lpMint.toString()) / totalSupply.toNumber()) * 100;

      console.log(chalk.green(`Liquidity lock status for pair ${pairAddress}: ${liquidityLockedPercentage.toFixed(2)}%`));

      // Determine if liquidity is considered locked based on a threshold
      const IS_LIQUIDITY_LOCKED_THRESHOLD = 90; // Adjust this value as needed
      return liquidityLockedPercentage > IS_LIQUIDITY_LOCKED_THRESHOLD;
    } catch (decodeError) {
      console.warn(chalk.yellow(`Failed to decode liquidity pool data for pair ${pairAddress}: ${(decodeError as Error).toString()}`));
      return null;
    }
  } catch (error) {
    console.error(chalk.red(`Error checking liquidity lock for pair ${pairAddress}:`), error);
    return null;
  }
}



export async function getLiquidityAndRisk(tokenAddress: string): Promise<LiquidityAndRiskResult | null> {
  try {
    const connection = new Connection(CONFIG.rpcUrl, "confirmed");
    const dexData = await getDexScreenerData(tokenAddress);

    if (!dexData) {
      console.warn(chalk.yellow(`No DEX Screener data found for token ${tokenAddress}`));
      return null;
    }

    let date = new Date(dexData.pairCreatedAt);
    if (CONFIG.maxTokenAge && (new Date().getTime() - date.getTime()) > CONFIG.maxTokenAge) {
      console.warn(chalk.yellow(`Token ${tokenAddress} exceeds maximum age`));
      return { liquidity: 0, highRisk: true };
    }

    const riskScore = await getRiskScore(tokenAddress);
    const isLiquidityLocked = await checkLiquidityLock(dexData.pairAddress, connection, tokenAddress);

    const result: LiquidityAndRiskResult = {
      liquidity: dexData.liquidity,
      priceUsd: dexData.priceUsd,
      priceNative: dexData.priceNative,
      lockedLiquidity: isLiquidityLocked || false,
      pairAddress: dexData.pairAddress,
      highRisk: riskScore > MAX_RISK_SCORE || dexData.liquidity < MIN_LIQUIDITY,
      marketCap: dexData.marketCap,
      volume: dexData.volume,
      priceChange: dexData.priceChange,
      fdv: dexData.fdv,
      pairCreatedAt: dexData.pairCreatedAt,
    };

    if (result.highRisk) {
      // console.warn(chalk.yellow(`Token ${tokenAddress} is considered high risk. Risk score: ${riskScore}, Liquidity: $${dexData.liquidity}`));
    }

    // console.log(chalk.green(`Liquidity and risk assessment completed for token ${tokenAddress}:`), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(chalk.red(`Error getting liquidity, price, or risk for token ${tokenAddress}:`), error);
    return { liquidity: 0, highRisk: true };
  }
}