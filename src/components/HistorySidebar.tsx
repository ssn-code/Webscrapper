import React, { useState } from 'react';
import {
  History,
  Trash2,
  ExternalLink,
  Clock,
  Heading,
  Link2,
  Search,
  X,
} from 'lucide-react';
import { HistoryItem } from '../types.ts';

interface HistorySidebarProps {
  history: HistoryItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  history,
  selectedId,
  onSelect,
  onDelete,
  onClearAll,
}) => {
  const [search, setSearch] = useState('');

  const filtered = history.filter(
    (h) =>
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      h.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-sm text-white">Scrape Runs</h3>
          <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition"
            title="Clear run history"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {history.length > 1 && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved runs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500 italic">
          No scrape executions yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500 italic">
          No runs matched your search.
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1 max-h-[600px]">
          {filtered.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition relative group ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-500/50 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`font-semibold truncate text-xs ${
                      isSelected ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {item.title || item.url}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition shrink-0"
                    title="Delete item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 truncate mt-1 flex items-center gap-1 font-mono">
                  <span className="truncate">{item.url}</span>
                </div>

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {item.duration_ms}ms
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Heading className="w-2.5 h-2.5 text-blue-400" />
                    {item.headings_count}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Link2 className="w-2.5 h-2.5 text-cyan-400" />
                    {item.links_count}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
