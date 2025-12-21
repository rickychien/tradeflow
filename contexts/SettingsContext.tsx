
import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { loadWatchlist, saveWatchlist } from '../services/storageService';
import {
  getStoredHandle,
  saveToSyncedFile,
  selectSyncFile,
  verifyPermission,
  SyncStatus
} from '../services/fileSyncService';
import { subscribeToDataChanges, exportBackup } from '../services/storageService';

interface SettingsContextType {
  oandaApiKey: string;
  setOandaApiKey: (key: string) => void;
  oandaAccountId: string;
  setOandaAccountId: (id: string) => void;
  oandaEnv: 'practice' | 'live';
  setOandaEnv: (env: 'practice' | 'live') => void;
  availableInstruments: string[];
  setAvailableInstruments: (instruments: string[]) => void;
  autoSyncOanda: boolean;
  setAutoSyncOanda: (enabled: boolean) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  isGeminiKeyValid: boolean;
  setIsGeminiKeyValid: (valid: boolean) => void;
  dateFormat: string;
  setDateFormat: (format: string) => void;
  timezone: string;
  setTimezone: (tz: string) => void;
  currency: string;
  setCurrency: (curr: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | number | Date) => string;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  updateWatchlist: (newWatchlist: string[]) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  // Sync Props
  syncStatus: SyncStatus;
  connectSyncFile: () => Promise<void>;
  manualSync: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const DEFAULT_DATE_FORMAT = 'EEE yyyy-MM-dd HH:mm';


// Helper to guess currency from timezone
const getCurrencyFromTimezone = (tz: string): string => {
  if (tz.includes('Tokyo')) return 'JPY';
  if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Denver')) return 'USD';
  if (tz.includes('London')) return 'GBP';
  if (tz.includes('Paris') || tz.includes('Berlin') || tz.includes('Madrid') || tz.includes('Rome') || tz.includes('Vienna') || tz.includes('Amsterdam') || tz.includes('Brussels')) return 'EUR';
  if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Brisbane')) return 'AUD';
  if (tz.includes('Toronto') || tz.includes('Vancouver')) return 'CAD';
  if (tz.includes('Zurich')) return 'CHF';
  if (tz.includes('Shanghai') || tz.includes('Beijing')) return 'CNY';
  if (tz.includes('Hong_Kong')) return 'HKD';
  if (tz.includes('Taipei')) return 'TWD';
  if (tz.includes('Singapore')) return 'SGD';
  if (tz.includes('Calcutta') || tz.includes('Kolkata')) return 'INR';
  if (tz.includes('Seoul')) return 'KRW';

  // Broad region defaults
  if (tz.startsWith('Europe/')) return 'EUR';
  if (tz.startsWith('Australia/')) return 'AUD';
  if (tz.startsWith('America/')) return 'USD';

  return 'USD'; // Global default
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from LocalStorage or use empty defaults (No hardcoded secrets)
  const [oandaApiKey, setOandaApiKey] = useState(() => localStorage.getItem('oanda_key') || '');
  const [oandaAccountId, setOandaAccountId] = useState(() => localStorage.getItem('oanda_account_id') || '');

  const [oandaEnv, setOandaEnv] = useState<'practice' | 'live'>(() => {
    const saved = localStorage.getItem('oanda_env');
    if (saved === 'practice' || saved === 'live') return saved;

    // Smart default: Detect environment from Account ID if not explicitly saved
    const currentId = localStorage.getItem('oanda_account_id') || '';
    if (currentId.startsWith('001')) return 'live';
    if (currentId.startsWith('101')) return 'practice';

    return 'live';
  });

  // Auto-sync setting (Default to true if not set)
  const [autoSyncOanda, setAutoSyncOanda] = useState(() => {
    const saved = localStorage.getItem('auto_sync_oanda');
    return saved === null ? true : saved === 'true';
  });

  // Store the fetched instrument list (JSON stringified in local storage)
  const [availableInstruments, setAvailableInstruments] = useState<string[]>(() => {
    const stored = localStorage.getItem('oanda_instruments');
    return stored ? JSON.parse(stored) : [];
  });

  const [watchlist, setWatchlist] = useState<string[]>(() => loadWatchlist());

  const [geminiApiKey, setGeminiApiKeyState] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isGeminiKeyValid, setIsGeminiKeyValid] = useState(() => localStorage.getItem('gemini_key_valid') === 'true');

  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('date_format') || DEFAULT_DATE_FORMAT);

  // Default to system timezone or UTC
  const [timezone, setTimezone] = useState(() => localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Currency State - Default based on timezone
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem('currency');
    if (saved) return saved;

    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return getCurrencyFromTimezone(systemTz);
  });

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light') ? 'light' : 'dark';
  });

  // --- SYNC STATE ---
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    lastSyncTime: null,
    fileName: null
  });

  // Initialize Sync
  useEffect(() => {
    const initSync = async () => {
      const handle = await getStoredHandle();
      if (handle) {
        // We have a remembered handle. We can't verify permission without interaction usually,
        // but we can at least show the filename.
        setSyncStatus(prev => ({
          ...prev,
          isActive: true, // Optimistically active, might need permission re-grant
          fileName: handle.name
        }));
      }
    };
    initSync();
  }, []);

  useEffect(() => {
    localStorage.setItem('oanda_key', oandaApiKey);
  }, [oandaApiKey]);

  useEffect(() => {
    localStorage.setItem('oanda_account_id', oandaAccountId);

    // Auto-detect environment based on Account ID format
    // Live accounts typically start with '001', Practice with '101'
    if (oandaAccountId) {
      if (oandaAccountId.startsWith('001') && oandaEnv !== 'live') {
        console.log("Auto-switching to LIVE based on Account ID");
        setOandaEnv('live');
      } else if (oandaAccountId.startsWith('101') && oandaEnv !== 'practice') {
        console.log("Auto-switching to PRACTICE based on Account ID");
        setOandaEnv('practice');
      }
    }
  }, [oandaAccountId, oandaEnv]);

  useEffect(() => {
    localStorage.setItem('oanda_env', oandaEnv);
  }, [oandaEnv]);

  useEffect(() => {
    localStorage.setItem('auto_sync_oanda', String(autoSyncOanda));
  }, [autoSyncOanda]);

  useEffect(() => {
    localStorage.setItem('oanda_instruments', JSON.stringify(availableInstruments));
  }, [availableInstruments]);

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_key_valid', String(isGeminiKeyValid));
  }, [isGeminiKeyValid]);

  useEffect(() => {
    localStorage.setItem('date_format', dateFormat);
  }, [dateFormat]);

  useEffect(() => {
    localStorage.setItem('timezone', timezone);
  }, [timezone]);

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Wrapper for setGeminiApiKey to invalidate validity on change
  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    if (key !== geminiApiKey) {
      setIsGeminiKeyValid(false);
    }
  };

  const addToWatchlist = (symbol: string) => {
    if (!watchlist.includes(symbol)) {
      setWatchlist(prev => [...prev, symbol]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  };

  const updateWatchlist = (newWatchlist: string[]) => {
    setWatchlist(newWatchlist);
  };

  // Connect File
  const connectSyncFile = async () => {
    try {
      const handle = await selectSyncFile();
      setSyncStatus({
        isActive: true,
        lastSyncTime: new Date().toISOString(),
        fileName: handle.name,
        error: undefined
      });

      // Initial save
      const data = exportBackup();
      await saveToSyncedFile(data);
    } catch (e: any) {
      console.error("Sync connection failed", e);
      setSyncStatus(prev => ({ ...prev, error: e.message, isActive: false }));
    }
  };

  const manualSync = async () => {
    try {
      const data = exportBackup();
      await saveToSyncedFile(data);
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date().toISOString(),
        error: undefined
      }));
    } catch (e: any) {
      console.error("Manual sync failed", e);
      setSyncStatus(prev => ({ ...prev, error: e.message }));
    }
  };

  // Auto-Sync Logic (Debounced)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const handleDataChange = () => {
      if (!syncStatus.isActive) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log("Auto-syncing data...");
        try {
          const data = exportBackup();
          await saveToSyncedFile(data);
          setSyncStatus(prev => ({
            ...prev,
            lastSyncTime: new Date().toISOString(),
            error: undefined
          }));
        } catch (e: any) {
          // If permission lost, we update status
          console.error("Auto-sync failed", e);
          setSyncStatus(prev => ({ ...prev, error: "Permission needed. Please Reconnect.", isActive: false }));
        }
      }, 2000); // 2 second debounce
    };

    const unsubscribe = subscribeToDataChanges(handleDataChange);
    return () => {
      unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, [syncStatus.isActive]);

  const formatDate = (date: string | number | Date) => {
    if (!date) return '-';
    try {
      let d: Date;
      if (typeof date === 'number') {
        // Intelligent guess: if timestamp is small (e.g. < 100 billion), it's seconds.
        if (date < 100000000000) {
          d = new Date(date * 1000);
        } else {
          d = new Date(date);
        }
      } else {
        d = new Date(date);
      }

      // Handle invalid dates
      if (isNaN(d.getTime())) return '-';

      // Use date-fns-tz to format in the selected timezone
      return formatInTimeZone(d, timezone, dateFormat);
    } catch (e) {
      console.error("Date formatting error", e);
      return String(date);
    }
  };

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      // Fallback if currency code is invalid
      return `$${amount.toFixed(2)} `;
    }
  };

  return (
    <SettingsContext.Provider value={{
      oandaApiKey,
      setOandaApiKey,
      oandaAccountId,
      setOandaAccountId,
      oandaEnv,
      setOandaEnv,
      availableInstruments,
      setAvailableInstruments,
      autoSyncOanda,
      setAutoSyncOanda,
      geminiApiKey,
      setGeminiApiKey,
      isGeminiKeyValid,
      setIsGeminiKeyValid,
      dateFormat,
      setDateFormat,
      timezone,
      setTimezone,
      currency,
      setCurrency,
      formatCurrency,
      formatDate,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      updateWatchlist,
      theme,
      setTheme,
      syncStatus,
      connectSyncFile,
      manualSync
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
