
import React, { useMemo, useState } from 'react';
import { Trade, TradeType, TradeStatus, Strategy } from '../../types';
import { OrderState } from './index';
import { CheckSquare, Square, Calculator, ShieldCheck, ChevronsRight } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface OrderPanelProps {
  symbol: string;
  onSave: (trade: Trade) => void;
  strategies: Strategy[];
  orderState: OrderState;
  setOrderState: React.Dispatch<React.SetStateAction<OrderState>>;
  accountBalance?: number;
  onClose?: () => void;
}

export const OrderPanel: React.FC<OrderPanelProps> = ({ symbol, onSave, strategies, orderState, setOrderState, accountBalance = 0, onClose }) => {
  const { formatCurrency, currency: accountCurrency } = useSettings();
  const [riskPercent, setRiskPercent] = useState(0.5);

  const risk = Math.abs(orderState.entryPrice - orderState.stopLoss) * orderState.quantity;
  const reward = Math.abs(orderState.takeProfit - orderState.entryPrice) * orderState.quantity;
  const rrRatio = risk > 0 ? reward / risk : 0;

  const selectedStrategy = useMemo(() => {
      return strategies.find(s => s.name === orderState.setup);
  }, [strategies, orderState.setup]);

  // Calculate Match Percentage
  const matchPercentage = useMemo(() => {
      if (!selectedStrategy || selectedStrategy.entryRules.length === 0) return 0;
      const checkedCount = orderState.followedRules?.filter(r => selectedStrategy.entryRules.includes(r)).length || 0;
      return Math.round((checkedCount / selectedStrategy.entryRules.length) * 100);
  }, [selectedStrategy, orderState.followedRules]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!orderState.entryPrice || !symbol) return;

      const newTrade: Trade = {
          id: Math.random().toString(36).substr(2, 9),
          symbol: symbol.replace('_', ''),
          type: orderState.type,
          status: TradeStatus.OPEN,
          entryPrice: orderState.entryPrice,
          quantity: orderState.quantity,
          stopLoss: orderState.stopLoss,
          takeProfit: orderState.takeProfit,
          initialStopLoss: orderState.stopLoss,
          entryDate: new Date().toISOString().split('T')[0],
          entryTimestamp: Math.floor(Date.now() / 1000),
          notes: orderState.notes,
          setup: orderState.setup,
          mistake: '',
          emotion: '',
          pnl: 0,
          followedRules: orderState.followedRules
      };
      
      onSave(newTrade);
      setOrderState(prev => ({ ...prev, notes: '', followedRules: [] }));
  };

  const handleRuleToggle = (rule: string) => {
      setOrderState(prev => {
          const currentRules = prev.followedRules || [];
          if (currentRules.includes(rule)) {
              return { ...prev, followedRules: currentRules.filter(r => r !== rule) };
          } else {
              return { ...prev, followedRules: [...currentRules, rule] };
          }
      });
  };

  const handleCalculateQuantity = () => {
      if (!orderState.entryPrice || !orderState.stopLoss || accountBalance <= 0) return;
      
      const riskPerUnit = Math.abs(orderState.entryPrice - orderState.stopLoss);
      if (riskPerUnit === 0) return;

      let conversionRate = 1;
      const cleanSym = symbol.replace('_', '');
      
      const base = cleanSym.substring(0, 3);
      const quote = cleanSym.substring(3, 6);

      if (quote === accountCurrency) {
          conversionRate = 1;
      } else if (base === accountCurrency) {
          conversionRate = 1 / orderState.entryPrice;
      } else {
          conversionRate = 1; 
      }

      const riskAmount = accountBalance * (riskPercent / 100);
      const qty = riskAmount / (riskPerUnit * conversionRate);
      
      setOrderState(prev => ({ ...prev, quantity: Math.floor(qty) }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden p-4 relative group">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Order</h2>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors"
                    title="Collapse Panel"
                >
                    <ChevronsRight size={18} />
                </button>
            )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => setOrderState(p => ({ ...p, type: TradeType.LONG }))}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${orderState.type === TradeType.LONG ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                    Buy
                </button>
                <button
                    type="button"
                    onClick={() => setOrderState(p => ({ ...p, type: TradeType.SHORT }))}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${orderState.type === TradeType.SHORT ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                    Sell
                </button>
            </div>

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Entry</label>
                        <input type="number" step="0.001" value={orderState.entryPrice || ''} onChange={e => setOrderState(p => ({...p, entryPrice: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono text-sm outline-none focus:border-blue-500" placeholder="0.000"/>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Unit</label>
                        <input type="number" value={orderState.quantity || ''} onChange={e => setOrderState(p => ({...p, quantity: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono text-sm outline-none focus:border-blue-500" placeholder="1000"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-rose-500 font-bold uppercase block mb-1">Stop Loss</label>
                        <input type="number" step="0.001" value={orderState.stopLoss || ''} onChange={e => setOrderState(p => ({...p, stopLoss: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono text-sm outline-none focus:border-rose-500" placeholder="0.000"/>
                    </div>
                    <div>
                        <label className="text-xs text-emerald-500 font-bold uppercase block mb-1">Take Profit</label>
                        <input type="number" step="0.001" value={orderState.takeProfit || ''} onChange={e => setOrderState(p => ({...p, takeProfit: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono text-sm outline-none focus:border-emerald-500" placeholder="0.000"/>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Risk Amount</span>
                    <span className="text-rose-400 font-mono font-bold">-{formatCurrency(risk)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Reward Amount</span>
                    <span className="text-emerald-400 font-mono font-bold">+{formatCurrency(reward)}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-slate-700/50">
                    <span className="text-slate-400 font-bold">R/R Ratio</span>
                    <span className={`font-mono font-bold ${rrRatio >= 2 ? 'text-emerald-400' : 'text-slate-300'}`}>{rrRatio.toFixed(2)}</span>
                </div>
            </div>

            <div>
                <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Strategy / Setup</label>
                <select 
                    value={orderState.setup} 
                    onChange={e => setOrderState(p => ({...p, setup: e.target.value, followedRules: [] }))} // Reset rules on setup change
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm outline-none cursor-pointer"
                >
                    <option value="">Select Strategy...</option>
                    {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
            </div>

            {selectedStrategy && selectedStrategy.entryRules.length > 0 && (
                <div className="bg-slate-900/30 border border-slate-700/50 rounded-lg p-3 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Entry Checklist</div>
                        <div className={`text-[10px] font-bold ${matchPercentage >= 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {matchPercentage}% Match
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {selectedStrategy.entryRules.map((rule, idx) => {
                            const isChecked = orderState.followedRules?.includes(rule);
                            return (
                                <div key={idx} className="flex items-start gap-2 cursor-pointer group" onClick={() => handleRuleToggle(rule)}>
                                    <div className={`mt-0.5 flex-shrink-0 transition-colors ${isChecked ? 'text-emerald-500' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                        {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </div>
                                    <span className={`text-xs leading-tight transition-colors ${isChecked ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                        {rule}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="flex-1 min-h-[80px]">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Plan / Notes</label>
                <textarea value={orderState.notes} onChange={e => setOrderState(p => ({...p, notes: e.target.value}))} className="w-full h-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm outline-none resize-none" placeholder="Trade plan..."/>
            </div>

            {/* Risk Management Section */}
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 animate-fade-in">
                <div className="flex items-center gap-2 mb-2 text-blue-400">
                    <ShieldCheck size={14} />
                    <span className="text-xs font-bold uppercase">Risk Management</span>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Assets</span>
                    <span className="text-xs font-mono font-bold text-white">{formatCurrency(accountBalance)}</span>
                </div>

                <div className="flex gap-2 items-center mb-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Risk %</label>
                        <input 
                            type="number" 
                            step="0.1" 
                            value={riskPercent} 
                            onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)} 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs text-right outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-1 text-right">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Value</label>
                        <div className="text-xs font-mono font-bold text-rose-400 py-1">
                            {formatCurrency(accountBalance * (riskPercent / 100))}
                        </div>
                    </div>
                </div>

                <button 
                    type="button" 
                    onClick={handleCalculateQuantity}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold py-1.5 rounded border border-slate-600 hover:border-slate-500 transition-colors flex items-center justify-center gap-1"
                >
                    <Calculator size={12} /> Apply Risk Sizing
                </button>
            </div>

            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                Confirm Order
            </button>
        </form>
    </div>
  );
};
