
import React from 'react';
import { AudioSample } from '../../types';

interface SampleCardProps {
  sample: AudioSample;
  onPlay: (sample: AudioSample) => void;
  onCopy: (path: string) => void;
}

export const SampleCard: React.FC<SampleCardProps> = ({ sample, onPlay, onCopy }) => {
  const isMidi = sample.type === 'midi';
  const isSilent = sample.acousticTags.includes('#Silent');

  return (
    <div 
      className={`bg-black/90 border ${isSilent ? 'border-red-900/20' : 'border-green-900/40'} p-5 rounded-lg group hover:border-green-400 transition-all relative overflow-hidden flex flex-col gap-4 min-h-[220px] shadow-lg`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[14px] text-green-400 font-bold truncate uppercase tracking-tight" title={sample.name}>
            {sample.name}
          </span>
          <span className="text-[10px] text-green-900 truncate font-mono mt-1">
            {sample.path.split('/').slice(-2).join(' / ')}
          </span>
        </div>
        {!isMidi && !isSilent && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPlay(sample); }}
            className="w-10 h-10 flex-none border border-green-900 flex items-center justify-center hover:bg-green-500 hover:text-black transition-all shadow-[0_0_10px_rgba(57,255,20,0.1)] group-hover:shadow-[0_0_15px_rgba(57,255,20,0.4)]"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 overflow-hidden max-h-[50px]">
        {sample.sourceTags.map(t => (
          <span key={t} className="text-[9px] bg-green-950/40 text-green-600 px-2 py-1 border border-green-900/30 uppercase font-bold">
            {t.replace('#', '')}
          </span>
        ))}
        {sample.acousticTags.map(t => (
          <span key={t} className={`text-[9px] px-2 py-1 border uppercase font-bold ${t === '#Silent' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-white/5 text-white/60 border-white/10'}`}>
            {t.replace('#', '')}
          </span>
        ))}
        {sample.musicalKey && (
          <span className="text-[9px] bg-blue-900/30 text-blue-400 px-2 py-1 border border-blue-900/40 uppercase font-bold">
            KEY: {sample.musicalKey}
          </span>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-green-900/20 grid grid-cols-4 gap-3 text-[12px] uppercase font-bold">
        <div className="flex flex-col">
          <span className="text-green-950 text-[9px]">FREQ</span>
          <span className="text-green-500 tabular-nums">{sample.dna.peakFrequency > 0 ? `${Math.round(sample.dna.peakFrequency)}Hz` : '---'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-green-950 text-[9px]">BRI</span>
          <div className="h-2 bg-green-900/20 mt-1 relative rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: `${sample.dna.brightness * 100}%` }}></div>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-green-950 text-[9px]">ATK</span>
          <span className="text-green-500 tabular-nums">{sample.dna.attackMs.toFixed(0)}ms</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-green-950 text-[9px]">DNA</span>
          <span className="text-white tabular-nums">{sample.confidenceScore}%</span>
        </div>
      </div>

      <button 
        onClick={() => onCopy(sample.fullPath)}
        className="mt-2 text-[10px] border border-green-900/50 py-2 uppercase hover:bg-green-600 hover:text-black hover:border-green-600 text-green-800 transition-all font-bold tracking-widest"
      >
        COPY_PATH
      </button>
    </div>
  );
};
