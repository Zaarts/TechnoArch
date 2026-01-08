
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
      className="bg-black border border-green-900/50 p-3 rounded group hover:border-green-400 transition-all relative overflow-hidden flex flex-col gap-2"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col max-w-[70%]">
          <span className="text-[10px] text-green-400 font-bold truncate uppercase tracking-tighter" title={sample.name}>
            {sample.name}
          </span>
          <span className="text-[8px] text-green-900 truncate">
            {sample.path.split('/').slice(-2).join('/')}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onPlay(sample); }}
          className="w-6 h-6 border border-green-900 flex items-center justify-center hover:bg-green-500 hover:text-black transition-colors"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {sample.sourceTags.map(t => <span key={t} className="text-[8px] bg-green-900/30 text-green-500 px-1 border border-green-900/50">{t}</span>)}
        {sample.acousticTags.map(t => <span key={t} className="text-[8px] bg-white/10 text-white px-1 border border-white/20">{t}</span>)}
      </div>

      {/* DNA Visualization Bar */}
      <div className="mt-auto pt-2 border-t border-green-900/20 grid grid-cols-4 gap-1 text-[7px] uppercase font-bold">
        <div className="flex flex-col">
          <span className="text-green-900">FRQ</span>
          <span className="text-green-500">{Math.round(sample.dna.peakFrequency)}Hz</span>
        </div>
        <div className="flex flex-col">
          <span className="text-green-900">BRI</span>
          <div className="h-1 bg-green-900/30 mt-0.5 relative">
            <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: `${sample.dna.brightness * 100}%` }}></div>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-green-900">ATK</span>
          <span className="text-green-500">{sample.dna.attackMs.toFixed(0)}ms</span>
        </div>
        <div className="flex flex-col">
          <span className="text-green-900">CONF</span>
          <span className="text-white">{sample.confidenceScore}%</span>
        </div>
      </div>

      <button 
        onClick={() => onCopy(sample.fullPath)}
        className="mt-2 text-[9px] border border-green-900 py-1 uppercase hover:bg-green-900/20 text-green-700 hover:text-green-400 transition-colors"
      >
        COPY PATH
      </button>

      {/* Industrial Glitch Accent */}
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-green-400/30"></div>
    </div>
  );
};
