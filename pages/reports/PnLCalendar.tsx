
import React, { useMemo, useState } from 'react';
import { Trade, TradeStatus } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface PnLCalendarProps {
  trades: Trade[];
}

export const PnLCalendar: React.FC<PnLCalendarProps> = ({ trades }) => {
  const { formatCurrency } = useSettings();
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const dailyStats = useMemo(() => {
    const stats: Record<string, { pnl: number; count: number; wins: number; losses: number }> = {};
    
    trades.forEach(t => {
      if (t.status === TradeStatus.OPEN) return;
      // Ensure we use the date string directly to avoid timezone shifts
      const dateStr = t.entryDate; 
      if (!stats[dateStr]) {
        stats[dateStr] = { pnl: 0, count: 0, wins: 0, losses: 0 };
      }
      stats[dateStr].pnl += (t.pnl || 0);
      stats[dateStr].count += 1;
      if (t.status === TradeStatus.WIN) stats[dateStr].wins += 1;
      if (t.status === TradeStatus.LOSS) stats[dateStr].losses += 1;
    });
    return stats;
  }, [trades]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month); // 0 = Sunday

  // Generate calendar grid cells
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalSlots = [...blanks, ...days];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Determine max P&L for opacity scaling
  const maxWin = Math.max(...Object.values(dailyStats).map((s: any) => s.pnl).filter((p: number) => p > 0), 1);
  const maxLoss = Math.abs(Math.min(...Object.values(dailyStats).map((s: any) => s.pnl).filter((p: number) => p < 0), -1));

  const getCellColor = (pnl: number) => {
      if (pnl > 0) {
          const intensity = Math.min(Math.ceil((pnl / maxWin) * 5), 5); // 1-5 scale
          return `bg-emerald-${Math.max(400, 300 + (intensity * 100))}`; // e.g. bg-emerald-500
      } else if (pnl < 0) {
          const intensity = Math.min(Math.ceil((Math.abs(pnl) / maxLoss) * 5), 5);
          return `bg-rose-${Math.max(400, 300 + (intensity * 100))}`; // e.g. bg-rose-500
      }
      return 'bg-slate-800';
  };

  const getCellStyle = (pnl: number) => {
      // Since Tailwind classes need to be safelisted or fully static for some compilers,
      // let's use inline styles for dynamic opacity to be safe, backed by a base color
      if (pnl > 0) {
          const alpha = 0.2 + (Math.min(pnl / maxWin, 1) * 0.8);
          return { backgroundColor: `rgba(16, 185, 129, ${alpha})` }; // Emerald
      }
      if (pnl < 0) {
          const alpha = 0.2 + (Math.min(Math.abs(pnl) / maxLoss, 1) * 0.8);
          return { backgroundColor: `rgba(244, 63, 94, ${alpha})` }; // Rose
      }
      return {};
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">P&L Calendar</h3>
            <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
                <span className="text-sm font-bold text-white min-w-[120px] text-center">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"><ChevronRight size={16}/></button>
            </div>
        </div>
        
        <div className="p-4 grid grid-cols-7 gap-2 flex-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase pb-2">{d}</div>
            ))}
            
            {totalSlots.map((day, index) => {
                if (day === null) return <div key={`blank-${index}`} className="bg-transparent aspect-square" />;
                
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data = dailyStats[dateStr];
                const hasTrade = !!data;
                const pnl = data ? data.pnl : 0;

                return (
                    <div 
                        key={dateStr}
                        style={getCellStyle(pnl)}
                        className={`
                            relative aspect-square rounded-lg border border-slate-700/50 flex flex-col items-center justify-center group cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-xl
                            ${!hasTrade ? 'bg-slate-800/50' : ''}
                        `}
                    >
                        <span className={`absolute top-1 left-2 text-[10px] font-bold ${hasTrade ? 'text-white/70' : 'text-slate-600'}`}>{day}</span>
                        
                        {hasTrade && (
                            <>
                                <div className={`text-xs font-mono font-bold ${pnl >= 0 ? 'text-white' : 'text-white'}`}>
                                    {pnl >= 0 ? '+' : ''}{Math.abs(pnl) >= 1000 ? (pnl/1000).toFixed(1) + 'k' : Math.round(pnl)}
                                </div>
                                <div className="absolute bottom-1 right-2 flex gap-0.5">
                                    {Array.from({length: Math.min(data.count, 3)}).map((_, i) => (
                                        <div key={i} className="w-1 h-1 rounded-full bg-white/50"></div>
                                    ))}
                                    {data.count > 3 && <div className="w-1 h-1 text-[6px] leading-[4px] text-white">+</div>}
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 w-32 bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs text-left pointer-events-none">
                                    <div className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">{dateStr}</div>
                                    <div className="flex justify-between"><span>P&L:</span> <span className={pnl>=0?'text-emerald-400':'text-rose-400'}>{formatCurrency(pnl)}</span></div>
                                    <div className="flex justify-between"><span>Trades:</span> <span className="text-white">{data.count}</span></div>
                                    <div className="flex justify-between"><span>Wins:</span> <span className="text-emerald-400">{data.wins}</span></div>
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};
