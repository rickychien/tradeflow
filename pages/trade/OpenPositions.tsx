
import React from 'react';
import { Trade, TradeStatus, TradeType } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface OpenPositionsProps {
  trades: Trade[];
  onSelectTrade?: (trade: Trade) => void;
}

export const OpenPositions: React.FC<OpenPositionsProps> = ({ trades, onSelectTrade }) => {
  const { formatCurrency } = useSettings();
  const openTrades = trades.filter(t => t.status === TradeStatus.OPEN);

  return (
    <div className="flex flex-col h-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-900/50">
            <Layers size={14} className="text-blue-500" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Open Positions & Orders</h3>
            <span className="bg-slate-700 text-white text-[10px] px-1.5 rounded-full font-mono">{openTrades.length}</span>
        </div>
        
        <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900/50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-2 border-b border-slate-700">Symbol</th>
                        <th className="px-4 py-2 border-b border-slate-700 text-center">Side</th>
                        <th className="px-4 py-2 border-b border-slate-700 text-right">Size</th>
                        <th className="px-4 py-2 border-b border-slate-700 text-right">Entry</th>
                        <th className="px-4 py-2 border-b border-slate-700 text-right">Unrealized P&L</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                    {openTrades.length > 0 ? (
                        openTrades.map((trade) => (
                            <tr 
                                key={trade.id} 
                                className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                                onClick={() => onSelectTrade && onSelectTrade(trade)}
                            >
                                <td className="px-4 py-2">
                                    <span className="text-sm font-bold text-slate-200">{trade.symbol}</span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                        trade.type === TradeType.LONG 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                    }`}>
                                        {trade.type === TradeType.LONG ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <span className="text-xs font-mono text-slate-300">{trade.quantity}</span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <span className="text-xs font-mono text-slate-300">{trade.entryPrice}</span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <span className={`text-xs font-mono font-bold ${
                                        (trade.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                        {(trade.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(trade.pnl || 0)}
                                    </span>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs">
                                No open positions.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
