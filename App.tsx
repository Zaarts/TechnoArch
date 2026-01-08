
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { scanFolder } from './modules/inventory/scanner';
import { AudioSample, ScanProgress } from './types';
import { Terminal } from './ui/components/Terminal';
import { SampleCard } from './ui/components/SampleCard';

const App: React.FC = () => {
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [filter, setFilter] = useState('');
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]);
  }, []);

  const handleScan = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      addLog(`ACCESS_GRANTED: ${dirHandle.name}`);
      addLog('INITIATING_DEEP_SCAN...');
      
      const results = await scanFolder(dirHandle, (p) => {
        setProgress(p);
        if (p.processedFiles % 25 === 0) {
            addLog(`ANALYZING: ${p.currentFile}`);
        }
      });

      setSamples(results);
      setProgress(prev => prev ? { ...prev, isScanning: false } : null);
      addLog(`SCAN_COMPLETE. OBJECTS_INDEXED: ${results.length}`);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog(`ERR: SYSTEM_ACCESS_DENIED - ${err.message}`);
      }
    }
  };

  const playSample = async (sample: AudioSample) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const file = await sample.handle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      addLog(`PLAYBACK: ${sample.name}`);
    } catch (e) {
      addLog(`ERR: AUDIO_FAILED - ${sample.name}`);
    }
  };

  const exportIndex = () => {
    const data = JSON.stringify(samples.map(s => ({
        id: s.id,
        name: s.name,
        fullPath: s.fullPath,
        sourceTags: s.sourceTags,
        acousticTags: s.acousticTags,
        dna: s.dna
    })), null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techno_architect_map_${Date.now()}.json`;
    a.click();
    addLog('SYSTEM: GLOBAL_INDEX_EXPORTED');
  };

  const filteredSamples = useMemo(() => {
    if (!filter) return samples;
    const f = filter.toLowerCase();
    return samples.filter(s => 
        s.name.toLowerCase().includes(f) || 
        s.sourceTags.some(t => t.toLowerCase().includes(f)) ||
        s.acousticTags.some(t => t.toLowerCase().includes(f))
    );
  }, [samples, filter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog(`PATH_SAVED_TO_CLIPBOARD: ${text.split('/').pop()}`);
  };

  return (
    <div className="min-h-screen cyber-grid p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-green-900 pb-6 gap-4">
        <div className="group cursor-default">
          <h1 className="text-4xl font-bold neon-text tracking-tighter uppercase font-['Orbitron']">
            Techno Architect <span className="text-white">OS v3.2</span>
          </h1>
          <p className="text-green-700 text-[10px] mt-1 uppercase tracking-[0.4em] animate-pulse">
            Neural Inventory & Acoustic Intelligence System
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportIndex}
            disabled={samples.length === 0}
            className="px-4 py-2 border border-green-900 text-green-900 text-[10px] uppercase font-bold hover:bg-green-900/20 hover:text-green-400 disabled:opacity-30 transition-all"
          >
            EXPORT_MAP
          </button>
          <button 
            onClick={handleScan}
            disabled={progress?.isScanning}
            className="px-6 py-2 bg-green-500 text-black font-bold uppercase text-xs rounded-sm hover:bg-white transition-all disabled:opacity-50 neon-border"
          >
            {progress?.isScanning ? 'SCANNING_FS...' : 'SCAN_INVENTORY'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
          <Terminal logs={logs} title="NEURAL_LOG" />
          
          <div className="bg-black/80 border border-green-900/50 p-4 rounded backdrop-blur-sm shadow-xl">
            <h3 className="text-green-500 font-bold mb-3 uppercase text-xs flex items-center justify-between">
              <span>MATRIX_FILTER</span>
              <span className="text-[8px] text-green-900">VER: 0.9.4</span>
            </h3>
            <div className="relative">
              <input 
                type="text"
                placeholder="TAG_SEARCH..."
                className="w-full bg-green-950/20 border border-green-900/50 p-2 text-green-400 text-xs outline-none focus:border-green-400 focus:bg-green-950/40 transition-all"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className="absolute right-2 top-2 text-[8px] text-green-900 font-mono">
                {progress?.isScanning ? 'BUSY' : 'IDLE'}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['#Kick', '#Bass', '#Hat', '#Industrial', '#Punchy', '#Distorted'].map(tag => (
                <button 
                  key={tag}
                  onClick={() => setFilter(tag === filter ? '' : tag)}
                  className={`text-[9px] border px-2 py-1 transition-all uppercase text-center ${
                    filter === tag ? 'bg-green-500 text-black border-green-500' : 'border-green-900 text-green-800 hover:text-green-400 hover:border-green-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-green-950/5 border border-green-900/20 p-4 rounded text-[9px] uppercase space-y-3">
             <div className="flex justify-between items-center opacity-50">
               <span>CORE_UPTIME</span>
               <span>02:45:11</span>
             </div>
             <div className="h-[2px] bg-green-900/30 w-full">
               <div className="h-full bg-green-500/50 animate-[width_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
             </div>
             <div className="flex justify-between font-bold">
               <span className="text-green-900">ACTIVE_INDEX</span>
               <span className="text-white">{samples.length} SAMPLES</span>
             </div>
          </div>
        </div>

        {/* Results Explorer */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center px-2">
             <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold uppercase tracking-widest text-white">INVENTORY_OUTPUT</h2>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
             </div>
             <div className="text-[10px] text-green-800 tracking-tighter">
                FILTERED: {filteredSamples.length} | TOTAL: {samples.length}
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
            {filteredSamples.map(sample => (
              <SampleCard 
                key={sample.id}
                sample={sample}
                onPlay={playSample}
                onCopy={copyToClipboard}
              />
            ))}
            
            {samples.length === 0 && !progress?.isScanning && (
              <div className="col-span-full h-80 flex flex-col items-center justify-center border border-dashed border-green-900/30 rounded bg-green-950/5">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-green-500 blur-2xl opacity-10 animate-pulse"></div>
                    <svg className="w-16 h-16 text-green-900 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
                <span className="text-green-700 text-xs uppercase tracking-[0.5em] font-bold">AWAITING_LOCAL_SOURCE</span>
                <span className="text-[9px] text-green-900 mt-2 uppercase">SELECT SAMPLE DIRECTORY TO INDEX DNA</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Status Bar */}
      <footer className="border-t border-green-900/30 pt-4 flex justify-between items-center text-[8px] text-green-900 uppercase tracking-widest font-bold">
        <div className="flex gap-6">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500"></span> ENGINE_STABLE</span>
          <span>S_MAPPING: ENABLED</span>
          <span>DSP_LATENCY: LOW</span>
        </div>
        <div className="flex gap-4">
          <span className="text-white/20">X_ARCH_3.2.0</span>
          <span>BY <span className="text-green-500">TECHNO_ARCHITECT</span></span>
        </div>
      </footer>
    </div>
  );
};

export default App;
