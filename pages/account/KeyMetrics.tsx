
import React from 'react';
import { TrendingUp, DollarSign, Activity, Shield } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface KeyMetricsProps {
  accountData: any;
}

export const KeyMetrics: React.FC<KeyMetricsProps> = ({ accountData }) => {
  const { formatCurrency } = useSettings();

  const nav = accountData ? parseFloat(accountData.NAV) : 0;
  const balance = accountData ? parseFloat(accountData.balance) : 0;
  const unrealizedPL = accountData ? parseFloat(accountData.unrealizedPL) : 0;
  const marginAvailable = accountData ? parseFloat(accountData.marginAvailable) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* NAV */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Asset Value (NAV)</span>
                <TrendingUp size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-mono font-bold text-white">
                {formatCurrency(nav)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Total account value</div>
        </div>

        {/* Balance */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balance</span>
                <DollarSign size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-mono font-bold text-white">
                {formatCurrency(balance)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Cash on hand</div>
        </div>

        {/* Unrealized P&L */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
            <div className={`absolute right-0 top-0 h-full w-1 bg-gradient-to-b ${unrealizedPL >= 0 ? 'from-emerald-500' : 'from-rose-500'} to-transparent opacity-50 rounded-tr-xl rounded-br-xl`}></div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unrealized P&L</span>
                <Activity size={16} className={unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
            <div className={`text-2xl font-mono font-bold ${unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {unrealizedPL >= 0 ? '+' : ''}{formatCurrency(unrealizedPL)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Floating profit/loss</div>
        </div>

        {/* Margin Available */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-transparent opacity-50 rounded-tr-xl rounded-br-xl"></div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Margin Available</span>
                <Shield size={16} className="text-purple-500" />
            </div>
            <div className="text-2xl font-mono font-bold text-white">
                {formatCurrency(marginAvailable)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Buying power</div>
        </div>
    </div>
  );
};
