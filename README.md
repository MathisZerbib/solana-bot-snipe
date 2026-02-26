# Solana Sniper Bot MVP 💣📈

A full-stack, automated Solana Sniper built rigorously upon Helius RPC integrations, dynamic Jito bundled transactions, and integrated Anti-Rug forensics. It features a complete React single-page dashboard streaming your real-time actions over native WebSockets!

---

## 🚀 Getting Started

Deploying this multi-service bot doesn't require complex compiler chains. We've simplified it perfectly with **Docker Compose**, wrapping both the Backend bot engine and the React UI securely under a bridged local network.

### 1️⃣ Clone and Prepare Env

Clone the code, and clone `.env.example` into `.env`. Open it and populate the variables inside:
```bash
cp .env.example .env
```
Inside `.env` be sure to drop in your private-secrets:
* `PRIVATE_KEY`: An array-string of your base58 Wallet Private Key. Provide a fresh burner wallet.
* `RPC_URL` & `WS_URL`: Helius or native endpoints supporting your network (e.g., `https://mainnet.helius-rpc.com/?api-key=...`)
* `PAPER_TRADE_MODE`: Defaults to `"true"`, which ensures the engine performs simulation scans and simulated paper sells before committing actual solana.
* `VITE_API_URL`: Leave at `http://localhost:3001` if deploying locally on your desktop.

*(Note: To integrate Bubblemaps forensic scanning for high-confidence honeypot avoidance, include `INSIGHTX_API_KEY=your_key`)*

### 2️⃣ One-Click Docker Startup 🐳

You just need Docker engine installed. Run our one-click startup macro:

```bash
docker-compose up --build -d
```
Docker will now compile Native C++ C-bindings, build out your Node-GYP packages safely isolated from your Mac, generate the minified React frontend, and spin up the SQLite execution tracking database gracefully.

### 3️⃣ View The Control Dashboard 🖥️
Once Docker echoes that `solana_bot_engine` and `solana_bot_ui` are booted, open up your browser!

👉 **[http://localhost:8080](http://localhost:8080)**

1. Authorize natively with your Phantom wallet browser extension. 
2. Adjust your system settings (You'll see PAPER vs LIVE modes mapped directly to your `.env`)
3. Initiate the Sniper Engine stream.
4. Enjoy real-time token forensic metrics, live WebSockets log tracking, and instant Explorer deep-linking via Solscan and Pump.fun DB rows!

### Need to restart/clean?
```bash
docker-compose down
```

---

## 🛡️ Anti-Rug Diagnostics Core
The engine intercepts Solana Mint Accounts and natively enforces:
- **Zero Mint Authority**: Blocks tokens where dev can infinitely mint tokens down the road.
- **Zero Freeze Authority**: Blocks maliciously honeypotted targets looking to pause sales.
- **Metadata Mutability Check**: Audits whether devs can pull the bait-and-switch rug.
- *(Optional)* **Bubblemaps / InsightX Metrics**: Mitigates risk using global token scoring and sybil distribution traces leveraging InsightX endpoints statically mapped.
