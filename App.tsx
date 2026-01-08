
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFolder, scanFilesLegacy } from './modules/inventory/scanner';
import { AudioSample, ScanProgress, Plugin } from './types';
import { Terminal } from './ui/components/Terminal';
import { SampleCard } from './ui/components/SampleCard';
import { PluginManager } from './ui/components/PluginManager';
import { localSearch } from './modules/inventory/localSearch';
import { getAIRecommendation } from './services/aiService';

const App: React.FC = () => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'plugins' | 'assistant'>('inventory');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('ta_plugins');
    if (saved) setPlugins(JSON.parse(saved));
    const savedSamples = localStorage.getItem('ta_samples_index');
    if (savedSamples) {
        try {
            setSamples(JSON.parse(savedSamples));
            addLog("SYSTEM: LOCAL_INDEX_LOADED_FROM_CACHE");
        } catch(e) {}
    }
  }, [addLog]);

  useEffect(() => {
    localStorage.setItem('ta_plugins', JSON.stringify(plugins));
  }, [plugins]);

  useEffect(() => {
    if (samples.length > 0) {
        localStorage.setItem('ta_samples_index', JSON.stringify(samples));
    }
  }, [samples]);

  const handleScan = async () => {
    try {
      const win = window as any;
      if (typeof win.showDirectoryPicker === 'function') {
        const dirHandle = await win.showDirectoryPicker();
        addLog(`ACCESS_GRANTED: ${dirHandle.name}`);
        addLog('DEEP_DNA_SCAN: INITIATED');
        
        const results = await scanFolder(dirHandle, (p) => {
          setProgress(p);
          if (p.processedFiles % 100 === 0) {
              addLog(`OK: ${p.processedFiles} SAMPLES_ANALYZED (FILT: ${p.filteredCount})`);
          }
        });

        setSamples(results);
        setProgress(null);
        addLog(`SCAN_STABLE: ${results.length} OBJECTS_INDEXED`);
      } else {
        throw new Error('NOT_SUPPORTED');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addLog("SECURITY: REDIRECTING TO LEGACY SCANNER...");
      fileInputRef.current?.click();
    }
  };

  const handleAIRequest = async () => {
    if (!aiQuery.trim() || samples.length === 0) return;
    setIsAiLoading(true);
    addLog(`AI_QUERY: "${aiQuery}"`);
    
    // 1. Предварительный локальный поиск (Mediator)
    const topCandidates = localSearch(samples, aiQuery, 50);
    
    // 2. Запрос к Gemini
    const recommendation = await getAIRecommendation(aiQuery, topCandidates, plugins);
    
    addLog("--- NEURAL_ADVICE_START ---");
    recommendation.split('\n').forEach(line => {
        if (line.trim()) addLog(`> ${line}`);
    });
    addLog("--- NEURAL_ADVICE_END ---");
    
    setIsAiLoading(false);
    setAiQuery('');
  };

  const playSample = async (sample: AudioSample) => {
    try {
      if (sample.type === 'midi') {
        addLog('SYSTEM: MIDI_PREVIEW_DISABLED');
        return;
      }
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const file = sample.handle instanceof File ? sample.handle : await sample.handle.getFile();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      addLog(`PLAY: ${sample.name} [FRQ: ${sample.dna.peakFrequency.toFixed(0)}Hz | ATK: ${sample.dna.attackMs.toFixed(1)}ms]`);
    } catch (e) {
      addLog(`ERR: AUDIO_ENGINE_FAILURE - ${sample.name}`);
    }
  };

  const exportIndex = () => {
    const data = JSON.stringify({ samples, plugins, date: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TA_CORE_INDEX.json`;
    a.click();
    addLog('EXPORT: SYNC_SUCCESS');
  };

  const filteredSamples = useMemo(() => {
    if (!filter) return samples.slice(0, 100);
    const results = localSearch(samples, filter, 150);
    return results;
  }, [samples, filter]);

  return (
    <div className="min-h-screen cyber-grid p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Fix: Use object spread and type assertion to bypass webkitdirectory property error in TS */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={async (e) => {
          const files = e.target.files;
          if (!files) return;
          const res = await scanFilesLegacy(files, setProgress);
          setSamples(res);
          setProgress(null);
        }} 
        {...({ webkitdirectory: "true" } as any)} 
        multiple 
      />
      <input type="file" ref={importInputRef} style={{ display: 'none' }} onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
              const d = JSON.parse(ev.target?.result as string);
              if (d.samples) setSamples(d.samples);
              if (d.plugins) setPlugins(d.plugins);
              addLog(`RESTORED: ${d.samples?.length} OBJECTS`);
          };
          reader.readAsText(file);
      }} accept=".json" />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-green-900 pb-6 gap-4 relative">
        <div className="z-20">
          <h1 className="text-4xl font-bold neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">OS v3.2</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
             <div className={`w-2 h-2 rounded-full ${samples.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
             <p className="text-green-700 text-[10px] uppercase tracking-[0.4em]">
                Neural DNA Precision Engine
             </p>
          </div>
        </div>
        <div className="flex gap-2 z-20">
          <button onClick={() => importInputRef.current?.click()} className="px-3 py-2 border border-green-900 text-green-900 text-[10px] uppercase font-bold hover:text-green-400">IMPORT</button>
          <button onClick={exportIndex} className="px-3 py-2 border border-green-900 text-green-900 text-[10px] uppercase font-bold hover:text-green-400">EXPORT</button>
          <button onClick={handleScan} disabled={!!progress} className="px-6 py-2 bg-green-500 text-black font-bold uppercase text-xs rounded-sm hover:bg-white neon-border disabled:opacity-50 transition-all">
            {progress ? `SCANNING: ${progress.processedFiles}` : 'SCAN_STATION'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
          <Terminal logs={logs} title="NEURAL_LOG_3.2" />
          
          <div className="flex border border-green-900 overflow-hidden rounded p-1 bg-black">
            {['inventory', 'plugins', 'assistant'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)} 
                className={`flex-1 py-1.5 text-[9px] uppercase font-bold transition-all ${activeTab === tab ? 'bg-green-500 text-black' : 'text-green-900 hover:text-green-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'inventory' && (
              <div className="bg-black/80 border border-green-900/50 p-4 rounded backdrop-blur-sm shadow-xl h-full flex flex-col">
                <h3 className="text-green-500 font-bold mb-3 uppercase text-xs">Acoustic_Matrix</h3>
                <input type="text" placeholder="TAGS_OR_DNA..." className="w-full bg-green-950/20 border border-green-900/50 p-2 text-green-400 text-xs outline-none focus:border-green-400 mb-4" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  {['#Kick', '#Bass', '#Hat', '#Percussion', '#Punchy', '#Long_Tail', '#STEM', '#LOOP'].map(tag => (
                    <button key={tag} onClick={() => setFilter(tag === filter ? '' : tag)} className={`text-[9px] border px-2 py-1.5 transition-all uppercase ${filter === tag ? 'bg-green-500 text-black border-green-500' : 'border-green-900 text-green-800 hover:border-green-400'}`}>{tag}</button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'plugins' && (
              <PluginManager plugins={plugins} onAdd={p => setPlugins([...plugins, { ...p, id: Math.random().toString() }])} onRemove={id => setPlugins(plugins.filter(p => p.id !== id))} />
            )}
            {activeTab === 'assistant' && (
              <div className="bg-black/80 border border-green-500/30 p-4 rounded backdrop-blur-sm h-full flex flex-col gap-3">
                 <h3 className="text-green-400 font-bold uppercase text-xs">Neural_Assistant</h3>
                 <p className="text-[9px] text-green-800 uppercase italic">Задай вопрос, например: "Найди самый жирный кик для индустриального техно"</p>
                 <textarea 
                   className="flex-1 bg-green-950/20 border border-green-900/50 p-3 text-green-400 text-xs outline-none focus:border-green-400 resize-none"
                   placeholder="TYPE_COMMAND..."
                   value={aiQuery}
                   onChange={e => setAiQuery(e.target.value)}
                 />
                 <button 
                   onClick={handleAIRequest}
                   disabled={isAiLoading || samples.length === 0}
                   className="w-full bg-green-500 text-black font-bold py-2 text-[10px] uppercase hover:bg-white transition-all disabled:opacity-30"
                 >
                   {isAiLoading ? 'GENERATING_RESPONSE...' : 'CONSULT_INTELLIGENCE'}
                 </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Stream */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden bg-black/40 border border-green-900/20 rounded p-4">
          <div className="flex justify-between items-center border-b border-green-900/30 pb-2">
             <div className="flex gap-4 items-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">INVENTORY_STREAM</h2>
                {progress && (
                   <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-green-950 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 animate-[width_1s_ease-in-out_infinite]" style={{width: '30%'}}></div>
                      </div>
                      <span className="text-[8px] text-green-500 animate-pulse">ANALYZING DNA: {progress.currentFile}</span>
                   </div>
                )}
             </div>
             <div className="text-[10px] text-green-800 font-mono">
                DISPLAY: {filteredSamples.length} | FILTERED_OUT: {progress?.filteredCount || 0}
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
            {filteredSamples.map(sample => (
              <SampleCard key={sample.id} sample={sample} onPlay={playSample} onCopy={path => { navigator.clipboard.writeText(path); addLog(`PATH_SAVED: ${sample.name}`); }} />
            ))}
            {samples.length === 0 && !progress && (
              <div className="col-span-full h-full flex flex-col items-center justify-center opacity-30">
                 <div className="text-[50px] font-bold text-green-900 mb-4">Ø</div>
                 <p className="text-xs uppercase tracking-[0.5em]">SYSTEM_EMPTY</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Stat Bar */}
      <footer className="h-6 flex items-center justify-between px-2 text-[8px] text-green-900 uppercase tracking-widest bg-green-900/5 border-t border-green-900/20">
         <div className="flex gap-4">
            <span>CORE: STABLE</span>
            <span>DSP: ACTIVE</span>
            {/* Fix: cast performance to any to access standard-extension memory property */}
            <span>MEM: {Math.round(((performance as any).memory?.usedJSHeapSize || 0) / 1024 / 1024) || 0}MB</span>
         </div>
         <div className="flex gap-4">
            <span>INDEXED: {samples.length}</span>
            <span>PLUGINS: {plugins.length}</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
