
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import { Trade, TradeStatus, TradeType } from '../../types';
import {
    PieChart as PieIcon, Activity, AlertTriangle,
    Layers, Smile, Clock, Hourglass, TrendingUp, Target, Calculator
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface ReportsProps {
    trades: Trade[];
}

type ReportType = 'overview' | 'strategies' | 'timing' | 'symbols' | 'mistakes' | 'emotions';

export const Reports: React.FC<ReportsProps> = ({ trades }) => {
    const { formatCurrency, theme } = useSettings();
    const [activeReport, setActiveReport] = useState<ReportType>('overview');

    const chartTheme = useMemo(() => {
        const isLight = theme === 'light';
        return {
            grid: isLight ? '#e2e8f0' : '#1e293b',
            axis: isLight ? '#94a3b8' : '#64748b',
            tooltipBg: isLight ? '#ffffff' : '#0f172a',
            tooltipBorder: isLight ? '#cbd5e1' : '#334155',
            tooltipText: isLight ? '#0f172a' : '#f1f5f9',
            referenceLine: isLight ? '#cbd5e1' : '#475569'
        };
    }, [theme]);

    const closedTrades = useMemo(() => trades.filter(t => t.status !== TradeStatus.OPEN), [trades]);

    const equityCurveData = useMemo(() => {
        const sortedTrades = [...closedTrades]
            .sort((a, b) => (a.exitTimestamp || 0) - (b.exitTimestamp || 0));

        let runningPnl = 0;

        return sortedTrades.map((t, index) => {
            runningPnl += (t.pnl || 0);
            return {
                tradeNumber: index + 1,
                date: t.exitDate,
                pnl: t.pnl,
                equity: runningPnl,
                symbol: t.symbol
            };
        });
    }, [closedTrades]);

    // Performance Metrics for Overview
    const performanceStats = useMemo(() => {
        const totalTrades = closedTrades.length;
        if (totalTrades === 0) return null;

        const wins = closedTrades.filter(t => t.status === TradeStatus.WIN);
        const losses = closedTrades.filter(t => t.status === TradeStatus.LOSS);

        const totalPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const grossProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));

        const winRate = (wins.length / totalTrades) * 100;
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
        const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
        const expectancy = (avgWin * (winRate / 100)) - (avgLoss * ((100 - winRate) / 100));

        return {
            totalTrades,
            winRate,
            profitFactor,
            totalPnl,
            avgWin,
            avgLoss,
            expectancy
        };
    }, [closedTrades]);

    const strategyMatrixData = useMemo(() => {
        const stats: Record<string, { pnl: number; wins: number; total: number }> = {};

        trades.forEach(t => {
            if (t.status === TradeStatus.OPEN) return;
            const setup = t.setup || 'No Setup';
            if (!stats[setup]) stats[setup] = { pnl: 0, wins: 0, total: 0 };

            stats[setup].pnl += (t.pnl || 0);
            stats[setup].total += 1;
            if (t.status === TradeStatus.WIN) stats[setup].wins += 1;
        });

        return Object.entries(stats).map(([name, data]) => ({
            name,
            pnl: data.pnl,
            winRate: (data.wins / data.total) * 100,
            count: data.total,
            avgPnl: data.pnl / data.total,
            avgWin: data.wins > 0 ? (data.pnl / data.wins) : 0 // Simplified estimate, mostly for display
        }));
    }, [trades]);

    const durationScatterData = useMemo(() => {
        return trades
            .filter(t => t.status !== TradeStatus.OPEN && t.entryTimestamp && t.exitTimestamp)
            .map(t => ({
                durationMinutes: (t.exitTimestamp! - t.entryTimestamp!) / 60,
                pnl: t.pnl || 0,
                symbol: t.symbol,
                type: t.type
            }));
    }, [trades]);

    const aggregateBy = (key: keyof Trade, defaultLabel: string = 'Unspecified') => {
        const data: Record<string, { pnl: number; count: number; wins: number }> = {};

        trades.forEach(t => {
            if (t.status === TradeStatus.OPEN) return;
            // @ts-ignore
            const val = t[key] || defaultLabel;
            const label = Array.isArray(val) ? (val.length ? val[0] : defaultLabel) : val;

            if (!data[label]) data[label] = { pnl: 0, count: 0, wins: 0 };
            data[label].pnl += (t.pnl || 0);
            data[label].count += 1;
            if (t.status === TradeStatus.WIN) data[label].wins += 1;
        });

        return Object.entries(data)
            .map(([name, stats]) => ({
                name,
                pnl: stats.pnl,
                count: stats.count,
                winRate: (stats.wins / stats.count) * 100,
                avgPnl: stats.pnl / stats.count
            }))
            .sort((a, b) => b.pnl - a.pnl);
    };

    const symbolData = useMemo(() => aggregateBy('symbol'), [trades]);
    const mistakeData = useMemo(() => aggregateBy('mistake', 'None').filter(d => d.name !== 'None'), [trades]);
    const emotionData = useMemo(() => aggregateBy('emotion', 'Neutral'), [trades]);

    const hourlyData = useMemo(() => {
        const data = Array.from({ length: 24 }, (_, i) => ({
            name: `${String(i).padStart(2, '0')}:00`,
            hour: i,
            pnl: 0,
            count: 0
        }));

        trades.forEach(t => {
            if (t.status === TradeStatus.OPEN) return;
            const date = t.entryTimestamp ? new Date(t.entryTimestamp * 1000) : new Date(t.entryDate);
            const hour = date.getHours();
            if (hour >= 0 && hour < 24) {
                data[hour].pnl += (t.pnl || 0);
                data[hour].count += 1;
            }
        });
        return data;
    }, [trades]);

    const dayOfWeekData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = days.map(d => ({ name: d, pnl: 0, count: 0 }));
        trades.forEach(t => {
            if (t.status === TradeStatus.OPEN) return;
            const date = new Date(t.entryDate);
            data[date.getDay()].pnl += (t.pnl || 0);
            data[date.getDay()].count += 1;
        });
        return data;
    }, [trades]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl z-50 min-w-[180px]" style={{ backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder }}>
                    <p className="font-bold text-xs mb-2 border-b pb-1" style={{ color: chartTheme.axis, borderColor: chartTheme.tooltipBorder }}>{payload[0].payload.name || label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between items-center gap-4 mb-1">
                            <span className="text-xs capitalize" style={{ color: chartTheme.axis }}>{entry.name}:</span>
                            <span className={`font-mono font-bold text-sm ${entry.name.toLowerCase().includes('pnl') || entry.name.toLowerCase().includes('equity') || entry.name.toLowerCase().includes('cumulative')
                                ? (entry.value >= 0 ? 'text-emerald-400' : 'text-rose-400')
                                : ''
                                }`} style={!(entry.name.toLowerCase().includes('pnl') || entry.name.toLowerCase().includes('equity') || entry.name.toLowerCase().includes('cumulative')) ? { color: chartTheme.tooltipText } : {}}>
                                {entry.name.toLowerCase().includes('rate')
                                    ? `${entry.value.toFixed(1)}%`
                                    : (entry.name.toLowerCase().includes('equity') || entry.name.toLowerCase().includes('pnl'))
                                        ? formatCurrency(entry.value)
                                        : entry.name.toLowerCase().includes('cumulative')
                                            ? `${entry.value.toFixed(2)}R`
                                            : entry.value
                                }
                            </span>
                        </div>
                    ))}
                    {payload[0].payload.count !== undefined && (
                        <div className="flex justify-between items-center gap-4 mt-2 pt-2 border-t" style={{ borderColor: chartTheme.tooltipBorder }}>
                            <span className="text-xs" style={{ color: chartTheme.axis }}>Trades:</span>
                            <span className="text-xs font-mono" style={{ color: chartTheme.tooltipText }}>{payload[0].payload.count}</span>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const tabs: { id: ReportType; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <PieIcon size={16} /> },
        { id: 'strategies', label: 'Strategies', icon: <Layers size={16} /> },
        { id: 'timing', label: 'Timing', icon: <Clock size={16} /> },
        { id: 'symbols', label: 'Symbols', icon: <Activity size={16} /> },
        { id: 'mistakes', label: 'Mistakes', icon: <AlertTriangle size={16} /> },
        { id: 'emotions', label: 'Emotions', icon: <Smile size={16} /> },
    ];

    const hasData = trades.length > 0;

    return (
        <div className="animate-fade-in flex flex-col pb-10">

            <div className="mb-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Performance Reports</h1>
                        <p className="text-slate-400 mt-1">Deep dive analytics to improve your edge.</p>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveReport(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg whitespace-nowrap text-sm font-medium transition-all ${activeReport === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-500'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl relative min-h-[500px]">

                {!hasData && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-slate-800/80 backdrop-blur-sm rounded-2xl">
                        <Layers size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">No trade data available</p>
                        <p className="text-sm">Import trades or sync your account to generate reports.</p>
                    </div>
                )}

                {activeReport === 'overview' && (
                    <div className="space-y-8 animate-fade-in">

                        {/* Equity Curve */}
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 shadow-inner relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="text-emerald-500" size={20} />
                                    Cumulative P&L (Equity Curve)
                                </h3>
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl font-mono font-bold text-emerald-400">
                                        {equityCurveData.length > 0
                                            ? formatCurrency(equityCurveData[equityCurveData.length - 1].equity)
                                            : '$0.00'}
                                    </div>
                                </div>
                            </div>

                            <div className="h-[650px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={equityCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                        <XAxis dataKey="tradeNumber" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `#${v}`} />
                                        <YAxis stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} width={60} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartTheme.axis, strokeDasharray: '3 3' }} />
                                        <ReferenceLine y={0} stroke={chartTheme.referenceLine} strokeDasharray="3 3" />
                                        <Area
                                            type="monotone"
                                            dataKey="equity"
                                            name="Equity"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            fill="url(#colorEquity)"
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Performance Overview Grid (TradeZella Style) */}
                        {performanceStats && (
                            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-500" />
                                    Performance Overview
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Win Rate</p>
                                        <p className={`text-2xl font-mono font-bold ${performanceStats.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {performanceStats.winRate.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Total P&L</p>
                                        <p className={`text-2xl font-mono font-bold ${performanceStats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {formatCurrency(performanceStats.totalPnl)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Profit Factor</p>
                                        <p className="text-2xl font-mono font-bold text-amber-400">
                                            {performanceStats.profitFactor.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Avg Win</p>
                                        <p className="text-2xl font-mono font-bold text-emerald-400">
                                            {formatCurrency(performanceStats.avgWin)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Avg Loss</p>
                                        <p className="text-2xl font-mono font-bold text-rose-400">
                                            {formatCurrency(performanceStats.avgLoss)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors group">
                                        <p className="text-xs text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">Expectancy <Calculator size={10} className="text-purple-500" /></p>
                                        <p className={`text-2xl font-mono font-bold ${performanceStats.expectancy >= 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                                            {formatCurrency(performanceStats.expectancy)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeReport === 'strategies' && (
                    <div className="space-y-8 animate-fade-in h-full flex flex-col">
                        {strategyMatrixData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-700/50 rounded-xl">
                                <Layers size={32} className="mb-3 opacity-50" />
                                <p className="text-sm font-medium">No strategy data available</p>
                                <p className="text-xs">Tag your trades with a setup to see this report.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 min-h-[400px]">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Target size={16} /> Strategy Matrix (Win Rate vs P&L)</h3>
                                    <ResponsiveContainer width="100%" height={550}>
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                            <XAxis type="number" dataKey="winRate" name="Win Rate" unit="%" stroke={chartTheme.axis} fontSize={12} domain={[0, 100]} label={{ value: 'Win Rate (%)', position: 'bottom', fill: chartTheme.axis, fontSize: 10 }} />
                                            <YAxis type="number" dataKey="pnl" name="Net P&L" stroke={chartTheme.axis} fontSize={12} tickFormatter={(val) => formatCurrency(val)} label={{ value: 'Net P&L', angle: -90, position: 'left', fill: chartTheme.axis, fontSize: 10 }} />
                                            <ZAxis type="number" dataKey="count" range={[60, 400]} name="Trades" />
                                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                                            <ReferenceLine y={0} stroke={chartTheme.referenceLine} strokeDasharray="3 3" />
                                            <ReferenceLine x={50} stroke={chartTheme.referenceLine} strokeDasharray="3 3" />
                                            <Scatter name="Strategies" data={strategyMatrixData} fill="#3b82f6">
                                                {strategyMatrixData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.8} stroke={entry.pnl >= 0 ? '#059669' : '#e11d48'} strokeWidth={1} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900/50 text-xs font-bold text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-6 py-4 border-b border-slate-700">Strategy</th>
                                                <th className="px-6 py-4 border-b border-slate-700 text-center">Trades</th>
                                                <th className="px-6 py-4 border-b border-slate-700 text-center">Win Rate</th>
                                                <th className="px-6 py-4 border-b border-slate-700 text-right">Avg Win</th>
                                                <th className="px-6 py-4 border-b border-slate-700 text-right">Net P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {strategyMatrixData.sort((a, b) => b.pnl - a.pnl).map((s, i) => (
                                                <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-white">{s.name}</td>
                                                    <td className="px-6 py-4 text-center text-slate-300 font-mono">{s.count}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.winRate >= 50 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                            {s.winRate.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-emerald-400 font-mono">{formatCurrency(s.avgWin)}</td>
                                                    <td className={`px-6 py-4 text-right font-bold font-mono ${s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {formatCurrency(s.pnl)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeReport === 'timing' && (
                    <div className="space-y-8 animate-fade-in h-full flex flex-col">

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Hourly Performance</h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={hourlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                            <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                            <Tooltip cursor={{ fill: chartTheme.grid, opacity: 0.5 }} content={<CustomTooltip />} />
                                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                                {hourlyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Daily Performance</h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dayOfWeekData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                            <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                            <Tooltip cursor={{ fill: chartTheme.grid, opacity: 0.5 }} content={<CustomTooltip />} />
                                            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                                {dayOfWeekData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Hourglass className="text-amber-500" size={20} /> Duration vs. P&L
                                </h3>
                            </div>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                        <XAxis type="number" dataKey="durationMinutes" name="Duration" unit="m" stroke={chartTheme.axis} fontSize={12} label={{ value: 'Duration (Minutes)', position: 'bottom', fill: chartTheme.axis, fontSize: 10 }} />
                                        <YAxis type="number" dataKey="pnl" name="P&L" stroke={chartTheme.axis} fontSize={12} tickFormatter={(val) => formatCurrency(val)} label={{ value: 'P&L', angle: -90, position: 'left', fill: chartTheme.axis, fontSize: 10 }} />
                                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                                        <ReferenceLine y={0} stroke={chartTheme.referenceLine} />
                                        <Scatter name="Trades" data={durationScatterData} fill="#3b82f6" fillOpacity={0.6}>
                                            {durationScatterData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeReport === 'symbols' && (
                    <div className="space-y-6 animate-fade-in h-full flex flex-col">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-blue-500" /> Symbol Performance</h2>
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={symbolData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                                    <XAxis type="number" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                    <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip cursor={{ fill: chartTheme.grid, opacity: 0.5 }} content={<CustomTooltip />} />
                                    <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={20}>
                                        {symbolData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeReport === 'mistakes' && (
                    <div className="space-y-6 animate-fade-in h-full flex flex-col">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><AlertTriangle className="text-rose-500" /> Cost of Mistakes</h2>
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mistakeData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                                    <XAxis type="number" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                    <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip cursor={{ fill: chartTheme.grid, opacity: 0.5 }} content={<CustomTooltip />} />
                                    <Bar dataKey="pnl" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20}>
                                        {mistakeData.map((entry, index) => <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeReport === 'emotions' && (
                    <div className="space-y-6 animate-fade-in h-full flex flex-col">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Smile className="text-purple-500" /> Emotion Analysis</h2>
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={emotionData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                                    <XAxis type="number" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val)} />
                                    <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={11} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip cursor={{ fill: chartTheme.grid, opacity: 0.5 }} content={<CustomTooltip />} />
                                    <Bar dataKey="pnl" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={20}>
                                        {emotionData.map((entry, index) => <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
