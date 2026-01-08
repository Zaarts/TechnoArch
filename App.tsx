
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
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[] | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
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
            addLog("SYSTEM: HYBRID_INDEX_RECOVERED");
        } catch(e) {}
    }
  }, [addLog]);

  useEffect(() => { localStorage.setItem('ta_plugins', JSON.stringify(plugins)); }, [plugins]);
  useEffect(() => { if (samples.length > 0) localStorage.setItem('ta_samples_index', JSON.stringify(samples)); }, [samples]);

  const handleScan = async () => {
    try {
      const win = window as any;
      if (typeof win.showDirectoryPicker === 'function') {
        const dirHandle = await win.showDirectoryPicker();
        addLog(`SCANNING_MODERN: ${dirHandle.name}`);
        const results = await scanFolder(dirHandle, (p) => {
          setProgress(p);
          if (p.processedFiles % 100 === 0) addLog(`DNA_STATUS: ${p.processedFiles} PARSED`);
        });
        setSamples(results);
        setProgress(null);
        addLog(`SCAN_STABLE: ${results.length} UNITS_INDEXED`);
      } else {
        throw new Error('MODERN_PICKER_NOT_AVAILABLE');
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
    addLog(`NEURAL_PROMPT: "${aiQuery}"`);
    
    // Предварительный поиск для контекста
    const contextSamples = localSearch(samples, aiQuery, 40);
    const result = await getAIRecommendation(aiQuery, contextSamples, plugins);
    
    addLog("--- AI_ADVICE ---");
    addLog(`> ${result.text}`);
    
    if (result.recommendedIds.length > 0) {
      setAiRecommendedIds(result.recommendedIds);
      addLog(`SYSTEM: FILTERING_BY_NEURAL_RECAP [${result.recommendedIds.length} ITEMS]`);
    } else {
      addLog("SYSTEM: NO_EXACT_MATCHES_FOUND");
    }
    
    setIsAiLoading(false);
    setAiQuery('');
  };

  const playSample = async (sample: AudioSample) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      // Audio Singleton Logic: Stop previous
      if (activeSourceRef.current) {
        activeSourceRef.current.stop();
        activeSourceRef.current = null;
      }

      const file = sample.handle instanceof File ? sample.handle : await sample.handle.getFile();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      activeSourceRef.current = source;
      source.start();
      
      source.onended = () => {
        if (activeSourceRef.current === source) activeSourceRef.current = null;
      };

      addLog(`PLAY: ${sample.name}`);
    } catch (e) { addLog(`ERR: AUDIO_FAIL`); }
  };

  const filteredSamples = useMemo(() => {
    // Приоритет AI-фильтру, если он активен
    if (aiRecommendedIds) {
      return samples.filter(s => aiRecommendedIds.includes(s.id));
    }
    return localSearch(samples, filter, 150);
  }, [samples, filter, aiRecommendedIds]);

  const clearAIFilter = () => {
    setAiRecommendedIds(null);
    addLog("SYSTEM: AI_FILTER_CLEARED");
  };

  return (
    <div className="h-screen w-screen cyber-grid flex flex-col overflow-hidden bg-[#050505] text-[#39ff14] font-mono selection:bg-green-600 selection:text-black">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={async (e) => {
          const files = e.target.files;
          if (!files) return;
          addLog(`LEGACY_SCAN: ${files.length} FILES_QUEUED`);
          const res = await scanFilesLegacy(files, setProgress);
          setSamples(res);
          setProgress(null);
      }} {...({ webkitdirectory: "true" } as any)} multiple />
      <input type="file" ref={importInputRef} style={{ display: 'none' }} onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
              const d = JSON.parse(ev.target?.result as string);
              if (d.samples) setSamples(d.samples);
              if (d.plugins) setPlugins(d.plugins);
          };
          reader.readAsText(file);
      }} accept=".json" />

      {/* Header */}
      <header className="flex-none p-4 md:px-8 md:pt-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-green-900/40 gap-4 bg-black/80 backdrop-blur-md z-30">
        <div>
          <h1 className="text-3xl font-bold neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">OS v3.2</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${samples.length ? 'bg-green-500 shadow-[0_0_5px_#39ff14]' : 'bg-red-900 animate-pulse'}`}></span>
            <p className="text-green-800 text-[9px] uppercase tracking-[0.4em]">Universal_Hybrid_Engine</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => importInputRef.current?.click()} className="px-3 py-1.5 border border-green-900/50 text-green-900 text-[9px] uppercase font-bold hover:text-green-400 hover:border-green-400 transition-all">IMPORT</button>
          <button onClick={handleScan} disabled={!!progress} className="px-6 py-2 bg-green-600 text-black font-bold uppercase text-[10px] rounded-sm hover:bg-white neon-border disabled:opacity-50 transition-all">
            {progress ? `PARSING_DNA...` : 'SCAN_FOLDER'}
          </button>
        </div>
      </header>

      {/* Main Grid Container */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 md:p-6 lg:p-8 relative">
        
        {/* Sidebar Controls */}
        <aside className="lg:col-span-1 flex flex-col gap-4 overflow-hidden h-full z-20">
          <Terminal logs={logs} title="NEURAL_LOG_3.2" />
          
          <nav className="flex-none flex border border-green-900 overflow-hidden rounded bg-black/90 p-1">
            {['inventory', 'plugins', 'assistant'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`flex-1 py-2 text-[9px] uppercase font-bold transition-all ${activeTab === tab ? 'bg-green-600 text-black shadow-[0_0_10px_rgba(57,255,20,0.5)]' : 'text-green-900 hover:text-green-500'}`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'inventory' && (
              <div className="bg-black/90 border border-green-900/40 p-4 rounded-lg h-full flex flex-col shadow-2xl">
                <h3 className="text-green-500 font-bold mb-3 uppercase text-[10px] tracking-widest border-b border-green-900/30 pb-1">Filter_Matrix</h3>
                <input 
                  type="text" 
                  placeholder="#Tag Or Keyword..." 
                  className="w-full bg-green-950/10 border border-green-900/40 p-2 text-green-400 text-xs outline-none focus:border-green-400 mb-4" 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)} 
                />
                <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                  {['#Kick', '#Bass', '#Hat', '#Vocal', '#Snare', '#Percussion', '#Ambient', '#Punchy', '#STEM', '#LOOP'].map(tag => (
                    <button 
                      key={tag} 
                      onClick={() => setFilter(prev => prev.includes(tag) ? prev.replace(tag, '').trim() : `${prev} ${tag}`.trim())} 
                      className={`text-[8px] border px-1.5 py-1.5 transition-all uppercase font-bold ${filter.includes(tag) ? 'bg-green-500 text-black border-green-500' : 'border-green-900 text-green-900 hover:border-green-400'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'plugins' && (
              <PluginManager 
                plugins={plugins} 
                onAdd={p => setPlugins([...plugins, { ...p, id: crypto.randomUUID() }])} 
                onAddBatch={newPs => setPlugins([...plugins, ...newPs.map(p => ({...p, id: crypto.randomUUID()}))])}
                onRemove={id => setPlugins(plugins.filter(p => p.id !== id))} 
              />
            )}
            {activeTab === 'assistant' && (
              <div className="bg-black/90 border border-green-500/20 p-4 rounded-lg h-full flex flex-col shadow-2xl">
                 <h3 className="text-green-400 font-bold uppercase text-[10px] border-b border-green-900/30 pb-1">AI_Tactician</h3>
                 <div className="flex-1 overflow-hidden flex flex-col gap-3">
                   <textarea 
                     className="flex-1 bg-green-950/5 border border-green-900/40 p-3 text-green-300 text-xs outline-none focus:border-green-500 resize-none font-mono" 
                     placeholder="ASK_NEURAL_COMMAND..." 
                     value={aiQuery} 
                     onChange={e => setAiQuery(e.target.value)} 
                   />
                   <button 
                     onClick={handleAIRequest} 
                     disabled={isAiLoading || !samples.length} 
                     className="bg-green-600 text-black font-bold py-3 text-[10px] uppercase hover:bg-white transition-all disabled:opacity-20 shadow-[0_0_20px_rgba(57,255,20,0.2)]"
                   >
                     {isAiLoading ? 'DECODING...' : 'RUN_ANALYSIS'}
                   </button>
                 </div>
              </div>
            )}
          </div>
        </aside>

        {/* Inventory Stream (Main Content) */}
        <section className="lg:col-span-3 flex flex-col gap-4 overflow-hidden h-full z-20">
          <div className="flex-none flex justify-between items-center px-3 py-2 bg-black/40 border-b border-green-900/30">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">Inventory_Stream</h2>
              {aiRecommendedIds && (
                <button 
                  onClick={clearAIFilter}
                  className="bg-green-500/10 border border-green-500 text-green-400 text-[8px] px-2 py-0.5 uppercase hover:bg-green-500 hover:text-black transition-all animate-pulse"
                >
                  [CLEAR_AI_FILTER]
                </button>
              )}
            </div>
            <div className="text-[9px] text-green-900 font-mono tracking-tighter uppercase">
              NODES: {filteredSamples.length} <span className="mx-2">|</span> TOTAL: {samples.length}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 content-start">
            {filteredSamples.map(sample => (
              <SampleCard 
                key={sample.id} 
                sample={sample} 
                onPlay={playSample} 
                onCopy={path => { 
                  navigator.clipboard.writeText(path); 
                  addLog(`CLIPBOARD: ${sample.name}`); 
                }} 
              />
            ))}
            {!samples.length && !progress && (
              <div className="col-span-full h-full flex flex-col items-center justify-center opacity-10 py-40">
                 <div className="text-8xl font-thin tracking-tighter">NULL</div>
                 <p className="text-[12px] uppercase tracking-[1em] mt-4">STATION_OFFLINE</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex-none h-6 flex items-center justify-between px-4 text-[7px] text-green-900 uppercase tracking-widest bg-black border-t border-green-900/30 z-30">
         <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><span className="w-1 h-1 bg-green-500 rounded-full"></span> SYSTEM: STABLE</span>
            <span>MEM: {Math.round(((performance as any).memory?.usedJSHeapSize || 0) / 1024 / 1024)}MB</span>
         </div>
         <div className="flex gap-4">
            <span>INDEX_VER: 3.2.0</span>
            <span className="text-green-700">© TECHNO_ARCHITECT_CORP</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
