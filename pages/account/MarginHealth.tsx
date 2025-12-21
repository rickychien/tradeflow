
import React from 'react';
import { Percent, Layers, Activity, Clock } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface MarginHealthProps {
  accountData: any;
}

export const MarginHealth: React.FC<MarginHealthProps> = ({ accountData }) => {
  const { formatCurrency } = useSettings();

  if (!accountData) return null;

  const marginUsed = parseFloat(accountData.marginUsed);
  const marginRate = parseFloat(accountData.marginRate);
  const positionValue = parseFloat(accountData.positionValue);
  const nav = parseFloat(accountData.NAV);

  const getMarginPercent = () => {
      if (nav === 0) return 0;
      return (marginUsed / nav) * 100;
  };

  const marginPercent = getMarginPercent();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Margin Usage Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Percent size={18} className="text-amber-500"/> Margin Health
            </h3>
            
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Margin Used</span>
                        <span className="font-mono text-white">{formatCurrency(marginUsed)} ({marginPercent.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full ${marginPercent > 80 ? 'bg-rose-500' : marginPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${Math.min(marginPercent, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Margin Rate</div>
                        <div className="text-lg font-mono text-white">{(1/marginRate).toFixed(0)}:1</div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Position Value</div>
                        <div className="text-lg font-mono text-white">{formatCurrency(positionValue)}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Account Stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Layers size={18} className="text-blue-500"/> Account Stats
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400"><Activity size={16}/></div>
                        <span className="text-slate-300 font-medium">Open Trades</span>
                    </div>
                    <span className="font-mono text-white font-bold">{accountData.openTradeCount}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400"><Clock size={16}/></div>
                        <span className="text-slate-300 font-medium">Pending Orders</span>
                    </div>
                    <span className="font-mono text-white font-bold">{accountData.pendingOrderCount}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
