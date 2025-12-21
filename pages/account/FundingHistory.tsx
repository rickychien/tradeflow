
import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';

interface FundingHistoryProps {
  transactions: any[];
}

export const FundingHistory: React.FC<FundingHistoryProps> = ({ transactions }) => {
  const { formatCurrency, formatDate } = useSettings();

  const getLabel = (t: any) => {
      if (t.type === 'TRANSFER_FUNDS') {
          return Number(t.amount) > 0 ? 'Deposit' : 'Withdrawal';
      }
      if (t.type === 'TRANSFER_FUNDS_REJECT') {
          return 'Transfer Rejected';
      }
      if (t.type === 'FUNDING') {
          return 'Funding';
      }
      if (t.type === 'RESET_RESETTABLE_PL') {
          return 'Account Reset';
      }
      if (t.type === 'CREATE' || t.type === 'ACCOUNT_CREATE') {
          return 'Account Opened';
      }
      return t.type.replace(/_/g, ' ');
  };

  const getAmount = (t: any) => {
      if (t.amount) return Number(t.amount);
      // Fallback for resets that might not have direct amount but imply a balance
      return 0;
  };

  const isPositive = (t: any) => {
      return getAmount(t) >= 0;
  };

  const isRejected = (t: any) => {
      return t.type.includes('REJECT');
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4">Account History</h3>
        <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-xs sticky top-0">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Event</th>
                        <th className="p-4 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {transactions.length > 0 ? transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-700/30">
                            <td className="p-4 text-slate-400 font-mono">{formatDate(t.time)}</td>
                            <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    isRejected(t)
                                        ? 'bg-slate-500/10 text-slate-400'
                                        : t.type === 'RESET_RESETTABLE_PL' 
                                            ? 'bg-blue-500/10 text-blue-400'
                                            : (t.type === 'CREATE' || t.type === 'ACCOUNT_CREATE')
                                                ? 'bg-purple-500/10 text-purple-400' 
                                                : isPositive(t) 
                                                    ? 'bg-emerald-500/10 text-emerald-400' 
                                                    : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                    {getLabel(t)}
                                </span>
                            </td>
                            <td className={`p-4 text-right font-mono font-bold ${isRejected(t) ? 'text-slate-500 line-through' : isPositive(t) ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {getAmount(t) !== 0 ? formatCurrency(getAmount(t)) : '-'}
                            </td>
                        </tr>
                        )) : (
                        <tr>
                            <td colSpan={3} className="p-8 text-center text-slate-500">
                                No account history found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
