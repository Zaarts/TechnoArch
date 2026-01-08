
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFolder, scanFilesLegacy } from './modules/inventory/scanner';
import { AudioSample, ScanProgress, Plugin } from './types';
import { Terminal } from './ui/components/Terminal';
import { SampleCard } from './ui/components/SampleCard';
import { PluginManager } from './ui/components/PluginManager';
import { localSearch } from './modules/inventory/localSearch';
import { getAIRecommendation } from './services/aiService';
import { saveSamples, loadSamples, savePlugins, loadPlugins, clearAllData } from './services/storageService';

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
  
  // Virtual Scroll State
  const [visibleCount, setVisibleCount] = useState(40);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]);
  }, []);

  useEffect(() => {
    async function init() {
      const ps = await loadPlugins(); if (ps.length) setPlugins(ps);
      const ss = await loadSamples(); if (ss.length) setSamples(ss);
    }
    init();
  }, []);

  useEffect(() => { if (plugins.length) savePlugins(plugins); }, [plugins]);

  const handleScan = async () => {
    try {
      const win = window as any;
      if (typeof win.showDirectoryPicker === 'function') {
        const dirHandle = await win.showDirectoryPicker();
        addLog(`SCAN_INIT: ${dirHandle.name}`);
        setSamples([]); // Clear for fresh progressive scan
        const results = await scanFolder(dirHandle, setProgress, (batch) => {
          setSamples(prev => [...prev, ...batch]);
        });
        await saveSamples(results);
        setProgress(null);
        addLog(`SCAN_COMPLETE: ${results.length} NODES SAVED TO IDB`);
      } else {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') addLog("ERR: SCAN_AUTH_FAILED");
    }
  };

  const handleAIRequest = async () => {
    if (!aiQuery.trim() || !samples.length) return;
    setIsAiLoading(true);
    addLog(`AI_SYNC: "${aiQuery}"`);
    
    // Ограничиваем контекст для LLM до Топ-50
    const topMatches = localSearch(samples, aiQuery, 50);
    const result = await getAIRecommendation(aiQuery, topMatches, plugins);
    
    addLog(`AI_SYSTEM: ${result.text}`);
    if (result.recommendedIds.length) {
      setAiRecommendedIds(result.recommendedIds);
      setActiveTab('inventory');
    }
    setIsAiLoading(false);
    setAiQuery('');
  };

  const playSample = async (sample: AudioSample) => {
    if (sample.type === 'midi') { addLog("MIDI: NO_AUDIO_ENGINE"); return; }
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      // Audio Singleton: Stop previous
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
      addLog(`PLAY: ${sample.name}`);
    } catch (e) { addLog(`ERR: CODEC_FAIL`); }
  };

  const filteredSamples = useMemo(() => {
    if (aiRecommendedIds) return samples.filter(s => aiRecommendedIds.includes(s.id));
    return localSearch(samples, filter, 30000);
  }, [samples, filter, aiRecommendedIds]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 800) {
      setVisibleCount(prev => Math.min(prev + 40, filteredSamples.length));
    }
  };

  useEffect(() => {
    setVisibleCount(40);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [filter, aiRecommendedIds]);

  return (
    <div className="h-screen w-screen cyber-grid flex flex-col overflow-hidden bg-[#050505] text-[#39ff14] font-mono select-none">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={async (e) => {
          if (!e.target.files) return;
          setSamples([]);
          const res = await scanFilesLegacy(e.target.files, setProgress, (b) => setSamples(p => [...p, ...b]));
          await saveSamples(res);
          setProgress(null);
      }} {...({ webkitdirectory: "true" } as any)} multiple />

      {/* Header */}
      <header className="flex-none p-4 md:px-8 border-b border-green-900/40 flex justify-between items-center bg-black/80 backdrop-blur-xl z-50">
        <div>
          <h1 className="text-2xl font-bold neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">v3.3</span>
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${samples.length ? 'bg-green-500 shadow-[0_0_5px_#39ff14]' : 'bg-red-900 animate-pulse'}`}></span>
            <p className="text-green-800 text-[8px] uppercase tracking-[0.4em]">Precision_DNA_Engine_30k</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { await clearAllData(); window.location.reload(); }} className="px-3 py-1 border border-red-900 text-red-900 text-[8px] uppercase hover:bg-red-900 hover:text-black transition-all">NUKE_DB</button>
          <button onClick={handleScan} disabled={!!progress} className="px-6 py-2 bg-green-600 text-black font-bold uppercase text-[10px] rounded-sm hover:bg-white neon-border disabled:opacity-50">
            {progress ? `SCANNING_${Math.round((progress.processedFiles / (progress.totalFiles > 0 ? progress.totalFiles : 1)) * 100)}%` : 'SCAN_FOLDER'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 lg:p-6">
        
        {/* Sidebar Panel */}
        <aside className="lg:col-span-1 flex flex-col gap-4 overflow-hidden h-full">
          <Terminal logs={logs} title="NEURAL_LOG" />
          
          <nav className="flex-none flex border border-green-900 bg-black/90 p-1 rounded">
            {['inventory', 'plugins', 'assistant'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`flex-1 py-2 text-[9px] uppercase font-bold transition-all ${activeTab === tab ? 'bg-green-600 text-black shadow-[0_0_15px_rgba(57,255,20,0.3)]' : 'text-green-900 hover:text-green-500'}`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'inventory' && (
              <div className="bg-black/90 border border-green-900/40 p-4 rounded-lg h-full flex flex-col">
                <input 
                  type="text" 
                  placeholder="FILTER_NODES..." 
                  className="w-full bg-green-950/10 border border-green-900/40 p-2 text-green-400 text-xs outline-none focus:border-green-400 mb-4" 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)} 
                />
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar grid grid-cols-2 gap-1.5 content-start">
                  {['#Kick', '#Bass', '#Hat', '#Vocal', '#Snare', '#Punchy', '#Subby', '#Tight', '#Soft', '#Distorted'].map(tag => (
                    <button 
                      key={tag} 
                      onClick={() => setFilter(prev => prev.includes(tag) ? prev.replace(tag, '').trim() : `${prev} ${tag}`.trim())} 
                      className={`text-[8px] border p-2 transition-all uppercase font-bold ${filter.includes(tag) ? 'bg-green-500 text-black' : 'border-green-900 text-green-900 hover:border-green-400'}`}
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
              <div className="bg-black/90 border border-green-500/20 p-4 rounded-lg h-full flex flex-col gap-4">
                 <textarea 
                   className="flex-1 bg-green-950/5 border border-green-900/40 p-3 text-green-300 text-xs outline-none focus:border-green-500 resize-none font-mono" 
                   placeholder="COMMAND_NEURAL_CORE..." 
                   value={aiQuery} 
                   onChange={e => setAiQuery(e.target.value)} 
                 />
                 <button 
                   onClick={handleAIRequest} 
                   disabled={isAiLoading || !samples.length} 
                   className="w-full bg-green-600 text-black font-bold py-3 text-[10px] uppercase hover:bg-white transition-all disabled:opacity-20"
                 >
                   {isAiLoading ? 'ANALYZING...' : 'RUN_NEURAL_ACTION'}
                 </button>
              </div>
            )}
          </div>
        </aside>

        {/* Stream Area */}
        <section className="lg:col-span-3 flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex-none flex justify-between items-center px-4 py-2 bg-black/40 border-b border-green-900/30">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white">Inventory_Stream</h2>
              {aiRecommendedIds && (
                <button 
                  onClick={() => setAiRecommendedIds(null)}
                  className="bg-green-500/10 border border-green-500 text-green-400 text-[8px] px-3 py-0.5 uppercase hover:bg-green-500 hover:text-black transition-all"
                >
                  [RESET_FILTERS]
                </button>
              )}
            </div>
            <div className="text-[9px] text-green-900 font-mono tracking-tighter uppercase">
              VISIBLE: {Math.min(visibleCount, filteredSamples.length)} <span className="mx-1">/</span> INDEX: {filteredSamples.length}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 content-start pb-20"
          >
            {filteredSamples.slice(0, visibleCount).map(sample => (
              <SampleCard 
                key={sample.id} 
                sample={sample} 
                onPlay={playSample} 
                onCopy={path => { navigator.clipboard.writeText(path); addLog(`COPY: ${sample.name}`); }} 
              />
            ))}
          </div>
        </section>
      </main>

      {/* Status Bar */}
      <footer className="flex-none h-6 flex items-center justify-between px-4 text-[7px] text-green-900 uppercase tracking-widest bg-black border-t border-green-900/30 z-50">
         <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span> STATUS: STABLE</span>
            <span>HEAP: {Math.round(((performance as any).memory?.usedJSHeapSize || 0) / 1024 / 1024)}MB</span>
            <span className="text-green-500 font-bold">BATCH_PROC: ACTIVE</span>
         </div>
         <div className="flex gap-4">
            <span className="text-green-700">© 2025 TECHNO_ARCHITECT_CORP</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
