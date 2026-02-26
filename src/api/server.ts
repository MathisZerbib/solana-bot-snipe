import express from 'express';
import cors from 'cors';
import { CONFIG } from '../config/config.js';
import { logger } from '../logger/logger.js';
import { getSnipedTokensDb } from '../utils/db.js';
import { WebSocketServer } from 'ws';
import http from 'http';

let wss: WebSocketServer | null = null;

// Realtime WebSocket broadaster for system-wide logs
export function broadcastEvent(type: 'LOG' | 'TOKENS' | 'SCAN_METADATA' | 'CONFIG', data: any) {
    if (wss) {
        const payload = JSON.stringify({ type, data });
        wss.clients.forEach(client => {
            if (client.readyState === 1) client.send(payload);
        });
    }
}

export function startApiServer(port: number = 3001) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Fallback REST GET Config
    app.get('/api/config', (req, res) => {
        res.json({
            paperTrade: CONFIG.paperTrade,
            amountToSwap: CONFIG.amountToSwap,
            slippage: CONFIG.slippage,
            priorityFee: CONFIG.priorityFee,
        });
    });

    // Get recently sniped tokens
    app.get('/api/tokens', async (req, res) => {
        try {
            const tokens = await getSnipedTokensDb();
            res.json({ success: true, tokens });
        } catch (error) {
            logger.error('[API] Failed to fetch tokens', error);
            res.status(500).json({ success: false, error: 'Database error fetching tokens' });
        }
    });

    // Fallback REST POST update
    app.post('/api/config', (req, res) => {
        try {
            if (typeof req.body.paperTrade === 'boolean') {
                CONFIG.paperTrade = req.body.paperTrade;
                logger.info(`[API] Updated paperTrade to: ${CONFIG.paperTrade}`);
                broadcastEvent('CONFIG', { paperTrade: CONFIG.paperTrade });
            }
            res.json({ success: true, paperTrade: CONFIG.paperTrade });
        } catch (error) {
            logger.error('[API] Failed to update config', error);
            res.status(500).json({ success: false, error: 'Failed to update config' });
        }
    });

    const server = http.createServer(app);
    wss = new WebSocketServer({ server });

    wss.on('connection', async (ws) => {
        logger.info("[WebSocket] Admin Dashboard Client Connected via WSS.");

        // Immediately sync newest state gracefully upon client connect
        ws.send(JSON.stringify({ type: 'CONFIG', data: { paperTrade: CONFIG.paperTrade } }));

        try {
            const tokens = await getSnipedTokensDb();
            ws.send(JSON.stringify({ type: 'TOKENS', data: tokens }));
        } catch (err) { }

        ws.on('message', (message) => {
            try {
                const msg = JSON.parse(message.toString());
                if (msg.type === 'TOGGLE_PAPER_MODE') {
                    if (typeof msg.data === 'boolean') {
                        CONFIG.paperTrade = msg.data;
                        logger.info(`[WSS] Client forcibly toggled System Mode to: ${msg.data ? 'PAPER' : 'LIVE'}`);
                        broadcastEvent('CONFIG', { paperTrade: CONFIG.paperTrade });
                    }
                }
            } catch (e) {
                logger.error('[WSS] Message parsing failed', e);
            }
        });
    });

    server.listen(port, () => {
        logger.info(`[API/WSS] Blazing-fast Configuration + Data WebSocket running on port ${port}`);
    });
}
