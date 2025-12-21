
import React, { useState, useEffect } from 'react';
import { Watchlist } from './Watchlist';
import { MainChart } from './MainChart';
import { OrderPanel } from './OrderPanel';
import { OpenPositions } from './OpenPositions';
import { Trade, Strategy, TradeType } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { fetchAccountDetails } from '../../services/oandaService';
import { ChevronsLeft, PanelRightOpen } from 'lucide-react';

interface TradePageProps {
  onSaveTrade: (trade: Trade) => void;
  trades: Trade[];
  onSelectTrade?: (trade: Trade) => void;
  strategies: Strategy[];
}

// Shared State Interface
export interface OrderState {
    type: TradeType;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    setup: string;
    notes: string;
    followedRules: string[];
}

export const TradePage: React.FC<TradePageProps> = ({ onSaveTrade, trades, onSelectTrade, strategies }) => {
  const { oandaApiKey, oandaAccountId, oandaEnv } = useSettings();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('USD_JPY');
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(true);
  
  // Lifted state to sync Chart <-> Order Panel
  const [orderState, setOrderState] = useState<OrderState>({
      type: TradeType.LONG,
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      quantity: 1000,
      setup: '',
      notes: '',
      followedRules: []
  });

  useEffect(() => {
      const loadAccount = async () => {
          if (oandaApiKey && oandaAccountId) {
              try {
                  const details = await fetchAccountDetails(oandaAccountId, oandaApiKey, oandaEnv);
                  if (details && details.balance) {
                      setAccountBalance(parseFloat(details.balance));
                  }
              } catch (e) {
                  console.error("Failed to load account balance for trade page", e);
              }
          }
      };
      loadAccount();
  }, [oandaApiKey, oandaAccountId, oandaEnv]);

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-3 animate-fade-in overflow-hidden relative">
        {/* Center Column: Watchlist (Top), Chart, Positions */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 h-full">
            {/* Horizontal Watchlist */}
            <div className="h-12 flex-shrink-0">
                <Watchlist 
                    selectedSymbol={selectedSymbol} 
                    onSelect={setSelectedSymbol} 
                    orientation="horizontal"
                />
            </div>

            <div className="flex-1 min-h-0 relative">
                <MainChart 
                    symbol={selectedSymbol} 
                    isWatchlistVisible={true} 
                    onToggleWatchlist={() => {}}
                    orderState={orderState}
                    setOrderState={setOrderState}
                />
                
                {/* Floating Expand Button when Order Panel is Closed */}
                {!isOrderPanelOpen && (
                    <button 
                        onClick={() => setIsOrderPanelOpen(true)}
                        className="absolute right-0 top-16 bg-slate-800 border-l border-t border-b border-slate-700 text-blue-400 hover:text-white p-2 rounded-l-lg shadow-lg z-30 transition-all hover:pr-3"
                        title="Open Order Panel"
                    >
                        <PanelRightOpen size={20} />
                    </button>
                )}
            </div>
            
            <div className="h-48 flex-shrink-0">
                <OpenPositions trades={trades} onSelectTrade={onSelectTrade} />
            </div>
        </div>

        {/* Right Column: Order Panel */}
        <div 
            className={`flex-shrink-0 hidden lg:block h-full transition-all duration-300 ease-in-out overflow-hidden ${isOrderPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'}`}
        >
            <div className="w-80 h-full">
                <OrderPanel 
                    symbol={selectedSymbol} 
                    onSave={onSaveTrade} 
                    strategies={strategies}
                    orderState={orderState}
                    setOrderState={setOrderState}
                    accountBalance={accountBalance}
                    onClose={() => setIsOrderPanelOpen(false)}
                />
            </div>
        </div>
    </div>
  );
};
