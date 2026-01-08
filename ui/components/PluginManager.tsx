
import React, { useState } from 'react';
import { Plugin } from '../../types';

interface PluginManagerProps {
  plugins: Plugin[];
  onAdd: (plugin: Omit<Plugin, 'id'>) => void;
  onRemove: (id: string) => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ plugins, onAdd, onRemove }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Plugin['type']>('Synth');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, type });
    setName('');
  };

  return (
    <div className="bg-black/80 border border-green-900/50 p-4 rounded backdrop-blur-sm h-full flex flex-col">
      <h3 className="text-green-500 font-bold mb-4 uppercase text-xs flex justify-between">
        <span>VST_PLUGIN_DATABASE</span>
        <span className="text-[8px] text-green-900">MANUAL_ENTRY_MODE</span>
      </h3>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <input 
          type="text" 
          placeholder="PLUGIN_NAME..."
          className="w-full bg-green-950/20 border border-green-900/50 p-2 text-green-400 text-xs outline-none focus:border-green-400"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <select 
          className="w-full bg-green-950/20 border border-green-900/50 p-2 text-green-400 text-xs outline-none"
          value={type}
          onChange={e => setType(e.target.value as any)}
        >
          {['Synth', 'EQ', 'Dynamics', 'Distortion', 'Reverb', 'Delay', 'Other'].map(t => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
        <button className="w-full bg-green-500 text-black font-bold py-1 text-[10px] uppercase hover:bg-white transition-all">
          ADD_TO_INDEX
        </button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
        {plugins.map(p => (
          <div key={p.id} className="flex justify-between items-center border border-green-900/30 p-2 group">
            <div className="flex flex-col">
              <span className="text-[10px] text-green-400 font-bold">{p.name}</span>
              <span className="text-[8px] text-green-800 uppercase">{p.type}</span>
            </div>
            <button 
              onClick={() => onRemove(p.id)}
              className="text-red-900 hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              [X]
            </button>
          </div>
        ))}
        {plugins.length === 0 && <div className="text-green-900 text-[9px] text-center mt-10 uppercase italic opacity-30">Database is empty</div>}
      </div>
    </div>
  );
};
