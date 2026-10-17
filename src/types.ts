export interface HeadingItem {
  level: number;
  text: string;
}

export interface LinkItem {
  text: string;
  href: string;
  isExternal: boolean;
}

export interface ImageItem {
  src: string;
  alt: string;
}

export interface SeoMetadata {
  title_tag: string;
  description_tag: string;
  canonical_url: string;
  robots_directives: string;
  viewport: string;
  open_graph: Record<string, string>;
  twitter: Record<string, string>;
  language: string;
  has_doctype: boolean;
  has_html: boolean;
  has_head: boolean;
  has_body: boolean;
  missing_alt_count: number;
  missing_anchor_text_count: number;
  duplicate_link_count: number;
}

export interface CustomSelectorResult {
  selector: string;
  count: number;
  items: Array<{ text: string; html: string; attributes: Record<string, string> }>;
}

export interface ScrapedData {
  id: string;
  url: string;
  final_url: string;
  title: string;
  meta_description: string;
  headings: HeadingItem[];
  paragraphs: string[];
  links: LinkItem[];
  images: ImageItem[];
  seo_metadata: SeoMetadata;
  custom_selector?: CustomSelectorResult;
  raw_html?: string | null;
  status_code: number | null;
  content_type?: string;
  content_length_bytes?: number;
  robots_allowed?: boolean;
  robots_status?: 'rules' | 'not-found' | 'client-error' | 'unavailable' | 'disabled';
  duration_ms: number;
  timestamp: string;
}

export interface LinkCheckResult {
  url: string;
  text: string;
  isExternal: boolean;
  status_code: number | null;
  final_url: string;
  method: 'HEAD' | 'GET';
  error?: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  final_url: string;
  title: string;
  headings_count: number;
  paragraphs_count: number;
  links_count: number;
  images_count: number;
  status_code: number | null;
  duration_ms: number;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  logger: string;
  message: string;
}

export interface ScraperConfig {
  user_agent: string;
  timeout_ms: number;
  delay_seconds: number;
  respect_robots: boolean;
}
