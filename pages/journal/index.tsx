import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trade, TradeStatus, TradeType, Strategy } from '../../types';
import { TRADING_MISTAKES, TRADING_EMOTIONS } from '../../constants';
import { GripHorizontal, Settings2, Check, ChevronLeft, ChevronRight, Calendar, RotateCcw, Filter, RefreshCcw, RefreshCw, Tag, Info, Loader2 } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { loadJournalConfig, saveJournalConfig } from '../../services/storageService';
import { fetchTradeEnrichmentData } from '../../services/oandaService';

interface TradeListProps {
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
    onUpdateTrade: (trade: Trade) => void;
    initialDateRange?: { start: string; end: string } | null;
    initialSetupFilter?: string | null;
    strategies: Strategy[];
}

interface ColumnConfig {
    id: string;
    label: string;
    align: 'left' | 'center' | 'right';
    width: number;
    tooltip?: string;
}

// Reordered columns: Tags is last
const DEFAULT_COLUMNS: ColumnConfig[] = [
    { id: 'date', label: 'Date', align: 'left', width: 140, tooltip: 'Entry date and time of the trade' },
    { id: 'duration', label: 'Duration', align: 'right', width: 90, tooltip: 'Time elapsed between entry and exit' },
    { id: 'symbol', label: 'Symbol', align: 'center', width: 90, tooltip: 'Trading instrument' },
    { id: 'type', label: 'Direction', align: 'center', width: 100, tooltip: 'Long (Buy) or Short (Sell)' },
    { id: 'quantity', label: 'Qty', align: 'right', width: 80, tooltip: 'Position size' },
    { id: 'entryPrice', label: 'Entry', align: 'right', width: 100, tooltip: 'Price at trade entry' },
    { id: 'exitPrice', label: 'Exit', align: 'right', width: 100, tooltip: 'Price at trade exit' },
    { id: 'r_multiple', label: 'R-Mult', align: 'right', width: 70, tooltip: 'Realized profit/loss divided by initial risk' },
    { id: 'pnl', label: 'P&L', align: 'right', width: 100, tooltip: 'Realized Profit or Loss' },
    { id: 'roi', label: 'ROI', align: 'right', width: 90, tooltip: 'Return on Investment (%)' },
    { id: 'status', label: 'Status', align: 'left', width: 110, tooltip: 'Outcome of the trade' },
    { id: 'setup', label: 'Setup', align: 'center', width: 150, tooltip: 'Strategy or pattern used' },
    { id: 'mistake', label: 'Mistake', align: 'center', width: 120, tooltip: 'Primary execution error' },
    { id: 'emotion', label: 'Emotion', align: 'center', width: 100, tooltip: 'Primary emotion recorded' },
    { id: 'tags', label: 'Tags', align: 'left', width: 150, tooltip: 'Custom categorization tags' },
];

const ITEMS_PER_PAGE = 18;

export const TradeList: React.FC<TradeListProps> = ({ trades, onSelectTrade, onUpdateTrade, initialDateRange, initialSetupFilter, strategies }) => {
    const { formatDate, formatCurrency, oandaApiKey, oandaAccountId, oandaEnv } = useSettings();

    // Load saved config
    const savedConfig = useMemo(() => {
        const config = loadJournalConfig();
        if (config) {
            // Merge defaults to ensure new columns (like tags) appear if not in saved config
            const savedIds = new Set(config.columns.map((c: any) => c.id));
            const missingDefaults = DEFAULT_COLUMNS.filter(c => !savedIds.has(c.id));
            if (missingDefaults.length > 0) {
                config.columns = [...config.columns, ...missingDefaults];
                // Also make them visible by default
                missingDefaults.forEach(c => config.visibleColumns.push(c.id));
            }
            // Update tooltips for existing columns if they are missing
            config.columns = config.columns.map((col: any) => {
                const defaultCol = DEFAULT_COLUMNS.find(d => d.id === col.id);
                return defaultCol ? { ...col, tooltip: defaultCol.tooltip } : col;
            });
        }
        return config;
    }, []);

    const [columns, setColumns] = useState<ColumnConfig[]>(savedConfig?.columns || DEFAULT_COLUMNS);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(savedConfig?.visibleColumns || DEFAULT_COLUMNS.map(c => c.id)));

    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);

    // Track individual trade enrichment status
    const [enrichingTradeIds, setEnrichingTradeIds] = useState<Set<string>>(new Set());

    const { defaultStartDate, defaultEndDate } = useMemo(() => {
        if (trades.length === 0) {
            const today = new Date().toISOString().split('T')[0];
            return { defaultStartDate: today, defaultEndDate: today };
        }
        const sorted = [...trades].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
        return {
            defaultStartDate: sorted[0].entryDate,
            defaultEndDate: sorted[sorted.length - 1].entryDate
        };
    }, [trades]);

    // Use saved filter or defaults
    const [startDate, setStartDate] = useState<string>(initialDateRange?.start || savedConfig?.filters?.startDate || defaultStartDate);
    const [endDate, setEndDate] = useState<string>(initialDateRange?.end || savedConfig?.filters?.endDate || defaultEndDate);

    const [setupFilter, setSetupFilter] = useState<string>(initialSetupFilter || savedConfig?.filters?.setup || '');
    const [symbolFilter, setSymbolFilter] = useState<string>(savedConfig?.filters?.symbol || '');
    const [directionFilter, setDirectionFilter] = useState<string>(savedConfig?.filters?.type || '');
    const [statusFilter, setStatusFilter] = useState<string>(savedConfig?.filters?.status || '');
    const [mistakeFilter, setMistakeFilter] = useState<string>(savedConfig?.filters?.mistake || '');
    const [emotionFilter, setEmotionFilter] = useState<string>(savedConfig?.filters?.emotion || '');
    const [tagFilter, setTagFilter] = useState<string>(savedConfig?.filters?.tag || '');
    const [debouncedTagFilter, setDebouncedTagFilter] = useState<string>(tagFilter);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);

    const processedTradeIds = useRef<Set<string>>(new Set());

    // Debounce tag search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedTagFilter(tagFilter);
        }, 400);
        return () => clearTimeout(handler);
    }, [tagFilter]);

    // Save config on change (using immediate values for UI state, but debounce affects list)
    useEffect(() => {
        saveJournalConfig({
            columns,
            visibleColumns: Array.from(visibleColumns),
            filters: {
                startDate, endDate, symbol: symbolFilter, type: directionFilter, setup: setupFilter, status: statusFilter, mistake: mistakeFilter, emotion: emotionFilter, tag: tagFilter
            }
        });
    }, [columns, visibleColumns, startDate, endDate, symbolFilter, directionFilter, setupFilter, statusFilter, mistakeFilter, emotionFilter, tagFilter]);

    const uniqueSymbols = useMemo(() => {
        return Array.from(new Set(trades.map(t => t.symbol))).sort();
    }, [trades]);

    const allAvailableTags = useMemo(() => {
        const tags = new Set<string>();
        trades.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
        return Array.from(tags).sort();
    }, [trades]);

    const filteredTags = useMemo(() => {
        if (!tagFilter) return [];
        return allAvailableTags.filter(t => t.toLowerCase().includes(tagFilter.toLowerCase()));
    }, [allAvailableTags, tagFilter]);

    useEffect(() => {
        if (initialDateRange) {
            setStartDate(initialDateRange.start || defaultStartDate);
            setEndDate(initialDateRange.end || defaultEndDate);
        }
    }, [initialDateRange, defaultStartDate, defaultEndDate]);

    useEffect(() => {
        if (initialSetupFilter !== undefined && initialSetupFilter !== null) {
            setSetupFilter(initialSetupFilter);
            // Explicitly NOT opening the panel as per request
            // setIsFilterPanelOpen(true); 
        }
    }, [initialSetupFilter]);

    const [currentPage, setCurrentPage] = useState(1);

    const isCustomDateFilter = startDate !== defaultStartDate || endDate !== defaultEndDate;
    const hasActiveAttributeFilters = setupFilter || symbolFilter || directionFilter || statusFilter || mistakeFilter || emotionFilter || tagFilter;

    const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
    const columnMenuRef = useRef<HTMLDivElement>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
                setIsColumnMenuOpen(false);
            }
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                // Also close suggestions if clicking outside filter menu completely
                setIsFilterPanelOpen(false);
                setShowTagSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleColumnVisibility = (columnId: string) => {
        const newVisible = new Set(visibleColumns);
        if (newVisible.has(columnId)) {
            if (newVisible.size > 1) newVisible.delete(columnId);
        } else {
            newVisible.add(columnId);
        }
        setVisibleColumns(newVisible);
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, index: number) => {
        if (resizingRef.current) {
            e.preventDefault();
            return;
        }
        setDraggedColumnIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableHeaderCellElement>, index: number) => {
        e.preventDefault();
        if (draggedColumnIndex === null) return;
        if (draggedColumnIndex !== index) {
            const newColumns = [...columns];
            const draggedCol = newColumns[draggedColumnIndex];
            newColumns.splice(draggedColumnIndex, 1);
            newColumns.splice(index, 0, draggedCol);

            setColumns(newColumns);
            setDraggedColumnIndex(index);
        }
    };

    const handleDragEnd = () => {
        setDraggedColumnIndex(null);
    };

    const startResize = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = {
            index,
            startX: e.clientX,
            startWidth: columns[index].width
        };
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeUp);
        document.body.style.cursor = 'col-resize';
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const { index, startX, startWidth } = resizingRef.current;
        const diff = e.clientX - startX;
        const newWidth = Math.max(40, startWidth + diff);
        setColumns(prevCols => {
            const newCols = [...prevCols];
            newCols[index] = { ...newCols[index], width: newWidth };
            return newCols;
        });
    };

    const handleResizeUp = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeUp);
        document.body.style.cursor = '';
    };

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeUp);
        };
    }, []);

    const handleResetFilters = () => {
        setSetupFilter('');
        setSymbolFilter('');
        setDirectionFilter('');
        setStatusFilter('');
        setMistakeFilter('');
        setEmotionFilter('');
        setTagFilter('');
        setDebouncedTagFilter('');
    };

    const filteredTrades = useMemo(() => {
        return trades.filter(trade => {
            if (startDate && trade.entryDate < startDate) return false;
            if (endDate && trade.entryDate > endDate) return false;

            if (setupFilter && trade.setup !== setupFilter) return false;
            if (symbolFilter && trade.symbol !== symbolFilter) return false;
            if (directionFilter && trade.type !== directionFilter) return false;
            if (statusFilter && trade.status !== statusFilter) return false;
            if (mistakeFilter && trade.mistake !== mistakeFilter) return false;
            if (emotionFilter && trade.emotion !== emotionFilter) return false;

            if (debouncedTagFilter) {
                const filterLower = debouncedTagFilter.toLowerCase();
                const hasTag = trade.tags?.some(t => t.toLowerCase().includes(filterLower));
                if (!hasTag) return false;
            }

            return true;
        });
    }, [trades, startDate, endDate, setupFilter, symbolFilter, directionFilter, statusFilter, mistakeFilter, emotionFilter, debouncedTagFilter]);

    const totalPages = Math.ceil(filteredTrades.length / ITEMS_PER_PAGE);
    const paginatedTrades = filteredTrades.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, setupFilter, symbolFilter, directionFilter, statusFilter, mistakeFilter, emotionFilter, debouncedTagFilter]);

    // Lazy Loading for Enrichment (Initial SL)
    useEffect(() => {
        if (!oandaApiKey || !oandaAccountId) return;

        // Filter trades that haven't been processed in this session AND are not currently enriching
        const tradesToProcess = paginatedTrades.filter(t => !processedTradeIds.current.has(t.id));

        if (tradesToProcess.length === 0) return;

        // Mark as processing immediately to avoid loop
        tradesToProcess.forEach(t => processedTradeIds.current.add(t.id));

        // Batch update loading state
        setEnrichingTradeIds(prev => {
            const next = new Set(prev);
            tradesToProcess.forEach(t => next.add(t.id));
            return next;
        });

        const enrichTrades = async () => {
            for (const trade of tradesToProcess) {
                try {
                    const data = await fetchTradeEnrichmentData(trade, oandaAccountId, oandaApiKey, oandaEnv);

                    if (data.initialStopLoss !== null && data.initialStopLoss !== undefined && data.initialStopLoss !== trade.initialStopLoss) {
                        const updatedTrade = { ...trade, initialStopLoss: data.initialStopLoss };
                        onUpdateTrade(updatedTrade);
                    }
                } catch (e) {
                    console.warn("Lazy enrichment failed for trade", trade.id);
                } finally {
                    // Remove individual trade from loading state
                    setEnrichingTradeIds(prev => {
                        const next = new Set(prev);
                        next.delete(trade.id);
                        return next;
                    });
                }
            }
        };

        enrichTrades();
    }, [paginatedTrades, oandaApiKey, oandaAccountId, oandaEnv, onUpdateTrade]);

    const renderCell = (trade: Trade, columnId: string) => {
        const isWin = trade.status === TradeStatus.WIN;
        const isLong = trade.type === TradeType.LONG;
        const pnlColor = (trade.pnl || 0) > 0 ? 'text-emerald-400' : (trade.pnl || 0) < 0 ? 'text-rose-400' : 'text-slate-400';

        switch (columnId) {
            case 'status':
                const statusText = trade.status.replace('_', ' ');
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${isWin
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : trade.status === TradeStatus.LOSS
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                        {statusText}
                    </span>
                );
            case 'symbol':
                return <span className="font-bold text-white">{trade.symbol}</span>;
            case 'type':
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${isLong
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                        }`}>
                        {trade.type}
                    </span>
                );
            case 'setup':
                return trade.setup ? (
                    <span className="inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium border bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                        {trade.setup}
                    </span>
                ) : null;
            case 'tags':
                if (!trade.tags || trade.tags.length === 0) return <span className="text-slate-600">-</span>;
                return (
                    <div className="flex gap-1 items-center overflow-hidden cursor-help" title={trade.tags.join(', ')}>
                        <span className="inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] text-slate-300 bg-slate-700 border border-slate-600">
                            {trade.tags[0]}
                        </span>
                        {trade.tags.length > 1 && (
                            <span className="text-[10px] text-slate-500 font-medium">
                                +{trade.tags.length - 1}...
                            </span>
                        )}
                    </div>
                );
            case 'mistake':
                return trade.mistake ? (
                    <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20">
                        {trade.mistake}
                    </span>
                ) : <span className="text-slate-600">-</span>;
            case 'emotion':
                return trade.emotion ? (
                    <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20">
                        {trade.emotion}
                    </span>
                ) : <span className="text-slate-600">-</span>;
            case 'r_multiple':
                // Show loader if enrichment is pending for this trade
                if (enrichingTradeIds.has(trade.id)) {
                    return (
                        <div className="flex justify-end w-full pr-2">
                            <Loader2 size={14} className="animate-spin text-blue-500/50" />
                        </div>
                    );
                }

                if (trade.status === TradeStatus.OPEN || !trade.exitPrice) return <span className="text-slate-600">-</span>;

                // Priority: Initial Stop Loss (Enrichment) -> Current Stop Loss
                const stopLossToUse = trade.initialStopLoss !== undefined ? trade.initialStopLoss : trade.stopLoss;

                if (!stopLossToUse) return <span className="text-slate-600">-</span>;

                const riskAmt = Math.abs(trade.entryPrice - stopLossToUse);
                if (riskAmt === 0) return <span className="text-slate-600">-</span>;

                const realizedDiff = trade.type === TradeType.LONG
                    ? (trade.exitPrice - trade.entryPrice)
                    : (trade.entryPrice - trade.exitPrice);

                const rMult = realizedDiff / riskAmt;
                const rColor = rMult > 0 ? 'text-emerald-400' : rMult < 0 ? 'text-rose-400' : 'text-slate-400';
                return <span className={`font-mono font-bold ${rColor}`}>{rMult.toFixed(2)}R</span>;
            case 'roi':
                const investedCapital = trade.entryPrice * trade.quantity;
                const roi = investedCapital > 0 && trade.pnl ? (trade.pnl / investedCapital) * 100 : 0;
                return (
                    <span className={`font-mono font-medium ${roi > 0 ? 'text-emerald-400' : roi < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {roi.toFixed(2)}%
                    </span>
                );
            case 'pnl':
                return (
                    <span className={`font-mono font-medium ${pnlColor}`}>
                        {trade.pnl !== undefined ? `${trade.pnl > 0 ? '+' : ''}${formatCurrency(trade.pnl)}` : '-'}
                    </span>
                );
            case 'date':
                const dateVal = trade.entryTimestamp || trade.entryDate;
                return <span className="text-slate-400 font-mono text-xs">{formatDate(dateVal)}</span>;
            case 'duration':
                if (trade.entryTimestamp && trade.exitTimestamp) {
                    const diffInMinutes = Math.round((trade.exitTimestamp - trade.entryTimestamp) / 60);
                    return <span className="text-slate-400 font-mono">{diffInMinutes}m</span>;
                }
                return <span className="text-slate-500">-</span>;
            case 'quantity':
                return <span className="text-slate-300 font-mono">{trade.quantity}</span>;
            case 'entryPrice':
                return <span className="text-slate-300 font-mono">{trade.entryPrice.toFixed(3)}</span>;
            case 'exitPrice':
                return <span className="text-slate-300 font-mono">{trade.exitPrice?.toFixed(3) || '-'}</span>;
            default:
                return null;
        }
    };

    const visibleCols = columns.filter(col => visibleColumns.has(col.id));

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 h-9">
                        <div className="flex items-center gap-2 bg-slate-800 rounded-lg border border-slate-700 h-9 overflow-hidden">
                            <div className="flex items-center justify-center w-8 h-full border-r border-slate-700 bg-slate-800/50">
                                <Calendar size={14} className="text-slate-400" />
                            </div>
                            <div className="flex items-center gap-1 px-1 h-full">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-slate-300 text-xs outline-none px-1 w-24 h-full" />
                                <span className="text-slate-600 text-[10px] mx-1">-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-slate-300 text-xs outline-none px-1 w-24 h-full" />
                            </div>
                            {isCustomDateFilter && (
                                <button onClick={() => { setStartDate(defaultStartDate); setEndDate(defaultEndDate); }} className="text-xs text-blue-400 hover:text-white w-8 h-full flex items-center justify-center transition-colors border-l border-slate-700 hover:bg-slate-700" title="Reset to All Time">
                                    <RotateCcw size={12} />
                                </button>
                            )}
                        </div>

                        <div className="relative" ref={filterMenuRef}>
                            <button onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} className={`flex items-center gap-2 px-3 h-9 border rounded-lg text-xs font-medium transition-colors ${isFilterPanelOpen || hasActiveAttributeFilters ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                                <Filter size={14} /> Filters {hasActiveAttributeFilters && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                            </button>
                            {isFilterPanelOpen && (
                                <div className="absolute left-0 top-full mt-2 w-[640px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-visible">
                                    <div className="p-4 grid grid-cols-3 gap-4 bg-slate-900/50">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Symbol</label>
                                            <select value={symbolFilter} onChange={(e) => setSymbolFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">All Symbols</option>
                                                {uniqueSymbols.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Direction</label>
                                            <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">All</option>
                                                <option value={TradeType.LONG}>Long</option>
                                                <option value={TradeType.SHORT}>Short</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Setup</label>
                                            <select value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">All Setups</option>
                                                {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Status</label>
                                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">All</option>
                                                <option value={TradeStatus.WIN}>WIN</option>
                                                <option value={TradeStatus.LOSS}>LOSS</option>
                                                <option value={TradeStatus.BREAK_EVEN}>BREAK EVEN</option>
                                                <option value={TradeStatus.OPEN}>OPEN</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Mistake</label>
                                            <select value={mistakeFilter} onChange={(e) => setMistakeFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">Any</option>
                                                {TRADING_MISTAKES.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500">Emotion</label>
                                            <select value={emotionFilter} onChange={(e) => setEmotionFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none">
                                                <option value="">Any</option>
                                                {TRADING_EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-3 relative">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Tag size={10} /> Tags (Search)</label>
                                            <input
                                                type="text"
                                                value={tagFilter}
                                                onChange={(e) => {
                                                    setTagFilter(e.target.value);
                                                    setShowTagSuggestions(true);
                                                }}
                                                onFocus={() => setShowTagSuggestions(true)}
                                                placeholder="Type to filter by custom tags..."
                                                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:border-blue-500 outline-none mt-1"
                                            />
                                            {showTagSuggestions && filteredTags.length > 0 && (
                                                <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto z-50">
                                                    {filteredTags.map(tag => (
                                                        <div
                                                            key={tag}
                                                            onClick={() => {
                                                                setTagFilter(tag);
                                                                setShowTagSuggestions(false);
                                                            }}
                                                            className="px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                                                        >
                                                            {tag}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {hasActiveAttributeFilters && (
                                        <div className="p-3 border-t border-slate-700 bg-slate-800 flex justify-end">
                                            <button onClick={(e) => { e.stopPropagation(); handleResetFilters(); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors">
                                                <RefreshCcw size={12} /> Reset Filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={columnMenuRef}>
                            <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="flex items-center gap-2 px-3 h-9 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors">
                                <Settings2 size={14} /> Columns
                            </button>
                            {isColumnMenuOpen && (
                                <div className="absolute left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                    <div className="p-2 border-b border-slate-700 bg-slate-900/50">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Visible Columns</span>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-1">
                                        {columns.map(col => (
                                            <div key={col.id} onClick={() => toggleColumnVisibility(col.id)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 rounded cursor-pointer text-sm text-slate-300 select-none">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleColumns.has(col.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                                                    {visibleColumns.has(col.id) && <Check size={10} className="text-white" />}
                                                </div>
                                                {col.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left table-fixed border-collapse">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                {visibleCols.map((col, index) => (
                                    <th key={col.id} style={{ width: col.width }} className={`relative px-4 py-4 cursor-grab active:cursor-grabbing hover:bg-slate-800/50 transition-colors group select-none text-left ${draggedColumnIndex === index ? 'opacity-50' : ''}`} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd}>
                                        <div className={`flex items-center gap-2 overflow-hidden justify-start`}>
                                            <GripHorizontal size={12} className="text-slate-600 flex-shrink-0" />
                                            <span className="truncate">{col.label}</span>
                                            {col.tooltip && (
                                                <div className="group/tooltip relative">
                                                    <Info size={12} className="text-slate-600 hover:text-blue-400 transition-colors cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed font-normal normal-case">
                                                        {col.tooltip}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 z-10 transition-colors" onMouseDown={(e) => startResize(e, index)} onClick={(e) => e.stopPropagation()} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {paginatedTrades.length > 0 ? (
                                paginatedTrades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer group" onClick={() => onSelectTrade(trade)}>
                                        {visibleCols.map((col) => (
                                            <td key={`${trade.id}-${col.id}`} className={`px-4 py-4 truncate overflow-hidden ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                                {renderCell(trade, col.id)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleCols.length} className="px-4 py-10 text-center text-slate-500">
                                        {trades.length === 0 ? "No trades recorded. Sync with OANDA to get started." : "No trades found within the selected criteria."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800">
                    <div className="text-xs text-slate-400">
                        Showing <span className="font-medium text-white">{filteredTrades.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTrades.length)}</span> of <span className="font-medium text-white">{filteredTrades.length}</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded">{currentPage} / {totalPages || 1}</div>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
