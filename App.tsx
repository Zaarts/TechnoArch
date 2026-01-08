
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFolder, scanFilesLegacy } from './modules/inventory/scanner';
import { AudioSample, ScanProgress, Plugin } from './types';
import { Terminal } from './ui/components/Terminal';
import { SampleCard } from './ui/components/SampleCard';
import { PluginManager } from './ui/components/PluginManager';
import { localSearch } from './modules/inventory/localSearch';
import { getAIRecommendation } from './services/aiService';
import { saveSamples, saveSamplesBatch, loadSamples, savePlugins, loadPlugins, clearAllData, exportIndex, importIndex } from './services/storageService';

const NeuralPrecisionVisual: React.FC<{ total: number, processed: number }> = ({ total, processed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || total === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const dotsPerRow = Math.ceil(Math.sqrt(total));
    const dotSize = Math.max(2, Math.floor(width / dotsPerRow) - 1);
    for (let i = 0; i < total; i++) {
      const x = (i % dotsPerRow) * (dotSize + 1);
      const y = Math.floor(i / dotsPerRow) * (dotSize + 1);
      if (y > height) break;
      ctx.fillStyle = i < processed ? '#39ff14' : '#0a140a';
      if (i < processed) { ctx.shadowBlur = 4; ctx.shadowColor = '#39ff14'; }
      ctx.fillRect(x, y, dotSize, dotSize);
    }
  }, [total, processed]);

  return (
    <div className="bg-black/90 border border-green-900/40 p-2 rounded mb-4 h-32 relative overflow-hidden shadow-inner">
      <div className="absolute top-1 left-2 text-[8px] uppercase text-green-900 z-10 font-bold tracking-tighter">Precision_Matrix_v3</div>
      <canvas ref={canvasRef} width={800} height={120} className="w-full h-full opacity-70" />
    </div>
  );
};

const App: React.FC = () => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]);
  }, []);

  // Debounce Filter: 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filter), 300);
    return () => clearTimeout(timer);
  }, [filter]);

  useEffect(() => {
    async function init() {
      try {
        const ps = await loadPlugins(); if (ps.length) setPlugins(ps);
        const ss = await loadSamples(); if (ss.length) setSamples(ss);
        addLog("SYSTEM: KERNEL_LOADED [STABLE]");
      } catch (e) { addLog("ERR: INDEX_SYNC_FAILED"); }
    }
    init();
  }, [addLog]);

  useEffect(() => { if (plugins.length) savePlugins(plugins); }, [plugins]);

  const handleScan = async () => {
    const triggerLegacy = () => fileInputRef.current?.click();
    try {
      const win = window as any;
      if (typeof win.showDirectoryPicker === 'function' && window.self === window.top) {
        const dirHandle = await win.showDirectoryPicker();
        addLog(`SCAN_INIT: ${dirHandle.name}`);
        setSamples([]); 
        let batchCounter = 0;
        const results = await scanFolder(dirHandle, setProgress, (batch) => {
          setSamples(prev => [...prev, ...batch]);
          batchCounter += batch.length;
          if (batchCounter >= 50) { // Коммит каждые 50 файлов
            saveSamplesBatch(batch);
            batchCounter = 0;
          }
        });
        await saveSamples(results); // Финальный коммит
        setProgress(null);
        addLog(`SUCCESS: ${results.length} NODES_INDEXED`);
      } else { triggerLegacy(); }
    } catch (err: any) { triggerLegacy(); }
  };

  const handleAIRequest = async () => {
    if (!aiQuery.trim() || !samples.length) return;
    setIsAiLoading(true);
    addLog(`AI_CORE_LINK: "${aiQuery}"`);
    const topMatches = localSearch(samples, aiQuery, 40);
    const result = await getAIRecommendation(aiQuery, topMatches, plugins);
    addLog(`AI_TACTICIAN: ${result.text}`);
    if (result.recommendedIds.length) setAiRecommendedIds(result.recommendedIds);
    setIsAiLoading(false);
    setAiQuery('');
  };

  const playSample = async (sample: AudioSample) => {
    if (sample.type === 'midi') return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (activeSourceRef.current) { activeSourceRef.current.stop(); activeSourceRef.current = null; }
      const file = sample.handle instanceof File ? sample.handle : await sample.handle.getFile();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      activeSourceRef.current = source;
      source.start();
    } catch (e) { addLog("ERR: AUDIO_STREAM_FAIL"); }
  };

  const filteredSamples = useMemo(() => {
    if (aiRecommendedIds) return samples.filter(s => aiRecommendedIds.includes(s.id));
    return localSearch(samples, debouncedFilter, 30000);
  }, [samples, debouncedFilter, aiRecommendedIds]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 800) {
      setVisibleCount(prev => Math.min(prev + 30, filteredSamples.length));
    }
  };

  return (
    <div className="h-screen w-screen cyber-grid flex flex-col overflow-hidden bg-[#020202] text-[#39ff14] font-mono select-none text-[14px]">
      <input type="file" ref={fileInputRef} className="hidden" onChange={async (e) => {
          if (!e.target.files?.length) return;
          setSamples([]);
          addLog(`LEGACY_SCAN: ${e.target.files.length} ITEMS`);
          const res = await scanFilesLegacy(e.target.files, setProgress, (b) => {
            setSamples(p => [...p, ...b]);
            saveSamplesBatch(b);
          });
          setProgress(null);
      }} {...({ webkitdirectory: "", directory: "" } as any)} multiple />
      
      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const text = await file.text();
              const data = await importIndex(text);
              setSamples(data.samples); setPlugins(data.plugins || []);
              addLog(`RESTORE_COMPLETE: ${data.samples.length} NODES`);
            } catch (err: any) { addLog(`ERR: ${err.message}`); }
          }
      }} />

      {/* Header */}
      <header className="flex-none p-6 md:px-10 border-b border-green-900/30 flex justify-between items-center bg-black/60 backdrop-blur-md z-50">
        <div>
          <h1 className="text-3xl font-black neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">v3.3.1</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#39ff14]"></span>
            <p className="text-green-900 text-[10px] uppercase tracking-[0.6em] font-bold">Acoustic_DNA_Precision_Engine</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={exportIndex} className="px-4 py-2 border border-green-900/50 text-green-700 text-[10px] uppercase hover:text-green-400 font-bold transition-all">EXPORT_JSON</button>
          <button onClick={() => importInputRef.current?.click()} className="px-4 py-2 border border-green-900/50 text-green-700 text-[10px] uppercase hover:text-green-400 font-bold transition-all">IMPORT_JSON</button>
          <button onClick={async () => { if(confirm("NUKE_DATABASE?")) { await clearAllData(); window.location.reload(); } }} className="px-4 py-2 border border-red-900/50 text-red-900 text-[10px] uppercase hover:bg-red-900 hover:text-black font-bold transition-all">NUKE_DB</button>
          <button onClick={handleScan} disabled={!!progress} className="px-8 py-3 bg-green-600 text-black font-black uppercase text-[12px] rounded-sm hover:bg-white neon-border disabled:opacity-50 transition-all">
            {progress ? `DECODING_${Math.round((progress.processedFiles / (progress.totalFiles || 1)) * 100)}%` : 'SCAN_FOLDER'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-6 p-6 lg:p-8">
        <aside className="md:col-span-3 flex flex-col gap-6 overflow-hidden h-full">
          <Terminal logs={logs} title="SYSTEM_CORE_LOG" />
          {progress && <NeuralPrecisionVisual total={progress.totalFiles} processed={progress.processedFiles} />}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/80 border border-green-900/40 p-5 rounded-lg flex flex-col shadow-2xl">
            <h3 className="text-green-500 font-bold mb-4 uppercase text-[12px] tracking-widest border-b border-green-900/20 pb-2">DNA_Matrix_Filters</h3>
            <input 
              type="text" 
              placeholder="SEARCH (e.g. #Kick, short, note F)..." 
              className="w-full bg-green-950/5 border border-green-900/40 p-3 text-green-400 text-sm outline-none focus:border-green-400 mb-6 font-mono placeholder:text-green-900" 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2 content-start">
              {['#Kick', '#Bass', '#Hat', '#Vocal', '#MIDI', '#Sub', '#Tight', '#Crunch', '#Bright', '#Silent'].map(tag => (
                <button 
                  key={tag} 
                  onClick={() => setFilter(prev => prev.includes(tag) ? prev.replace(tag, '').trim() : `${prev} ${tag}`.trim())} 
                  className={`text-[10px] border p-3 transition-all uppercase font-bold tracking-wider ${filter.includes(tag) ? 'bg-green-500 text-black shadow-[0_0_10px_#39ff14]' : 'border-green-900 text-green-900 hover:border-green-400'}`}
                >
                  {tag.replace('#', '')}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="md:col-span-6 flex flex-col gap-6 overflow-hidden h-full">
          <div className="flex-none flex justify-between items-center px-6 py-3 bg-black/80 border border-green-900/30 rounded-lg shadow-xl">
             <h2 className="text-[12px] font-bold uppercase tracking-[0.5em] text-white font-['Orbitron']">Inventory_Stream</h2>
             <div className="flex items-center gap-4">
               {(aiRecommendedIds || filter) && (
                 <button onClick={() => { setAiRecommendedIds(null); setFilter(''); }} className="text-green-400 text-[10px] px-3 py-1 border border-green-500/30 uppercase hover:bg-green-500 hover:text-black transition-all">RESET</button>
               )}
               <div className="text-[10px] text-green-900 font-bold">Visible: {filteredSamples.length}</div>
             </div>
          </div>
          <div 
            ref={scrollContainerRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto pr-3 custom-scrollbar grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 content-start pb-24"
          >
            {filteredSamples.length > 0 ? (
              filteredSamples.slice(0, visibleCount).map(s => (
                <SampleCard key={s.id} sample={s} onPlay={playSample} onCopy={p => { navigator.clipboard.writeText(p); addLog(`CLIPBOARD: ${s.name}`); }} />
              ))
            ) : !progress ? (
              <div className="col-span-full h-full flex flex-col items-center justify-center py-48 opacity-20"><div className="text-5xl font-thin tracking-tighter">OFFLINE</div></div>
            ) : (
              <div className="col-span-full py-48 text-center text-green-500 text-[14px] uppercase tracking-[1.5em] animate-pulse">Scanning...</div>
            )}
          </div>
        </section>

        <aside className="md:col-span-3 flex flex-col gap-6 overflow-hidden h-full">
          <div className="flex-1 overflow-hidden bg-black/90 border border-green-500/20 p-6 rounded-lg flex flex-col gap-6 shadow-2xl">
            <h3 className="text-green-400 font-bold uppercase text-[12px] border-b border-green-900/20 pb-2 tracking-[0.3em] font-['Orbitron']">AI_Tactician</h3>
            <textarea 
              className="flex-1 bg-green-950/5 border border-green-900/40 p-4 text-green-300 text-sm outline-none focus:border-green-500 resize-none font-mono placeholder:text-green-900" 
              placeholder="e.g. 'Найди жирный кик в F'..." 
              value={aiQuery} onChange={e => setAiQuery(e.target.value)} 
            />
            <button 
              onClick={handleAIRequest} disabled={isAiLoading || !samples.length} 
              className="w-full bg-green-600 text-black font-black py-4 text-[12px] uppercase hover:bg-white transition-all shadow-[0_0_20px_rgba(57,255,20,0.2)]"
            >
              {isAiLoading ? 'ANALYZING...' : 'RUN_AI_SEARCH'}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
             <PluginManager 
               plugins={plugins} onAdd={p => setPlugins([...plugins, { ...p, id: crypto.randomUUID() }])} 
               onAddBatch={ns => setPlugins([...plugins, ...ns.map(n => ({...n, id: crypto.randomUUID()}))])}
               onRemove={id => setPlugins(plugins.filter(p => p.id !== id))} 
             />
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
