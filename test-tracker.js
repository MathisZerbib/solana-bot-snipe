const { SolanaTracker } = require("solana-swap");
const { Keypair } = require("@solana/web3.js");

async function main() {
    const keypair = Keypair.generate();
    const tracker = new SolanaTracker(keypair, "https://api.mainnet-beta.solana.com");
    try {
        const ins = await tracker.getSwapInstructions(
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            0.001,
            1,
            keypair.publicKey.toBase58(),
            0.00005
        );
        console.log(Object.keys(ins));
    } catch(e) {
        console.error(e);
    }
}
main();
