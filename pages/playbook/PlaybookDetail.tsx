
import React, { useState, useMemo, useEffect } from 'react';
import { Strategy, Trade, TradeStatus } from '../../types';
import { Edit2, ListChecks, LogIn, LogOut, Calculator, BookOpen, Clock, ClipboardCheck, ArrowLeftRight, Save, X, GripVertical, Plus, Target, Trash2 } from 'lucide-react';
import { WinRateChart } from './WinRateChart';
import { useSettings } from '../../contexts/SettingsContext';

interface PlaybookDetailProps {
    strategy: Strategy;
    onSave: (strategy: Strategy) => void;
    trades: Trade[];
    onSelectTrade: (trade: Trade) => void;
    onDeleteTrade: (tradeId: string) => void;
    onViewTrades: (strategyName: string) => void;
    onDelete: (id: string) => void;
}

export const PlaybookDetail: React.FC<PlaybookDetailProps> = ({
    strategy,
    onSave,
    trades,
    onSelectTrade,
    onDeleteTrade,
    onViewTrades,
    onDelete
}) => {
    const { formatCurrency } = useSettings();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Strategy>(strategy);

    useEffect(() => {
        setFormData(strategy);
    }, [strategy, isEditing]);

    const [draggedItem, setDraggedItem] = useState<{ index: number; type: 'entry' | 'exit' } | null>(null);

    const relevantTrades = useMemo(() => {
        return trades.filter(t => t.setup === strategy.name);
    }, [trades, strategy.name]);

    const stats = useMemo(() => {
        const count = relevantTrades.length;
        if (count === 0) return null;

        const winningTrades = relevantTrades.filter(t => t.status === TradeStatus.WIN);
        const losingTrades = relevantTrades.filter(t => t.status === TradeStatus.LOSS);

        const wins = winningTrades.length;
        const losses = losingTrades.length;
        const winRate = (wins / count) * 100;

        const totalPnl = relevantTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

        const grossProfit = winningTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (t.pnl || 0), 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;

        let totalHoldTime = 0;
        let holdTimeCount = 0;
        relevantTrades.forEach(t => {
            if (t.entryTimestamp && t.exitTimestamp) {
                totalHoldTime += (t.exitTimestamp - t.entryTimestamp);
                holdTimeCount++;
            }
        });
        const avgHoldSeconds = holdTimeCount > 0 ? totalHoldTime / holdTimeCount : 0;
        const avgHoldMinutes = avgHoldSeconds / 60;
        const holdTimeDisplay = avgHoldMinutes > 60
            ? `${(avgHoldMinutes / 60).toFixed(1)}h`
            : `${avgHoldMinutes.toFixed(0)}m`;

        const winRateDecimal = wins / count;
        const lossRateDecimal = losses / count;
        const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);

        const dailyPnls: Record<string, number> = {};
        relevantTrades.forEach(t => {
            if (!dailyPnls[t.entryDate]) dailyPnls[t.entryDate] = 0;
            dailyPnls[t.entryDate] += (t.pnl || 0);
        });
        const dailyPnlValues = Object.values(dailyPnls);
        const tradingDays = dailyPnlValues.length;
        const avgDailyNetPnl = tradingDays > 0 ? dailyPnlValues.reduce((a, b) => a + b, 0) / tradingDays : 0;
        const avgDailyTrades = tradingDays > 0 ? count / tradingDays : 0;

        let totalEntryComp = 0;
        let totalExitComp = 0;
        const entryRulesCount = strategy.entryRules.length;
        const exitRulesCount = strategy.exitRules.length;

        relevantTrades.forEach(t => {
            const followed = t.followedRules || [];
            if (entryRulesCount > 0) {
                const matched = followed.filter(r => strategy.entryRules.includes(r)).length;
                totalEntryComp += (matched / entryRulesCount);
            } else {
                totalEntryComp += 1; // Default to 100% if no rules defined
            }

            if (exitRulesCount > 0) {
                const matched = followed.filter(r => strategy.exitRules.includes(r)).length;
                totalExitComp += (matched / exitRulesCount);
            } else {
                totalExitComp += 1; // Default to 100% if no rules defined
            }
        });

        const avgEntryCompliance = count > 0 ? (totalEntryComp / count) * 100 : 0;
        const avgExitCompliance = count > 0 ? (totalExitComp / count) * 100 : 0;

        return {
            count,
            wins,
            losses,
            winRate,
            totalPnl,
            profitFactor,
            avgWin,
            avgLoss,
            holdTimeDisplay,
            expectancy,
            avgDailyNetPnl,
            avgDailyTrades,
            avgEntryCompliance,
            avgExitCompliance
        };
    }, [relevantTrades, strategy]);

    const getRuleAdherence = (rule: string) => {
        if (relevantTrades.length === 0) return 0;
        const count = relevantTrades.filter(t => t.followedRules?.includes(rule)).length;
        return Math.round((count / relevantTrades.length) * 100);
    };

    const handleSaveClick = () => {
        if (!formData.name) return;
        onSave(formData);
        setIsEditing(false);
    };

    const handleCancelClick = () => {
        setFormData(strategy);
        setIsEditing(false);
    };

    const handleRuleChange = (type: 'entry' | 'exit', index: number, value: string) => {
        if (type === 'entry') {
            const newRules = [...formData.entryRules];
            newRules[index] = value;
            setFormData(prev => ({ ...prev, entryRules: newRules }));
        } else {
            const newRules = [...formData.exitRules];
            newRules[index] = value;
            setFormData(prev => ({ ...prev, exitRules: newRules }));
        }
    };

    const addRuleField = (type: 'entry' | 'exit') => {
        if (type === 'entry') {
            setFormData(prev => ({ ...prev, entryRules: [...prev.entryRules, ''] }));
        } else {
            setFormData(prev => ({ ...prev, exitRules: [...prev.exitRules, ''] }));
        }
    };

    const removeRuleField = (type: 'entry' | 'exit', index: number) => {
        if (type === 'entry') {
            setFormData(prev => ({ ...prev, entryRules: prev.entryRules.filter((_, i) => i !== index) }));
        } else {
            setFormData(prev => ({ ...prev, exitRules: prev.exitRules.filter((_, i) => i !== index) }));
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number, type: 'entry' | 'exit') => {
        setDraggedItem({ index, type });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number, type: 'entry' | 'exit') => {
        e.preventDefault();
        if (!draggedItem || draggedItem.type !== type || draggedItem.index === index) return;

        if (type === 'entry') {
            const newRules = [...formData.entryRules];
            const item = newRules[draggedItem.index];
            newRules.splice(draggedItem.index, 1);
            newRules.splice(index, 0, item);
            setFormData(prev => ({ ...prev, entryRules: newRules }));
        } else {
            const newRules = [...formData.exitRules];
            const item = newRules[draggedItem.index];
            newRules.splice(draggedItem.index, 1);
            newRules.splice(index, 0, item);
            setFormData(prev => ({ ...prev, exitRules: newRules }));
        }

        setDraggedItem({ index, type });
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const renderRuleInput = (rule: string, index: number, type: 'entry' | 'exit') => (
        <div
            key={`${type}-${index}`}
            className="flex gap-2 items-center group bg-slate-800 border border-slate-700 rounded p-1.5 transition-colors hover:border-slate-600 mb-2"
            draggable
            onDragStart={(e) => handleDragStart(e, index, type)}
            onDragOver={(e) => handleDragOver(e, index, type)}
            onDragEnd={handleDragEnd}
        >
            <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-1">
                <GripVertical size={14} />
            </div>
            <div className={`text-[10px] font-mono ${type === 'entry' ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
                {index + 1}.
            </div>
            <input
                type="text"
                value={rule}
                onChange={(e) => handleRuleChange(type, index, e.target.value)}
                className="flex-1 bg-transparent border-none text-slate-200 focus:ring-0 outline-none text-sm placeholder-slate-600"
                placeholder={`${type === 'entry' ? 'Entry' : 'Exit'} rule...`}
            />
            <button
                type="button"
                onClick={() => removeRuleField(type, index)}
                className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X size={14} />
            </button>
        </div>
    );

    return (
        <div className="w-full animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl mb-6 p-6 shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500 p-3 rounded-lg shadow-lg shadow-blue-500/20">
                            <ListChecks className="text-white" size={28} />
                        </div>
                        <div>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="text-xl font-bold text-white bg-slate-900/50 border border-slate-600 rounded px-2 py-1 outline-none focus:border-blue-500 w-full"
                                />
                            ) : (
                                <h2 className="text-xl font-bold text-white">{strategy.name}</h2>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                {stats && (
                                    <>
                                        <div className={`text-sm font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {stats.winRate.toFixed(1)}% WR
                                        </div>
                                        <span className="text-slate-600">•</span>
                                        <div className="text-sm text-slate-400">{stats.count} Trades</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onViewTrades(strategy.name)}
                        className="px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 border bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600 hover:text-white"
                    >
                        <ArrowLeftRight size={18} /> View Trades
                    </button>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Net P&L / Daily P&L</div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`text-2xl font-mono font-bold ${stats && stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stats ? formatCurrency(stats.totalPnl) : '0.00'}
                            </span>
                            <span className="text-slate-600 text-xl font-light">/</span>
                            <span className={`text-lg font-mono font-bold ${stats && stats.avgDailyNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stats ? formatCurrency(stats.avgDailyNetPnl).replace(/\.\d+/, '') : '0'}
                            </span>
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-transparent opacity-20"></div>
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Calculator size={16} className="text-purple-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Expectancy</span>
                        </div>
                        <div className={`text-2xl font-mono font-bold ${stats && stats.expectancy >= 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                            {stats ? formatCurrency(stats.expectancy) : '0.00'}
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Profit Factor</div>
                        <div className="text-2xl font-mono font-bold text-amber-400">
                            {stats ? stats.profitFactor.toFixed(2) : '0.00'}
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Total / Daily Trades</div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-2xl font-mono font-bold text-slate-200">
                                {stats ? stats.count : 0}
                            </span>
                            <span className="text-slate-600 text-xl font-light">/</span>
                            <span className="text-lg font-mono font-bold text-slate-400">
                                {stats ? stats.avgDailyTrades.toFixed(1) : '0.0'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Win Rate</div>
                        <div className="flex items-center gap-3">
                            <WinRateChart percentage={stats ? stats.winRate : 0} count={stats ? stats.count : 0} />
                            <div className={`text-2xl font-mono font-bold ${stats && stats.winRate >= 50 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {stats ? stats.winRate.toFixed(1) : '0'}%
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-transparent opacity-20"></div>
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Target size={16} className="text-blue-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Win / Loss</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs text-slate-500">Win</span>
                                <span className="text-lg text-emerald-400 font-mono font-bold">{stats ? formatCurrency(stats.avgWin).replace(/\.\d+/, '') : '0'}</span>
                            </div>
                            <span className="text-slate-600">/</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs text-slate-500">Loss</span>
                                <span className="text-lg text-rose-400 font-mono font-bold">{stats ? formatCurrency(stats.avgLoss).replace(/\.\d+/, '') : '0'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-amber-500 to-transparent opacity-20"></div>
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Clock size={16} className="text-amber-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Hold Time</span>
                        </div>
                        <div className="text-2xl font-mono font-bold text-slate-200">
                            {stats ? stats.holdTimeDisplay : '-'}
                        </div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-transparent opacity-20"></div>
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <ClipboardCheck size={16} className="text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Rules Compliance</span>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 text-xs font-semibold">Entry</span>
                                <span className={`font-mono font-bold ${stats?.avgEntryCompliance >= 80 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                    {stats ? stats.avgEntryCompliance.toFixed(0) : '0'}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                                <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${stats?.avgEntryCompliance || 0}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-1">
                                <span className="text-slate-500 text-xs font-semibold">Exit</span>
                                <span className={`font-mono font-bold ${stats?.avgExitCompliance >= 80 ? 'text-rose-400' : 'text-slate-300'}`}>
                                    {stats ? stats.avgExitCompliance.toFixed(0) : '0'}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                                <div className="bg-rose-500 h-1 rounded-full" style={{ width: `${stats?.avgExitCompliance || 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
                        <h3 className="text-slate-300 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <BookOpen size={16} /> Strategy Details
                        </h3>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this strategy?')) {
                                            onDelete(strategy.id);
                                        }
                                    }}
                                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors mr-2"
                                    title="Delete Strategy"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={handleSaveClick}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20"
                                >
                                    <Save size={14} /> Save
                                </button>
                                <button
                                    onClick={handleCancelClick}
                                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                                >
                                    <X size={14} /> Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                title="Edit Strategy"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-8">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Description</label>
                            {isEditing ? (
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 outline-none resize-none"
                                />
                            ) : (
                                <p className="text-slate-300 text-lg leading-relaxed">
                                    {strategy.description}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className={`rounded-xl border ${isEditing ? 'border-slate-600 bg-slate-900/20 p-4' : 'border-transparent p-0'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <LogIn className="text-emerald-500" size={18} />
                                        <h3 className="font-bold text-slate-200">Entry Rules</h3>
                                    </div>
                                    {isEditing && (
                                        <button onClick={() => addRuleField('entry')} className="text-emerald-400 hover:text-white text-xs flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded">
                                            <Plus size={12} /> Add
                                        </button>
                                    )}
                                </div>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        {formData.entryRules.map((rule, i) => renderRuleInput(rule, i, 'entry'))}
                                        <p className="text-[10px] text-slate-500 mt-2 text-center italic">Drag to reorder</p>
                                    </div>
                                ) : (
                                    <ul className="space-y-4">
                                        {strategy.entryRules.map((rule, i) => {
                                            const adherence = getRuleAdherence(rule);
                                            return (
                                                <li key={i} className="flex gap-3 items-start">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold font-mono mt-0.5 border border-emerald-500/20">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <span className="text-slate-300 leading-relaxed block">{rule}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="h-1 w-24 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full ${adherence >= 80 ? 'bg-emerald-500' : 'bg-slate-500'}`} style={{ width: `${adherence}%` }}></div>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold">{adherence}% Adherence</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className={`rounded-xl border ${isEditing ? 'border-slate-600 bg-slate-900/20 p-4' : 'border-transparent p-0'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <LogOut className="text-rose-500" size={18} />
                                        <h3 className="font-bold text-slate-200">Exit Rules</h3>
                                    </div>
                                    {isEditing && (
                                        <button onClick={() => addRuleField('exit')} className="text-rose-400 hover:text-white text-xs flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 transition-colors"
                                        >
                                            <Plus size={12} /> Add
                                        </button>
                                    )}
                                </div>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        {formData.exitRules.map((rule, i) => renderRuleInput(rule, i, 'exit'))}
                                        <p className="text-[10px] text-slate-500 mt-2 text-center italic">Drag to reorder</p>
                                    </div>
                                ) : (
                                    <ul className="space-y-4">
                                        {strategy.exitRules.map((rule, i) => {
                                            const adherence = getRuleAdherence(rule);
                                            return (
                                                <li key={i} className="flex gap-3 items-start">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs font-bold font-mono mt-0.5 border border-rose-500/20">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <span className="text-slate-300 leading-relaxed block">{rule}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="h-1 w-24 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full ${adherence >= 80 ? 'bg-emerald-500' : 'bg-slate-500'}`} style={{ width: `${adherence}%` }}></div>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-bold">{adherence}% Adherence</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
