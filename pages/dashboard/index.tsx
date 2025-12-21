
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Brush
} from 'recharts';
import { Trade, TradeStatus, TradeType, Strategy } from '../../types';
import { TRADING_MISTAKES, TRADING_EMOTIONS } from '../../constants';
import { Activity, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, RefreshCcw, Target, Divide, Info, HelpCircle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface DashboardProps {
    trades: Trade[];
    onDateSelect: (date: Date) => void;
    strategies: Strategy[];
}

interface DailyStats {
    date: string;
    pnl: number;
    cumulative: number;
    tradeCount: number;
    winCount: number;
    lossCount: number;
}

interface DashboardFilters {
    startDate: string;
    endDate: string;
    symbol: string;
    type: string;
    setup: string;
    mistake: string;
    emotion: string;
}

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative inline-flex ml-1.5 align-middle">
        <Info size={13} className="text-slate-500 hover:text-blue-400 cursor-help transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed font-medium">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
        </div>
    </div>
);

const WinRateGauge: React.FC<{ winRate: number; wins: number; losses: number; be: number }> = ({ winRate, wins, losses, be }) => {
    // Semi-circle configuration
    const radius = 35;
    const stroke = 8;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * Math.PI;
    const strokeDashoffset = circumference - (winRate / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-[70px] h-[35px] overflow-hidden">
                <svg
                    height={radius}
                    width={radius * 2}
                    className="transform origin-bottom"
                >
                    {/* Background Arc (Red/Loss) */}
                    <path
                        d={`M${stroke / 2},${radius} a${normalizedRadius},${normalizedRadius} 0 0,1 ${normalizedRadius * 2},0`}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        className="opacity-80"
                    />
                    {/* Foreground Arc (Green/Win) */}
                    <path
                        d={`M${stroke / 2},${radius} a${normalizedRadius},${normalizedRadius} 0 0,1 ${normalizedRadius * 2},0`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={stroke}
                        strokeDasharray={`${circumference} ${circumference}`}
                        style={{ strokeDashoffset }}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
            </div>
            <div className="flex gap-2 mt-2">
                <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 cursor-help" title={`${wins} Wins`}>
                    {wins}
                </div>
                <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 cursor-help" title={`${be} Break-even`}>
                    {be}
                </div>
                <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 cursor-help" title={`${losses} Losses`}>
                    {losses}
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ trades, onDateSelect, strategies }) => {
    const { formatCurrency, theme } = useSettings();

    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const [filters, setFilters] = useState<DashboardFilters>({
        startDate: '',
        endDate: '',
        symbol: '',
        type: '',
        setup: '',
        mistake: '',
        emotion: ''
    });

    const chartTheme = useMemo(() => {
        const isLight = theme === 'light';
        return {
            grid: isLight ? '#e2e8f0' : '#1e293b',
            axis: isLight ? '#94a3b8' : '#64748b',
            tooltipBg: isLight ? '#ffffff' : '#0f172a',
            tooltipBorder: isLight ? '#cbd5e1' : '#334155',
            tooltipText: isLight ? '#0f172a' : '#f1f5f9',
            brushFill: isLight ? '#f1f5f9' : '#1e293b', // Matches card bg in dark mode
            brushStroke: isLight ? '#cbd5e1' : '#475569'
        };
    }, [theme]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const uniqueSymbols = useMemo(() => {
        return Array.from(new Set(trades.map(t => t.symbol))).sort();
    }, [trades]);

    const filteredTrades = useMemo(() => {
        return trades.filter(t => {
            if (filters.startDate && t.entryDate < filters.startDate) return false;
            if (filters.endDate && t.entryDate > filters.endDate) return false;
            if (filters.symbol && t.symbol !== filters.symbol) return false;
            if (filters.type && t.type !== filters.type) return false;
            if (filters.setup && t.setup !== filters.setup) return false;
            if (filters.mistake && t.mistake !== filters.mistake) return false;
            if (filters.emotion && t.emotion !== filters.emotion) return false;
            return true;
        });
    }, [trades, filters]);

    const hasActiveFilters = useMemo(() => {
        return Object.values(filters).some(val => val !== '');
    }, [filters]);

    const dailyData = useMemo(() => {
        if (!filteredTrades || filteredTrades.length === 0) return [];

        const grouped: Record<string, { pnl: number; trades: number; wins: number; losses: number }> = {};

        filteredTrades.forEach(t => {
            const date = t.entryDate;
            if (!grouped[date]) {
                grouped[date] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
            }
            grouped[date].pnl += (t.pnl || 0);
            grouped[date].trades += 1;
            if (t.status === TradeStatus.WIN) grouped[date].wins += 1;
            if (t.status === TradeStatus.LOSS) grouped[date].losses += 1;
        });

        const sortedDates = Object.keys(grouped).sort();

        let runningTotal = 0;
        return sortedDates.map(date => {
            runningTotal += grouped[date].pnl;
            return {
                date,
                pnl: grouped[date].pnl,
                cumulative: runningTotal,
                tradeCount: grouped[date].trades,
                winCount: grouped[date].wins,
                lossCount: grouped[date].losses
            } as DailyStats;
        });
    }, [filteredTrades]);

    const totalPnL = filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winCount = filteredTrades.filter(t => t.status === TradeStatus.WIN).length;
    const lossCount = filteredTrades.filter(t => t.status === TradeStatus.LOSS).length;
    const breakEvenCount = filteredTrades.filter(t => t.status === TradeStatus.BREAK_EVEN).length;
    const totalClosedTrades = winCount + lossCount + breakEvenCount;
    const winRate = totalClosedTrades > 0 ? (winCount / totalClosedTrades) * 100 : 0;

    const grossProfit = filteredTrades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(filteredTrades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;

    const avgRMultiple = useMemo(() => {
        let totalR = 0;
        let count = 0;

        filteredTrades.forEach(t => {
            if (t.status === TradeStatus.OPEN || !t.exitPrice) return;
            const sl = t.initialStopLoss !== undefined ? t.initialStopLoss : t.stopLoss;
            const risk = Math.abs(t.entryPrice - sl);
            if (risk === 0) return;

            let realizedDiff = 0;
            if (t.type === TradeType.LONG) {
                realizedDiff = t.exitPrice - t.entryPrice;
            } else {
                realizedDiff = t.entryPrice - t.exitPrice;
            }

            const rValue = realizedDiff / risk;
            totalR += rValue;
            count++;
        });

        return count > 0 ? totalR / count : 0;
    }, [filteredTrades]);


    const handleResetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            symbol: '',
            type: '',
            setup: '',
            mistake: '',
            emotion: ''
        });
    };

    const getDataForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return dailyData.find(d => d.date === dateStr);
    };

    const getCalendarDays = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        const calendarGrid = [];

        for (let i = 0; i < startDayOfWeek; i++) calendarGrid.push(null);
        for (let i = 1; i <= daysInMonth; i++) calendarGrid.push(new Date(year, month, i));
        while (calendarGrid.length % 7 !== 0) calendarGrid.push(null);

        return calendarGrid;
    };

    const calendarDays = getCalendarDays(currentCalendarDate);
    const monthName = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthlyStats = useMemo(() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();

        let pnl = 0;
        let tradeCount = 0;
        let mWinCount = 0;

        for (let d = 1; d <= lastDay; d++) {
            const y = year;
            const m = String(month + 1).padStart(2, '0');
            const dayStr = String(d).padStart(2, '0');
            const dateStr = `${y}-${m}-${dayStr}`;
            const dayData = dailyData.find(d => d.date === dateStr);

            if (dayData) {
                pnl += dayData.pnl;
                tradeCount += dayData.tradeCount;
                mWinCount += dayData.winCount;
            }
        }

        return {
            pnl,
            tradeCount,
            winRate: tradeCount > 0 ? (mWinCount / tradeCount) * 100 : 0
        };
    }, [currentCalendarDate, dailyData]);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }

    const getWeeklyStats = (weekDays: (Date | null)[]) => {
        let pnl = 0;
        let tradeCount = 0;
        let wWinCount = 0;

        weekDays.forEach(date => {
            if (date) {
                const stats = getDataForDate(date);
                if (stats) {
                    pnl += stats.pnl;
                    tradeCount += stats.tradeCount;
                    wWinCount += stats.winCount;
                }
            }
        });
        return { pnl, tradeCount, winCount: wWinCount };
    };

    const prevMonth = () => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
    const jumpToToday = () => setCurrentCalendarDate(new Date());

    return (
        <div className="space-y-6 pb-20">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                        <p className="text-slate-400 mt-1">Welcome back. Here's your trading overview.</p>
                    </div>
                </div>

                <div className="relative" ref={filterRef}>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isFilterOpen || hasActiveFilters
                            ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                    >
                        <Filter size={16} />
                        Filters
                        {hasActiveFilters && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-[640px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50">
                                {/* Filter Inputs (kept same) */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Symbol</label>
                                    <select value={filters.symbol} onChange={(e) => setFilters({ ...filters, symbol: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                        <option value="">All Symbols</option>
                                        {uniqueSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Direction</label>
                                    <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                        <option value="">All</option>
                                        <option value={TradeType.LONG}>Long</option>
                                        <option value={TradeType.SHORT}>Short</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Setup</label>
                                    <select value={filters.setup} onChange={(e) => setFilters({ ...filters, setup: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                        <option value="">All Setups</option>
                                        {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Start Date</label>
                                    <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">End Date</label>
                                    <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Mistake</label>
                                    <select value={filters.mistake} onChange={(e) => setFilters({ ...filters, mistake: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                        <option value="">Any</option>
                                        {TRADING_MISTAKES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Emotion</label>
                                    <select value={filters.emotion} onChange={(e) => setFilters({ ...filters, emotion: e.target.value })} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                        <option value="">Any</option>
                                        {TRADING_EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                            </div>
                            {hasActiveFilters && (
                                <div className="p-3 border-t border-slate-700 bg-slate-800 flex justify-end">
                                    <button onClick={(e) => { e.stopPropagation(); handleResetFilters(); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors">
                                        <RefreshCcw size={12} /> Reset Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* KPI Cards */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group">
                    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
                    <div className="flex items-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Net P&L</p>
                        <InfoTooltip text="Total realized profit or loss from all closed trades." />
                    </div>
                    <h2 className={`text-xl lg:text-2xl font-mono font-bold mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(totalPnL)}
                    </h2>
                </div>

                {/* Win Rate Widget */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group flex justify-between items-start">
                    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
                    <div className="flex flex-col justify-between h-full z-10">
                        <div className="flex items-center gap-1">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Trade win %</p>
                            <InfoTooltip text="Percentage of winning trades. The gauge shows Wins (Green), Break-even (Indigo), and Losses (Red)." />
                        </div>
                        <h2 className="text-xl lg:text-2xl font-bold mt-1 text-slate-200">
                            {winRate.toFixed(2)}%
                        </h2>
                    </div>
                    <div className="flex flex-col items-center justify-end h-full z-10 -mb-1">
                        <WinRateGauge winRate={winRate} wins={winCount} losses={lossCount} be={breakEvenCount} />
                    </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group">
                    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
                    <div className="flex items-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"><Divide size={10} /> Avg R-Mult</p>
                        <InfoTooltip text="Average Risk Multiple (Reward / Risk). A value of 2R means you made 2x your risk on average." />
                    </div>
                    <h2 className={`text-xl lg:text-2xl font-mono font-bold mt-1 ${avgRMultiple >= 0 ? 'text-purple-400' : 'text-rose-400'}`}>
                        {avgRMultiple.toFixed(2)}R
                    </h2>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group">
                    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-amber-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
                    <div className="flex items-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Profit Factor</p>
                        <InfoTooltip text="Gross Profit divided by Gross Loss. A value > 1.0 indicates profitability." />
                    </div>
                    <h2 className="text-xl lg:text-2xl font-mono font-bold mt-1 text-amber-400">
                        {profitFactor.toFixed(2)}
                    </h2>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative group">
                    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-600 to-transparent opacity-30 rounded-tr-xl rounded-br-xl"></div>
                    <div className="flex items-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">Avg Win <span className="text-slate-600">/</span> Loss</p>
                        <InfoTooltip text="Average profit per winning trade vs Average loss per losing trade." />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                        <h2 className="text-lg font-mono font-bold text-emerald-400">{formatCurrency(avgWin)}</h2>
                        <span className="text-slate-600 text-lg">/</span>
                        <h2 className="text-lg font-mono font-bold text-rose-400">{formatCurrency(avgLoss)}</h2>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-300 font-semibold mb-6 flex items-center gap-2">
                        <Activity size={18} className="text-blue-500" />
                        Daily Cumulative P&L
                        <InfoTooltip text="Running total of your realized Profit & Loss over time." />
                    </h3>
                    <div className="h-[250px] w-full">
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                                    <YAxis stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} width={50} />
                                    <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder, color: chartTheme.tooltipText, borderRadius: '8px' }} itemStyle={{ color: chartTheme.tooltipText }} formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']} />
                                    <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCumulative)" animationDuration={500} />
                                    <Brush dataKey="date" height={20} stroke={chartTheme.brushStroke} fill={chartTheme.brushFill} tickFormatter={() => ''} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 border border-dashed border-slate-700 rounded-lg">No trade data available</div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-300 font-semibold mb-6 flex items-center gap-2">
                        <Activity size={18} className="text-emerald-500" />
                        Daily P&L
                        <InfoTooltip text="Net Profit or Loss realized on each specific trading day." />
                    </h3>
                    <div className="h-[250px] w-full">
                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                                    <YAxis stroke={chartTheme.axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} width={50} />
                                    <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder, color: chartTheme.tooltipText, borderRadius: '8px' }} itemStyle={{ color: chartTheme.tooltipText }} cursor={{ fill: chartTheme.grid, opacity: 0.4 }} formatter={(value: number) => [formatCurrency(value), 'Daily P&L']} />
                                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                        {dailyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                                    </Bar>
                                    <Brush dataKey="date" height={20} stroke={chartTheme.brushStroke} fill={chartTheme.brushFill} tickFormatter={() => ''} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 border border-dashed border-slate-700 rounded-lg">No trade data available</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-700 grid grid-cols-1 xl:grid-cols-3 gap-4 items-center">
                    <h3 className="text-slate-300 font-semibold flex items-center gap-2 justify-self-start">
                        <CalendarIcon size={18} className="text-purple-500" />
                        Daily P&L Calendar
                        <InfoTooltip text="Visual heatmap of your daily trading performance." />
                    </h3>
                    <div className="flex items-center justify-center gap-4 sm:gap-6 bg-slate-900/50 px-6 py-2 rounded-lg border border-slate-700/50 shadow-sm justify-self-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Monthly P&L</span>
                            <span className={`font-mono font-bold text-sm sm:text-base ${monthlyStats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{monthlyStats.pnl >= 0 ? '+' : ''}{formatCurrency(monthlyStats.pnl)}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-700/50"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Trades</span>
                            <span className="font-mono font-bold text-sm sm:text-base text-white">{monthlyStats.tradeCount}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-700/50"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</span>
                            <span className="font-mono font-bold text-sm sm:text-base text-blue-400">{monthlyStats.winRate.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900 rounded-lg p-1.5 shadow-inner justify-self-end">
                        <button onClick={jumpToToday} className="text-xs font-semibold text-blue-400 hover:text-white hover:bg-blue-600 px-3 py-1 rounded transition-colors">This Month</button>
                        <div className="w-px h-5 bg-slate-800 mx-1"></div>
                        <button onClick={prevMonth} className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"><ChevronLeft size={18} /></button>
                        <span className="font-bold text-white min-w-[140px] text-center select-none text-sm">{monthName}</span>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="p-6 overflow-x-auto">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-8 gap-2 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Weekly'].map((day, index) => (
                                <div key={index} className={`text-center text-slate-500 text-xs font-bold uppercase tracking-wider py-2 ${index === 7 ? 'bg-slate-700/30 rounded text-slate-400' : ''}`}>{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-8 gap-2">
                            {weeks.map((week, weekIndex) => {
                                const weeklyStats = getWeeklyStats(week);
                                const weeklyWinRate = weeklyStats.tradeCount > 0 ? (weeklyStats.winCount / weeklyStats.tradeCount) * 100 : 0;
                                return (
                                    <React.Fragment key={weekIndex}>
                                        {week.map((date, dayIndex) => {
                                            if (!date) return <div key={`empty-${weekIndex}-${dayIndex}`} className="bg-transparent h-28 lg:h-32"></div>;
                                            const stats = getDataForDate(date);
                                            const isToday = new Date().toDateString() === date.toDateString();
                                            const dayPnL = stats?.pnl || 0;
                                            const hasTrades = stats && stats.tradeCount > 0;
                                            const dailyWinRate = hasTrades && stats ? (stats.winCount / stats.tradeCount) * 100 : 0;
                                            return (
                                                <div key={date.toISOString()} onClick={() => onDateSelect(date)} className={`h-28 lg:h-32 border rounded-lg p-2 flex flex-col relative transition-all hover:border-blue-400 cursor-pointer group ${isToday ? 'border-blue-500 bg-blue-900/10' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700'}`}>
                                                    <div className="absolute top-2 left-2"><span className={`text-xs font-bold ${isToday ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>{date.getDate()}</span></div>
                                                    {hasTrades ? (
                                                        <div className="flex flex-col items-center justify-center h-full gap-0.5 pt-3">
                                                            <div className={`font-mono font-bold text-sm lg:text-base ${dayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{dayPnL >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dayPnL))}</div>
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className="font-semibold text-slate-300">{stats?.tradeCount}</span> Trades</div>
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className={`font-semibold ${dailyWinRate >= 50 ? 'text-blue-400' : ''}`}>{dailyWinRate.toFixed(0)}%</span> Win Rate</div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center"><span className="text-slate-700 text-2xl font-bold select-none opacity-20">-</span></div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div className="h-28 lg:h-32 border border-slate-700 bg-slate-700/20 rounded-lg p-2 flex flex-col justify-center gap-1 shadow-inner relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-slate-700/10 to-transparent pointer-events-none"></div>
                                            {weeklyStats.tradeCount > 0 ? (
                                                <div className="space-y-1.5 z-10">
                                                    <div className={`text-center font-mono font-bold text-base ${weeklyStats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{weeklyStats.pnl >= 0 ? '+' : '-'}{formatCurrency(Math.abs(weeklyStats.pnl))}</div>
                                                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400"><span className="font-semibold text-white">{weeklyStats.tradeCount}</span> Trades</div>
                                                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400"><span className={`font-semibold ${weeklyWinRate >= 50 ? 'text-blue-400' : ''}`}>{weeklyWinRate.toFixed(0)}%</span> Win Rate</div>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-600 text-xs">-</div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
