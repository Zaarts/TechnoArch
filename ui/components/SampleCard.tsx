
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
  const isLowConfidence = sample.confidenceScore < 40;

  return (
    <div className={`bg-[#080808] border ${isSilent ? 'border-red-900/30' : 'border-green-900/40'} p-5 rounded-lg group hover:border-green-400 transition-all relative overflow-hidden flex flex-col gap-4 min-h-[230px] shadow-2xl`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isLowConfidence ? 'bg-red-600 animate-pulse' : 'bg-green-500 shadow-[0_0_5px_#39ff14]'}`} title={`Analysis Confidence: ${sample.confidenceScore}%`}></span>
            <span className="text-[14px] text-green-400 font-bold truncate uppercase tracking-tight" title={sample.name}>{sample.name}</span>
          </div>
          <span className="text-[10px] text-green-900 truncate font-mono mt-1 opacity-60">{sample.path.split('/').slice(-2).join(' / ')}</span>
        </div>
        {!isMidi && !isSilent && (
          <button onClick={(e) => { e.stopPropagation(); onPlay(sample); }} className="w-10 h-10 flex-none border border-green-900 flex items-center justify-center hover:bg-green-500 hover:text-black transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sample.sourceTags.map(t => (
          <span key={t} className="text-[8px] bg-green-950/30 text-green-700 px-2 py-0.5 border border-green-900/20 uppercase font-black">{t.replace('#', '')}</span>
        ))}
        {sample.acousticTags.map(t => (
          <span key={t} className={`text-[8px] px-2 py-0.5 border uppercase font-black ${t === '#Silent' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-white/5 text-white/50 border-white/10'}`}>{t.replace('#', '')}</span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-green-900/20 grid grid-cols-4 gap-2 text-[12px] uppercase font-bold">
        <div className="flex flex-col"><span className="text-green-950 text-[8px]">FREQ</span><span className="text-green-500 tabular-nums">{sample.dna.peakFrequency > 0 ? `${Math.round(sample.dna.peakFrequency)}Hz` : '---'}</span></div>
        <div className="flex flex-col"><span className="text-green-950 text-[8px]">BRI</span><div className="h-1.5 bg-green-900/20 mt-1 rounded-full overflow-hidden"><div className="h-full bg-green-400" style={{ width: `${sample.dna.brightness * 100}%` }}></div></div></div>
        <div className="flex flex-col"><span className="text-green-950 text-[8px]">ATK</span><span className="text-green-500 tabular-nums">{sample.dna.attackMs.toFixed(0)}ms</span></div>
        <div className="flex flex-col items-end"><span className="text-green-950 text-[8px]">CONF</span><span className={`${isLowConfidence ? 'text-red-700' : 'text-white'} tabular-nums`}>{sample.confidenceScore}%</span></div>
      </div>

      <button onClick={() => onCopy(sample.fullPath)} className="mt-2 text-[10px] border border-green-900/50 py-2.5 uppercase hover:bg-green-600 hover:text-black hover:border-green-600 text-green-900 transition-all font-black tracking-widest">COPY_PATH</button>
    </div>
  );
};
