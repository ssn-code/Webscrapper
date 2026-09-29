import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Loader2,
  Sparkles,
  Code2,
  Globe,
  Clock,
  FileCode,
  X,
  AlertCircle,
} from 'lucide-react';

interface ScraperFormProps {
  onScrape: (params: {
    url: string;
    selector?: string;
    timeout?: number;
    include_html?: boolean;
    user_agent?: string;
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

const PRESETS = [
  {
    name: 'Example Domain',
    url: 'https://example.com',
    description: 'Minimal RFC 2606 sample page',
  },
  {
    name: 'Quotes to Scrape',
    url: 'https://quotes.toscrape.com',
    selector: '.quote',
    description: 'Scraping sandbox with quotes and authors',
  },
  {
    name: 'Wikipedia: Web Scraping',
    url: 'https://en.wikipedia.org/wiki/Web_scraping',
    selector: '#mw-content-text',
    description: 'Long-form rich article with citations and links',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    selector: '.athing',
    description: 'Tabular layout with external discussion links',
  },
];

export const ScraperForm: React.FC<ScraperFormProps> = ({
  onScrape,
  isLoading,
  error,
  onClearError,
}) => {
  const [url, setUrl] = useState('');
  const [selector, setSelector] = useState('');
  const [timeout, setTimeoutVal] = useState<number>(30);
  const [includeHtml, setIncludeHtml] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onClearError();
    onScrape({
      url: url.trim(),
      selector: selector.trim() ? selector.trim() : undefined,
      timeout: timeout * 1000,
      include_html: includeHtml,
    });
  };

  const handleSelectPreset = (presetUrl: string, presetSelector?: string) => {
    setUrl(presetUrl);
    if (presetSelector) {
      setSelector(presetSelector);
      setShowAdvanced(true);
    } else {
      setSelector('');
    }
    onClearError();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/40">
      {/* Title & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Target Web Address
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extract headings, body copy, hyperlinks, media assets, and custom DOM elements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            showAdvanced
              ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
              : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Options & Selectors</span>
        </button>
      </div>

      {/* Main Scrape Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) onClearError();
            }}
            placeholder="Enter web URL to scrape (e.g. https://example.com)"
            required
            className="w-full bg-slate-950/80 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 rounded-xl pl-12 pr-32 py-3.5 text-sm sm:text-base outline-none transition"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md shadow-blue-600/20 transition active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Scrape</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-200">Scraping Error</p>
              <p className="text-xs text-red-300/90 mt-0.5">{error}</p>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-red-400 hover:text-red-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Advanced Options Section */}
        {showAdvanced && (
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                Wait/Extract CSS Selector (optional)
              </label>
              <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="e.g. article, div.content, .quote"
                className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 text-xs sm:text-sm text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Extracts custom matching nodes and inner HTML
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Timeout (seconds)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={timeout}
                onChange={(e) => setTimeoutVal(Math.max(2, parseInt(e.target.value) || 10))}
                className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-blue-500 text-xs sm:text-sm text-slate-200 rounded-lg px-3 py-2 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Abort fetch if response takes longer
              </span>
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                Include Full Raw HTML
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={includeHtml}
                  onChange={(e) => setIncludeHtml(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-300">
                  Save raw page markup in output payload
                </span>
              </label>
              <span className="text-[10px] text-slate-500 mt-1">
                Inspect unprocessed response document
              </span>
            </div>
          </div>
        )}

        {/* Quick Presets */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 text-xs font-medium">Quick Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleSelectPreset(p.url, p.selector)}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition text-xs flex items-center gap-1.5"
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};
