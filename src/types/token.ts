// src/types/token.ts
export type TokenName = string;
export type TokenAddress = string;

export interface Token {
    name: TokenName;
    address: TokenAddress;
}

// src/types/config.ts
export interface Config {
    riskScore: number;
    minLiquidity: number;
    maxConcurrentSnipes: number;
    checkInterval: number;
    amountToSwap: number;
    slippage: number;
    priorityFee: number;
    takeProfitPercentage: number;
    stopLossPercentage: number;
    priceCheckInterval: number;
    logFile: string;
}

// src/types/api-responses.ts
export interface CoinGeckoResponse {
    solana: {
        usd: number;
    };
}

export interface DexScreenerPair {
    liquidity?: {
        usd: number;
    };
    priceUsd?: string;
    priceNative?: string;
    pairAddress: string;
}

export interface DexScreenerResponse {
    pairs?: DexScreenerPair[];
}

export interface RiskScoreResponse {
    score?: number;
}

// src/types/dex-screener.ts
export interface DexScreenerData {
    liquidity: number;
    priceUsd: number;
    priceNative: number;
    lockedLiquidity: boolean;
    pairAddress: string;
}

// src/types/liquidity-risk.ts
export interface LiquidityAndRiskResult {
    liquidity: number;
    priceUsd?: number;
    priceNative?: number;
    lockedLiquidity?: boolean;
    pairAddress?: string;
    highRisk: boolean;
}

// src/types/solana-tracker.ts
export interface SwapInstructions {
    // Define the structure of swap instructions here
    // This will depend on what solanaTracker.getSwapInstructions returns
}

// src/types/monitor-result.ts
export type MonitorResult = "Take Profit" | "Stop Loss" | "Partial Sell";

// src/types/sell-strategy.ts
export interface SellStrategy {
    initialSellPercentage: number;
    subsequentSellPercentages: number[];
    priceIncrementTriggers: number[];
}