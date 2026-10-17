import type { ScrapedData } from './types.ts';

export interface SeoFinding {
  id: string;
  title: string;
  status: 'pass' | 'warning' | 'fail';
  evidence: string;
  recommendation: string;
}

export interface SeoReport {
  score: number;
  findings: SeoFinding[];
}

export function auditSeo(data: ScrapedData): SeoReport {
  const metadata = data.seo_metadata;
  const findings: SeoFinding[] = [];
  const add = (finding: SeoFinding) => findings.push(finding);

  const title = metadata.title_tag;
  const titleLength = title.length;
  add({
    id: 'title',
    title: 'Page title',
    status: !title ? 'fail' : titleLength >= 30 && titleLength <= 60 ? 'pass' : 'warning',
    evidence: title ? `${titleLength} characters: ${title}` : 'No non-empty title element was found.',
    recommendation: !title ? 'Add a descriptive title element.' : 'Aim for a concise, descriptive title; 30-60 characters is a heuristic, not a ranking rule.',
  });

  const description = metadata.description_tag;
  const descriptionLength = description.length;
  add({
    id: 'description',
    title: 'Meta description',
    status: !description ? 'fail' : descriptionLength >= 70 && descriptionLength <= 160 ? 'pass' : 'warning',
    evidence: description ? `${descriptionLength} characters: ${description}` : 'No non-empty meta description was found.',
    recommendation: !description ? 'Add a useful summary in a meta description.' : 'Keep the description specific and readable; 70-160 characters is a display-oriented heuristic.',
  });

  add({
    id: 'canonical',
    title: 'Canonical URL',
    status: metadata.canonical_url ? 'pass' : 'warning',
    evidence: metadata.canonical_url || 'No canonical link was found.',
    recommendation: metadata.canonical_url ? 'Confirm the canonical URL is the preferred version of this page.' : 'Add a canonical link when this page has duplicate or alternate URLs.',
  });

  const noIndex = /(?:^|[\s,])noindex(?:$|[\s,])/i.test(metadata.robots_directives);
  add({
    id: 'robots-meta',
    title: 'Robots meta directives',
    status: noIndex ? 'warning' : 'pass',
    evidence: metadata.robots_directives || 'No robots meta directive was found.',
    recommendation: noIndex ? 'Review the noindex directive if this page is intended to appear in search results.' : 'No noindex directive was detected in the extracted robots meta tag.',
  });

  add({
    id: 'viewport',
    title: 'Viewport declaration',
    status: metadata.viewport ? 'pass' : 'warning',
    evidence: metadata.viewport || 'No viewport meta tag was found.',
    recommendation: metadata.viewport ? 'Check mobile rendering in a browser.' : 'Add a viewport declaration for mobile layout behavior.',
  });

  for (const [id, label, value] of [
    ['og-title', 'Open Graph title', metadata.open_graph['og:title']],
    ['og-description', 'Open Graph description', metadata.open_graph['og:description']],
    ['og-image', 'Open Graph image', metadata.open_graph['og:image']],
    ['twitter-card', 'Twitter card', metadata.twitter['twitter:card']],
    ['twitter-title', 'Twitter title', metadata.twitter['twitter:title']],
    ['twitter-description', 'Twitter description', metadata.twitter['twitter:description']],
  ]) {
    add({
      id,
      title: label,
      status: value ? 'pass' : 'warning',
      evidence: value || `No ${label.toLowerCase()} value was found.`,
      recommendation: value ? 'Confirm the preview content is accurate.' : `Add ${label} metadata if this page is shared on social platforms.`,
    });
  }

  add({
    id: 'language',
    title: 'Document language',
    status: metadata.language ? 'pass' : 'warning',
    evidence: metadata.language || 'The html element has no lang attribute.',
    recommendation: metadata.language ? 'Verify the declared language matches the page content.' : 'Set a valid lang attribute on the html element for accessibility and language signals.',
  });

  const structureComplete = metadata.has_doctype && metadata.has_html && metadata.has_head && metadata.has_body;
  add({
    id: 'structure',
    title: 'HTML document structure',
    status: structureComplete ? 'pass' : 'warning',
    evidence: `doctype=${metadata.has_doctype}, html=${metadata.has_html}, head=${metadata.has_head}, body=${metadata.has_body}`,
    recommendation: structureComplete ? 'Keep a valid document structure.' : 'Include a doctype and html, head, and body elements.',
  });

  const h1Count = data.headings.filter(heading => heading.level === 1).length;
  add({
    id: 'h1',
    title: 'H1 heading',
    status: h1Count === 1 ? 'pass' : h1Count === 0 ? 'fail' : 'warning',
    evidence: `Found ${h1Count} H1 headings.`,
    recommendation: h1Count === 0 ? 'Add a primary page heading.' : h1Count > 1 ? 'Review whether multiple H1 headings represent distinct sections clearly.' : 'Ensure the H1 accurately describes the page.',
  });

  let hierarchyIssue = false;
  let previousLevel = 0;
  for (const heading of data.headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) hierarchyIssue = true;
    previousLevel = heading.level;
  }
  add({
    id: 'heading-hierarchy',
    title: 'Heading hierarchy',
    status: hierarchyIssue ? 'warning' : 'pass',
    evidence: hierarchyIssue ? 'At least one heading level skips an intermediate level.' : 'No skipped heading levels were detected.',
    recommendation: hierarchyIssue ? 'Use heading levels in a logical outline order.' : 'Keep headings descriptive and organized by section.',
  });

  const headingCounts = new Map<string, number>();
  for (const heading of data.headings) {
    const normalized = heading.text.toLowerCase().trim();
    headingCounts.set(normalized, (headingCounts.get(normalized) || 0) + 1);
  }
  const repeatedHeadingCount = Array.from(headingCounts.values()).reduce((count, value) => count + Math.max(0, value - 1), 0);
  add({
    id: 'repeated-headings',
    title: 'Repeated headings',
    status: repeatedHeadingCount ? 'warning' : 'pass',
    evidence: `${repeatedHeadingCount} repeated heading texts were detected.`,
    recommendation: repeatedHeadingCount ? 'Review repeated headings and make section labels distinct where that improves navigation.' : 'No repeated heading text was detected.',
  });

  add({
    id: 'anchor-text',
    title: 'Link text',
    status: metadata.missing_anchor_text_count ? 'warning' : 'pass',
    evidence: `${metadata.missing_anchor_text_count} links have no detectable text or image alt text.`,
    recommendation: metadata.missing_anchor_text_count ? 'Give links descriptive accessible names.' : 'Link names were detectable for the extracted links.',
  });

  add({
    id: 'image-alt',
    title: 'Image alternative text',
    status: metadata.missing_alt_count ? 'warning' : 'pass',
    evidence: `${metadata.missing_alt_count} images have missing or empty alt attributes.`,
    recommendation: metadata.missing_alt_count ? 'Add appropriate alt text to informative images; use empty alt for decorative images.' : 'All detected images have a non-empty alt attribute.',
  });

  add({
    id: 'duplicate-links',
    title: 'Duplicate links',
    status: metadata.duplicate_link_count ? 'warning' : 'pass',
    evidence: `${metadata.duplicate_link_count} repeated link destinations were detected.`,
    recommendation: 'Review repeated destinations and ensure link text remains useful in context.',
  });

  const weightedScore = findings.reduce((total, finding) => (
    total + (finding.status === 'pass' ? 1 : finding.status === 'warning' ? 0.5 : 0)
  ), 0);
  return { score: Math.round((weightedScore / findings.length) * 100), findings };
}