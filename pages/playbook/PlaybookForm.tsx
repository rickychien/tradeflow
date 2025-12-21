
import React, { useState } from 'react';
import { Strategy } from '../../types';
import { Edit2, FileText, GripVertical, LogIn, LogOut, Plus, Save, Trash2, X } from 'lucide-react';

interface PlaybookFormProps {
  initialData?: Strategy;
  onSave: (strategy: Strategy) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

export const PlaybookForm: React.FC<PlaybookFormProps> = ({
  initialData,
  onSave,
  onCancel,
  onDelete
}) => {
  const [formData, setFormData] = useState<{
    id: string | null;
    name: string;
    description: string;
    entryRules: string[];
    exitRules: string[];
  }>({
    id: initialData?.id || null,
    name: initialData?.name || '',
    description: initialData?.description || '',
    entryRules: initialData?.entryRules && initialData.entryRules.length > 0 ? [...initialData.entryRules] : [''],
    exitRules: initialData?.exitRules && initialData.exitRules.length > 0 ? [...initialData.exitRules] : ['']
  });

  const [draggedItem, setDraggedItem] = useState<{ index: number; type: 'entry' | 'exit' } | null>(null);

  const handleRuleChange = (type: 'entry' | 'exit', index: number, value: string) => {
    if (type === 'entry') {
      const newRules = [...formData.entryRules];
      newRules[index] = value;
      setFormData(prev => ({ ...prev, entryRules: newRules }));
    } else {
      const newRules = [...formData.exitRules];
      newRules[index] = value;
      setFormData(prev => ({ ...prev, exitRules: newRules }));
    }
  };

  const addRuleField = (type: 'entry' | 'exit') => {
    if (type === 'entry') {
      setFormData(prev => ({ ...prev, entryRules: [...prev.entryRules, ''] }));
    } else {
      setFormData(prev => ({ ...prev, exitRules: [...prev.exitRules, ''] }));
    }
  };

  const removeRuleField = (type: 'entry' | 'exit', index: number) => {
    if (type === 'entry') {
      setFormData(prev => ({ ...prev, entryRules: prev.entryRules.filter((_, i) => i !== index) }));
    } else {
      setFormData(prev => ({ ...prev, exitRules: prev.exitRules.filter((_, i) => i !== index) }));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number, type: 'entry' | 'exit') => {
    setDraggedItem({ index, type });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number, type: 'entry' | 'exit') => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== type || draggedItem.index === index) return;

    if (type === 'entry') {
      const newRules = [...formData.entryRules];
      const item = newRules[draggedItem.index];
      newRules.splice(draggedItem.index, 1);
      newRules.splice(index, 0, item);
      setFormData(prev => ({ ...prev, entryRules: newRules }));
    } else {
      const newRules = [...formData.exitRules];
      const item = newRules[draggedItem.index];
      newRules.splice(draggedItem.index, 1);
      newRules.splice(index, 0, item);
      setFormData(prev => ({ ...prev, exitRules: newRules }));
    }

    setDraggedItem({ index, type });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const cleanEntryRules = formData.entryRules.filter(r => r.trim() !== '');
    const cleanExitRules = formData.exitRules.filter(r => r.trim() !== '');

    const strategy: Strategy = {
      id: formData.id || Math.random().toString(36).substr(2, 9),
      name: formData.name,
      description: formData.description,
      entryRules: cleanEntryRules,
      exitRules: cleanExitRules
    };

    onSave(strategy);
  };

  const handleDeleteCurrent = () => {
    if (formData.id && window.confirm('Are you sure you want to delete this strategy?')) {
      onDelete(formData.id);
    }
  };

  const renderRuleInput = (rule: string, index: number, type: 'entry' | 'exit') => (
    <div
      key={`${type}-${index}`}
      className="flex gap-2 items-center group bg-slate-800 border border-slate-700 rounded p-1.5 transition-colors hover:border-slate-600"
      draggable
      onDragStart={(e) => handleDragStart(e, index, type)}
      onDragOver={(e) => handleDragOver(e, index, type)}
      onDragEnd={handleDragEnd}
    >
      <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-1">
        <GripVertical size={14} />
      </div>
      <div className={`text-[10px] font-mono ${type === 'entry' ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
        {index + 1}.
      </div>
      <input
        type="text"
        value={rule}
        onChange={(e) => handleRuleChange(type, index, e.target.value)}
        className="flex-1 bg-transparent border-none text-slate-200 focus:ring-0 outline-none text-sm placeholder-slate-600"
        placeholder={`${type === 'entry' ? 'Entry' : 'Exit'} rule...`}
      />
      {(type === 'entry' ? formData.entryRules : formData.exitRules).length > 1 && (
        <button
          type="button"
          onClick={() => removeRuleField(type, index)}
          className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl animate-fade-in relative">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          {formData.id ? <Edit2 className="text-blue-500" size={24} /> : <Plus className="text-blue-500" size={24} />}
          {formData.id ? 'Edit Strategy' : 'Create New Strategy'}
        </h2>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Strategy Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
              placeholder="e.g., Bull Flag Continuation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText size={14} /> Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-sm leading-relaxed"
              placeholder="Describe the context, market conditions, and logic..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900/30 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wide">
                <LogIn size={14} /> Entry Rules
              </label>
              <button
                type="button"
                onClick={() => addRuleField('entry')}
                className="text-xs text-emerald-400 hover:text-white flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/20 transition-colors"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {formData.entryRules.map((rule, index) => renderRuleInput(rule, index, 'entry'))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center italic">Drag handle to reorder</p>
          </div>

          <div className="bg-slate-900/30 p-5 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wide">
                <LogOut size={14} /> Exit Rules
              </label>
              <button
                type="button"
                onClick={() => addRuleField('exit')}
                className="text-xs text-rose-400 hover:text-white flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded border border-rose-500/20 transition-colors"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {formData.exitRules.map((rule, index) => renderRuleInput(rule, index, 'exit'))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center italic">Drag handle to reorder</p>
          </div>
        </div>

        <div className="pt-6 flex items-center justify-between border-t border-slate-700">
          <div>
            {formData.id && (
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-medium px-4 py-2 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
              >
                <Trash2 size={16} /> Delete Strategy
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Save size={18} />
              Save Strategy
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
