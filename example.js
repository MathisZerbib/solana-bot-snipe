import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { SolanaTracker } from "solana-swap";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const CONFIG = {
  amountToSwap: 0.1,
  slippage: 30,
  priorityFee: 0.00005,
};

const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY)
);

const solanaTracker = new SolanaTracker(
  keypair,
  "https://api.solanatracker.io/rpc"
);

async function getLatestTokens() {
  const response = await fetch("https://api.solanatracker.io/tokens/latest");
  const tokens = await response.json();
  //   console.log("Tokens:", tokens);
  return tokens;
}

async function snipe(tokenAddress) {
  console.log("Sniping token:", tokenAddress);
  const swapResponse = await solanaTracker.getSwapInstructions(
    "So11111111111111111111111111111111111111112", // From Token (SOL)
    tokenAddress, // To Token (new token address)
    CONFIG.amountToSwap,
    CONFIG.slippage,
    keypair.publicKey.toBase58(), // Payer public key
    CONFIG.priorityFee
  );

  const txid = await solanaTracker.performSwap(swapResponse);
  console.log("Transaction ID:", txid);
  console.log("Transaction URL:", `https://explorer.solana.com/tx/${txid}`);
}

async function main() {
  const startDate = new Date();

  while (true) {
    const tokens = await getLatestTokens();

    for (const token of tokens) {
      const createdAt = new Date(token.createdAt);

      if (createdAt > startDate) {
        console.log("New token found:", token.name);
        await snipe(token.address);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
