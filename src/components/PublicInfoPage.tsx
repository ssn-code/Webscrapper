import React, { useEffect } from 'react';

type PageKey = 'about' | 'contact' | 'privacy' | 'terms' | 'not-found';

const pageContent: Record<Exclude<PageKey, 'not-found'>, { title: string; description: string; sections: Array<{ heading: string; body: React.ReactNode }> }> = {
  about: {
    title: 'About WebScrapper',
    description: 'Inspect a public page and review its extracted content, SEO signals, links, and robots policy.',
    sections: [
      { heading: 'What it does', body: <p>WebScrapper fetches one publicly reachable HTTP or HTTPS page and presents its metadata, headings, paragraphs, links, images, optional CSS-selected content, and an indicative SEO checklist. You can optionally check a bounded set of links from that page.</p> },
      { heading: 'How it behaves', body: <p>Robots.txt is respected by default. Requests are limited, redirects are revalidated, private network destinations are blocked, and the tool does not bypass authentication, CAPTCHAs, paywalls, or other access restrictions.</p> },
      { heading: 'Limits', body: <p>SEO findings are heuristics, not ranking predictions. The service has no access to private search analytics. History and logs are in-memory and are lost when the server restarts.</p> },
    ],
  },
  contact: {
    title: 'Contact',
    description: 'Contact the WebScrapper maintainers about defects or responsible-use concerns.',
    sections: [
      { heading: 'Project support', body: <p>Report a reproducible defect or request a change through the <a className="text-cyan-300 underline" href="https://github.com/ssn-code/Webscrapper/issues">project issue tracker</a>. Do not include passwords, cookies, API tokens, or private page contents in reports.</p> },
      { heading: 'Security reports', body: <p>For a security concern, use the repository’s private vulnerability reporting option when available. Avoid posting exploit details or sensitive target information publicly.</p> },
    ],
  },
  privacy: {
    title: 'Privacy',
    description: 'What WebScrapper processes and retains during page inspection.',
    sections: [
      { heading: 'Submitted URLs', body: <p>When you request a scrape, the server fetches the submitted public URL and may fetch its robots.txt file. Extracted results are returned to your browser. Do not submit URLs containing credentials or sensitive information.</p> },
      { heading: 'History and logs', body: <p>History is held in server memory, isolated by an HTTP-only browser session cookie, expires after at most 24 hours, and is limited to 20 records per session. A server restart clears it. Operational logs keep at most 200 entries and exclude scraped page contents and submitted URLs.</p> },
      { heading: 'Cookies and analytics', body: <p>The application uses a random session cookie to keep history separate between browser sessions. No analytics service or user account system is configured by this repository. Deployments may add infrastructure-level logging outside this application’s control.</p> },
      { heading: 'Administration', body: <p>Administrator tokens are supplied through deployment configuration and are not saved by the application. Configuration changes and operational log access require that token.</p> },
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'Responsible-use conditions and limitations for WebScrapper.',
    sections: [
      { heading: 'Responsible use', body: <p>Use this tool only for pages you are authorized to inspect and in a manner consistent with applicable law and the site’s policies. Robots.txt is observed by default but is not authorization to access content.</p> },
      { heading: 'Prohibited use', body: <p>Do not use the service to access private networks, evade access controls, overload sites, collect credentials, or bypass CAPTCHAs, paywalls, or anti-bot measures. Automated link checks are bounded and may produce different results than a browser.</p> },
      { heading: 'Availability and accuracy', body: <p>Results depend on the target site’s response and may be incomplete or out of date. SEO observations are heuristic and are not a promise of search ranking, availability, or fitness for a particular purpose.</p> },
    ],
  },
};

export const PublicInfoPage: React.FC<{ page: PageKey }> = ({ page }) => {
  const content = page === 'not-found' ? null : pageContent[page];
  const title = content?.title || 'Page not found';

  useEffect(() => {
    document.title = `${title} | WebScrapper`;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', content?.description || 'The requested WebScrapper page was not found.');
  }, [title, content]);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-5">
          <a href="/" className="text-sm font-bold text-white">WebScrapper</a>
          <a href="/" className="text-xs text-cyan-300 hover:text-white">Open inspector</a>
        </header>
        <article className="py-10">
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          {content ? (
            <div className="mt-8 space-y-8">
              {content.sections.map(section => (
                <section key={section.heading} className="border-b border-slate-800 pb-6">
                  <h2 className="text-base font-semibold text-cyan-200">{section.heading}</h2>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{section.body}</div>
                </section>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-300">That page does not exist.</p>}
        </article>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-5 text-xs text-slate-400">
          <a href="/about" className="hover:text-white">About</a>
          <a href="/contact" className="hover:text-white">Contact</a>
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="/terms" className="hover:text-white">Terms</a>
        </footer>
      </div>
    </main>
  );
};