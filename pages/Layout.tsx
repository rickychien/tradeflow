
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, BookOpen, Settings, BarChart2, Zap, ClipboardList, RefreshCw, ChevronsLeft, ChevronsRight, Wallet, CandlestickChart } from 'lucide-react';
import { loadUIPreferences, saveUIPreferences } from '../services/storageService';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'journal' | 'playbook' | 'settings' | 'reports' | 'accounts' | 'trade';
  onTabChange: (tab: 'dashboard' | 'journal' | 'playbook' | 'settings' | 'reports' | 'accounts' | 'trade') => void;
  onSync: () => void;
  isSyncing: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onSync, isSyncing }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
      const prefs = loadUIPreferences();
      return prefs.sidebarCollapsed;
  });

  useEffect(() => {
      saveUIPreferences({ sidebarCollapsed: isCollapsed });
  }, [isCollapsed]);

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-200 font-sans">
      {/* Sidebar */}
      <aside 
        className={`${isCollapsed ? 'w-20' : 'w-20 lg:w-64'} border-r border-slate-700 bg-slate-900 flex flex-col fixed h-full z-20 transition-all duration-300`}
      >
        <div className="h-16 flex items-center justify-center lg:justify-start px-0 lg:px-4 border-b border-slate-700 relative">
          <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <Zap className="text-blue-500 h-8 w-8 flex-shrink-0" />
            <span className={`font-bold text-xl text-white tracking-tight transition-opacity duration-200 ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>
                TradeFlow
            </span>
          </div>
          
          {/* Collapse Toggle - Vertical Rectangle Style */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-1/2 transform -translate-y-1/2 bg-slate-800 border border-slate-600 text-slate-400 hover:text-white rounded-r w-3 h-12 items-center justify-center shadow-lg transition-colors z-50 hover:bg-slate-700"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronsRight size={10} /> : <ChevronsLeft size={10} />}
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4 overflow-y-auto overflow-x-hidden">
          
          {/* Trade Terminal */}
          <button
            onClick={() => onTabChange('trade')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'trade' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Trade Terminal"
          >
            <CandlestickChart size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Trade</span>
          </button>

          <button
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Dashboard"
          >
            <LayoutDashboard size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('journal')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'journal' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Journal"
          >
            <BookOpen size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Journal</span>
          </button>

          <button
            onClick={() => onTabChange('playbook')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'playbook' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Playbook"
          >
            <ClipboardList size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Playbook</span>
          </button>

          <button 
            onClick={() => onTabChange('reports')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
                activeTab === 'reports' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Reports"
            >
            <BarChart2 size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Reports</span>
          </button>

          <button 
            onClick={() => onTabChange('accounts')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
                activeTab === 'accounts' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Account"
            >
            <Wallet size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Account</span>
          </button>
          
          <button 
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
                activeTab === 'settings' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Settings"
            >
            <Settings size={20} className="flex-shrink-0" />
            <span className={`ml-3 font-medium transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>Settings</span>
          </button>
        </nav>

        {/* Footer with Sync Button - Ensuring bottom alignment with flex-col on aside */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 mt-auto">
            <button
                onClick={onSync}
                disabled={isSyncing}
                className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group border ${
                    isSyncing 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300 shadow-lg shadow-emerald-900/20'
                }`}
                title="Sync OANDA"
            >
                <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                <span className={`ml-3 font-bold transition-opacity duration-200 whitespace-nowrap ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>
                    {isSyncing ? 'Syncing...' : 'Sync OANDA'}
                </span>
            </button>
        </div>
      </aside>

      {/* Main Content - Adjust margin based on collapsed state */}
      <main className={`flex-1 ${isCollapsed ? 'ml-20' : 'ml-20 lg:ml-64'} p-4 lg:p-8 overflow-y-auto transition-all duration-300`}>
        <div className="max-w-[1920px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
