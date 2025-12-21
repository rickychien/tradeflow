
import { ChartCandle, Trade, TradeType, TradeStatus } from '../types';

// OANDA URLs
const PRACTICE_URL = 'https://api-fxpractice.oanda.com/v3'; 
const LIVE_URL = 'https://api-fxtrade.oanda.com/v3';

const getBaseUrl = (env: 'practice' | 'live') => {
    if (env === 'live') return LIVE_URL;
    return PRACTICE_URL;
};

// Helper to remove separators for comparison (e.g. "USD_JPY" -> "USDJPY")
const cleanSymbol = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const fetchAccountInstruments = async (
  accountId: string,
  apiKey: string,
  env: 'practice' | 'live'
): Promise<string[]> => {
  const baseUrl = getBaseUrl(env);
  const url = `${baseUrl}/accounts/${accountId}/instruments`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
        console.warn('Failed to fetch instruments list', response.statusText);
        return [];
    }

    const data = await response.json();
    if (data.instruments) {
        return data.instruments.map((i: any) => i.name);
    }
    return [];
  } catch (e) {
    console.error('Error fetching instruments:', e instanceof Error ? e.message : e);
    return [];
  }
};

export const findBestMatchSymbol = (userSymbol: string, availableInstruments: string[]): string => {
  const target = cleanSymbol(userSymbol);
  
  if (availableInstruments.includes(userSymbol)) return userSymbol;

  const match = availableInstruments.find(i => cleanSymbol(i) === target);
  if (match) return match;

  if (target.endsWith('USD') && target.length > 3) {
      const base = target.replace('USD', '');
      return `${base}_USD`;
  }
  if (target.length === 6 && !target.match(/\d/)) {
    return `${target.substring(0, 3)}_${target.substring(3)}`;
  }
  return `${target}_USD`;
};


export const fetchOandaCandles = async (
  symbol: string, 
  granularity: string, 
  count: number = 500,
  apiKey: string,
  from?: number, // Unix timestamp in seconds
  to?: number,   // Unix timestamp in seconds
  env: 'practice' | 'live' = 'practice',
  availableInstruments: string[] = []
): Promise<ChartCandle[]> => {
  
  const oandaSymbol = findBestMatchSymbol(symbol, availableInstruments);
  const baseUrl = getBaseUrl(env);
  
  let url = `${baseUrl}/instruments/${oandaSymbol}/candles?granularity=${granularity}&price=M`;

  if (from && to) {
      const fromStr = new Date(from * 1000).toISOString();
      const toStr = new Date(to * 1000).toISOString();
      url += `&from=${fromStr}&to=${toStr}`;
  } else if (to && count) {
       const toStr = new Date(to * 1000).toISOString();
       url += `&to=${toStr}&count=${count}`;
  } else {
      url += `&count=${count}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.errorMessage || response.statusText;
      
      if (response.status === 400) {
          throw new Error(msg || `Invalid Request for ${oandaSymbol}. Check date range or symbol.`);
      }
      if (response.status === 401) {
          throw new Error("Unauthorized. Please check your OANDA API Token and Environment.");
      }
      if (response.status === 403) {
          throw new Error("Insufficient permissions. Check that your Token matches the Account ID.");
      }
      
      throw new Error(`OANDA Error (${response.status}): ${msg}`);
    }

    const data = await response.json();

    if (!data.candles || data.candles.length === 0) {
        return [];
    }

    return data.candles.map((c: any) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000), 
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: c.volume // Tick volume
    }));

  } catch (error) {
    console.error("OANDA Fetch Error:", error instanceof Error ? error.message : error);
    throw error;
  }
};

export const verifyOandaConnection = async (apiKey: string, accountId?: string, env: 'practice' | 'live' = 'practice'): Promise<{ success: boolean; message: string; instruments?: string[] }> => {
    const baseUrl = getBaseUrl(env);
    try {
        const accountsUrl = `${baseUrl}/accounts`;
        const response = await fetch(accountsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) return { success: false, message: 'Invalid API Key or Wrong Environment.' };
            return { success: false, message: `Connection failed: ${response.statusText}` };
        }

        const data = await response.json();
        let instruments: string[] = [];

        if (accountId) {
             const accountExists = data.accounts.some((acc: any) => acc.id === accountId);
             if (!accountExists) {
                 return { success: false, message: 'API Key is valid, but Account ID not found in this account list. Check environment (Live/Practice).' };
             }
             
             instruments = await fetchAccountInstruments(accountId, apiKey, env);
             
             return { 
                 success: true, 
                 message: `Verified! Loaded ${instruments.length} instruments for account ${accountId}.`, 
                 instruments 
             };
        }

        return { success: true, message: 'Connection Verified! API Key is valid.', instruments: [] };

    } catch (error: any) {
        return { success: false, message: `Network Error: ${error.message}` };
    }
};

export interface TradeEnrichment {
    initialStopLoss: number | null;
    initialEntryPrice: number | null;
    entryOrderType: string | null; // MARKET, LIMIT, STOP, etc.
    exitReason: string | null;     // STOP_LOSS, TAKE_PROFIT, MARKET, etc.
}

export const fetchTradeEnrichmentData = async (
    trade: Trade,
    accountId: string,
    apiKey: string,
    env: 'practice' | 'live'
): Promise<TradeEnrichment> => {
    const baseUrl = getBaseUrl(env);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    let initialStopLoss: number | null = null;
    let initialEntryPrice: number | null = null;
    let entryOrderType: string | null = null;
    let exitReason: string | null = null;

    const validateSL = (slPrice: number): boolean => {
        let isValid = false;
        if (trade.type === TradeType.LONG) {
            isValid = slPrice < trade.entryPrice;
        } else {
            isValid = slPrice > trade.entryPrice;
        }
        return isValid;
    };

    try {
        // 1. Get the original trade opening transaction (ORDER_FILL)
        const url = `${baseUrl}/accounts/${accountId}/transactions/${trade.id}`;
        const response = await fetch(url, { method: 'GET', headers });

        if (response.ok) {
            const data = await response.json();
            const transaction = data.transaction;

            if (transaction && transaction.type === 'ORDER_FILL') {
                const orderId = transaction.orderID;
                if (orderId) {
                     const orderUrl = `${baseUrl}/accounts/${accountId}/transactions/${orderId}`;
                     const orderRes = await fetch(orderUrl, { method: 'GET', headers });
                     if (orderRes.ok) {
                         const orderData = await orderRes.json();
                         const orderTx = orderData.transaction;
                         
                         if (orderTx.type) {
                             entryOrderType = orderTx.type; // MARKET, LIMIT, STOP, etc.
                         }

                         if ((orderTx.type === 'LIMIT' || orderTx.type === 'STOP' || orderTx.type === 'MARKET_IF_TOUCHED') && orderTx.price) {
                             initialEntryPrice = parseFloat(orderTx.price);
                         }
                     }
                }

                // Initial SL Logic
                if (transaction.tradeOpened && transaction.tradeOpened.stopLossOnFill) {
                    const price = parseFloat(transaction.tradeOpened.stopLossOnFill.price);
                    if (validateSL(price)) {
                        initialStopLoss = price;
                    }
                }

                // Case B: SL added shortly after entry
                if (!initialStopLoss) {
                    const summaryUrl = `${baseUrl}/accounts/${accountId}/summary`;
                    const summaryRes = await fetch(summaryUrl, { method: 'GET', headers });
                    if (summaryRes.ok) {
                        const summaryData = await summaryRes.json();
                        const lastId = parseInt(summaryData.account.lastTransactionID);
                        const startId = parseInt(trade.id);
                        const endId = Math.min(startId + 100, lastId);
                        
                        if (endId > startId) {
                            const rangeUrl = `${baseUrl}/accounts/${accountId}/transactions/idrange?from=${startId}&to=${endId}`;
                            const rangeRes = await fetch(rangeUrl, { method: 'GET', headers });
                            if (rangeRes.ok) {
                                const rangeData = await rangeRes.json();
                                const transactions = rangeData.transactions as any[];
                                transactions.sort((a, b) => Number(a.id) - Number(b.id));
                                
                                const potentialSLOrders = transactions.filter(t => 
                                    (t.tradeID === trade.id || (t.order && t.order.tradeID === trade.id)) &&
                                    (
                                        t.type === 'STOP_LOSS_ORDER' || 
                                        (t.order && t.order.type === 'STOP_LOSS') ||
                                        (t.type === 'ORDER_CREATE' && t.order && t.order.type === 'STOP_LOSS')
                                    )
                                );

                                for (const t of potentialSLOrders) {
                                    const priceStr = t.price || t.order?.price;
                                    if (priceStr) {
                                        const price = parseFloat(priceStr);
                                        if (validateSL(price)) {
                                            initialStopLoss = price;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Get Closing Reason (if closed)
        if (trade.status !== TradeStatus.OPEN) {
            // First, fetch the Trade Details to get closingTransactionIDs
            const tradeUrl = `${baseUrl}/accounts/${accountId}/trades/${trade.id}`;
            const tradeRes = await fetch(tradeUrl, { method: 'GET', headers });
            
            if (tradeRes.ok) {
                const tradeData = await tradeRes.json();
                const closingIds = tradeData.trade.closingTransactionIDs;
                
                if (closingIds && closingIds.length > 0) {
                    const closeTxId = closingIds[0];
                    const closeTxUrl = `${baseUrl}/accounts/${accountId}/transactions/${closeTxId}`;
                    const closeTxRes = await fetch(closeTxUrl, { method: 'GET', headers });
                    
                    if (closeTxRes.ok) {
                        const closeData = await closeTxRes.json();
                        const closeTx = closeData.transaction;
                        if (closeTx && closeTx.reason) {
                            exitReason = closeTx.reason; // STOP_LOSS_ORDER, TAKE_PROFIT_ORDER, MARKET_ORDER_TRADE_CLOSE
                        }
                    }
                }
            }
        }
        
        return { initialStopLoss, initialEntryPrice, entryOrderType, exitReason };
    } catch (e) {
        console.warn(`Failed to fetch enrichment for trade ${trade.id}`, e instanceof Error ? e.message : e);
        return { initialStopLoss, initialEntryPrice, entryOrderType: null, exitReason: null };
    }
};

export const fetchAccountDetails = async (
    accountId: string,
    apiKey: string,
    env: 'practice' | 'live'
): Promise<any> => {
    const baseUrl = getBaseUrl(env);
    const url = `${baseUrl}/accounts/${accountId}/summary`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.errorMessage || `Failed to fetch account details (${response.status})`);
        }

        const data = await response.json();
        return data.account;
    } catch (e) {
        console.error("Error fetching account details:", e instanceof Error ? e.message : e);
        throw e;
    }
};

export const fetchFundTransactions = async (
    accountId: string,
    apiKey: string,
    env: 'practice' | 'live'
): Promise<any[]> => {
    const baseUrl = getBaseUrl(env);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    
    // Look back 5 years to find all deposit/withdrawal history
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[OANDA Service] Starting Funding History Fetch...`);

    let finalTransactions: any[] = [];

    // 1. Get Account Summary first to see latest transaction ID
    try {
        const summaryResponse = await fetch(`${baseUrl}/accounts/${accountId}/summary`, { method: 'GET', headers });
        if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            const lastId = summaryData.account.lastTransactionID;
            
            // DEBUG: Fetch the LATEST transaction to answer the user's question
            if (lastId) {
                const latestTxUrl = `${baseUrl}/accounts/${accountId}/transactions/${lastId}`;
                const latestTxRes = await fetch(latestTxUrl, { method: 'GET', headers });
                if (latestTxRes.ok) {
                    const latestData = await latestTxRes.json();
                    console.log(`[OANDA Service] LATEST Transaction Data (ID ${lastId}):`, latestData.transaction);
                }
            }
        }
    } catch (e) {
        console.warn("Failed to fetch summary for transaction debugging", e);
    }

    // 2. Fetch the FIRST transaction (Account Creation) - Explicitly
    try {
        const firstTxUrl = `${baseUrl}/accounts/${accountId}/transactions/1`;
        const firstTxRes = await fetch(firstTxUrl, { method: 'GET', headers });
        if (firstTxRes.ok) {
            const firstData = await firstTxRes.json();
            console.log(`[OANDA Service] First Transaction (ID 1):`, firstData.transaction);
            if (firstData.transaction) {
                // Ensure type is friendly for UI logic
                if (firstData.transaction.type === 'CREATE' || firstData.transaction.type === 'ACCOUNT_CREATE') {
                    // Manually inject a type if needed or keep standard
                    // We will add this to the list
                    finalTransactions.push(firstData.transaction);
                }
            }
        } else {
            console.warn(`[OANDA Service] Failed to fetch Transaction ID 1 (Status: ${firstTxRes.status})`);
        }
    } catch (e) {
        console.warn("Failed to fetch first transaction", e);
    }

    // 3. Fetch Standard Funding Transactions (Deposits, Withdrawals, Resets)
    const url = `${baseUrl}/accounts/${accountId}/transactions?from=${from}&to=${to}&type=TRANSFER_FUNDS,TRANSFER_FUNDS_REJECT,FUNDING,RESET_RESETTABLE_PL`;

    try {
        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            console.warn("Failed to fetch fund transactions list", response.status, response.statusText);
        } else {
            const data = await response.json();
            console.log("[OANDA Service] Funds History Data:", data);
            
            if (data.transactions && Array.isArray(data.transactions)) {
                finalTransactions = [...finalTransactions, ...data.transactions];
            }
        }
    } catch (e) {
        console.error("Error fetching fund transactions:", e instanceof Error ? e.message : e);
    }

    // Remove duplicates based on ID (just in case ID 1 appeared in the list)
    const seenIds = new Set();
    const uniqueTransactions = finalTransactions.filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
    });

    // Sort by ID descending (newest first)
    return uniqueTransactions.sort((a, b) => Number(b.id) - Number(a.id));
};

export const fetchOandaTradeHistory = async (
  accountId: string,
  apiKey: string,
  env: 'practice' | 'live'
): Promise<Trade[]> => {
    const baseUrl = getBaseUrl(env);
    const trades: Trade[] = [];

    try {
        const closedUrl = `${baseUrl}/accounts/${accountId}/trades?state=CLOSED&count=500`;
        const closedResponse = await fetch(closedUrl, {
             method: 'GET',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${apiKey}` 
             }
        });

        if (closedResponse.ok) {
            const data = await closedResponse.json();
            if (data.trades) {
                data.trades.forEach((t: any) => trades.push(mapOandaTradeToAppTrade(t, 'CLOSED')));
            }
        } else {
             const err = await closedResponse.json().catch(() => ({}));
             const msg = err.errorMessage || closedResponse.statusText;
             
             console.error(`Failed to fetch closed trades: ${msg}`);
             
             if (closedResponse.status === 401) throw new Error("Unauthorized. Please check your API Token.");
             if (closedResponse.status === 403) throw new Error(`Insufficient authorization. You are trying to access a ${accountId.startsWith('001') ? 'LIVE' : 'PRACTICE'} account on the ${env.toUpperCase()} server. Please check your environment settings.`);
             
             throw new Error(msg || `Failed to fetch closed trades (${closedResponse.status})`);
        }

        const openUrl = `${baseUrl}/accounts/${accountId}/trades?state=OPEN&count=500`;
        const openResponse = await fetch(openUrl, {
             method: 'GET',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${apiKey}` 
             }
        });

        if (openResponse.ok) {
            const data = await openResponse.json();
             if (data.trades) {
                data.trades.forEach((t: any) => trades.push(mapOandaTradeToAppTrade(t, 'OPEN')));
            }
        } else {
             const err = await openResponse.json().catch(() => ({}));
             const msg = err.errorMessage || openResponse.statusText;
             console.warn(`Failed to fetch open trades: ${msg}`);
        }

    } catch (e) {
        console.error("Error syncing with OANDA:", e instanceof Error ? e.message : e);
        throw e;
    }

    return trades.sort((a, b) => (b.entryTimestamp || 0) - (a.entryTimestamp || 0));
};

const mapOandaTradeToAppTrade = (oandaTrade: any, state: 'OPEN' | 'CLOSED'): Trade => {
    const units = Number(oandaTrade.initialUnits);
    const type = units > 0 ? TradeType.LONG : TradeType.SHORT;
    const quantity = Math.abs(units);
    
    const entryDateObj = new Date(oandaTrade.openTime);
    const entryTimestamp = Math.floor(entryDateObj.getTime() / 1000);
    const entryDate = entryDateObj.toISOString().split('T')[0];

    let exitTimestamp: number | undefined;
    let exitDate: string | undefined;
    let exitPrice: number | undefined;
    
    let status = TradeStatus.OPEN;
    let pnl = 0;

    if (state === 'CLOSED') {
        pnl = Number(oandaTrade.realizedPL);
        if (pnl > 0) status = TradeStatus.WIN;
        else if (pnl < 0) status = TradeStatus.LOSS;
        else status = TradeStatus.BREAK_EVEN;

        if (oandaTrade.closeTime) {
            const exitDateObj = new Date(oandaTrade.closeTime);
            exitTimestamp = Math.floor(exitDateObj.getTime() / 1000);
            exitDate = exitDateObj.toISOString().split('T')[0];
        }
        
        exitPrice = Number(oandaTrade.averageClosePrice);
    } else {
        pnl = Number(oandaTrade.unrealizedPL || 0);
    }

    const stopLoss = oandaTrade.stopLossOrder ? Number(oandaTrade.stopLossOrder.price) : 0;
    const takeProfit = oandaTrade.takeProfitOrder ? Number(oandaTrade.takeProfitOrder.price) : 0;

    return {
        id: oandaTrade.id,
        symbol: cleanSymbol(oandaTrade.instrument),
        type,
        status,
        entryPrice: Number(oandaTrade.price),
        exitPrice,
        quantity,
        stopLoss,
        initialStopLoss: stopLoss,
        takeProfit,
        pnl,
        entryDate,
        entryTimestamp,
        exitDate,
        exitTimestamp,
        notes: '',
        setup: '',
        mistake: '',
        emotion: '',
        mistakes: []
    };
};
