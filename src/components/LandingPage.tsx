import React from 'react';
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Sparkles, FolderKanban, BarChart3, FileText, Layers3, Bot } from 'lucide-react';

const featureCards = [
  { icon: Search, title: 'Website inspection', description: 'Fetch a public page, extract metadata, headings, text, links, and images in one run.' },
  { icon: FileText, title: 'HTML content extraction', description: 'Capture structured DOM data plus raw HTML when needed for a deeper inspection.' },
  { icon: Layers3, title: 'CSS selector extraction', description: 'Zero in on exact page sections with selector-based extraction and visible counts.' },
  { icon: FolderKanban, title: 'Batch URL processing', description: 'Queue up to 10 unique URLs and run sequential inspection while respecting rate limits.' },
  { icon: BarChart3, title: 'SEO auditing', description: 'Review title tags, descriptions, canonical URLs, headings, and indexability signals.' },
  { icon: CheckCircle2, title: 'Broken-link analysis', description: 'Check extracted destinations and surface reachable or blocked links with safe explanations.' },
  { icon: Sparkles, title: 'Metadata inspection', description: 'Inspect robots directives, canonical tags, open graph data, and viewport information.' },
  { icon: ShieldCheck, title: 'robots.txt-aware scraping', description: 'Respect site policies by default while preserving safe request budgets and SSRF protections.' },
  { icon: ArrowRight, title: 'Exportable reports', description: 'Download JSON or CSV exports for your inspection history and results.' },
  { icon: Bot, title: 'Inspection history', description: 'Keep session-scoped results for review, re-open, and export without leaving the dashboard.' },
];

const steps = [
  'Enter a website URL or paste a list for batch inspection.',
  'Choose extraction options and review the configured limits.',
  'Run the inspection and inspect the structured results in context.',
  'Audit SEO quality, review discovered links, and export your report.',
];

const faqs = [
  {
    question: 'Is this a general-purpose crawler?',
    answer: 'No. This tool focuses on public web-page inspection, bounded link validation, and metadata extraction while preserving safe site and network protections.',
  },
  {
    question: 'Does it respect robots.txt?',
    answer: 'Yes. robots.txt enforcement is enabled by default for supported requests, and the backend still blocks unsafe or private destinations.',
  },
  {
    question: 'How are exports handled?',
    answer: 'Owned results can be exported as JSON or CSV. CSV exports are sanitized to prevent spreadsheet formula injection.',
  },
  {
    question: 'What is stored locally?',
    answer: 'Current history and logs are kept in memory for the active browser session and are not a durable public database.',
  },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3 font-semibold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-600/30">
              <Search className="h-4 w-4" />
            </span>
            <span>WebScrapper</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how-it-works" className="transition hover:text-white">How It Works</a>
            <a href="#docs" className="transition hover:text-white">Documentation</a>
            <a href="https://github.com/ssn-code/Webscrapper" target="_blank" rel="noreferrer" className="transition hover:text-white">GitHub</a>
          </nav>

          <div className="flex items-center gap-3">
            <a href="/about" className="hidden rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white sm:inline-flex">About</a>
            <a href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),transparent_40%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="space-y-8">
              <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
                Web intelligence, simplified.
              </span>
              <div className="space-y-5">
                <h1 className="max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Inspect websites, extract signals, and turn them into actionable reports.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  WebScrapper helps you inspect public pages, audit SEO quality, assess page structure, review robots-safe access, and export clean reports from one powerful dashboard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#features" className="inline-flex items-center rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white">
                  Explore Features
                </a>
              </div>

              <div className="flex flex-wrap gap-6 pt-2 text-sm text-slate-400">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Safe public inspection</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> SEO-driven analysis</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Batch reporting</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-cyan-950/30">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Dashboard preview</span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                        <span>Inspection</span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">Healthy</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2.5 w-3/4 rounded-full bg-slate-800"><div className="h-full w-[76%] rounded-full bg-cyan-500" /></div>
                        <div className="h-2.5 w-1/2 rounded-full bg-slate-800"><div className="h-full w-[68%] rounded-full bg-indigo-500" /></div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                        <p className="text-xs text-slate-400">URLs inspected</p>
                        <p className="mt-2 text-2xl font-semibold text-white">184</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                        <p className="text-xs text-slate-400">SEO findings</p>
                        <p className="mt-2 text-2xl font-semibold text-white">27</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Recent activity</span>
                        <span className="text-cyan-300">Live</span>
                      </div>
                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-2">
                          <span>example.com</span>
                          <span className="text-emerald-300">Success</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-2">
                          <span>docs.example.com</span>
                          <span className="text-amber-300">Warnings</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything needed for confident page inspection.</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/30 transition hover:border-cyan-500/40 hover:bg-slate-900">
                <div className="mb-4 inline-flex rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-800 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">From raw URL to actionable insight in five steps.</h2>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step} className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-bold text-cyan-300">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="docs" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Use cases</p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Built for teams that need practical web intelligence.</h2>
              <div className="space-y-4 text-slate-300">
                <p>Use WebScrapper to review public pages before launch, validate metadata structure, discover broken links, and maintain an evidence trail for SEO audits.</p>
                <p>It is especially useful for content teams, developers, SEO analysts, and operations teams that need structured results without spinning up a custom crawler.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                'Content and metadata verification',
                'SEO and indexability checks',
                'Link monitoring and validation',
                'Structured exports for reporting',
                'Batch inspection for page collections',
                'Session history for follow-up review',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-200">
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Documentation</p>
                <h2 className="mt-3 text-3xl font-bold text-white">Launch the dashboard and inspect a public URL today.</h2>
              </div>
              <a href="/dashboard" className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                Open Dashboard
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Common questions</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {faqs.map(({ question, answer }) => (
              <div key={question} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="text-lg font-semibold text-white">{question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-lg font-semibold text-white">WebScrapper</p>
            <p className="mt-2 text-sm text-slate-400">Public page inspection, SEO review, and structured export tooling.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
            <a href="https://github.com/ssn-code/Webscrapper" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
            <a href="/about" className="hover:text-white">About</a>
            <a href="/contact" className="hover:text-white">Contact</a>
            <a href="/privacy" className="hover:text-white">Privacy Policy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
