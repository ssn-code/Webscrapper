import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { ScraperForm } from './components/ScraperForm.tsx';
import { ResultsViewer } from './components/ResultsViewer.tsx';
import { HistorySidebar } from './components/HistorySidebar.tsx';
import { LogsModal } from './components/LogsModal.tsx';
import { ConfigModal } from './components/ConfigModal.tsx';
import { BatchScraperModal } from './components/BatchScraperModal.tsx';
import { ScrapedData, HistoryItem } from './types.ts';
import { Globe, ArrowRight, ShieldCheck, Database, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [currentData, setCurrentData] = useState<ScrapedData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);

  // Load history on mount
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data: HistoryItem[] = await res.json();
        setHistory(data);
        // If nothing is selected yet and history exists, select first
        if (!selectedId && data.length > 0) {
          handleSelectHistory(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSelectHistory = async (id: string) => {
    setSelectedId(id);
    try {
      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const fullData: ScrapedData = await res.json();
        setCurrentData(fullData);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
  };

  const handleScrape = async (params: {
    url: string;
    selector?: string;
    timeout?: number;
    include_html?: boolean;
    user_agent?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({ error: 'Scraping failed' }));
        throw new Error(errPayload.error || `HTTP ${res.status} Error`);
      }

      const scraped: ScrapedData = await res.json();
      setCurrentData(scraped);
      setSelectedId(scraped.id);
      await fetchHistory();
    } catch (err: any) {
      setError(err.message || 'Scrape operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        if (selectedId === id) {
          const remaining = history.filter((h) => h.id !== id);
          if (remaining.length > 0) {
            handleSelectHistory(remaining[0].id);
          } else {
            setSelectedId(null);
            setCurrentData(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearAllHistory = async () => {
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        setSelectedId(null);
        setCurrentData(null);
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      <Navbar
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        historyCount={history.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scraper Input Form */}
        <ScraperForm
          onScrape={handleScrape}
          isLoading={isLoading}
          error={error}
          onClearError={() => setError(null)}
        />

        {/* Main Content Grid: Results Viewer + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-3 space-y-6">
            {currentData ? (
              <ResultsViewer data={currentData} />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <Globe className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ready to Scrape</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Enter any website address above or pick a quick preset to trigger real-time DOM extraction, headings analysis, link resolution, and structured JSON/CSV exports.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Polite & Configurable</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>Structured Models</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Fast DOM Engine</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Sidebar */}
          <div className="lg:col-span-1">
            <HistorySidebar
              history={history}
              selectedId={selectedId}
              onSelect={handleSelectHistory}
              onDelete={handleDeleteHistory}
              onClearAll={handleClearAllHistory}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <LogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
      <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      <BatchScraperModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        onScrapeSuccess={(data) => {
          setCurrentData(data);
          setSelectedId(data.id);
        }}
        onRefreshHistory={fetchHistory}
      />
    </div>
  );
};

export default App;
