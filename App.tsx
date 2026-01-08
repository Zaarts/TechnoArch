
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFolder, scanFilesLegacy } from './modules/inventory/scanner';
import { AudioSample, ScanProgress, Plugin } from './types';
import { Terminal } from './ui/components/Terminal';
import { SampleCard } from './ui/components/SampleCard';
import { PluginManager } from './ui/components/PluginManager';
import { localSearch } from './modules/inventory/localSearch';
import { getAIRecommendation } from './services/aiService';
import { saveSamples, loadSamples, savePlugins, loadPlugins, clearAllData, exportIndex, importIndex } from './services/storageService';

// Визуальный компонент нейронного движка
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

      ctx.fillStyle = i < processed ? '#39ff14' : '#0f1c0e';
      if (i < processed) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#39ff14';
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(x, y, dotSize, dotSize);
    }
  }, [total, processed]);

  return (
    <div className="bg-black/80 border border-green-900/40 p-2 rounded mb-4 overflow-hidden h-32 relative">
      <div className="absolute top-1 left-2 text-[8px] uppercase text-green-800 z-10 font-bold">Neural_Precision_Matrix</div>
      <canvas ref={canvasRef} width={800} height={120} className="w-full h-full opacity-60" />
    </div>
  );
};

const App: React.FC = () => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState('');
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

  useEffect(() => {
    async function init() {
      try {
        const ps = await loadPlugins(); if (ps.length) setPlugins(ps);
        const ss = await loadSamples(); 
        if (ss.length) {
          setSamples(ss);
          addLog("SYSTEM: INDEX_SYNC_COMPLETE [STABLE]");
        }
      } catch (e) { addLog("ERR: STORAGE_OFFLINE"); }
    }
    init();
  }, [addLog]);

  useEffect(() => { if (plugins.length) savePlugins(plugins); }, [plugins]);

  const handleScan = async () => {
    const triggerLegacy = () => {
      addLog("SECURITY: ACTIVATING_LEGACY_PICKER...");
      fileInputRef.current?.click();
    };
    try {
      const win = window as any;
      if (typeof win.showDirectoryPicker === 'function' && window.self === window.top) {
        const dirHandle = await win.showDirectoryPicker();
        addLog(`SCAN_START: ${dirHandle.name}`);
        setSamples([]); 
        const results = await scanFolder(dirHandle, setProgress, (batch) => {
          setSamples(prev => [...prev, ...batch]);
        });
        await saveSamples(results);
        setProgress(null);
        addLog(`SUCCESS: ${results.length} NODES_INDEXED`);
      } else { triggerLegacy(); }
    } catch (err: any) { triggerLegacy(); }
  };

  const handleAIRequest = async () => {
    if (!aiQuery.trim() || !samples.length) return;
    setIsAiLoading(true);
    addLog(`AI_NEURAL_LINK: "${aiQuery}"`);
    const topMatches = localSearch(samples, aiQuery, 40);
    const result = await getAIRecommendation(aiQuery, topMatches, plugins);
    addLog(`AI_REPORT: ${result.text}`);
    if (result.recommendedIds.length) {
      setAiRecommendedIds(result.recommendedIds);
    }
    setIsAiLoading(false);
    setAiQuery('');
  };

  const playSample = async (sample: AudioSample) => {
    if (sample.type === 'midi') return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      
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
    } catch (e) { addLog("ERR: CODEC_FAILURE_PREVIEW_FAIL"); }
  };

  const filteredSamples = useMemo(() => {
    if (aiRecommendedIds) return samples.filter(s => aiRecommendedIds.includes(s.id));
    return localSearch(samples, filter, 30000);
  }, [samples, filter, aiRecommendedIds]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 800) {
      setVisibleCount(prev => Math.min(prev + 30, filteredSamples.length));
    }
  };

  useEffect(() => {
    setVisibleCount(30);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [filter, aiRecommendedIds]);

  return (
    <div className="h-screen w-screen cyber-grid flex flex-col overflow-hidden bg-[#050505] text-[#39ff14] font-mono select-none text-[14px]">
      <input type="file" ref={fileInputRef} className="hidden" onChange={async (e) => {
          if (!e.target.files?.length) return;
          setSamples([]);
          addLog(`LEGACY_LOAD: ${e.target.files.length} ITEMS_QUEUED`);
          const res = await scanFilesLegacy(e.target.files, setProgress, (b) => {
            setSamples(p => [...p, ...b]);
          });
          await saveSamples(res);
          setProgress(null);
      }} {...({ webkitdirectory: "", directory: "" } as any)} multiple />
      
      <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const text = await file.text();
              const data = await importIndex(text);
              setSamples(data.samples || []);
              setPlugins(data.plugins || []);
              addLog(`RESTORE: ${data.samples?.length || 0} NODES_ACTIVE`);
            } catch (err) { addLog("ERR: IMPORT_FORMAT_INVALID"); }
          }
      }} />

      {/* Header */}
      <header className="flex-none p-6 md:px-10 border-b border-green-900/40 flex justify-between items-center bg-black/80 backdrop-blur-xl z-50">
        <div>
          <h1 className="text-3xl font-bold neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">v3.3</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#39ff14]"></span>
            <p className="text-green-800 text-[10px] uppercase tracking-[0.5em]">Neural_Precision_Engine_STABLE</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportIndex} className="px-4 py-2 border border-green-900 text-green-700 text-[10px] uppercase hover:text-green-400 font-bold transition-all">EXPORT_JSON</button>
          <button onClick={() => importInputRef.current?.click()} className="px-4 py-2 border border-green-900 text-green-700 text-[10px] uppercase hover:text-green-400 font-bold transition-all">IMPORT_JSON</button>
          <button onClick={async () => { if(confirm("NUKE_DATABASE?")) { await clearAllData(); window.location.reload(); } }} className="px-4 py-2 border border-red-900 text-red-900 text-[10px] uppercase hover:bg-red-900 hover:text-black font-bold transition-all">NUKE_DB</button>
          <button onClick={handleScan} disabled={!!progress} className="px-8 py-3 bg-green-600 text-black font-bold uppercase text-[12px] rounded-sm hover:bg-white neon-border disabled:opacity-50 transition-all">
            {progress ? `DECODING_${Math.round((progress.processedFiles / (progress.totalFiles || 1)) * 100)}%` : 'SCAN_FOLDER'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-6 p-6 lg:p-8">
        
        {/* Column 1: Terminal & Neural Matrix */}
        <aside className="md:col-span-3 flex flex-col gap-6 overflow-hidden h-full border-r border-green-900/20 pr-6">
          <div className="flex-none">
            <Terminal logs={logs} title="NEURAL_LOG" />
          </div>

          {progress && (
            <NeuralPrecisionVisual total={progress.totalFiles} processed={progress.processedFiles} />
          )}
          
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/90 border border-green-900/40 p-5 rounded-lg flex flex-col shadow-2xl">
            <h3 className="text-green-500 font-bold mb-4 uppercase text-[12px] tracking-widest border-b border-green-900/30 pb-2">Filter_Matrix</h3>
            <input 
              type="text" 
              placeholder="SEARCH_TAGS_OR_NOTES..." 
              className="w-full bg-green-950/10 border border-green-900/40 p-3 text-green-400 text-sm outline-none focus:border-green-400 mb-6 font-mono" 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2 content-start">
              {['#Kick', '#Bass', '#Hat', '#Vocal', '#Snare', '#Punchy', '#Subby', '#Tight', '#Soft', '#Distorted', '#MIDI', '#Industrial', '#Silent'].map(tag => (
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

        {/* Column 2: Inventory Stream */}
        <section className="md:col-span-6 flex flex-col gap-6 overflow-hidden h-full">
          <div className="flex-none flex justify-between items-center px-6 py-3 bg-black/40 border border-green-900/30 rounded-lg shadow-xl">
            <div className="flex items-center gap-6">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.5em] text-white font-['Orbitron']">Inventory_Stream</h2>
              {(aiRecommendedIds || filter) && (
                <button 
                  onClick={() => { setAiRecommendedIds(null); setFilter(''); }}
                  className="bg-green-500/10 border border-green-500 text-green-400 text-[10px] px-4 py-1.5 uppercase hover:bg-green-500 hover:text-black transition-all font-bold tracking-widest shadow-[0_0_10px_rgba(57,255,20,0.2)]"
                >
                  [RESET_FILTERS]
                </button>
              )}
            </div>
            <div className="text-[10px] text-green-900 font-mono font-bold">
              VISIBLE: {Math.min(visibleCount, filteredSamples.length)} / TOTAL: {filteredSamples.length}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto pr-3 custom-scrollbar grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 content-start pb-24"
          >
            {filteredSamples.length > 0 ? (
              filteredSamples.slice(0, visibleCount).map(sample => (
                <SampleCard 
                  key={sample.id} 
                  sample={sample} 
                  onPlay={playSample} 
                  onCopy={path => { 
                    navigator.clipboard.writeText(path); 
                    addLog(`CLIPBOARD: ${sample.name}`); 
                  }} 
                />
              ))
            ) : !progress ? (
              <div className="col-span-full h-full flex flex-col items-center justify-center py-48 bg-green-900/5 border border-dashed border-green-900/20 rounded-xl">
                <div className="text-5xl font-thin text-green-900 tracking-tighter uppercase">STATION_OFFLINE</div>
                <button onClick={handleScan} className="mt-12 px-12 py-4 border border-green-900 text-green-500 text-sm hover:bg-green-500 hover:text-black transition-all uppercase font-black tracking-[0.4em] shadow-2xl">INITIALIZE_SCAN</button>
              </div>
            ) : (
              <div className="col-span-full py-48 flex flex-col items-center text-green-500 text-[14px] uppercase tracking-[1.5em] animate-pulse font-bold">DECODING_NODES...</div>
            )}
          </div>
        </section>

        {/* Column 3: Assistant & Plugins */}
        <aside className="md:col-span-3 flex flex-col gap-6 overflow-hidden h-full border-l border-green-900/20 pl-6">
          <div className="flex-1 overflow-hidden bg-black/90 border border-green-500/20 p-6 rounded-lg flex flex-col gap-6 shadow-2xl">
            <h3 className="text-green-400 font-bold uppercase text-[12px] border-b border-green-900/30 pb-2 tracking-[0.3em] font-['Orbitron']">AI_Tactician</h3>
            <textarea 
              className="flex-1 bg-green-950/5 border border-green-900/40 p-4 text-green-300 text-sm outline-none focus:border-green-500 resize-none font-mono placeholder:text-green-900" 
              placeholder="COMMAND_NEURAL_CORE (e.g. 'Найди жирный кик в тональности F')..." 
              value={aiQuery} 
              onChange={e => setAiQuery(e.target.value)} 
            />
            <button 
              onClick={handleAIRequest} 
              disabled={isAiLoading || !samples.length} 
              className="w-full bg-green-600 text-black font-black py-4 text-[12px] uppercase hover:bg-white transition-all disabled:opacity-20 shadow-[0_0_20px_rgba(57,255,20,0.3)]"
            >
              {isAiLoading ? 'DECODING_PROMPT...' : 'RUN_ANALYSIS'}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
             <PluginManager 
               plugins={plugins} 
               onAdd={p => setPlugins([...plugins, { ...p, id: crypto.randomUUID() }])} 
               onAddBatch={newPs => setPlugins([...plugins, ...newPs.map(p => ({...p, id: crypto.randomUUID()}))])}
               onRemove={id => setPlugins(plugins.filter(p => p.id !== id))} 
             />
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="flex-none h-8 flex items-center justify-between px-6 text-[10px] text-green-900 uppercase bg-black border-t border-green-900/30 z-50 font-bold">
         <div className="flex gap-6 items-center">
            <span className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#39ff14]"></span> CORE: STABLE</span>
            <span>INDEXED_NODES: {samples.length}</span>
            <span>MEMORY_OPTIMIZED: ON</span>
         </div>
         <span className="text-green-700 tracking-[0.8em] font-['Orbitron']">TECHNO_ARCHITECT_OS_v3.3_FINAL</span>
      </footer>
    </div>
  );
};

export default App;
