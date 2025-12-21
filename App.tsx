
import { useState, useEffect, useRef } from 'react';
import { Layout } from './pages/Layout';
import { Dashboard } from './pages/dashboard';
import { TradeList } from './pages/journal';
import { TradeDetail } from './pages/journal/TradeDetail';
import { AddTradeForm } from './pages/journal/AddTradeForm';
import { Playbook } from './pages/playbook';
import { Settings } from './pages/settings';
import { Reports } from './pages/reports';
import { AccountPage } from './pages/account';
import { TradePage } from './pages/trade';
import { Trade, Strategy } from './types';
import { useSettings } from './contexts/SettingsContext';
import { fetchOandaTradeHistory, fetchAccountInstruments } from './services/oandaService';
import { loadStrategies, saveStrategies, saveTradeEnrichment, mergeTradesWithJournal } from './services/storageService';

function App() {
  const { oandaApiKey, oandaAccountId, oandaEnv, autoSyncOanda, setAvailableInstruments } = useSettings();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'playbook' | 'settings' | 'reports' | 'accounts' | 'trade'>('dashboard');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isAddingTrade, setIsAddingTrade] = useState(false);

  const [trades, setTrades] = useState<Trade[]>([]);

  const [strategies, setStrategies] = useState<Strategy[]>(() => {
    const saved = loadStrategies();
    return saved;
  });

  const [selectedDateFilter, setSelectedDateFilter] = useState<{ start: string, end: string } | null>(null);
  const [journalSetupFilter, setJournalSetupFilter] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const hasAutoSyncedRef = useRef(false);

  useEffect(() => {
    saveStrategies(strategies);
  }, [strategies]);

  const handleTabChange = (tab: 'dashboard' | 'journal' | 'playbook' | 'settings' | 'reports' | 'accounts' | 'trade') => {
    setActiveTab(tab);
    setSelectedTrade(null);
    setIsAddingTrade(false);

    if (tab !== 'journal') {
      setJournalSetupFilter(null);
    }
  };

  const handleSyncOanda = async () => {
    if (!oandaApiKey || !oandaAccountId) {
      if (activeTab === 'settings') return;
      if (!hasAutoSyncedRef.current) {
        return;
      }
      // Only redirect if explicit user action, otherwise silent fail on auto-sync
      if (activeTab !== 'dashboard') {
        setActiveTab('settings');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const [syncedTrades, instruments] = await Promise.all([
        fetchOandaTradeHistory(oandaAccountId, oandaApiKey, oandaEnv),
        fetchAccountInstruments(oandaAccountId, oandaApiKey, oandaEnv)
      ]);

      const mergedTrades = mergeTradesWithJournal(syncedTrades);
      setTrades(mergedTrades);

      if (instruments && instruments.length > 0) {
        setAvailableInstruments(instruments);
      }
    } catch (e: any) {
      console.error("Sync Error", e);
      // Removed alert to prevent UI blocking loops
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync logic
  useEffect(() => {
    if (autoSyncOanda && oandaApiKey && oandaAccountId) {
      // If we haven't synced yet, OR if the environment params changed (re-trigger)
      // We use a small timeout to ensure other contexts (like Env auto-detection) are settled
      const timer = setTimeout(() => {
        if (!isSyncing) {
          handleSyncOanda();
          hasAutoSyncedRef.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoSyncOanda, oandaApiKey, oandaAccountId, oandaEnv]); // Added oandaEnv to dep array to re-sync if env switches

  const handleTradeSelect = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsAddingTrade(false);
    setActiveTab('journal');
  };

  const handleAddTradeClick = () => {
    setIsAddingTrade(true);
    setSelectedTrade(null);
    setActiveTab('journal');
  };

  const handleSaveTrade = (newTrade: Trade) => {
    setTrades([newTrade, ...trades]);
    setIsAddingTrade(false);

    if (activeTab === 'trade') {
      setActiveTab('journal');
      saveTradeEnrichment(newTrade);
    }
  };

  const handleUpdateTrade = (updatedTrade: Trade) => {
    setTrades(prevTrades => prevTrades.map(t => t.id === updatedTrade.id ? updatedTrade : t));
    if (selectedTrade && selectedTrade.id === updatedTrade.id) {
      setSelectedTrade(updatedTrade);
    }
    saveTradeEnrichment(updatedTrade);
  };

  const handleDeleteTrade = (tradeId: string) => {
    setTrades(trades.filter(t => t.id !== tradeId));
    setSelectedTrade(null);
  };

  const handleDashboardDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    setSelectedDateFilter({ start: dateStr, end: dateStr });
    setActiveTab('journal');
  };

  const handleAddStrategy = (strategy: Strategy) => {
    setStrategies([...strategies, strategy]);
  };

  const handleUpdateStrategy = (updatedStrategy: Strategy) => {
    setStrategies(prev => prev.map(s => s.id === updatedStrategy.id ? updatedStrategy : s));
  };

  const handleDeleteStrategy = (id: string) => {
    setStrategies(strategies.filter(s => s.id !== id));
  };

  const handlePlaybookViewTrades = (strategyName: string) => {
    setJournalSetupFilter(strategyName);
    setSelectedDateFilter({ start: '', end: '' });
    setActiveTab('journal');
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} onSync={handleSyncOanda} isSyncing={isSyncing}>

      {activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          <Dashboard trades={trades} onDateSelect={handleDashboardDateSelect} strategies={strategies} />
        </div>
      )}

      {activeTab === 'trade' && (
        <TradePage
          onSaveTrade={handleSaveTrade}
          trades={trades}
          onSelectTrade={handleTradeSelect}
          strategies={strategies}
        />
      )}

      {activeTab === 'journal' && !selectedTrade && !isAddingTrade && (
        <div className="animate-fade-in">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Trade Journal</h1>
              <p className="text-slate-400 mt-1">Review your past performance and execution.</p>
            </div>
          </div>
          <TradeList
            trades={trades}
            onSelectTrade={handleTradeSelect}
            onUpdateTrade={handleUpdateTrade}
            initialDateRange={selectedDateFilter}
            initialSetupFilter={journalSetupFilter}
            strategies={strategies}
          />
        </div>
      )}

      {activeTab === 'journal' && isAddingTrade && (
        <AddTradeForm
          onSave={handleSaveTrade}
          onCancel={() => setIsAddingTrade(false)}
          strategies={strategies}
        />
      )}

      {activeTab === 'journal' && selectedTrade && (
        <TradeDetail
          trade={selectedTrade}
          onBack={() => setSelectedTrade(null)}
          onUpdate={handleUpdateTrade}
          onSettingsClick={() => setActiveTab('settings')}
          strategies={strategies}
        />
      )}

      {activeTab === 'playbook' && (
        <Playbook
          strategies={strategies}
          trades={trades}
          onAddStrategy={handleAddStrategy}
          onUpdateStrategy={handleUpdateStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onSelectTrade={handleTradeSelect}
          onDeleteTrade={handleDeleteTrade}
          onViewTrades={handlePlaybookViewTrades}
        />
      )}

      {activeTab === 'reports' && (
        <Reports trades={trades} />
      )}

      {activeTab === 'accounts' && (
        <AccountPage trades={trades} />
      )}

      {activeTab === 'settings' && (
        <Settings />
      )}

    </Layout>
  );
}

export default App;
