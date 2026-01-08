
import React from 'react';
import { AudioSample } from '../../types';

interface SampleCardProps {
  sample: AudioSample;
  onPlay: (sample: AudioSample) => void;
  onCopy: (path: string) => void;
}

export const SampleCard: React.FC<SampleCardProps> = ({ sample, onPlay, onCopy }) => {
  return (
    <div 
      className="bg-black/90 border border-green-900/40 p-4 rounded-lg group hover:border-green-400 transition-all relative overflow-hidden flex flex-col gap-3 min-h-[180px] shadow-lg"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[11px] text-green-400 font-bold truncate uppercase tracking-tight" title={sample.name}>
            {sample.name}
          </span>
          <span className="text-[8px] text-green-900 truncate font-mono mt-0.5">
            {sample.path.split('/').slice(-2).join(' / ')}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(sample); }}
          className="w-8 h-8 flex-none border border-green-900 flex items-center justify-center hover:bg-green-500 hover:text-black transition-all shadow-[0_0_10px_rgba(57,255,20,0.1)] group-hover:shadow-[0_0_15px_rgba(57,255,20,0.4)]"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[40px]">
        {sample.sourceTags.map(t => (
          <span key={t} className="text-[7px] bg-green-950/40 text-green-600 px-1.5 py-0.5 border border-green-900/30 uppercase font-bold">
            {t.replace('#', '')}
          </span>
        ))}
        {sample.acousticTags.map(t => (
          <span key={t} className="text-[7px] bg-white/5 text-white/60 px-1.5 py-0.5 border border-white/10 uppercase font-bold">
            {t.replace('#', '')}
          </span>
        ))}
      </div>

      {/* DNA Matrix */}
      <div className="mt-auto pt-3 border-t border-green-900/20 grid grid-cols-4 gap-2 text-[8px] uppercase font-bold">
        <div className="flex flex-col">
          <span className="text-green-950 text-[6px]">FREQ</span>
          <span className="text-green-500 tabular-nums">{Math.round(sample.dna.peakFrequency)}Hz</span>
        </div>
        <div className="flex flex-col">
          <span className="text-green-950 text-[6px]">BRI</span>
          <div className="h-1 bg-green-900/20 mt-1 relative rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: `${sample.dna.brightness * 100}%` }}></div>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-green-950 text-[6px]">ATK</span>
          <span className="text-green-500 tabular-nums">{sample.dna.attackMs.toFixed(0)}ms</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-green-950 text-[6px]">SCORE</span>
          <span className="text-white tabular-nums">{sample.confidenceScore}%</span>
        </div>
      </div>

      <button 
        onClick={() => onCopy(sample.fullPath)}
        className="mt-1 text-[8px] border border-green-900/50 py-1.5 uppercase hover:bg-green-600 hover:text-black hover:border-green-600 text-green-800 transition-all font-bold tracking-widest"
      >
        COPY_LOCAL_PATH
      </button>

      {/* Industrial Glitch Accent */}
      <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/5 rotate-45 translate-x-4 -translate-y-4"></div>
    </div>
  );
};
