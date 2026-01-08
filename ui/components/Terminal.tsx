
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
    <div className="bg-black border border-green-900 rounded-lg overflow-hidden flex flex-col h-64 font-mono text-xs">
      <div className="bg-green-900/20 px-3 py-1 border-b border-green-900 flex justify-between items-center">
        <span className="text-green-500 font-bold uppercase tracking-widest">{title}</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-900"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-900"></div>
          <div className="w-2 h-2 rounded-full bg-green-900"></div>
        </div>
      </div>
      <div ref={scrollRef} className="p-3 overflow-y-auto flex-1 space-y-1 scrollbar-hide">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-green-800">[{new Date().toLocaleTimeString()}]</span>
            <span className={log.includes('ERR') ? 'text-red-500' : 'text-green-400'}>
              {log}
            </span>
          </div>
        ))}
        {logs.length === 0 && <div className="text-green-900 animate-pulse">ОЖИДАНИЕ ВВОДА...</div>}
      </div>
    </div>
  );
};
