const { Connection, PublicKey } = require("@solana/web3.js");
const { getMint, getExtensionTypes } = require("@solana/spl-token");

async function main() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    // Token-2022 test token if any exists, but we can just check if getMint extracts tlvData on a standard token. 
    // USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    const token = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const mintInfo = await getMint(conn, token);
    console.log("tlvData length:", mintInfo.tlvData ? mintInfo.tlvData.length : "undefined");
}
main().catch(console.error);
