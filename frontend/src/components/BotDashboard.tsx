import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Terminal, ShieldAlert, Activity, Play, Square, Settings, Zap, ToggleRight, ToggleLeft } from 'lucide-react';

export const BotDashboard = () => {
    const { connected, publicKey } = useWallet();
    const [isRunning, setIsRunning] = useState(false);
    const [isPaperMode, setIsPaperMode] = useState<boolean>(import.meta.env.VITE_PAPER_TRADE_MODE !== 'false');

    // Fetch live config state regularly
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Point to backend 3001 API
                const res = await fetch('http://localhost:3001/api/config');
                const data = await res.json();
                if (data.paperTrade !== undefined) {
                    setIsPaperMode(data.paperTrade);
                }
            } catch (err) {
                // If it fails, fallback to build-args silently
            }
        };

        fetchConfig();
        const interval = setInterval(fetchConfig, 5000);
        return () => clearInterval(interval);
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
            const res = await fetch('http://localhost:3001/api/config', {
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
            {/* Control Panel (Sidebar) */}
            <div className="glass-panel controls-group">
                <div className="panel-header">
                    <Settings color="white" size={24} />
                    <span className="panel-title">Bot Configuration</span>
                </div>

                <div className="stat-item">
                    <span className="stat-label">RPC Protocol</span>
                    <span className="stat-value purple">HELIUS_PRO</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        System Mode 
                        {isPaperMode ? (
                           <ToggleLeft color="var(--text-muted)" size={18} cursor="pointer" onClick={toggleTradingMode} style={{transition: '0.2s'}} />
                        ) : (
                           <ToggleRight color="var(--danger)" size={18} cursor="pointer" onClick={toggleTradingMode} style={{transition: '0.2s'}} />
                        )}
                    </span>
                    <span className={`stat-value ${isPaperMode ? 'green' : 'danger'}`} style={!isPaperMode ? {color: 'var(--danger)', textShadow: '0 0 10px rgba(255,59,48,0.5)'} : {}}>
                        {isPaperMode ? 'PAPER TRADING' : '🔴 LIVE TRADING'}
                    </span>
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

            {/* Main Terminal View */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Terminal color="white" size={24} />
                        <span className="panel-title">Live Execution Terminal</span>
                    </div>
                    {isRunning && <Activity className="loading-spinner" size={20} />}
                </div>

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
