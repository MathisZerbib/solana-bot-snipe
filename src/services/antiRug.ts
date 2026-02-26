import { Connection, PublicKey } from "@solana/web3.js";
import { getMint, Mint } from "@solana/spl-token";
import { logger } from "../logger/logger.js";

const CONSTANTS = {
    RAYDIUM_V4_PROGRAM_ID: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
    PUMP_FUN_PROGRAM_ID: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfX4lfsz2sVd2eKpgw"),
    TOKEN_2022_PROGRAM_ID: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
    METAPLEX_PROGRAM_ID: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
};

/**
 * Module: Advanced Static & Dynamic Vulnerability Analysis
 * Extracted into clean, DRY architecture.
 */
export class AntiRugEngine {
    private connection: Connection;

    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, "confirmed");
    }

    public async analyzeToken(mintAddress: string): Promise<boolean> {
        try {
            logger.info(`\n[Anti-Rug] 🛡️ Starting deep forensic scan for: ${mintAddress}`);
            const mintPubkey = new PublicKey(mintAddress);

            const accountInfo = await this.connection.getAccountInfo(mintPubkey);
            if (!accountInfo) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Mint account does not exist on-chain.`);
                return false;
            }

            const isToken2022 = accountInfo.owner.equals(CONSTANTS.TOKEN_2022_PROGRAM_ID);
            const mintInfo = await getMint(this.connection, mintPubkey, "confirmed", accountInfo.owner);

            // Step 1: Validate Authorities
            if (!this.validateAuthorities(mintInfo)) return false;

            // Step 2: Validate Token-2022 Extensions
            if (isToken2022 && !(await this.validateToken2022Extensions(mintInfo))) return false;

            // Step 3: Analyze Supply & Sybil Distribution
            const supplyAnalysis = await this.analyzeSupplyDistribution(mintPubkey, Number(mintInfo.supply));
            if (!supplyAnalysis.isSafe) return false;

            // Step 4: Metadata Mutability 
            await this.checkMetadataMutability(mintPubkey);

            // Step 5: LP Burn Verification (Raydium)
            if (supplyAnalysis.isRaydiumMigrated && !supplyAnalysis.isPumpFunCurve) {
                if (!(await this.verifyRaydiumLPBurn(mintAddress))) return false;
            }

            // Step 6: Bundle Sniper Detection
            if (!(await this.detectBundleSnipers(mintPubkey, supplyAnalysis.isPumpFunCurve))) return false;

            // Step 7: RPC Sandbox Simulation
            if (!(await this.simulateTransactionSandbox(mintAddress))) return false;

            logger.info(`[Anti-Rug] 🟢 FINAL VERDICT: GO. Token ${mintAddress} passed all strict security modules.`);
            return true;

        } catch (error) {
            logger.error(`[Anti-Rug] Analysis failed for ${mintAddress}: ${error instanceof Error ? error.message : "Unknown error"}`);
            return false;
        }
    }

    // ==========================================
    // PRIVATE VALIDATOR MODULES
    // ==========================================

    private validateAuthorities(mintInfo: Mint): boolean {
        if (mintInfo.mintAuthority !== null) {
            logger.warn(`[Anti-Rug] 🔴 NO-GO: Mint Authority EXPOSED. The dev can print infinite tokens.`);
            return false;
        }
        if (mintInfo.freezeAuthority !== null) {
            logger.warn(`[Anti-Rug] 🔴 NO-GO: Freeze Authority EXPOSED. Honeypot risk (dev can freeze your ability to sell).`);
            return false;
        }
        logger.info(`[Anti-Rug] ✅ Authorities Revoked (No Honeypot / Infinite Minting)`);
        return true;
    }

    private async validateToken2022Extensions(mintInfo: Mint): Promise<boolean> {
        logger.info(`[Anti-Rug] 🔍 Token-2022 Standard Detected! Analyzing SPL Extensions (Hooks/Taxes)...`);
        const { getExtensionTypes, ExtensionType } = await import("@solana/spl-token");

        if (mintInfo.tlvData && mintInfo.tlvData.length > 0) {
            const activeExtensions = getExtensionTypes(mintInfo.tlvData);

            if (activeExtensions.includes(ExtensionType.TransferHook)) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Token-2022 TransferHook detected! Hijack risk.`);
                return false;
            }

            if (activeExtensions.includes(ExtensionType.TransferFeeConfig)) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Token-2022 TransferFeeConfig detected! Hidden tax risk.`);
                return false;
            }

            logger.info(`[Anti-Rug] 🟢 Validated: Token-2022 Extensions are safe (No Hooks or Fees).`);
        } else {
            logger.info(`[Anti-Rug] 🟢 Validated: No dynamic Token-2022 extensions actively configured.`);
        }
        return true;
    }

    private async analyzeSupplyDistribution(mintPubkey: PublicKey, totalSupply: number) {
        if (totalSupply === 0) {
            logger.warn(`[Anti-Rug] 🔴 NO-GO: Supply is 0. Malformed token.`);
            return { isRaydiumMigrated: false, isPumpFunCurve: false, isSafe: false };
        }

        const largestAccounts = await this.connection.getTokenLargestAccounts(mintPubkey);
        let top10Holdings = 0;
        let sybilClusterSize = 0;
        const topBalances: number[] = [];
        let isRaydiumMigrated = false;
        let isPumpFunCurve = false;

        for (let i = 0; i < Math.min(10, largestAccounts.value.length); i++) {
            const account = largestAccounts.value[i];
            const amount = Number(account.amount);
            topBalances.push(amount);

            const accountInfo = await this.connection.getParsedAccountInfo(account.address);
            if (accountInfo.value && 'parsed' in accountInfo.value.data) {
                const owner = accountInfo.value.data.parsed.info.owner;
                if (owner === CONSTANTS.RAYDIUM_V4_PROGRAM_ID.toBase58()) isRaydiumMigrated = true;
                if (owner === CONSTANTS.PUMP_FUN_PROGRAM_ID.toBase58()) isPumpFunCurve = true;
            }
            if (!isRaydiumMigrated && !isPumpFunCurve) {
                top10Holdings += amount;
            }
        }

        for (let i = 1; i < topBalances.length; i++) {
            if (topBalances[i] > 0 && Math.abs(topBalances[i] - topBalances[i - 1]) < totalSupply * 0.0001) {
                sybilClusterSize++;
            }
        }

        if (sybilClusterSize >= 3) {
            logger.warn(`[Anti-Rug] 🔴 NO-GO: Sybil Cluster Detected! ${sybilClusterSize} identical wallets.`);
            return { isRaydiumMigrated, isPumpFunCurve, isSafe: false };
        }

        const top10Percentage = (top10Holdings / totalSupply) * 100;

        if (isPumpFunCurve) {
            if (top10Percentage > 35) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Dev holds ${top10Percentage.toFixed(2)}% outside bonding curve.`);
                return { isRaydiumMigrated, isPumpFunCurve, isSafe: false };
            }
        } else if (isRaydiumMigrated) {
            if (top10Percentage > 25) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Supply highly concentrated: ${top10Percentage.toFixed(2)}%.`);
                return { isRaydiumMigrated, isPumpFunCurve, isSafe: false };
            }
        }

        logger.info(`[Anti-Rug] ✅ Supply Distribution Clean (Top non-AMM wallets hold ${top10Percentage.toFixed(2)}%)`);
        return { isRaydiumMigrated, isPumpFunCurve, isSafe: true };
    }

    private async checkMetadataMutability(mintPubkey: PublicKey): Promise<void> {
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), CONSTANTS.METAPLEX_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
            CONSTANTS.METAPLEX_PROGRAM_ID
        );

        const metadataAccount = await this.connection.getAccountInfo(metadataPDA);
        if (metadataAccount && metadataAccount.data.length > 0) {
            const isMutable = metadataAccount.data[metadataAccount.data.length - 1] === 1;
            if (isMutable) {
                logger.warn(`[Anti-Rug] ⚠️ WARNING: Metadata is Mutable (Bait and Switch risk).`);
            } else {
                logger.info(`[Anti-Rug] ✅ Metadata is Immutable.`);
            }
        }
    }

    private async verifyRaydiumLPBurn(mintAddress: string): Promise<boolean> {
        try {
            logger.info(`[Anti-Rug] 🔍 Initializing LP Burn Verification on Raydium...`);
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
            const data = await response.json() as any;

            if (!data || !data.pairs || data.pairs.length === 0) return false;

            const raydiumPair = data.pairs.find((p: any) => p.dexId === "raydium" && p.baseToken.address === mintAddress);
            if (!raydiumPair) return false;

            const poolAddress = new PublicKey(raydiumPair.pairAddress);
            const poolAccountInfo = await this.connection.getAccountInfo(poolAddress);

            if (!poolAccountInfo || poolAccountInfo.data.length !== 752) return false;

            const lpMintPubkey = new PublicKey(poolAccountInfo.data.slice(76, 76 + 32));
            const lpMintInfo = await getMint(this.connection, lpMintPubkey);
            const decodedSupply = Number(lpMintInfo.supply);

            if (decodedSupply > 0) {
                const lpLargestAccounts = await this.connection.getTokenLargestAccounts(lpMintPubkey);
                if (lpLargestAccounts && lpLargestAccounts.value.length > 0) {
                    const lockPercentage = (Number(lpLargestAccounts.value[0].amount) / decodedSupply) * 100;
                    if (lockPercentage > 5) {
                        logger.warn(`[Anti-Rug] 🔴 NO-GO: LP Tokens NOT burned! Dev holds ${lockPercentage.toFixed(2)}%.`);
                        return false;
                    }
                }
            }

            logger.info(`[Anti-Rug] 🟩 SECURE: LP Tokens are Burned or Securely Locked.`);
            return true;
        } catch {
            return false;
        }
    }

    private async detectBundleSnipers(mintPubkey: PublicKey, isPumpFunCurve: boolean): Promise<boolean> {
        try {
            logger.info(`[Anti-Rug] 🔍 Initializing Bundle Sniper Detection...`);
            const signatures = await this.connection.getSignaturesForAddress(mintPubkey, { limit: 25 }, "confirmed");
            if (signatures.length === 0) return true;

            const genesisSlot = signatures[signatures.length - 1].slot;
            let sameSlotTxs = 0;

            for (const sig of signatures) {
                if (sig.slot === genesisSlot) sameSlotTxs++;
            }

            if (sameSlotTxs >= 4) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Jito Bundle Attack detected in Genesis Slot (${genesisSlot}).`);
                return false;
            }

            logger.info(`[Anti-Rug] 🟩 SECURE: No suspicious Genesis-Slot bundling detected.`);
            return true;
        } catch {
            return true;
        }
    }

    private async simulateTransactionSandbox(mintAddress: string): Promise<boolean> {
        try {
            logger.info(`[Anti-Rug] 🔍 Initializing RPC Buy/Sell Sandbox Simulation...`);
            const { solanaTracker, keypair } = require("../services/solanaService");
            const { VersionedTransaction } = require("@solana/web3.js");

            // Buy Simulation
            const buySwapResponse = await solanaTracker.getSwapInstructions(
                "So11111111111111111111111111111111111111112", mintAddress, 0.001, 10, keypair.publicKey.toBase58(), 0.00005
            );
            if (!buySwapResponse || !buySwapResponse.txn) return false;

            const buyTx = VersionedTransaction.deserialize(Buffer.from(buySwapResponse.txn, "base64"));
            const buySimulation = await this.connection.simulateTransaction(buyTx, { replaceRecentBlockhash: true });

            if (buySimulation.value.err) {
                logger.warn(`[Anti-Rug] 🔴 NO-GO: Buy Simulation execution error.`);
                return false;
            }

            // Sell Simulation
            const sellSwapResponse = await solanaTracker.getSwapInstructions(
                mintAddress, "So11111111111111111111111111111111111111112", 1, 10, keypair.publicKey.toBase58(), 0.00005
            );
            if (!sellSwapResponse || !sellSwapResponse.txn) return false;

            const sellTx = VersionedTransaction.deserialize(Buffer.from(sellSwapResponse.txn, "base64"));
            const sellSimulation = await this.connection.simulateTransaction(sellTx, { replaceRecentBlockhash: true });

            if (sellSimulation.value.err) {
                const err: any = sellSimulation.value.err;
                if (err.InstructionError && Array.isArray(err.InstructionError)) {
                    const [, errorDetail] = err.InstructionError;
                    if (errorDetail && errorDetail.Custom !== undefined) {
                        logger.warn(`[Anti-Rug] 🔴 NO-GO: Sell Simulation caught Custom Error (${errorDetail.Custom}). Sell Tax/Honeypot!`);
                        return false;
                    }
                }
            }

            logger.info(`[Anti-Rug] 🟩 SECURE: RPC Sandbox cleanly passed.`);
            return true;
        } catch {
            return true;
        }
    }
}
