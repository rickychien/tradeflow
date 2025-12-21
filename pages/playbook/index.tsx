
import React, { useState } from 'react';
import { Strategy, Trade } from '../../types';
import { ArrowLeft, Plus } from 'lucide-react';
import { PlaybookList } from './PlaybookList';
import { PlaybookDetail } from './PlaybookDetail';
import { PlaybookForm } from './PlaybookForm';

interface PlaybookProps {
  strategies: Strategy[];
  trades: Trade[];
  onAddStrategy: (strategy: Strategy) => void;
  onUpdateStrategy: (strategy: Strategy) => void;
  onDeleteStrategy: (id: string) => void;
  onSelectTrade: (trade: Trade) => void;
  onDeleteTrade: (tradeId: string) => void;
  onViewTrades: (strategyName: string) => void;
}

type ViewMode = 'list' | 'detail' | 'form';

export const Playbook: React.FC<PlaybookProps> = ({
  strategies,
  trades,
  onAddStrategy,
  onUpdateStrategy,
  onDeleteStrategy,
  onSelectTrade,
  onDeleteTrade,
  onViewTrades
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const handleGoToList = () => {
    setViewMode('list');
    setSelectedStrategy(null);
  };

  const handleSelectStrategy = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setViewMode('detail');
  };

  const handleOpenCreate = () => {
    setSelectedStrategy(null);
    setViewMode('form');
  };

  const handleSaveStrategy = (strategy: Strategy) => {
    if (selectedStrategy && selectedStrategy.id === strategy.id) {
      onUpdateStrategy(strategy);
    } else {
      onAddStrategy(strategy);
    }
    setSelectedStrategy(strategy);
    setViewMode('detail');
  };

  const handleDeleteStrategy = (id: string) => {
    onDeleteStrategy(id);
    handleGoToList();
  };

  return (
    <div className="animate-fade-in pb-10">

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {viewMode !== 'list' && (
            <button
              onClick={viewMode === 'detail' ? handleGoToList : () => {
                if (selectedStrategy) setViewMode('detail');
                else setViewMode('list');
              }}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Playbook</h1>
            <p className="text-slate-400 mt-1">Define and refine your trading strategies.</p>
          </div>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Add Strategy
          </button>
        )}
      </div>

      {viewMode === 'list' && (
        <PlaybookList
          strategies={strategies}
          trades={trades}
          onSelectStrategy={handleSelectStrategy}
          onOpenCreate={handleOpenCreate}
        />
      )}

      {viewMode === 'detail' && selectedStrategy && (
        <PlaybookDetail
          strategy={selectedStrategy}
          onSave={handleSaveStrategy}
          trades={trades}
          onSelectTrade={onSelectTrade}
          onDeleteTrade={onDeleteTrade}
          onViewTrades={onViewTrades}
          onDelete={handleDeleteStrategy}
        />
      )}

      {viewMode === 'form' && (
        <PlaybookForm
          initialData={selectedStrategy || undefined}
          onSave={handleSaveStrategy}
          onCancel={() => {
            if (selectedStrategy) setViewMode('detail');
            else setViewMode('list');
          }}
          onDelete={handleDeleteStrategy}
        />
      )}

    </div>
  );
};
