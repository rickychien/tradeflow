
import React, { useMemo } from 'react';
import { Trade, TradeStatus } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';

interface ConfluenceHeatmapProps {
  trades: Trade[];
}

export const ConfluenceHeatmap: React.FC<ConfluenceHeatmapProps> = ({ trades }) => {
  const { formatCurrency } = useSettings();

  const data = useMemo(() => {
      // Grid: 7 days x 24 hours
      // 0 = Sunday, 6 = Saturday
      const grid = Array(7).fill(null).map(() => Array(24).fill({ pnl: 0, count: 0 }));
      
      let maxPnl = 0;
      let minPnl = 0;

      trades.forEach(t => {
          if (t.status === TradeStatus.OPEN) return;
          
          const date = new Date(t.entryTimestamp ? t.entryTimestamp * 1000 : t.entryDate);
          const day = date.getDay();
          const hour = date.getHours();
          
          grid[day][hour] = {
              pnl: grid[day][hour].pnl + (t.pnl || 0),
              count: grid[day][hour].count + 1
          };

          if (grid[day][hour].pnl > maxPnl) maxPnl = grid[day][hour].pnl;
          if (grid[day][hour].pnl < minPnl) minPnl = grid[day][hour].pnl;
      });

      return { grid, maxPnl, minPnl };
  }, [trades]);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = [0, 4, 8, 12, 16, 20]; // Labels

  const getCellStyle = (pnl: number, count: number) => {
      if (count === 0) return { backgroundColor: 'rgba(30, 41, 59, 0.5)' }; // Slate-800/50
      
      if (pnl > 0) {
          const alpha = 0.3 + (Math.min(pnl / (data.maxPnl || 1), 1) * 0.7);
          return { backgroundColor: `rgba(16, 185, 129, ${alpha})` }; // Emerald
      } else {
          const alpha = 0.3 + (Math.min(Math.abs(pnl) / (Math.abs(data.minPnl) || 1), 1) * 0.7);
          return { backgroundColor: `rgba(244, 63, 94, ${alpha})` }; // Rose
      }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">Time & Day Confluence</h3>
            <p className="text-xs text-slate-500">Identify your most profitable trading windows.</p>
        </div>
        
        <div className="p-4 flex-1 overflow-x-auto">
            <div className="min-w-[500px]">
                <div className="flex">
                    <div className="w-10"></div> {/* Y-Axis Label Placeholder */}
                    <div className="flex-1 grid grid-cols-24 gap-px mb-2">
                        {Array.from({length: 24}).map((_, i) => (
                            <div key={i} className="text-[9px] text-slate-500 text-center">
                                {i % 4 === 0 ? i : ''}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    {data.grid.map((row, dayIndex) => (
                        <div key={dayIndex} className="flex items-center gap-2">
                            <div className="w-10 text-[10px] font-bold text-slate-400 uppercase text-right pr-2">
                                {days[dayIndex]}
                            </div>
                            <div className="flex-1 grid grid-cols-24 gap-1">
                                {row.map((cell, hourIndex) => (
                                    <div
                                        key={hourIndex}
                                        style={getCellStyle(cell.pnl, cell.count)}
                                        className="h-8 rounded-sm group relative cursor-help transition-all hover:scale-110 hover:z-10 hover:border hover:border-white/20"
                                    >
                                        {cell.count > 0 && (
                                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs z-50">
                                                <div className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                                                    {days[dayIndex]} @ {String(hourIndex).padStart(2,'0')}:00
                                                </div>
                                                <div className="flex justify-between"><span>P&L:</span> <span className={cell.pnl>=0?'text-emerald-400':'text-rose-400'}>{formatCurrency(cell.pnl)}</span></div>
                                                <div className="flex justify-between"><span>Trades:</span> <span className="text-white">{cell.count}</span></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
