
import { Strategy, Trade } from '../types';

export const STORAGE_KEYS = {
  JOURNAL_DATA: 'tradeflow_journal_data',
  STRATEGIES: 'tradeflow_strategies',
  WATCHLIST: 'tradeflow_watchlist',
  UI_PREFS: 'tradeflow_ui_prefs',
  JOURNAL_CONFIG: 'tradeflow_journal_config',

  // Settings Keys (Managed by SettingsContext/Components directly)
  SETTINGS: {
    OANDA_KEY: 'oanda_key',
    OANDA_ACCOUNT_ID: 'oanda_account_id',
    OANDA_ENV: 'oanda_env',
    GEMINI_KEY: 'gemini_api_key',
    DATE_FORMAT: 'date_format',
    TIMEZONE: 'timezone',
    CURRENCY: 'currency',
    AUTO_SYNC: 'auto_sync_oanda',
    CHART_HOLLOW: 'chart_hollow',
    CHART_UP: 'chart_upColor',
    CHART_DOWN: 'chart_downColor',
    THEME: 'theme'
  }
};

interface JournalData {
  [tradeId: string]: {
    notes?: string;
    setup?: string;
    mistake?: string;
    emotion?: string;
    initialStopLoss?: number;
    tags?: string[];
    followedRules?: string[];
  };
}

// --- CHANGE NOTIFIER (For Auto-Sync) ---
type DataChangeListener = () => void;
const listeners: DataChangeListener[] = [];

export const subscribeToDataChanges = (listener: DataChangeListener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l());
};

// --- UI PREFERENCES (Layout, etc.) ---

export interface UIPreferences {
  sidebarCollapsed: boolean;
}

export const loadUIPreferences = (): UIPreferences => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UI_PREFS);
    return data ? JSON.parse(data) : { sidebarCollapsed: false };
  } catch (e) {
    return { sidebarCollapsed: false };
  }
};

export const saveUIPreferences = (prefs: UIPreferences) => {
  localStorage.setItem(STORAGE_KEYS.UI_PREFS, JSON.stringify(prefs));
  notifyListeners();
};

// --- JOURNAL CONFIGURATION (Table Settings) ---

export interface JournalConfig {
  columns: any[]; // ColumnConfig[]
  visibleColumns: string[];
  filters: {
    startDate: string;
    endDate: string;
    symbol: string;
    type: string;
    setup: string;
    status: string;
    mistake: string;
    emotion: string;
    tag: string;
  };
}

export const loadJournalConfig = (): JournalConfig | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JOURNAL_CONFIG);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const saveJournalConfig = (config: JournalConfig) => {
  localStorage.setItem(STORAGE_KEYS.JOURNAL_CONFIG, JSON.stringify(config));
  notifyListeners();
};

// --- STRATEGIES PERSISTENCE ---

export const loadStrategies = (): Strategy[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STRATEGIES);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Deduplicate IDs: Ensure every strategy has a unique ID
        const seenIds = new Set<string>();
        const uniqueStrategies = parsed.map((s: Strategy) => {
          if (seenIds.has(s.id)) {
            // Found a duplicate ID! Regenerate it.
            return { ...s, id: Math.random().toString(36).substr(2, 9) };
          }
          seenIds.add(s.id);
          return s;
        });

        // If we found duplicates/changes, save back correctly immediately to fix storage
        if (JSON.stringify(uniqueStrategies) !== data) {
          console.log("Fixed duplicate strategy IDs on load");
          saveStrategies(uniqueStrategies);
        }
        return uniqueStrategies;
      }
    }
    return [];
  } catch (e) {
    console.error("Failed to load strategies", e);
    return [];
  }
};

export const saveStrategies = (strategies: Strategy[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(strategies));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save strategies", e);
  }
};

// --- WATCHLIST PERSISTENCE ---

export const loadWatchlist = (): string[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
    // Default to USD_JPY, EUR_JPY, GBP_JPY, EUR_USD as requested
    return data ? JSON.parse(data) : ['USD_JPY', 'EUR_JPY', 'GBP_JPY', 'EUR_USD'];
  } catch (e) {
    console.error("Failed to load watchlist", e);
    return ['USD_JPY', 'EUR_JPY', 'GBP_JPY', 'EUR_USD'];
  }
};

export const saveWatchlist = (watchlist: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(watchlist));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save watchlist", e);
  }
};

// --- JOURNAL DATA PERSISTENCE (ENRICHMENT LAYER) ---

export const loadJournalData = (): JournalData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JOURNAL_DATA);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to load journal data", e);
    return {};
  }
};

export const getAllUniqueTags = (): string[] => {
  try {
    const journalData = loadJournalData();
    const tags = new Set<string>();
    Object.values(journalData).forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  } catch (e) {
    return [];
  }
};

export const saveTradeEnrichment = (trade: Trade) => {
  try {
    const currentData = loadJournalData();

    // Only save fields that are not native to OANDA
    currentData[trade.id] = {
      notes: trade.notes,
      setup: trade.setup,
      mistake: trade.mistake,
      emotion: trade.emotion,
      initialStopLoss: trade.initialStopLoss,
      tags: trade.tags,
      followedRules: trade.followedRules
    };

    localStorage.setItem(STORAGE_KEYS.JOURNAL_DATA, JSON.stringify(currentData));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save trade enrichment", e);
  }
};

// Merges OANDA raw trades with LocalStorage journal data
export const mergeTradesWithJournal = (oandaTrades: Trade[]): Trade[] => {
  const journalData = loadJournalData();

  return oandaTrades.map(trade => {
    const enrichment = journalData[trade.id];
    if (enrichment) {
      return {
        ...trade,
        notes: enrichment.notes || '',
        setup: enrichment.setup || '',
        mistake: enrichment.mistake || '',
        emotion: enrichment.emotion || '',
        initialStopLoss: enrichment.initialStopLoss !== undefined ? enrichment.initialStopLoss : trade.stopLoss,
        tags: enrichment.tags || [],
        followedRules: enrichment.followedRules || []
      };
    }
    // Default initialStopLoss to current stopLoss if no history exists
    return { ...trade, initialStopLoss: trade.stopLoss, tags: [], followedRules: [] };
  });
};

// --- BACKUP & RESTORE ---

export const exportBackup = (): string => {
  const settings: Record<string, string | null> = {};
  Object.values(STORAGE_KEYS.SETTINGS).forEach(key => {
    settings[key] = localStorage.getItem(key);
  });

  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.2',
    strategies: loadStrategies() || [],
    journalData: loadJournalData(),
    watchlist: loadWatchlist(),
    uiPrefs: loadUIPreferences(),
    journalConfig: loadJournalConfig(),
    settings: settings
  };
  return JSON.stringify(backup, null, 2);
};



export const importBackup = (jsonString: string): { success: boolean; message: string } => {
  try {
    const backup = JSON.parse(jsonString);

    if (!backup.strategies && !backup.journalData) {
      return { success: false, message: "Invalid backup file format." };
    }

    // 1. Merge Strategies
    if (Array.isArray(backup.strategies)) {
      const currentStrategies = loadStrategies() || [];
      const strategyMap = new Map(currentStrategies.map(s => [s.id, s]));

      backup.strategies.forEach((s: Strategy) => {
        // Update or Add (based on ID)
        strategyMap.set(s.id, s);
      });

      saveStrategies(Array.from(strategyMap.values()));
    }

    // 2. Merge Journal Data
    if (backup.journalData && typeof backup.journalData === 'object') {
      const currentJournal = loadJournalData();
      const newJournal = { ...currentJournal, ...backup.journalData };
      localStorage.setItem(STORAGE_KEYS.JOURNAL_DATA, JSON.stringify(newJournal));
    }

    // 3. Restore Watchlist
    if (Array.isArray(backup.watchlist)) {
      saveWatchlist(backup.watchlist);
    }

    // 4. Restore UI Prefs
    if (backup.uiPrefs) {
      saveUIPreferences(backup.uiPrefs);
    }

    // 5. Restore Journal Table Config
    if (backup.journalConfig) {
      saveJournalConfig(backup.journalConfig);
    }

    // 6. Restore Settings (API Keys, etc.)
    if (backup.settings) {
      Object.entries(backup.settings).forEach(([key, value]) => {
        if (value !== null) {
          localStorage.setItem(key, value as string);
        }
      });
    }

    notifyListeners(); // Notify after import
    return { success: true, message: "Data restored successfully! Please refresh." };
  } catch (e: any) {
    console.error("Import failed", e);
    return { success: false, message: `Import failed: ${e.message}` };
  }
};
