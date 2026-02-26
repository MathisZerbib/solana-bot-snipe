import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Terminal, ShieldAlert, Activity, Play, Square, Settings, Zap } from 'lucide-react';

export const BotDashboard = () => {
    const { connected, publicKey } = useWallet();
    const [isRunning, setIsRunning] = useState(false);
    const [isPaperMode, setIsPaperMode] = useState<boolean>(import.meta.env.VITE_PAPER_TRADE_MODE !== 'false');

    const [tokens, setTokens] = useState<any[]>([]);
    const [activeScan, setActiveScan] = useState<any>(null);

    // Initialize Global Lightning-Fast WebSocket Data Stream
    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimer: any;
        
        const connectWs = () => {
            const wsUrl = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:3001';
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                addLog('WebSocket Data Stream Connected', 'success');
            };

            ws.onmessage = (event) => {
                try {
                    const { type, data } = JSON.parse(event.data);
                    
                    if (type === 'CONFIG' && data.paperTrade !== undefined) {
                        setIsPaperMode(data.paperTrade);
                    } else if (type === 'TOKENS') {
                        setTokens(data);
                    } else if (type === 'SCAN_METADATA') {
                        if (data.action === 'START') {
                            setActiveScan({ mintAddress: data.mintAddress, status: 'Scanning Token Authorities & Mutability...' });
                        } else if (data.action === 'AUTHORITIES') {
                            setActiveScan((prev: any) => ({
                                ...prev, 
                                mintSafe: data.mintSafe,
                                freezeSafe: data.freezeSafe,
                                status: 'Analyzing Bundled Supply...'
                            }));
                        } else if (data.action === 'MUTABILITY') {
                            setActiveScan((prev: any) => ({
                                ...prev,
                                updateSafe: data.updateSafe,
                                status: 'Analyzing Bundled Supply...'
                            }));
                        }
                    }
                } catch (err) {}
            };

            ws.onclose = () => {
                addLog('WebSocket disconnected, reconnecting...', 'error');
                reconnectTimer = setTimeout(connectWs, 3000);
            };
        };

        connectWs();

        return () => {
            clearTimeout(reconnectTimer);
            if (ws) ws.close();
        };
    }, []);

    const toggleTradingMode = async () => {
        const confirmChange = window.confirm(
            isPaperMode 
                ? "WARNING: You are about to enable LIVE TRADING WITH REAL FUNDS. Are you sure?" 
                : "Switching back to safe PAPER TRADING simulation. Confirm?"
        );
        
        if (!confirmChange) return;

        const newMode = !isPaperMode;
        
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paperTrade: newMode })
            });
            const data = await res.json();
            if(data.success) {
                setIsPaperMode(newMode);
                addLog(`Engine toggled to ${newMode ? 'PAPER TRADING MODE' : 'LIVE BLOCKCHAIN MODE'}`, newMode ? 'info' : 'warn');
            }
        } catch (err) {
            addLog("Error: Backend API is not responding. Ensure bot container is running.", 'error');
        }
    };
    const [logs, setLogs] = useState<{ id: number; time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

    useEffect(() => {
        // Mock Logs for the frontend UI Simulation
        if (connected && logs.length === 0) {
            addLog('System Initialized. Phantom Wallet Connected.', 'success');
            addLog(`Address: ${publicKey?.toBase58().slice(0, 8)}...${publicKey?.toBase58().slice(-8)}`, 'info');
        }
    }, [connected]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning && connected) {
            interval = setInterval(() => {
                const events = [
                    { m: "Found 3 new paired tokens on Raydium LP.", t: 'info' as const },
                    { m: "Running Anti-Rug Scan on Token GHY7t...", t: 'warn' as const },
                    { m: "Anti-Rug Scan Passed! 100% Secure.", t: 'success' as const },
                    { m: "Detected Jito Bundle. Simulation Avoided.", t: 'error' as const },
                    { m: "Simulated paper sell 0.2 SOL profit.", t: 'success' as const }
                ];
                const rnd = events[Math.floor(Math.random() * events.length)];
                addLog(rnd.m, rnd.t);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isRunning, connected]);

    const addLog = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            time: new Date().toLocaleTimeString(),
            msg,
            type
        }].slice(-50)); // Keep last 50 logs
    };

    const toggleBot = () => {
        if (!connected) return;
        setIsRunning(!isRunning);
        addLog(isRunning ? "Sniper Bot Stopped." : "Sniper Bot Engine Started.", isRunning ? 'warn' : 'success');
    };

    if (!connected) {
        return (
            <div className="glass-panel" style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="connect-prompt">
                    <ShieldAlert size={64} style={{ opacity: 0.5, marginBottom: '20px' }} />
                    <h2 style={{ fontSize: '1.5rem', color: 'white' }}>Wallet Connection Required</h2>
                    <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                        Please authorize via Phantom Wallet to securely encrypt your connection and initialize the Local RPC environment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-grid">
            {/* Control Panel Sidebar Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-panel controls-group">
                <div className="panel-header">
                    <Settings color="white" size={24} />
                    <span className="panel-title">Bot Configuration</span>
                </div>

                <div className="stat-item">
                    <span className="stat-label">RPC Protocol</span>
                    <span className="stat-value purple">HELIUS_PRO</span>
                </div>
                <div className="stat-item" style={{ alignItems: 'center' }}>
                    <span className="stat-label">System Mode</span>
                    <button 
                        onClick={toggleTradingMode}
                        style={{ 
                            padding: '6px 16px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            background: isPaperMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 59, 48, 0.15)',
                            color: isPaperMode ? 'var(--success)' : 'var(--danger)',
                            borderStyle: 'solid', borderWidth: '1px', borderColor: isPaperMode ? 'var(--success)' : 'var(--danger)',
                            boxShadow: !isPaperMode ? '0 0 15px rgba(255, 59, 48, 0.3)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isPaperMode ? <ShieldAlert size={16} /> : <Zap size={16} />}
                        {isPaperMode ? 'PAPER SIMULATION' : 'REAL LIVE TRADING'}
                    </button>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Active JITO Tips</span>
                    <span className="stat-value">0.005 SOL</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Slippage Limit</span>
                    <span className="stat-value">5%</span>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                    <div className="stat-item" style={{ marginBottom: '1rem' }}>
                        <span className="stat-label">System Status:</span>
                        <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isRunning ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {isRunning ? <Zap size={16} /> : <Square size={16} />}
                            {isRunning ? 'ACTIVE LOOP' : 'IDLE / OFF'}
                        </span>
                    </div>

                    <button className="primary-btn" onClick={toggleBot}>
                        {isRunning ? <Square size={20} color="black"/> : <Play size={20} color="black" />}
                        {isRunning ? 'Halt Engine' : 'Launch Sniper'}
                    </button>
                </div>
                </div>

                {/* Recent Snipe Executions Panel */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header">
                        <Activity color="white" size={24} />
                        <span className="panel-title">Recent DB Targets</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', paddingRight: '0.5rem' }}>
                        {tokens.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '1rem' }}>Listening for new Token execution locks via SQLite...</div>
                        ) : (
                            tokens.map(token => (
                                <div key={token.address} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                             {token.profit_usd > 0 ? '🟢' : '⚪️'} {token.name || 'Unknown LP Token'}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: token.profit_usd >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                            {token.profit_usd !== null ? `$${token.profit_usd.toFixed(2)}` : '$0.00'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <a href={`https://solscan.io/token/${token.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Solscan ↗
                                            </a>
                                            <a href={`https://pump.fun/coin/${token.address}`} target="_blank" rel="noreferrer" style={{ color: '#FFD700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Pump.fun ↗
                                            </a>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)' }}>{new Date(token.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Main Terminal View */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Terminal color="white" size={24} />
                        <span className="panel-title">Live Execution Terminal</span>
                    </div>
                    {isRunning && <Activity className="loading-spinner" size={20} />}
                </div>

                {activeScan && (
                    <div style={{ margin: '1rem', padding: '1rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>🔍 Live Forensic Scan: {activeScan.mintAddress?.slice(0, 6)}...{activeScan.mintAddress?.slice(-4)}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeScan.status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Mint Authority: </span>
                                {activeScan.mintSafe === undefined ? <span style={{ color: 'gray' }}>Waiting...</span> : activeScan.mintSafe ? <span style={{ color: 'var(--success)' }}>Revoked/Safe</span> : <span style={{ color: 'var(--danger)' }}>EXPOSED 🚨</span>}
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Freeze Authority: </span>
                                {activeScan.freezeSafe === undefined ? <span style={{ color: 'gray' }}>Waiting...</span> : activeScan.freezeSafe ? <span style={{ color: 'var(--success)' }}>Revoked/Safe</span> : <span style={{ color: 'var(--danger)' }}>EXPOSED 🚨</span>}
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>Update Auth/Meta: </span>
                                {activeScan.updateSafe === undefined ? <span style={{ color: 'gray' }}>Waiting...</span> : activeScan.updateSafe ? <span style={{ color: 'var(--success)' }}>Revoked/Safe</span> : <span style={{ color: 'var(--danger)' }}>EXPOSED 🚨</span>}
                            </div>
                        </div>
                    </div>
                )}

                <div className="terminal-window" id="terminal">
                    {logs.map((log) => (
                        <div key={log.id} className="terminal-line">
                            <span className="time-stamp">[{log.time}]</span>
                            <span className={`log-msg log-${log.type}`}>{log.msg}</span>
                        </div>
                    ))}
                    {/* Auto-scroll anchor anchor */}
                    <div style={{ float:"left", clear: "both" }}
                         ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }); }}>
                    </div>
                </div>
            </div>
        </div>
    );
};
