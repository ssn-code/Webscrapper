import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Save,
  Check,
  Shield,
  Clock,
  Laptop,
} from 'lucide-react';
import { ScraperConfig } from '../types.ts';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<ScraperConfig>({
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    timeout_ms: 30000,
    delay_seconds: 1,
    respect_robots: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then((r) => r.json())
        .then((data) => setConfig(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch {
      // Ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-white">Scraper Engine Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-blue-400" />
              Default User-Agent Header
            </label>
            <textarea
              rows={3}
              value={config.user_agent}
              onChange={(e) => setConfig({ ...config, user_agent: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono text-[11px] outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Default Timeout (ms)
              </label>
              <input
                type="number"
                min={2000}
                max={60000}
                step={1000}
                value={config.timeout_ms}
                onChange={(e) =>
                  setConfig({ ...config, timeout_ms: parseInt(e.target.value) || 30000 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Polite Delay (seconds)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={config.delay_seconds}
                onChange={(e) =>
                  setConfig({ ...config, delay_seconds: parseFloat(e.target.value) || 1 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                checked={config.respect_robots}
                onChange={(e) =>
                  setConfig({ ...config, respect_robots: e.target.checked })
                }
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1 text-slate-200 font-medium">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Respect robots.txt policies</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Adhere to crawler rate limits and disallowed paths
                </span>
              </div>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-800">
            {savedSuccess && (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-4 h-4" />
                Config saved!
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
