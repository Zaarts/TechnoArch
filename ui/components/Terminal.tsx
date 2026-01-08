
import React from 'react';

interface TerminalProps {
  logs: string[];
  title?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, title = "SYSTEM_LOG" }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black border border-green-900 rounded-lg overflow-hidden flex flex-col h-72 font-mono shadow-2xl">
      <div className="bg-green-900/20 px-4 py-2 border-b border-green-900 flex justify-between items-center">
        <span className="text-green-500 font-bold uppercase tracking-[0.3em] text-[12px]">{title}</span>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-900/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-900/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-900/50 shadow-[0_0_5px_#1a3a14]"></div>
        </div>
      </div>
      <div ref={scrollRef} className="p-4 overflow-y-auto flex-1 space-y-2 scrollbar-hide text-[14px]">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 leading-tight border-l border-green-900/10 pl-2">
            <span className="text-green-900 font-bold">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
            <span className={log.includes('ERR') ? 'text-red-500 font-bold' : log.includes('SUCCESS') ? 'text-white' : 'text-green-400'}>
              {log}
            </span>
          </div>
        ))}
        {logs.length === 0 && <div className="text-green-900 animate-pulse uppercase tracking-[0.4em]">SYSTEM_READY_STATION_IDLE...</div>}
      </div>
    </div>
  );
};
