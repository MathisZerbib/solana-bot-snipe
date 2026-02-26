import sqlite3 from 'sqlite3';
import { logger } from '../logger/logger.js';
import fs from 'fs';
import path from 'path';

let db: sqlite3.Database;

export function initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
        const dbPath = './data/bot_data.sqlite';
        const dbDir = path.dirname(dbPath);

        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('Failed to connect to database', err);
                return reject(err);
            }

            db.serialize(() => {
                db.run(`
          CREATE TABLE IF NOT EXISTS skipped_tokens (
            address TEXT PRIMARY KEY
          )
        `);

                db.run(`
          CREATE TABLE IF NOT EXISTS sniped_tokens (
            address TEXT PRIMARY KEY,
            name TEXT,
            txid TEXT,
            liquidity REAL,
            profit_usd REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    });
}

export function loadSkippedTokensDb(): Promise<Set<string>> {
    return new Promise((resolve, reject) => {
        db.all('SELECT address FROM skipped_tokens', (err, rows) => {
            if (err) return reject(err);
            const addresses = rows.map((row: any) => row.address);
            resolve(new Set(addresses));
        });
    });
}

export function addSkippedTokenDb(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO skipped_tokens (address) VALUES (?)', [address], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

export function addSnipedTokenDb(address: string, name: string, txid: string, liquidity: number, profitUsd: number): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR IGNORE INTO sniped_tokens (address, name, txid, liquidity, profit_usd) VALUES (?, ?, ?, ?, ?)',
            [address, name, txid, liquidity, profitUsd],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}
