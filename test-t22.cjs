const { Connection, PublicKey } = require("@solana/web3.js");
const { getMint } = require("@solana/spl-token");

async function main() {
    const conn = new Connection("https://api.mainnet-beta.solana.com");
    const token = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const mintInfo = await getMint(conn, token);
    console.log("tlvData length:", mintInfo.tlvData ? mintInfo.tlvData.length : "undefined");
}
main().catch(console.error);
