
import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Save, Key, Calendar, CheckCircle, AlertCircle, Loader2, Globe, Database, Check, Bot, Sparkles, Download, Upload, HardDrive, RefreshCw, DollarSign, Sun, Moon, Layout } from 'lucide-react';
import { verifyOandaConnection } from '../../services/oandaService';
import { verifyGeminiConnection } from '../../services/geminiService';
import { exportBackup, importBackup } from '../../services/storageService';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const CURRENCIES = [
    { code: 'USD', label: 'USD - US Dollar' },
    { code: 'EUR', label: 'EUR - Euro' },
    { code: 'GBP', label: 'GBP - British Pound' },
    { code: 'JPY', label: 'JPY - Japanese Yen' },
    { code: 'AUD', label: 'AUD - Australian Dollar' },
    { code: 'CAD', label: 'CAD - Canadian Dollar' },
    { code: 'CHF', label: 'CHF - Swiss Franc' },
    { code: 'CNY', label: 'CNY - Chinese Yuan' },
    { code: 'TWD', label: 'TWD - New Taiwan Dollar' },
    { code: 'HKD', label: 'HKD - Hong Kong Dollar' },
    { code: 'NZD', label: 'NZD - New Zealand Dollar' },
    { code: 'SGD', label: 'SGD - Singapore Dollar' },
    { code: 'INR', label: 'INR - Indian Rupee' },
];

export const Settings: React.FC = () => {
    const {
        oandaApiKey, setOandaApiKey,
        oandaAccountId, setOandaAccountId,
        oandaEnv, setOandaEnv,
        setAvailableInstruments,
        autoSyncOanda, setAutoSyncOanda,
        geminiApiKey, setGeminiApiKey,
        setIsGeminiKeyValid,
        dateFormat, setDateFormat,
        timezone, setTimezone,
        currency, setCurrency,
        theme, setTheme,
        syncStatus, connectSyncFile
    } = useSettings();

    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);
    const [verifyingGemini, setVerifyingGemini] = useState(false);
    const [geminiResult, setGeminiResult] = useState<{ success: boolean; message: string } | null>(null);
    const [localDateFormat, setLocalDateFormat] = useState(dateFormat);
    const [localTimezone, setLocalTimezone] = useState(timezone);
    const [localCurrency, setLocalCurrency] = useState(currency);
    const [dateTimeSaved, setDateTimeSaved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        setLocalDateFormat(dateFormat);
        setLocalTimezone(timezone);
        setLocalCurrency(currency);
    }, [dateFormat, timezone, currency]);

    const handleVerifyOanda = async () => {
        setVerifying(true);
        setVerificationResult(null);
        const result = await verifyOandaConnection(oandaApiKey, oandaAccountId, oandaEnv);
        setVerificationResult({ success: result.success, message: result.message });
        if (result.success && result.instruments) {
            setAvailableInstruments(result.instruments);
        } else {
            setAvailableInstruments([]);
        }
        setVerifying(false);
    };

    const handleVerifyGemini = async () => {
        setVerifyingGemini(true);
        setGeminiResult(null);
        const result = await verifyGeminiConnection(geminiApiKey);
        setGeminiResult(result);
        if (result.success) {
            setIsGeminiKeyValid(true);
        } else {
            setIsGeminiKeyValid(false);
        }
        setVerifyingGemini(false);
    };

    const handleSaveDateTime = () => {
        setDateFormat(localDateFormat);
        setTimezone(localTimezone);
        setCurrency(localCurrency);
        setDateTimeSaved(true);
        setTimeout(() => setDateTimeSaved(false), 3000);
    };

    const handleDownloadBackup = () => {
        const dataStr = exportBackup();
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `tradeflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const result = importBackup(event.target.result as string);
                setImportStatus(result);
                if (result.success) {
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="animate-fade-in max-w-2xl mx-auto pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-slate-400 mt-1">Configure global application preferences.</p>
            </div>

            <div className="space-y-6">

                {/* Appearance Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div className="bg-purple-500/10 p-2 rounded-lg">
                            <Layout className="text-purple-500" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Appearance</h3>
                            <p className="text-xs text-slate-400">Customize the look and feel of the application.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${theme === 'light' ? 'bg-amber-100 text-amber-500' : 'bg-slate-700 text-slate-400'}`}>
                                    {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-white">Theme Mode</span>
                                    <span className="text-xs text-slate-500">Switch between dark and light themes.</span>
                                </div>
                            </div>
                            <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${theme === 'light' ? 'bg-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                                >
                                    <Sun size={12} /> Light
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                                >
                                    <Moon size={12} /> Dark
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Management Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div className="bg-amber-500/10 p-2 rounded-lg">
                            <HardDrive className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Data Management</h3>
                            <p className="text-xs text-slate-400">Backup and restore your journal notes, strategies, and tags.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 text-sm text-slate-300 leading-relaxed">
                            TradeFlow runs serverless. Your OANDA data comes from the API, but your <b>Playbook</b>, <b>Notes</b>, and <b>Tags</b> are stored in your browser.
                            Use this feature to save your data to a file or transfer it to another device.
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handleDownloadBackup} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                                <Download size={18} /> Backup Data (.json)
                            </button>

                            <button onClick={handleImportClick} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                                <Upload size={18} /> Restore / Merge
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                        </div>

                        {importStatus && (
                            <div className={`p-3 rounded-lg flex items-start gap-2 text-sm animate-fade-in ${importStatus.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {importStatus.success ? <CheckCircle size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                                <span>{importStatus.message}</span>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold flex items-center gap-2"><RefreshCw size={16} className={syncStatus.isActive ? "text-emerald-500" : "text-slate-400"} /> Auto-Sync Backup</h4>
                                    <p className="text-xs text-slate-400 mt-1">Automatically save changes to a local file.</p>
                                </div>
                                <button
                                    onClick={connectSyncFile}
                                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors border ${syncStatus.isActive ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'}`}
                                >
                                    {syncStatus.isActive ? 'Connected' : 'Connect File'}
                                </button>
                            </div>

                            {syncStatus.isActive && (
                                <div className="mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 text-xs flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>File:</span>
                                        <span className="font-mono text-emerald-400">{syncStatus.fileName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-500">
                                        <span>Last synced:</span>
                                        <span>{syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : 'Pending...'}</span>
                                    </div>
                                    {syncStatus.error && (
                                        <div className="mt-2 text-rose-400 flex items-center gap-1">
                                            <AlertCircle size={12} /> {syncStatus.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* OANDA API Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div className="bg-emerald-500/10 p-2 rounded-lg">
                            <Key className="text-emerald-500" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Market Data Provider (OANDA)</h3>
                            <p className="text-xs text-slate-400">Configure connection to OANDA for real-time charts.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Server Environment</label>
                                <select value={oandaEnv} onChange={(e) => setOandaEnv(e.target.value as 'practice' | 'live')} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                                    <option value="practice">Demo (api-fxpractice.oanda.com)</option>
                                    <option value="live">Live (api-fxtrade.oanda.com)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account ID (Optional)</label>
                                <input type="text" value={oandaAccountId} onChange={(e) => setOandaAccountId(e.target.value)} placeholder="e.g. 101-001-..." className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">API Access Token</label>
                            <input type="password" value={oandaApiKey} onChange={(e) => setOandaApiKey(e.target.value)} placeholder="Enter your bearer token (e.g., 1234...-5678...)" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm" />
                        </div>

                        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <button onClick={() => setAutoSyncOanda(!autoSyncOanda)} className={`w-10 h-6 rounded-full relative transition-colors ${autoSyncOanda ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-[#ffffff] transition-transform ${autoSyncOanda ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-300">Auto-Sync on Startup</span>
                                <span className="text-[10px] text-slate-500">Automatically fetch new trades when you open the app.</span>
                            </div>
                        </div>

                        {verificationResult && (
                            <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${verificationResult.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {verificationResult.success ? <CheckCircle size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                                <div className="flex flex-col">
                                    <span>{verificationResult.message}</span>
                                    {verificationResult.success && (
                                        <span className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                                            <Database size={10} /> Instruments List Updated
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button onClick={handleVerifyOanda} disabled={verifying || !oandaApiKey} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                                {verifying ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Save & Verify
                            </button>
                        </div>
                    </div>
                </div>

                {/* Gemini API Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div className="bg-indigo-500/10 p-2 rounded-lg">
                            <Bot className="text-indigo-500" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">AI Intelligence (Gemini)</h3>
                            <p className="text-xs text-slate-400">Configure Gemini API for AI-powered trade analysis.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gemini API Key</label>
                            <input type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="Enter your Google Gemini API Key" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" />
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                <Sparkles size={12} className="text-indigo-400" />
                                Required for the AI Coach feature in trade details.
                            </p>
                        </div>

                        {geminiResult && (
                            <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${geminiResult.success ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                {geminiResult.success ? <CheckCircle size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                                <span>{geminiResult.message}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button onClick={handleVerifyGemini} disabled={verifyingGemini || !geminiApiKey} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                                {verifyingGemini ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Save & Verify
                            </button>
                        </div>
                    </div>
                </div>

                {/* Localization Section */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                        <div className="bg-blue-500/10 p-2 rounded-lg">
                            <Globe className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Localization</h3>
                            <p className="text-xs text-slate-400">Date, Time, and Currency preferences.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><Calendar size={16} /> Date Format</label>
                                <select value={localDateFormat} onChange={(e) => setLocalDateFormat(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="EEE yyyy-MM-dd HH:mm">Fri 2025-12-10 20:10</option>
                                    <option value="yyyy-MM-dd HH:mm">2025-12-10 20:10</option>
                                    <option value="MMM dd, yyyy HH:mm">Dec 10, 2025 20:10</option>
                                    <option value="dd MMM yyyy HH:mm">10 Dec 2025 20:10</option>
                                    <option value="MM/dd/yyyy HH:mm">12/10/2025 20:10 (US)</option>
                                    <option value="dd/MM/yyyy HH:mm">10/12/2025 20:10 (UK)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><Globe size={16} /> Timezone</label>
                                <select value={localTimezone} onChange={(e) => setLocalTimezone(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    {TIMEZONES.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><DollarSign size={16} /> Account Currency</label>
                            <select value={localCurrency} onChange={(e) => setLocalCurrency(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                {CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2">All P&L and financial metrics will be displayed in this currency.</p>
                        </div>

                        <div className="pt-2 flex justify-end items-center gap-3">
                            {dateTimeSaved && (
                                <span className="text-sm text-emerald-400 flex items-center gap-1 animate-fade-in"><Check size={16} /> Saved!</span>
                            )}
                            <button onClick={handleSaveDateTime} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                                <Save size={18} /> Save Preferences
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
