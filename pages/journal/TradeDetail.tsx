
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trade, AIAnalysisResponse, TradeType, TradeStatus, Strategy } from '../../types';
import { ChartComponent } from './ChartComponent';
import { analyzeTradeWithGemini } from '../../services/geminiService';
import { fetchTradeEnrichmentData, TradeEnrichment } from '../../services/oandaService';
import { getAllUniqueTags } from '../../services/storageService';
import { TRADING_MISTAKES, TRADING_EMOTIONS } from '../../constants';
import { ArrowLeft, BrainCircuit, Target, Clock, Activity, AlertTriangle, Smile, Calendar, Settings, ChevronRight, AlertCircle, Save, Loader2, Tag, X, Plus, CheckSquare, Square, Info, ShoppingCart, Hash, Compass, List, MousePointerClick, Layers, Shield, Flag, Percent, DollarSign, ShieldAlert } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface TradeDetailProps {
    trade: Trade;
    onBack: () => void;
    onUpdate: (trade: Trade) => void;
    onSettingsClick: () => void;
    strategies: Strategy[];
}

export const TradeDetail: React.FC<TradeDetailProps> = ({ trade, onBack, onUpdate, onSettingsClick, strategies }) => {
    const { formatDate, geminiApiKey, isGeminiKeyValid, formatCurrency, oandaApiKey, oandaAccountId, oandaEnv } = useSettings();
    // ... (rest of the file remains the same until the setup dropdown)
    const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Trade>(trade);
    const [hasChanges, setHasChanges] = useState(false);

    const [fetchingEnrichment, setFetchingEnrichment] = useState(false);
    const [enrichmentData, setEnrichmentData] = useState<TradeEnrichment | null>(null);

    const [tagInput, setTagInput] = useState('');
    const [existingTags, setExistingTags] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const tagInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setFormData(trade);
        setAnalysis(null);
        setAnalysisError(null);
        setHasChanges(false);
        setTagInput('');
        setExistingTags(getAllUniqueTags());
        setEnrichmentData(null);
    }, [trade]);

    useEffect(() => {
        const loadTradeDetails = async () => {
            if (oandaApiKey && oandaAccountId && trade.id) {
                setFetchingEnrichment(true);
                const data = await fetchTradeEnrichmentData(trade, oandaAccountId, oandaApiKey, oandaEnv);
                setEnrichmentData(data);
                setFetchingEnrichment(false);

                // Auto-persist Initial Stop Loss if found and different from current record
                // This ensures the R-Multiple calculation in the list view is correct immediately
                if (data.initialStopLoss !== null && data.initialStopLoss !== undefined && data.initialStopLoss !== trade.initialStopLoss) {
                    const updatedTrade = { ...trade, initialStopLoss: data.initialStopLoss };
                    setFormData(updatedTrade);
                    onUpdate(updatedTrade); // Save to storage immediately
                }
            }
        };

        loadTradeDetails();
    }, [trade.id, oandaApiKey, oandaAccountId, oandaEnv]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
                setShowTagSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAnalyze = async () => {
        if (!geminiApiKey || !isGeminiKeyValid) return;
        setLoadingAnalysis(true);
        setAnalysisError(null);
        try {
            const result = await analyzeTradeWithGemini(trade, geminiApiKey);
            setAnalysis(result);
        } catch (e: any) {
            setAnalysisError(e.message || "Failed to analyze trade.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const handleJournalChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setHasChanges(true);
    };

    const addTag = (tag: string) => {
        const cleanTag = tag.trim();
        if (!cleanTag) return;
        const currentTags = formData.tags || [];
        if (!currentTags.includes(cleanTag)) {
            setFormData(prev => ({ ...prev, tags: [...currentTags, cleanTag] }));
            setHasChanges(true);
        }
        setTagInput('');
        setShowTagSuggestions(false);
    };

    const handleAddTagKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagInput);
        }
    };

    const removeTag = (tagToRemove: string) => {
        const currentTags = formData.tags || [];
        setFormData(prev => ({ ...prev, tags: currentTags.filter(t => t !== tagToRemove) }));
        setHasChanges(true);
    };

    const handleSave = () => {
        onUpdate(formData);
        setHasChanges(false);
    };

    const toggleRule = (rule: string) => {
        const currentRules = formData.followedRules || [];
        const newRules = currentRules.includes(rule)
            ? currentRules.filter(r => r !== rule)
            : [...currentRules, rule];

        setFormData(prev => ({ ...prev, followedRules: newRules }));
        setHasChanges(true);
    };

    const pnlColor = (trade.pnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500';
    const pnlBg = (trade.pnl || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';

    const invested = trade.entryPrice * trade.quantity;
    const roi = invested > 0 && trade.pnl ? (trade.pnl / invested) * 100 : 0;

    const filteredSuggestions = existingTags.filter(
        t => t.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags?.includes(t)
    );

    const selectedStrategy = useMemo(() => {
        return strategies.find(s => s.name === formData.setup);
    }, [strategies, formData.setup]);

    // Separate Compliance Calculation
    const totalEntryRules = selectedStrategy?.entryRules.length || 0;
    const totalExitRules = selectedStrategy?.exitRules.length || 0;

    const matchedEntryRules = formData.followedRules?.filter(r => selectedStrategy?.entryRules.includes(r)).length || 0;
    const matchedExitRules = formData.followedRules?.filter(r => selectedStrategy?.exitRules.includes(r)).length || 0;

    const entryScore = totalEntryRules > 0 ? Math.round((matchedEntryRules / totalEntryRules) * 100) : 0;
    const exitScore = totalExitRules > 0 ? Math.round((matchedExitRules / totalExitRules) * 100) : 0;

    const entryWeight = totalEntryRules > 0 ? (100 / totalEntryRules) : 0;
    const exitWeight = totalExitRules > 0 ? (100 / totalExitRules) : 0;

    const currentDisplayedSL = formData.initialStopLoss || trade.stopLoss || 0;
    const isSLInvalid = currentDisplayedSL > 0 && (
        (trade.type === TradeType.LONG && currentDisplayedSL >= trade.entryPrice) ||
        (trade.type === TradeType.SHORT && currentDisplayedSL <= trade.entryPrice)
    );

    // Slippage Calculation
    // 1. Exit Slippage: ONLY if close reason was STOP_LOSS
    const finalStopLoss = trade.stopLoss;
    let exitSlippageAmount = 0;
    let hasExitSlippage = false;

    if (trade.exitPrice && finalStopLoss && enrichmentData?.exitReason === 'STOP_LOSS_ORDER') {
        // Calculate diff
        if (trade.type === TradeType.LONG) {
            if (trade.exitPrice < finalStopLoss) {
                exitSlippageAmount = finalStopLoss - trade.exitPrice;
                hasExitSlippage = true;
            }
        } else {
            if (trade.exitPrice > finalStopLoss) {
                exitSlippageAmount = trade.exitPrice - finalStopLoss;
                hasExitSlippage = true;
            }
        }
    }

    // 2. Entry Slippage: Compare Entry Price vs Order Price (Only for Limit/Stop Orders)
    let entrySlippageAmount = 0;
    let hasEntrySlippage = false;
    const orderType = enrichmentData?.entryOrderType;
    const isPendingOrder = orderType === 'LIMIT' || orderType === 'STOP' || orderType === 'MARKET_IF_TOUCHED';

    if (enrichmentData?.initialEntryPrice && trade.entryPrice && isPendingOrder) {
        entrySlippageAmount = Math.abs(trade.entryPrice - enrichmentData.initialEntryPrice);
        if (entrySlippageAmount > 0.00001) {
            hasEntrySlippage = true;
        }
    }

    const pricePrecision = trade.symbol.includes('JPY') ? 3 : 5;

    const formatOrderType = (type: string | null | undefined) => {
        if (!type) return '-';
        switch (type) {
            case 'MARKET': return 'Market';
            case 'LIMIT': return 'Limit Order';
            case 'STOP': return 'Stop Order';
            case 'MARKET_IF_TOUCHED': return 'MIT Order';
            default: return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        }
    };

    const formatExitReason = (reason: string | null | undefined) => {
        if (!reason) return '-';
        if (reason.includes('STOP_LOSS')) return 'Stop Loss';
        if (reason.includes('TAKE_PROFIT')) return 'Take Profit';
        if (reason.includes('MARKET_ORDER_TRADE_CLOSE')) return 'Manual Close';
        if (reason.includes('TRAILING_STOP')) return 'Trailing Stop';
        return reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="animate-fade-in space-y-6 pb-20">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {trade.symbol}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-lg ${pnlBg} ${pnlColor} font-mono font-bold text-xl flex items-center gap-2`}>
                        {trade.pnl && trade.pnl > 0 ? '+' : ''}{formatCurrency(trade.pnl || 0)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">

                <div className="h-full">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4 min-h-[32px]">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                Trade Parameters
                            </h3>
                        </div>

                        <div className="space-y-4 flex-1 flex flex-col">
                            <div>
                                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Hash size={10} /> Symbol</label>
                                <div className="font-bold text-white text-sm">{trade.symbol}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Compass size={10} /> Direction</label>
                                    <div className={`inline-flex items-center px-2.5 py-1 rounded border text-xs font-bold ${trade.type === TradeType.LONG
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                        }`}>
                                        {trade.type}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Info size={10} /> Status</label>
                                    <div className={`font-medium text-sm ${trade.status === TradeStatus.WIN ? 'text-emerald-400' :
                                        trade.status === TradeStatus.LOSS ? 'text-rose-400' :
                                            trade.status === TradeStatus.OPEN ? 'text-amber-400' : 'text-slate-400'
                                        }`}>{trade.status.replace('_', ' ')}</div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><List size={10} /> Strategy / Setup</label>
                                <select
                                    name="setup"
                                    value={formData.setup}
                                    onChange={handleJournalChange}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none hover:border-slate-600 transition-colors cursor-pointer"
                                >
                                    <option value="">Select Setup...</option>
                                    {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>

                            {selectedStrategy && (
                                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 animate-fade-in">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Strategy Rules</div>

                                    {selectedStrategy.entryRules.length > 0 && (
                                        <div className="mb-3">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[10px] font-bold text-emerald-400/80">ENTRY RULES</span>
                                                <span className={`text-[10px] font-bold ${entryScore === 100 ? 'text-emerald-400' : 'text-slate-400'}`}>{entryScore}%</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {selectedStrategy.entryRules.map((rule, idx) => {
                                                    const isChecked = formData.followedRules?.includes(rule);
                                                    return (
                                                        <div key={`entry-${idx}`} className="flex items-start gap-2 cursor-pointer group" onClick={() => toggleRule(rule)}>
                                                            <div className={`mt-0.5 flex-shrink-0 transition-colors ${isChecked ? 'text-emerald-500' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                                                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                                                            </div>
                                                            <span className={`text-xs leading-tight transition-colors ${isChecked ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                                                {rule} <span className="opacity-50 ml-1">({entryWeight.toFixed(0)}%)</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {selectedStrategy.exitRules.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[10px] font-bold text-rose-400/80">EXIT RULES</span>
                                                <span className={`text-[10px] font-bold ${exitScore === 100 ? 'text-rose-400' : 'text-slate-400'}`}>{exitScore}%</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {selectedStrategy.exitRules.map((rule, idx) => {
                                                    const isChecked = formData.followedRules?.includes(rule);
                                                    return (
                                                        <div key={`exit-${idx}`} className="flex items-start gap-2 cursor-pointer group" onClick={() => toggleRule(rule)}>
                                                            <div className={`mt-0.5 flex-shrink-0 transition-colors ${isChecked ? 'text-rose-500' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                                                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                                                            </div>
                                                            <span className={`text-xs leading-tight transition-colors ${isChecked ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                                                {rule} <span className="opacity-50 ml-1">({exitWeight.toFixed(0)}%)</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><AlertTriangle size={10} /> Mistake</label>
                                    <select
                                        name="mistake"
                                        value={formData.mistake || ''}
                                        onChange={handleJournalChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-rose-300 focus:ring-1 focus:ring-rose-500 outline-none hover:border-slate-600 transition-colors cursor-pointer"
                                    >
                                        <option value="">None</option>
                                        {TRADING_MISTAKES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Smile size={10} /> Emotion</label>
                                    <select
                                        name="emotion"
                                        value={formData.emotion || ''}
                                        onChange={handleJournalChange}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-purple-300 focus:ring-1 focus:ring-purple-500 outline-none hover:border-slate-600 transition-colors cursor-pointer"
                                    >
                                        <option value="">None</option>
                                        {TRADING_EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div ref={tagInputRef} className="relative">
                                <label className="text-xs text-slate-500 block mb-1 flex items-center gap-1"><Tag size={10} /> Custom Tags</label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {formData.tags && formData.tags.map((tag, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 border border-slate-600">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={10} /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => {
                                            setTagInput(e.target.value);
                                            setShowTagSuggestions(true);
                                        }}
                                        onFocus={() => setShowTagSuggestions(true)}
                                        onKeyDown={handleAddTagKey}
                                        placeholder="Add tag..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={() => addTag(tagInput)}
                                        className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white rounded px-2 flex items-center justify-center transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                {showTagSuggestions && filteredSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-32 overflow-y-auto z-50">
                                        {filteredSuggestions.map(tag => (
                                            <div
                                                key={tag}
                                                onClick={() => addTag(tag)}
                                                className="px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                                            >
                                                {tag}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-slate-700 my-2 pt-2"></div>

                            {/* Entry Section */}
                            <div>
                                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Calendar size={12} /> Entry Time</label>
                                <div className="font-mono text-sm text-white">
                                    {formatDate(trade.entryTimestamp || trade.entryDate)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Target size={12} /> Entry Price</label>
                                    <div className="font-mono text-white text-sm">{trade.entryPrice}</div>
                                    {hasEntrySlippage && (
                                        <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1 animate-fade-in">
                                            <AlertTriangle size={10} />
                                            <span>Slippage: {entrySlippageAmount.toFixed(pricePrecision)}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><MousePointerClick size={10} /> Entry Order Type</label>
                                    <div className="font-medium text-sm text-slate-300">
                                        {formatOrderType(enrichmentData?.entryOrderType)}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Layers size={10} /> Quantity</label>
                                <div className="font-mono text-slate-400 text-sm">{trade.quantity}</div>
                            </div>

                            <div className="border-t border-slate-700 my-2 pt-2"></div>

                            {/* Exit Section */}
                            <div>
                                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Clock size={12} /> Exit Time</label>
                                <div className="font-mono text-sm text-white">
                                    {formatDate(trade.exitTimestamp || '')}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Activity size={12} /> Exit Price</label>
                                    <div className="font-mono text-white text-sm">{trade.exitPrice || '-'}</div>
                                    {hasExitSlippage && (
                                        <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1 animate-fade-in">
                                            <AlertTriangle size={10} />
                                            <span>Slippage: {exitSlippageAmount.toFixed(pricePrecision)}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><MousePointerClick size={10} /> Exit Order Type</label>
                                    <div className="font-medium text-sm text-slate-300">
                                        {formatExitReason(enrichmentData?.exitReason)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-xs text-rose-400 block mb-1 flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <ShieldAlert size={10} /> Initial Stop Loss
                                            {isSLInvalid && !fetchingEnrichment && (
                                                <div className="group relative">
                                                    <AlertTriangle size={12} className="text-amber-500 cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                                                        This Stop Loss appears to be in profit or invalid relative to entry price.
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </span>
                                    </label>
                                    {fetchingEnrichment ? (
                                        <div className="py-1">
                                            <Loader2 size={16} className="animate-spin text-slate-500" />
                                        </div>
                                    ) : (
                                        <div className={`font-mono text-sm py-1 ${isSLInvalid ? 'text-amber-400 line-through decoration-amber-500/50' : 'text-rose-400'}`}>
                                            {formData.initialStopLoss || '-'}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-emerald-400 flex items-center gap-1 mb-1"><Flag size={10} /> Initial Take Profit</label>
                                    <div className="font-mono text-emerald-400 text-sm py-1">{trade.takeProfit || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-rose-400 flex items-center gap-1 mb-1"><Shield size={10} /> Final Stop Loss</label>
                                    <div className="font-mono text-rose-400 text-sm py-1">{trade.stopLoss || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-emerald-400 flex items-center gap-1 mb-1"><Flag size={10} /> Final Take Profit</label>
                                    <div className="font-mono text-emerald-400 text-sm py-1">{trade.takeProfit || '-'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-700 mt-auto">
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><Percent size={10} /> Return (ROI)</label>
                                    <div className={`font-mono text-sm font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {roi.toFixed(2)}%
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1"><DollarSign size={10} /> Net P&L</label>
                                    <div className={`font-mono text-sm font-bold ${trade.pnl && trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {formatCurrency(trade.pnl || 0)}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={!hasChanges}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${hasChanges
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700'
                                    }`}
                            >
                                <Save size={16} />
                                {hasChanges ? 'Save Changes' : 'Saved'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-6 flex flex-col">

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-1 shadow-lg relative">
                        <ChartComponent
                            trade={formData}
                            onSettingsClick={onSettingsClick}
                            fetchingInitialSL={fetchingEnrichment}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-full">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Trader Notes</h3>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleJournalChange}
                                rows={6}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none resize-none hover:border-slate-600 transition-colors h-[calc(100%-2rem)]"
                                placeholder="Enter your thoughts on this trade..."
                            />
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 relative overflow-hidden flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <BrainCircuit size={16} /> AI Coach
                                </h3>
                            </div>

                            {loadingAnalysis && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-500 animate-pulse flex-1">
                                    <Activity className="animate-spin mb-2" />
                                    <span className="text-xs">Analyzing price action & behavior...</span>
                                </div>
                            )}

                            {!loadingAnalysis && !analysis && (
                                <div className="flex-1 flex flex-col justify-center items-center text-center">
                                    {!isGeminiKeyValid ? (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-indigo-500/10 rounded-full inline-block">
                                                <Settings size={24} className="text-indigo-400" />
                                            </div>
                                            <p className="text-sm text-slate-400">Configure Gemini API to enable AI analysis.</p>
                                            <button
                                                onClick={onSettingsClick}
                                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto"
                                            >
                                                Go to Settings <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-500 italic">
                                                Get AI-powered feedback on your execution and psychology.
                                            </p>
                                            {analysisError ? (
                                                <div className="text-rose-400 text-xs bg-rose-500/10 p-2 rounded border border-rose-500/20 mb-2 flex items-center gap-2 justify-center">
                                                    <AlertCircle size={12} /> {analysisError}
                                                </div>
                                            ) : null}
                                            <button
                                                onClick={handleAnalyze}
                                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                Analyze Trade
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {analysis && (
                                <div className="animate-fade-in">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="text-3xl font-bold text-white">{analysis.score}<span className="text-sm text-slate-500 font-normal">/100</span></div>
                                        <div className="flex gap-1">
                                            {analysis.tags.map((tag, i) => (
                                                <span key={i} className="text-[10px] uppercase bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed border-t border-slate-700/50 pt-3">
                                        {analysis.feedback}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
