import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSeo } from './seoAudit.ts';
import type { ScrapedData } from './types.ts';

const base: ScrapedData = {
  id: 'test',
  url: 'https://example.com/',
  final_url: 'https://example.com/',
  title: 'A descriptive example page title for auditing',
  meta_description: 'A useful summary for this example page that has enough characters to be a meaningful description.',
  headings: [{ level: 1, text: 'Example' }, { level: 2, text: 'Details' }],
  paragraphs: [],
  links: [],
  images: [],
  seo_metadata: {
    title_tag: 'A descriptive example page title for auditing',
    description_tag: 'A useful summary for this example page that has enough characters to be a meaningful description.',
    canonical_url: 'https://example.com/',
    robots_directives: '',
    viewport: 'width=device-width, initial-scale=1',
    open_graph: { 'og:title': 'Example', 'og:description': 'Description', 'og:image': 'https://example.com/share.png' },
    twitter: {
      'twitter:card': 'summary',
      'twitter:title': 'Example',
      'twitter:description': 'Description',
    },
    language: 'en',
    has_doctype: true,
    has_html: true,
    has_head: true,
    has_body: true,
    missing_alt_count: 0,
    missing_anchor_text_count: 0,
    duplicate_link_count: 0,
  },
  status_code: 200,
  duration_ms: 10,
  timestamp: '2026-01-01T00:00:00.000Z',
};

test('SEO audit scores complete evidence and exposes the scoring denominator', () => {
  const report = auditSeo(base);
  assert.equal(report.score, 100);
  assert.equal(report.findings.length, 19);
  assert.ok(report.findings.every(finding => finding.evidence && finding.recommendation));
});

test('SEO audit flags missing metadata, headings, and image text as evidence-backed issues', () => {
  const report = auditSeo({
    ...base,
    title: '',
    meta_description: '',
    headings: [],
    seo_metadata: {
      ...base.seo_metadata,
      title_tag: '',
      description_tag: '',
      missing_alt_count: 2,
      robots_directives: 'noindex, nofollow',
    },
  });
  assert.equal(report.score < 100, true);
  assert.equal(report.findings.find(finding => finding.id === 'title')?.status, 'fail');
  assert.equal(report.findings.find(finding => finding.id === 'image-alt')?.evidence, '2 images have missing or empty alt attributes.');
});