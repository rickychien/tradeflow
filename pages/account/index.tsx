
import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { fetchAccountDetails, fetchFundTransactions } from '../../services/oandaService';
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react';
import { Trade } from '../../types';
import { KeyMetrics } from './KeyMetrics';
import { NavGrowthChart } from './NavGrowthChart';
import { MarginHealth } from './MarginHealth';
import { FundingHistory } from './FundingHistory';

interface AccountPageProps {
    trades?: Trade[]; // Accept trades to calculate growth curve
}

export const AccountPage: React.FC<AccountPageProps> = ({ trades = [] }) => {
  const { oandaApiKey, oandaAccountId, oandaEnv } = useSettings();
  const [accountData, setAccountData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadAccount = async () => {
    if (!oandaApiKey || !oandaAccountId) return;
    
    setLoading(true);
    setError(null);
    try {
        const [details, funds] = await Promise.all([
            fetchAccountDetails(oandaAccountId, oandaApiKey, oandaEnv),
            fetchFundTransactions(oandaAccountId, oandaApiKey, oandaEnv)
        ]);
        setAccountData(details);
        setTransactions(funds);
    } catch (e: any) {
        setError(e.message || "Failed to fetch account details");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      loadAccount();
  }, [oandaApiKey, oandaAccountId, oandaEnv]);

  if (!oandaApiKey || !oandaAccountId) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
              <Wallet size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Account Not Configured</p>
              <p className="text-sm">Please set up your OANDA API keys in Settings.</p>
          </div>
      );
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Account Overview</h1>
            <p className="text-slate-400 mt-1 flex items-center gap-2">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-700 font-mono">
                    {oandaAccountId}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${oandaEnv === 'live' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {oandaEnv}
                </span>
            </p>
        </div>
        <button 
            onClick={loadAccount}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
        </button>
      </div>

      {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 flex items-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
          </div>
      )}

      {accountData ? (
          <div className="space-y-6">
              <KeyMetrics accountData={accountData} />
              <NavGrowthChart trades={trades} transactions={transactions} accountData={accountData} />
              <MarginHealth accountData={accountData} />
              <FundingHistory transactions={transactions} />
          </div>
      ) : (
          !loading && <div className="text-center text-slate-500 py-20">No account data loaded.</div>
      )}
    </div>
  );
};
