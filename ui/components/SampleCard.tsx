
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
  const conf = sample.confidenceScore;
  const statusColor = conf > 80 ? 'bg-green-500' : conf > 40 ? 'bg-yellow-500' : 'bg-red-600';

  return (
    <div className={`bg-[#080808] border ${isSilent ? 'border-red-900/30' : 'border-green-900/40'} p-5 rounded-lg group hover:border-green-400 transition-all relative overflow-hidden flex flex-col gap-4 min-h-[240px] shadow-2xl`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor} ${conf > 80 ? 'shadow-[0_0_8px_#39ff14]' : ''}`} title={`Confidence: ${conf}%`}></span>
            <span className="text-[14px] text-green-400 font-bold truncate uppercase tracking-tight" title={sample.name}>{sample.name}</span>
          </div>
          <span className="text-[10px] text-green-900 truncate font-mono mt-1 opacity-70">{sample.path.split('/').slice(-2).join(' / ')}</span>
        </div>
        
        {isMidi ? (
          <div className="w-10 h-10 flex-none border border-blue-900 flex items-center justify-center text-blue-500" title="MIDI DATA NODE">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
          </div>
        ) : !isSilent && (
          <button onClick={(e) => { e.stopPropagation(); onPlay(sample); }} className="w-10 h-10 flex-none border border-green-900 flex items-center justify-center hover:bg-green-500 hover:text-black transition-all">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sample.sourceTags.map(t => (
          <span key={t} className="text-[8px] bg-green-950/30 text-green-500 px-2 py-0.5 border border-green-900/20 uppercase font-black">{t.replace('#', '')}</span>
        ))}
        {sample.acousticTags.map(t => (
          <span key={t} className={`text-[8px] px-2 py-0.5 border uppercase font-black ${t === '#Silent' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-white/5 text-white/70 border-white/20'}`}>{t.replace('#', '')}</span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-green-900/20 grid grid-cols-4 gap-2 text-[12px] uppercase font-bold">
        <div className="flex flex-col"><span className="text-white text-[8px] mb-1">FREQ</span><span className="text-green-500 tabular-nums">{sample.dna.peakFrequency > 0 ? `${Math.round(sample.dna.peakFrequency)}Hz` : '---'}</span></div>
        <div className="flex flex-col"><span className="text-white text-[8px] mb-1">BRI</span><div className="h-1.5 bg-green-900/20 mt-1 rounded-full overflow-hidden"><div className="h-full bg-green-400" style={{ width: `${sample.dna.brightness * 100}%` }}></div></div></div>
        <div className="flex flex-col"><span className="text-white text-[8px] mb-1">ATK</span><span className="text-green-500 tabular-nums">{sample.dna.attackMs.toFixed(0)}ms</span></div>
        <div className="flex flex-col items-end"><span className="text-white text-[8px] mb-1">CONF</span><span className={`${conf > 80 ? 'text-green-400' : 'text-yellow-600'} tabular-nums`}>{conf}%</span></div>
      </div>

      <button onClick={() => onCopy(sample.fullPath)} className="mt-2 text-[10px] border border-green-900/50 py-2.5 uppercase hover:bg-green-600 hover:text-black hover:border-green-600 text-green-700 transition-all font-black tracking-widest">COPY_PATH</button>
    </div>
  );
};
