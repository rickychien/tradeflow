
export enum TradeStatus {
  OPEN = 'OPEN',
  WIN = 'WIN',
  LOSS = 'LOSS',
  BREAK_EVEN = 'BREAK_EVEN'
}

export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  initialStopLoss?: number; // Persisted local override for R calculations
  takeProfit: number;
  quantity: number;
  entryDate: string; // ISO Date string YYYY-MM-DD for simplicity in list, but we can convert for chart
  exitDate?: string;
  entryTimestamp?: number; // Unix timestamp for chart marker
  exitTimestamp?: number; // Unix timestamp for chart marker
  pnl?: number;
  notes: string;
  setup?: string; // e.g., "Bull Flag", "Support Bounce"
  mistakes?: string[]; // Deprecated in favor of mistake (singular) for dropdown, kept for backward compat
  mistake?: string; // Single selection from dropdown
  emotion?: string; // Single selection from dropdown
  tags?: string[]; // Custom user tags
  followedRules?: string[]; // List of specific rule strings that were followed
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  entryRules: string[];
  exitRules: string[];
}

export interface ChartCandle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AIAnalysisResponse {
  feedback: string;
  score: number;
  tags: string[];
}
