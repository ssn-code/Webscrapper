import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  Heading,
  FileText,
  Link2,
  Image as ImageIcon,
  Code,
  FileCode2,
  Layers,
  Search,
  Clock,
  HardDrive,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import { ScrapedData } from '../types.ts';

interface ResultsViewerProps {
  data: ScrapedData;
}

type TabType =
  | 'overview'
  | 'headings'
  | 'paragraphs'
  | 'links'
  | 'images'
  | 'custom'
  | 'html'
  | 'json';

export const ResultsViewer: React.FC<ResultsViewerProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [headingFilter, setHeadingFilter] = useState<number | 'all'>('all');
  const [paragraphSearch, setParagraphSearch] = useState('');
  const [imageSearch, setImageSearch] = useState('');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = (format: 'json' | 'csv', type: string = 'all') => {
    const url = `/api/export/${data.id}?format=${format}&type=${type}`;
    window.location.href = url;
  };

  const filteredLinks = data.links.filter(
    (l) =>
      l.text.toLowerCase().includes(linkSearch.toLowerCase()) ||
      l.href.toLowerCase().includes(linkSearch.toLowerCase())
  );

  const filteredHeadings = data.headings.filter(
    (h) => headingFilter === 'all' || h.level === headingFilter
  );

  const filteredParagraphs = data.paragraphs.filter((p) =>
    p.toLowerCase().includes(paragraphSearch.toLowerCase())
  );

  const filteredImages = data.images.filter(
    (i) =>
      i.alt.toLowerCase().includes(imageSearch.toLowerCase()) ||
      i.src.toLowerCase().includes(imageSearch.toLowerCase())
  );

  const isRedirected = data.final_url && data.final_url !== data.url;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
      {/* Top Banner / Scraped Overview */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/90">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  (data.status_code || 200) < 400
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                HTTP {data.status_code || 200} OK
              </span>

              <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                <Clock className="w-3 h-3 text-amber-400" />
                {data.duration_ms} ms
              </span>

              {data.content_length_bytes && (
                <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
                  <HardDrive className="w-3 h-3 text-cyan-400" />
                  {(data.content_length_bytes / 1024).toFixed(1)} KB
                </span>
              )}

              <span className="text-xs text-slate-500">
                {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {data.title || '(No Document Title Extracted)'}
            </h1>

            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-500 font-medium">Target URL:</span>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline truncate flex items-center gap-1"
                >
                  {data.url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              {isRedirected && (
                <div className="flex items-center gap-2 text-amber-400/90 truncate">
                  <span className="text-slate-500 font-medium">Redirected to:</span>
                  <a
                    href={data.final_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline truncate flex items-center gap-1"
                  >
                    {data.final_url}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            {data.meta_description && (
              <p className="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mt-2">
                &ldquo;{data.meta_description}&rdquo;
              </p>
            )}
          </div>

          {/* Action / Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleCopy(JSON.stringify(data, null, 2), 'all_json')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
              title="Copy entire payload as JSON"
            >
              {copiedKey === 'all_json' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleDownload('json')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-1 z-20 min-w-[160px] text-xs">
                <button
                  onClick={() => handleDownload('csv', 'summary')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Summary CSV
                </button>
                <button
                  onClick={() => handleDownload('csv', 'headings')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Headings CSV ({data.headings.length})
                </button>
                <button
                  onClick={() => handleDownload('csv', 'links')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Links CSV ({data.links.length})
                </button>
                <button
                  onClick={() => handleDownload('csv', 'images')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Images CSV ({data.images.length})
                </button>
                <button
                  onClick={() => handleDownload('csv', 'paragraphs')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  Paragraphs CSV ({data.paragraphs.length})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Heading className="w-3.5 h-3.5 text-blue-400" />
              <span>Headings</span>
            </div>
            <div className="text-xl font-bold text-white">{data.headings.length}</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paragraphs</span>
            </div>
            <div className="text-xl font-bold text-white">{data.paragraphs.length}</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Link2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Links</span>
            </div>
            <div className="text-xl font-bold text-white">{data.links.length}</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Images</span>
            </div>
            <div className="text-xl font-bold text-white">{data.images.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center overflow-x-auto border-b border-slate-800 px-4 bg-slate-950/40 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('headings')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'headings'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Heading className="w-4 h-4" />
          <span>Headings ({data.headings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('paragraphs')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'paragraphs'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paragraphs ({data.paragraphs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'links'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Links ({data.links.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'images'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Images ({data.images.length})</span>
        </button>

        {data.custom_selector && (
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'custom'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4 text-purple-400" />
            <span>Selector &ldquo;{data.custom_selector.selector}&rdquo; ({data.custom_selector.count})</span>
          </button>
        )}

        {data.raw_html && (
          <button
            onClick={() => setActiveTab('html')}
            className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'html'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Raw HTML</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('json')}
          className={`flex items-center gap-1.5 px-3 py-3 border-b-2 transition whitespace-nowrap ${
            activeTab === 'json'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileJson className="w-4 h-4" />
          <span>JSON Schema</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Metadata Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  HTML Document Metadata
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Title tag:</span>
                    <p className="text-slate-200 font-medium bg-slate-900 p-2 rounded-lg border border-slate-800">
                      {data.title || '(none)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Meta Description:</span>
                    <p className="text-slate-200 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      {data.meta_description || '(none)'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-500 block">Content Type:</span>
                      <span className="text-slate-300 font-mono">{data.content_type || 'text/html'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Execution Time:</span>
                      <span className="text-slate-300 font-mono">{data.duration_ms} ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SERP Search Result Simulation */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-400" />
                  Search Engine Snippet Preview
                </h3>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1.5 font-sans">
                  <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                    <span className="text-slate-500">{data.final_url || data.url}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-blue-400 hover:underline cursor-pointer truncate">
                    {data.title || 'Page Title'}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {data.meta_description ||
                      (data.paragraphs[0]
                        ? data.paragraphs[0]
                        : 'No description or paragraph extracted from this page.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Highlights */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Extracted Content Snapshot</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="font-medium text-slate-400 mb-2">First 3 Headings:</h4>
                  {data.headings.length === 0 ? (
                    <p className="text-slate-500 italic">No headings found</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.headings.slice(0, 3).map((h, idx) => (
                        <li key={idx} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                            H{h.level}
                          </span>
                          <span className="truncate text-slate-200">{h.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-slate-400 mb-2">First 3 Paragraphs:</h4>
                  {data.paragraphs.length === 0 ? (
                    <p className="text-slate-500 italic">No paragraphs found</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.paragraphs.slice(0, 3).map((p, idx) => (
                        <li key={idx} className="bg-slate-900 p-2 rounded border border-slate-800 text-slate-300 line-clamp-2">
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HEADINGS TAB */}
        {activeTab === 'headings' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Filter Level:</span>
                {(['all', 1, 2, 3, 4, 5, 6] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setHeadingFilter(lvl)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      headingFilter === lvl
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl === 'all' ? 'All' : `H${lvl}`}
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  handleCopy(
                    data.headings.map((h) => `[H${h.level}] ${h.text}`).join('\n'),
                    'headings_copy'
                  )
                }
                className="flex items-center gap-1 text-slate-400 hover:text-white"
              >
                {copiedKey === 'headings_copy' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy Outline</span>
              </button>
            </div>

            {filteredHeadings.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No headings matched the selected filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHeadings.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition"
                    style={{ paddingLeft: `${Math.max(12, (h.level - 1) * 20)}px` }}
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        h.level === 1
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : h.level === 2
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : h.level === 3
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      H{h.level}
                    </span>
                    <span className="text-sm text-slate-200 flex-1">{h.text}</span>
                    <button
                      onClick={() => handleCopy(h.text, `h_${idx}`)}
                      className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition"
                      title="Copy heading text"
                    >
                      {copiedKey === `h_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PARAGRAPHS TAB */}
        {activeTab === 'paragraphs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={paragraphSearch}
                  onChange={(e) => setParagraphSearch(e.target.value)}
                  placeholder="Search paragraph text..."
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={() =>
                  handleCopy(data.paragraphs.join('\n\n'), 'paragraphs_copy')
                }
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                {copiedKey === 'paragraphs_copy' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy All Paragraphs</span>
              </button>
            </div>

            {filteredParagraphs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No paragraphs found.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredParagraphs.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition flex items-start gap-3 group"
                  >
                    <span className="text-[10px] font-mono text-slate-500 pt-0.5 select-none w-6 shrink-0">
                      #{idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed flex-1">
                      {p}
                    </p>
                    <button
                      onClick={() => handleCopy(p, `p_${idx}`)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                      title="Copy paragraph"
                    >
                      {copiedKey === `p_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Filter links by text or URL..."
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  Showing {filteredLinks.length} of {data.links.length}
                </span>
                <button
                  onClick={() =>
                    handleCopy(
                      data.links.map((l) => `${l.text} -> ${l.href}`).join('\n'),
                      'links_copy'
                    )
                  }
                  className="flex items-center gap-1 hover:text-white"
                >
                  {copiedKey === 'links_copy' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy URLs</span>
                </button>
              </div>
            </div>

            {filteredLinks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No links match your filter.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 w-12 text-center">#</th>
                        <th className="py-2.5 px-4 w-1/3">Anchor Text</th>
                        <th className="py-2.5 px-4">Resolved Destination</th>
                        <th className="py-2.5 px-3 w-20 text-center">Type</th>
                        <th className="py-2.5 px-3 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {filteredLinks.map((link, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-4 text-center text-slate-500 font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-4 text-slate-200 font-medium">
                            <span className="line-clamp-2">{link.text}</span>
                          </td>
                          <td className="py-2 px-4 text-blue-400 font-mono text-[11px] truncate max-w-xs">
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1 truncate"
                            >
                              <span className="truncate">{link.href}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />
                            </a>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                link.isExternal
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {link.isExternal ? 'External' : 'Internal'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleCopy(link.href, `link_${idx}`)}
                              className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition"
                              title="Copy URL"
                            >
                              {copiedKey === `link_${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* IMAGES TAB */}
        {activeTab === 'images' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={imageSearch}
                  onChange={(e) => setImageSearch(e.target.value)}
                  placeholder="Filter images by alt or source URL..."
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <span className="text-xs text-slate-400">
                Total Extracted Images: {data.images.length}
              </span>
            </div>

            {filteredImages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No images extracted on this page.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition"
                  >
                    <div className="h-40 bg-slate-900/80 flex items-center justify-center p-2 relative overflow-hidden">
                      <img
                        src={img.src}
                        alt={img.alt || 'Extracted image'}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-3 border-t border-slate-800 space-y-1.5 flex-1 flex flex-col justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Alt Description
                        </span>
                        <p className="text-slate-200 font-medium line-clamp-1">
                          {img.alt || '(No alt text provided)'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                        <a
                          href={img.src}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline truncate max-w-[180px] flex items-center gap-1"
                        >
                          <span className="truncate">{img.src}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <button
                          onClick={() => handleCopy(img.src, `img_${idx}`)}
                          className="text-slate-500 hover:text-white p-1"
                          title="Copy image link"
                        >
                          {copiedKey === `img_${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CUSTOM SELECTOR TAB */}
        {activeTab === 'custom' && data.custom_selector && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Selector Query:</span>
                <code className="bg-purple-950/60 text-purple-300 px-2.5 py-1 rounded border border-purple-500/30 font-mono text-xs">
                  {data.custom_selector.selector}
                </code>
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px]">
                  {data.custom_selector.count} matches
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {data.custom_selector.items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Match #{idx + 1}
                    </span>
                    <button
                      onClick={() => handleCopy(item.text, `custom_${idx}`)}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-white"
                    >
                      {copiedKey === `custom_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Text</span>
                    </button>
                  </div>

                  <p className="text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    {item.text || '(Empty text)'}
                  </p>

                  {Object.keys(item.attributes).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                      <span className="text-slate-500">Attributes:</span>
                      {Object.entries(item.attributes).map(([k, v]) => (
                        <span
                          key={k}
                          className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono text-slate-400"
                        >
                          {k}="{v}"
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RAW HTML TAB */}
        {activeTab === 'html' && data.raw_html && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Full Page Markup ({data.raw_html.length.toLocaleString()} characters)
              </span>
              <button
                onClick={() => handleCopy(data.raw_html || '', 'raw_html')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                {copiedKey === 'raw_html' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy Full HTML</span>
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
              <code>{data.raw_html}</code>
            </pre>
          </div>
        )}

        {/* JSON TAB */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">
                ScrapedData standard model representation
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleCopy(JSON.stringify(data, null, 2), 'json_model')
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  {copiedKey === 'json_model' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => handleDownload('json')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json</span>
                </button>
              </div>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[500px] leading-relaxed">
              <code>{JSON.stringify(data, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
