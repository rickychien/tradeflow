
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Scatter } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Trade, TradeStatus } from '../../types';

interface NavGrowthChartProps {
  trades: Trade[];
  transactions: any[];
  accountData: any;
}

export const NavGrowthChart: React.FC<NavGrowthChartProps> = ({ trades, transactions, accountData }) => {
  const { formatCurrency, formatDate, theme } = useSettings();

  const chartTheme = useMemo(() => {
      const isLight = theme === 'light';
      return {
          grid: isLight ? '#e2e8f0' : '#1e2d3b',
          axis: isLight ? '#94a3b8' : '#64748b',
          tooltipBg: isLight ? '#ffffff' : '#0f172a',
          tooltipBorder: isLight ? '#cbd5e1' : '#334155',
          tooltipText: isLight ? '#0f172a' : '#f1f5f9',
          cursor: isLight ? '#cbd5e1' : '#475569'
      };
  }, [theme]);

  const chartData = useMemo(() => {
      if (!accountData) return [];
      
      const currentNav = parseFloat(accountData.NAV);

      // 1. Create Events from Closed Trades
      // We only care about realized P&L affecting the balance history
      const tradeEvents = trades
        .filter(t => t.status !== TradeStatus.OPEN && t.exitTimestamp)
        .map(t => ({
            timestamp: t.exitTimestamp! * 1000, // ms
            amount: t.pnl || 0,
            type: 'TRADE',
            label: 'Trade P&L'
        }));

      // 2. Create Events from Fund Transactions
      const fundEvents = transactions.map(t => ({
          timestamp: new Date(t.time).getTime(),
          amount: Number(t.amount || 0),
          type: (t.type === 'CREATE' || t.type === 'ACCOUNT_CREATE') ? 'CREATE' : (Number(t.amount) >= 0 ? 'DEPOSIT' : 'WITHDRAWAL'),
          label: (t.type === 'CREATE' || t.type === 'ACCOUNT_CREATE') ? 'Account Opened' : (Number(t.amount) >= 0 ? 'Deposit' : 'Withdrawal')
      }));

      // 3. Merge & Sort Chronologically (Newest Last)
      const allEvents = [...tradeEvents, ...fundEvents]
        .sort((a, b) => a.timestamp - b.timestamp);

      // 4. Calculate Backwards from Current NAV
      // We start at 'Now' with current NAV, and subtract events as we go back in time
      // This ensures the right-most point matches the actual OANDA account value perfectly.
      
      const points = [];
      let runningNav = currentNav;

      // Add "Now" point
      points.push({
          date: Date.now(),
          value: runningNav,
          amount: 0,
          type: 'NOW',
          label: 'Current'
      });

      // Iterate backwards
      for (let i = allEvents.length - 1; i >= 0; i--) {
          const event = allEvents[i];
          
          // The NAV *before* this event was (Current - Amount)
          // The NAV *after* this event was (Current)
          // We record the value at the time of the event as the value *after* it processed.
          
          const dataPoint: any = {
              date: event.timestamp,
              value: runningNav, 
              amount: event.amount,
              type: event.type,
              label: event.label,
          };

          if (event.type === 'DEPOSIT') dataPoint.depositPoint = runningNav;
          if (event.type === 'WITHDRAWAL') dataPoint.withdrawPoint = runningNav;
          if (event.type === 'CREATE') dataPoint.createPoint = runningNav;

          points.push(dataPoint);

          // Update running total for the *next* historical point (further back in time)
          runningNav -= event.amount;
      }

      // If we have very few points, add a start point to make it look like a chart
      if (points.length === 1 && allEvents.length === 0) {
          // No history, just current balance. Add a point 1 day ago.
          points.push({
              date: Date.now() - 86400000,
              value: runningNav,
              amount: 0,
              type: 'START',
              label: 'Start'
          });
      }

      // Reverse back to chronological order for the chart
      return points.reverse();
  }, [trades, transactions, accountData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const data = payload[0].payload;
          return (
              <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs" style={{ backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder }}>
                  <p className="mb-1" style={{ color: chartTheme.axis }}>{formatDate(data.date)}</p>
                  <p className={`font-mono font-bold text-sm text-emerald-400`}>
                      NAV: {formatCurrency(data.value)}
                  </p>
                  {data.type !== 'NOW' && data.type !== 'START' && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: chartTheme.tooltipBorder }}>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mr-2 ${
                              data.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-400' : 
                              data.type === 'WITHDRAWAL' ? 'bg-rose-500/20 text-rose-400' : 
                              data.type === 'CREATE' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-blue-500/20 text-blue-400'
                          }`}>
                              {data.label}
                          </span>
                          <span className={`font-mono ${data.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {data.amount > 0 ? '+' : ''}{formatCurrency(data.amount)}
                          </span>
                      </div>
                  )}
              </div>
          );
      }
      return null;
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500"/> Net Asset Value Growth
        </h3>
        <div className="h-[350px] w-full">
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke={chartTheme.axis} 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(ts) => {
                                try {
                                    return new Date(ts).toLocaleDateString(undefined, {month:'short', day:'numeric'});
                                } catch { return ''; }
                            }}
                            minTickGap={40}
                        />
                        <YAxis 
                            stroke={chartTheme.axis} 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(val) => formatCurrency(val)}
                            width={80}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartTheme.cursor, strokeDasharray: '3 3' }} />
                        
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            fill="url(#colorValue)" 
                        />
                        <Scatter name="Deposit" dataKey="depositPoint" fill="#facc15" shape="circle" r={5} zIndex={100} />
                        <Scatter name="Withdrawal" dataKey="withdrawPoint" fill="#a855f7" shape="circle" r={5} zIndex={100} />
                        <Scatter name="Created" dataKey="createPoint" fill="#3b82f6" shape="star" r={6} zIndex={100} />
                    </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    No growth data available yet.
                </div>
            )}
        </div>
    </div>
  );
};
