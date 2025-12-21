
import React from 'react';
import { Strategy, Trade, TradeStatus } from '../../types';
import { ListChecks, LogIn, LogOut, Plus } from 'lucide-react';
import { WinRateChart } from './WinRateChart';

interface PlaybookListProps {
  strategies: Strategy[];
  trades: Trade[];
  onSelectStrategy: (strategy: Strategy) => void;
  onOpenCreate: () => void;
}

export const PlaybookList: React.FC<PlaybookListProps> = ({ 
  strategies, 
  trades, 
  onSelectStrategy, 
  onOpenCreate 
}) => {
  
  const getStrategyStats = (strategyName: string) => {
    const relevantTrades = trades.filter(t => t.setup === strategyName);
    const count = relevantTrades.length;
    
    if (count === 0) return { winRate: 0, count: 0, avgRR: 0 };

    const wins = relevantTrades.filter(t => t.status === TradeStatus.WIN).length;
    const winRate = (wins / count) * 100;

    let totalRR = 0;
    let rrCount = 0;
    relevantTrades.forEach(t => {
        const risk = Math.abs(t.entryPrice - t.stopLoss);
        const reward = Math.abs(t.takeProfit - t.entryPrice);
        if (risk > 0) {
            totalRR += (reward / risk);
            rrCount++;
        }
    });
    const avgRR = rrCount > 0 ? totalRR / rrCount : 0;

    return { winRate, count, avgRR };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
      {strategies.length > 0 ? (
        strategies.map((strategy) => {
          const stats = getStrategyStats(strategy.name);
          const winRateTextColor = stats.winRate >= 50 ? 'text-emerald-400' : stats.count > 0 ? 'text-rose-400' : 'text-slate-400';
          
          return (
            <div 
                key={strategy.id} 
                onClick={() => onSelectStrategy(strategy)}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col group cursor-pointer hover:border-blue-500/50 hover:-translate-y-1 transition-all shadow-lg hover:shadow-blue-500/10"
            >
                <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/10 p-2.5 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <ListChecks className="text-blue-500" size={20} />
                </div>
                <h3 className="text-lg font-bold text-white leading-tight">{strategy.name}</h3>
                </div>
                
                <p className="text-slate-400 text-sm mb-4 line-clamp-3">{strategy.description}</p>
                
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-700/50 mb-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Win Rate</span>
                        <div className="flex items-center gap-2 mt-1">
                            <WinRateChart percentage={stats.winRate} count={stats.count} />
                            <span className={`text-sm font-bold font-mono ${winRateTextColor}`}>
                                {stats.winRate.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col border-l border-slate-700/50 pl-3">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Trades</span>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-sm font-bold text-slate-300 font-mono">
                                {stats.count}
                            </span>
                        </div>
                    </div>
                     <div className="flex flex-col border-l border-slate-700/50 pl-3">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Avg R/R</span>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-sm font-bold text-slate-300 font-mono">
                                {stats.avgRR.toFixed(1)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mt-auto">
                    <div className="flex items-center gap-1.5">
                        <LogIn size={12} className="text-emerald-500"/>
                        <span>{strategy.entryRules.length} Rules</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <LogOut size={12} className="text-rose-500"/>
                        <span>{strategy.exitRules.length} Rules</span>
                    </div>
                </div>
            </div>
          );
        })
      ) : (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
          <ListChecks size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No strategies defined yet</p>
          <button onClick={onOpenCreate} className="text-blue-400 hover:text-blue-300 underline">
              Create your first strategy
          </button>
        </div>
      )}
    </div>
  );
};
