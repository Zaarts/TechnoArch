
import React, { useState } from 'react';
import { Plugin } from '../../types';
import { categorizePlugins } from '../../services/aiService';

interface PluginManagerProps {
  plugins: Plugin[];
  onAdd: (plugin: Omit<Plugin, 'id'>) => void;
  onAddBatch: (plugins: Omit<Plugin, 'id'>[]) => void;
  onRemove: (id: string) => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ plugins, onAdd, onAddBatch, onRemove }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Plugin['type']>('Synth');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, type });
    setName('');
  };

  const handleBulkSubmit = async () => {
    if (!bulkText.trim()) return;
    setIsLoading(true);
    const categorized = await categorizePlugins(bulkText);
    onAddBatch(categorized);
    setBulkText('');
    setBulkMode(false);
    setIsLoading(false);
  };

  return (
    <div className="bg-black/90 border border-green-900/60 p-4 rounded-lg backdrop-blur-md h-full flex flex-col shadow-[0_0_30px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-center mb-4 border-b border-green-900/30 pb-2">
        <h3 className="text-green-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          VST_REGISTRY_3.2
        </h3>
        <button 
          onClick={() => setBulkMode(!bulkMode)}
          className={`text-[8px] border px-2 py-0.5 uppercase transition-all font-bold ${bulkMode ? 'bg-green-600 text-black border-green-600' : 'text-green-800 border-green-900 hover:text-green-400'}`}
        >
          {bulkMode ? '[MANUAL]' : '[BULK_AI]'}
        </button>
      </div>

      {!bulkMode ? (
        <form onSubmit={handleSubmit} className="mb-4 space-y-2">
          <input 
            type="text" 
            placeholder="PLUGIN_NAME..."
            className="w-full bg-green-950/10 border border-green-900/40 p-2 text-green-300 text-xs outline-none focus:border-green-500 transition-all placeholder:text-green-900"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <select 
              className="flex-1 bg-green-950/20 border border-green-900/40 p-2 text-green-400 text-[10px] outline-none cursor-pointer"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              {['Synth', 'EQ', 'Dynamics', 'Distortion', 'Reverb', 'Delay', 'Other'].map(t => (
                <option key={t} value={t} className="bg-black">{t.toUpperCase()}</option>
              ))}
            </select>
            <button className="bg-green-600 text-black font-bold px-4 py-1 text-[10px] uppercase hover:bg-white transition-all">
              ADD
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-4 space-y-2">
          <textarea 
            placeholder="Paste plugin list (e.g. Serum, FabFilter Pro-Q 3...)"
            className="w-full h-24 bg-green-950/10 border border-green-900/40 p-2 text-green-300 text-[10px] outline-none focus:border-green-500 resize-none font-mono placeholder:text-green-900"
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />
          <button 
            onClick={handleBulkSubmit}
            disabled={isLoading || !bulkText.trim()}
            className="w-full bg-green-500 text-black font-bold py-2 text-[9px] uppercase hover:bg-white transition-all disabled:opacity-30"
          >
            {isLoading ? 'AI_CATEGORIZING...' : 'AI_SMART_IMPORT'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
        {plugins.map(p => (
          <div key={p.id} className="flex justify-between items-center border border-green-900/20 p-2 group hover:bg-green-900/10 transition-all">
            <div className="flex flex-col">
              <span className="text-[10px] text-white font-bold tracking-tight">{p.name}</span>
              <span className={`text-[7px] uppercase font-mono px-1 w-fit rounded mt-0.5 ${
                p.type === 'Synth' ? 'bg-blue-900/30 text-blue-400' : 
                p.type === 'EQ' ? 'bg-yellow-900/30 text-yellow-400' : 
                p.type === 'Reverb' ? 'bg-purple-900/30 text-purple-400' : 'bg-green-900/30 text-green-700'
              }`}>
                {p.type}
              </span>
            </div>
            <button 
              onClick={() => onRemove(p.id)}
              className="text-red-900 hover:text-red-500 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity font-bold"
            >
              [DEL]
            </button>
          </div>
        ))}
        {plugins.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center opacity-20 text-[9px] uppercase tracking-widest text-green-900 border border-dashed border-green-900/30 rounded">
            Registry_Empty
          </div>
        )}
      </div>
    </div>
  );
};
