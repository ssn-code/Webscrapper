import React, { useState } from 'react';
import {
  ListPlus,
  X,
  Play,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { ScrapedData } from '../types.ts';

interface BatchScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScrapeSuccess: (data: ScrapedData) => void;
  onRefreshHistory: () => void;
}

interface BatchItem {
  url: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  title?: string;
  error?: string;
}

export const BatchScraperModal: React.FC<BatchScraperModalProps> = ({
  isOpen,
  onClose,
  onScrapeSuccess,
  onRefreshHistory,
}) => {
  const [urlsText, setUrlsText] = useState(
    'https://example.com\nhttps://quotes.toscrape.com\nhttps://news.ycombinator.com'
  );
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const handleStartBatch = async () => {
    const rawList = urlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => Boolean(u));

    if (rawList.length === 0) return;

    const initialQueue: BatchItem[] = rawList.map((url) => ({
      url,
      status: 'pending',
    }));

    setQueue(initialQueue);
    setIsRunning(true);
    setProgress({ current: 0, total: initialQueue.length });

    for (let i = 0; i < initialQueue.length; i++) {
      const item = initialQueue[i];

      // Update status to running
      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'running' } : q))
      );

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url }),
        });

        if (res.ok) {
          const data: ScrapedData = await res.json();
          setQueue((prev) =>
            prev.map((q, idx) =>
              idx === i
                ? { ...q, status: 'done', title: data.title || data.url }
                : q
            )
          );
          onScrapeSuccess(data);
        } else {
          const err = await res.json().catch(() => ({ error: 'Scrape failed' }));
          setQueue((prev) =>
            prev.map((q, idx) =>
              idx === i
                ? { ...q, status: 'failed', error: err.error || 'Failed' }
                : q
            )
          );
        }
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: 'failed', error: err.message || 'Network error' }
              : q
          )
        );
      }

      setProgress({ current: i + 1, total: initialQueue.length });
      // Polite delay between scrapes
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsRunning(false);
    onRefreshHistory();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base text-white">Batch Scrape Queue</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
          {!isRunning && queue.length === 0 && (
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Target URLs (one per line)
              </label>
              <textarea
                rows={6}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder="https://example.com&#10;https://wikipedia.org"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs outline-none focus:border-blue-500 leading-relaxed"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                URLs will be scraped sequentially with respectful rate-limiting delays.
              </span>
            </div>
          )}

          {(isRunning || queue.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Processed {progress.current} of {progress.total} URLs
                </span>
                <span className="font-semibold text-blue-400">
                  {Math.round((progress.current / (progress.total || 1)) * 100)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${(progress.current / (progress.total || 1)) * 100}%`,
                  }}
                />
              </div>

              {/* Queue List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                      {item.status === 'running' && (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {item.status === 'failed' && (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      {item.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}

                      <span className="font-mono text-slate-300 truncate">
                        {item.url}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      {item.status === 'done' && (
                        <span className="text-[11px] text-emerald-400 font-medium">
                          {item.title || 'Completed'}
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-[11px] text-red-400 font-medium">
                          {item.error || 'Failed'}
                        </span>
                      )}
                      {item.status === 'running' && (
                        <span className="text-[11px] text-blue-400 animate-pulse">
                          Extracting...
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="text-[11px] text-slate-500">Queued</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          {queue.length > 0 && !isRunning ? (
            <button
              onClick={() => {
                setQueue([]);
                setProgress({ current: 0, total: 0 });
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Reset Queue
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition disabled:opacity-50"
            >
              {queue.length > 0 && !isRunning ? 'Close' : 'Cancel'}
            </button>

            {queue.length === 0 && (
              <button
                onClick={handleStartBatch}
                disabled={isRunning || !urlsText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Queue</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
