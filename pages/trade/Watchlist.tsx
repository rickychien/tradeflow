
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, X, List, GripVertical, Check, AlertCircle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

interface WatchlistProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  orientation?: 'vertical' | 'horizontal';
}

export const Watchlist: React.FC<WatchlistProps> = ({ selectedSymbol, onSelect, orientation = 'vertical' }) => {
  const { availableInstruments, watchlist, addToWatchlist, removeFromWatchlist, updateWatchlist } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Local state for drag and drop
  const [localWatchlist, setLocalWatchlist] = useState<string[]>(watchlist);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync local state when global watchlist changes
  useEffect(() => {
      setLocalWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
              setIsSearching(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchTerm || !availableInstruments) return [];
    const lowerTerm = searchTerm.toLowerCase().replace('_', '');
    return availableInstruments
        .filter(sym => sym.toLowerCase().replace('_', '').includes(lowerTerm))
        .sort((a, b) => {
            const aStarts = a.toLowerCase().replace('_', '').startsWith(lowerTerm);
            const bStarts = b.toLowerCase().replace('_', '').startsWith(lowerTerm);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        })
        .slice(0, 50); 
  }, [availableInstruments, searchTerm]);

  const toggleWatchlistSymbol = (symbol: string) => {
      if (watchlist.includes(symbol)) {
          removeFromWatchlist(symbol);
      } else {
          addToWatchlist(symbol);
      }
      // Keep search open for multiple selections
      searchInputRef.current?.focus();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newWatchlist = [...localWatchlist];
    const draggedItem = newWatchlist[draggedIndex];
    newWatchlist.splice(draggedIndex, 1);
    newWatchlist.splice(index, 0, draggedItem);
    
    setLocalWatchlist(newWatchlist);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    updateWatchlist(localWatchlist);
  };

  const isHorizontal = orientation === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row items-center h-12' : 'flex-col h-full'} bg-slate-800 border border-slate-700 rounded-xl overflow-visible relative`}>
      <div className={`${isHorizontal ? 'w-48 border-r' : 'border-b'} border-slate-700 bg-slate-900/50 p-2 relative z-50`} ref={searchContainerRef}>
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
            <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsSearching(true);
                }}
                onFocus={() => setIsSearching(true)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-7 py-1.5 text-[10px] text-white focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-600 uppercase font-bold"
            />
            {searchTerm && (
                 <button 
                    onClick={() => { setSearchTerm(''); setIsSearching(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                 >
                     <X size={12} />
                 </button>
            )}
        </div>

        {/* Dropdown Search Results */}
        {isSearching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-[100] animate-fade-in">
                {availableInstruments.length === 0 ? (
                    <div className="p-4 text-center">
                        <AlertCircle className="mx-auto text-slate-500 mb-2" size={20} />
                        <p className="text-xs text-slate-400">No instruments loaded.</p>
                        <p className="text-[10px] text-slate-600 mt-1">Check Settings &gt; Sync OANDA</p>
                    </div>
                ) : searchResults.length > 0 ? (
                    <div className="py-1">
                        {searchResults.map((symbol) => {
                            const isSelected = watchlist.includes(symbol);
                            const displaySymbol = symbol.replace('_', '');
                            return (
                                <div 
                                    key={symbol}
                                    onClick={() => toggleWatchlistSymbol(symbol)}
                                    className="px-3 py-2 cursor-pointer flex items-center justify-between transition-colors hover:bg-slate-700 group"
                                >
                                    <span className="font-bold text-xs text-slate-200">{displaySymbol}</span>
                                    {isSelected ? (
                                        <Check size={14} className="text-emerald-500" />
                                    ) : (
                                        <Plus size={14} className="text-slate-600 group-hover:text-blue-400" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-3 text-center text-xs text-slate-500">
                        No matches found.
                    </div>
                )}
            </div>
        )}
      </div>
      
      {/* Watchlist Items */}
      <div className={`flex-1 ${isHorizontal ? 'flex flex-row overflow-x-auto items-center gap-1 px-2 no-scrollbar' : 'overflow-y-auto p-1 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 relative z-0'}`}>
             {localWatchlist.length === 0 && (
                 <div className="p-4 text-center text-xs text-slate-500 flex flex-col items-center gap-2 opacity-60 w-full">
                     <List size={isHorizontal ? 16 : 24} />
                     <span>List empty.</span>
                 </div>
             )}
             {localWatchlist.map((symbol, index) => (
                <div 
                    key={symbol}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelect(symbol)}
                    className={`group rounded-lg cursor-pointer flex items-center justify-between transition-colors select-none flex-shrink-0
                        ${isHorizontal ? 'px-3 py-1.5 border border-transparent' : 'px-2 py-2'}
                        ${selectedSymbol === symbol 
                            ? isHorizontal 
                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                                : 'bg-blue-600 text-white' 
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                        } 
                        ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}
                    `}
                >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                         <div className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {isHorizontal ? <GripVertical size={10} /> : <GripVertical size={10} />}
                         </div>
                         <span className="font-bold text-xs truncate">{symbol.replace('_', '')}</span>
                    </div>
                    <div className={`flex items-center gap-1 flex-shrink-0 ${isHorizontal ? 'ml-2' : ''}`}>
                        {!isHorizontal && selectedSymbol === symbol && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeFromWatchlist(symbol); }}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                        >
                            <X size={10} />
                        </button>
                    </div>
                </div>
             ))}
      </div>
    </div>
  );
};
