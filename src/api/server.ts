import express from 'express';
import cors from 'cors';
import { CONFIG } from '../config/config.js';
import { logger } from '../logger/logger.js';

export function startApiServer(port: number = 3001) {
    const app = express();

    app.use(cors());
    app.use(express.json());

    // Get current config
    app.get('/api/config', (req, res) => {
        res.json({
            paperTrade: CONFIG.paperTrade,
            amountToSwap: CONFIG.amountToSwap,
            slippage: CONFIG.slippage,
            priorityFee: CONFIG.priorityFee,
        });
    });

    // Update config
    app.post('/api/config', (req, res) => {
        try {
            if (typeof req.body.paperTrade === 'boolean') {
                CONFIG.paperTrade = req.body.paperTrade;
                logger.info(`[API] Updated paperTrade to: ${CONFIG.paperTrade}`);
            }

            // Can add more fields if needed later

            res.json({ success: true, paperTrade: CONFIG.paperTrade });
        } catch (error) {
            logger.error('[API] Failed to update config', error);
            res.status(500).json({ success: false, error: 'Failed to update config' });
        }
    });

    app.listen(port, () => {
        logger.info(`[API] Configuration Server running on port ${port}`);
    });
}
