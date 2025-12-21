import React, { useState, useEffect, useRef } from 'react';
import { Trade, TradeStatus, TradeType, Strategy } from '../../types';
import { TRADING_MISTAKES, TRADING_EMOTIONS } from '../../constants';
import { getAllUniqueTags } from '../../services/storageService';
import { X, Save, Calendar, Clock, AlertTriangle, Smile, Target, Activity, Tag, Plus } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface AddTradeFormProps {
    onSave: (trade: Trade) => void;
    onCancel: () => void;
    strategies: Strategy[];
}

export const AddTradeForm: React.FC<AddTradeFormProps> = ({ onSave, onCancel, strategies }) => {
    const { formatCurrency } = useSettings();

    const getCurrentDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    const [formData, setFormData] = useState<Partial<Trade>>({
        symbol: '',
        type: TradeType.LONG,
        status: TradeStatus.OPEN,
        entryPrice: 0,
        exitPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        quantity: 1,
        entryDate: getCurrentDateTime(),
        exitDate: getCurrentDateTime(),
        notes: '',
        setup: '',
        mistake: '',
        emotion: '',
        tags: []
    });

    const [isExitVisible, setIsExitVisible] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [existingTags, setExistingTags] = useState<string[]>([]);
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const tagInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsExitVisible(formData.status !== TradeStatus.OPEN);
    }, [formData.status]);

    useEffect(() => {
        setExistingTags(getAllUniqueTags());
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
                setShowTagSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (formData.entryPrice && formData.exitPrice && formData.quantity && formData.status !== TradeStatus.OPEN) {
            const isLong = formData.type === TradeType.LONG;
            const diff = formData.exitPrice - formData.entryPrice;
            const pnl = (isLong ? diff : -diff) * formData.quantity;

            setFormData(prev => ({ ...prev, pnl }));
        } else {
            setFormData(prev => ({ ...prev, pnl: 0 }));
        }
    }, [formData.entryPrice, formData.exitPrice, formData.quantity, formData.type, formData.status]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.symbol || !formData.entryPrice) return;

        const entryDateObj = new Date(formData.entryDate!);
        const exitDateObj = isExitVisible && formData.exitDate ? new Date(formData.exitDate) : undefined;

        const newTrade: Trade = {
            id: Math.random().toString(36).substr(2, 9),
            symbol: formData.symbol.toUpperCase(),
            type: formData.type as TradeType,
            status: formData.status as TradeStatus,
            entryPrice: Number(formData.entryPrice),
            exitPrice: isExitVisible ? Number(formData.exitPrice) : undefined,
            stopLoss: Number(formData.stopLoss),
            takeProfit: Number(formData.takeProfit),
            quantity: Number(formData.quantity),
            entryDate: entryDateObj.toISOString().split('T')[0],
            exitDate: exitDateObj ? exitDateObj.toISOString().split('T')[0] : undefined,
            entryTimestamp: Math.floor(entryDateObj.getTime() / 1000),
            exitTimestamp: exitDateObj ? Math.floor(exitDateObj.getTime() / 1000) : undefined,
            pnl: isExitVisible ? formData.pnl : 0,
            notes: formData.notes || '',
            setup: formData.setup,
            mistake: formData.mistake,
            emotion: formData.emotion,
            tags: formData.tags || [],
            mistakes: []
        };

        onSave(newTrade);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (name === 'entryPrice' || name === 'exitPrice' || name === 'quantity' || name === 'stopLoss' || name === 'takeProfit')
                ? parseFloat(value) || 0
                : value
        }));
    };

    const addTag = (tag: string) => {
        const cleanTag = tag.trim();
        if (!cleanTag) return;
        const currentTags = formData.tags || [];
        if (!currentTags.includes(cleanTag)) {
            setFormData(prev => ({ ...prev, tags: [...currentTags, cleanTag] }));
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
    };

    const filteredSuggestions = existingTags.filter(
        t => t.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags?.includes(t)
    );

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Add New Trade</h1>
                    <p className="text-slate-400 text-sm">Record your execution details</p>
                </div>
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">

                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">General Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Symbol</label>
                            <input type="text" name="symbol" value={formData.symbol} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold" placeholder="BTCUSD" required autoFocus />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Direction</label>
                            <select name="type" value={formData.type} onChange={handleChange} className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium ${formData.type === TradeType.LONG ? 'text-emerald-400' : 'text-pink-400'}`}>
                                <option value={TradeType.LONG}>Long</option>
                                <option value={TradeType.SHORT}>Short</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium ${formData.status === TradeStatus.WIN ? 'text-emerald-400' : formData.status === TradeStatus.LOSS ? 'text-rose-400' : formData.status === TradeStatus.OPEN ? 'text-blue-400' : 'text-slate-300'}`}>
                                <option value={TradeStatus.OPEN}>OPEN</option>
                                <option value={TradeStatus.WIN}>WIN</option>
                                <option value={TradeStatus.LOSS}>LOSS</option>
                                <option value={TradeStatus.BREAK_EVEN}>BREAK_EVEN</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">Context</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Setup / Strategy</label>
                            <select name="setup" value={formData.setup} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">Select Setup...</option>
                                {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Mistake</label>
                            <select name="mistake" value={formData.mistake} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-rose-300 focus:ring-2 focus:ring-rose-500 outline-none">
                                <option value="">None</option>
                                {TRADING_MISTAKES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Smile size={12} /> Emotion</label>
                            <select name="emotion" value={formData.emotion} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-purple-300 focus:ring-2 focus:ring-purple-500 outline-none">
                                <option value="">None</option>
                                {TRADING_EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mt-4" ref={tagInputRef}>
                        <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Tag size={12} /> Tags</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {formData.tags && formData.tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-white"><X size={10} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="relative">
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
                                    placeholder="Type tag and press Enter..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => addTag(tagInput)}
                                    className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg px-3 flex items-center justify-center transition-colors"
                                >
                                    <Plus size={18} />
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
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">Execution</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Calendar size={12} /> Entry Time</label>
                            <input type="datetime-local" name="entryDate" value={formData.entryDate} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                            <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono" required />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Target size={12} /> Entry Price</label>
                            <input type="number" name="entryPrice" value={formData.entryPrice || ''} onChange={handleChange} step="0.00000001" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono" required />
                        </div>
                    </div>

                    {isExitVisible && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 animate-fade-in bg-slate-900/30 p-3 rounded-lg border border-slate-700/30">
                            <div className="md:col-start-1">
                                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Clock size={12} /> Exit Time</label>
                                <input type="datetime-local" name="exitDate" value={formData.exitDate} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" />
                            </div>
                            <div className="md:col-start-3">
                                <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1"><Activity size={12} /> Exit Price</label>
                                <input type="number" name="exitPrice" value={formData.exitPrice || ''} onChange={handleChange} step="0.00000001" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono" required={isExitVisible} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 text-rose-400">Stop Loss</label>
                            <input type="number" name="stopLoss" value={formData.stopLoss || ''} onChange={handleChange} step="0.00000001" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-rose-500 outline-none font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 text-emerald-400">Take Profit</label>
                            <input type="number" name="takeProfit" value={formData.takeProfit || ''} onChange={handleChange} step="0.00000001" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">Analysis</h3>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm" placeholder="What was your thought process? Market conditions? Confluence?" />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-4">
                        {isExitVisible && (
                            <div className="text-sm">
                                <span className="text-slate-400">Calculated P&L: </span>
                                <span className={`font-mono font-bold ${(formData.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(formData.pnl || 0)}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">Cancel</button>
                        <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all"><Save size={18} /> Save Trade</button>
                    </div>
                </div>
            </form>
        </div>
    );
};
