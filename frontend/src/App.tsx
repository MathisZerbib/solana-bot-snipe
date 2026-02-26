import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BotDashboard } from './components/BotDashboard';
import { ShieldAlert } from 'lucide-react';

function App() {
  return (
    <div className="app-container">
      {/* Dynamic Background Elements */}
      <div className="glow-orb glow-orb-1"></div>
      <div className="glow-orb glow-orb-2"></div>

      {/* Main Header */}
      <header className="header">
        <div className="logo-container">
          <ShieldAlert color="var(--accent)" size={32} />
          <h1 className="logo-text">
            Solana<span className="accent-text">Snipe</span>v2.0
          </h1>
        </div>
        
        {/* Phantom Wallet Connect Button */}
        <div>
          <WalletMultiButton />
        </div>
      </header>

      {/* Main Bot Dashboard Component */}
      <main>
        <BotDashboard />
      </main>
    </div>
  );
}

export default App;
