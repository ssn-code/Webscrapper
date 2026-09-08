"""HTML parsing and data extraction engine."""

import logging
import re
from typing import List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from scraper.models import HeadingItem, ImageItem, LinkItem, ScrapedData

logger = logging.getLogger(__name__)


class HTMLExtractor:
    """Extracts structured content from raw HTML without requiring a browser instance."""

    def __init__(self, parser: str = "html.parser") -> None:
        self.parser = parser

    def _get_soup(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html or "", self.parser)

    def extract_title(self, soup: BeautifulSoup) -> str:
        """Extract title tag content or og:title fallback."""
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            return title_tag.string.strip()

        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return str(og_title["content"]).strip()

        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)

        return ""

    def extract_meta_description(self, soup: BeautifulSoup) -> str:
        """Extract standard or OpenGraph meta description."""
        meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta_desc and meta_desc.get("content"):
            return str(meta_desc["content"]).strip()

        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            return str(og_desc["content"]).strip()

        return ""

    def extract_headings(self, soup: BeautifulSoup) -> List[HeadingItem]:
        """Extract all h1-h6 headings preserving document order."""
        headings: List[HeadingItem] = []
        heading_tags = soup.find_all(re.compile(r"^h[1-6]$"))
        for tag in heading_tags:
            try:
                level = int(tag.name[1])
                text = tag.get_text(separator=" ", strip=True)
                if text:
                    headings.append(HeadingItem(level=level, text=text))
            except (ValueError, IndexError):
                continue
        return headings

    def extract_paragraphs(self, soup: BeautifulSoup) -> List[str]:
        """Extract text paragraphs from <p> tags, filtering out empty strings."""
        paragraphs: List[str] = []
        for p in soup.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if text:
                paragraphs.append(text)
        return paragraphs

    def extract_links(self, soup: BeautifulSoup, base_url: str) -> List[LinkItem]:
        """Extract anchor links, resolving relative URLs against base_url."""
        links: List[LinkItem] = []
        seen_hrefs = set()

        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            # Resolve relative URLs
            absolute_url = urljoin(base_url, href)
            # Basic validation that it has scheme and netloc
            parsed = urlparse(absolute_url)
            if parsed.scheme in ("http", "https"):
                anchor_text = a.get_text(separator=" ", strip=True)
                # Deduplicate identical (href, text) combinations
                key = (absolute_url, anchor_text)
                if key not in seen_hrefs:
                    seen_hrefs.add(key)
                    links.append(LinkItem(text=anchor_text, href=absolute_url))

        return links

    def extract_images(self, soup: BeautifulSoup, base_url: str) -> List[ImageItem]:
        """Extract image src and alt attributes, resolving relative sources."""
        images: List[ImageItem] = []
        seen_sources = set()

        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            src = src.strip()
            if not src or src.startswith("data:"):
                continue

            absolute_src = urljoin(base_url, src)
            alt = img.get("alt", "").strip()

            if absolute_src not in seen_sources:
                seen_sources.add(absolute_src)
                images.append(ImageItem(src=absolute_src, alt=alt))

        return images

    def extract_all(
        self,
        html: str,
        original_url: str,
        final_url: Optional[str] = None,
        status_code: Optional[int] = None,
        include_html: bool = False,
    ) -> ScrapedData:
        """Parse raw HTML and assemble a complete ScrapedData model."""
        effective_final_url = final_url or original_url
        soup = self._get_soup(html)

        title = self.extract_title(soup)
        meta_desc = self.extract_meta_description(soup)
        headings = self.extract_headings(soup)
        paragraphs = self.extract_paragraphs(soup)
        links = self.extract_links(soup, base_url=effective_final_url)
        images = self.extract_images(soup, base_url=effective_final_url)

        return ScrapedData(
            url=original_url,
            final_url=effective_final_url,
            title=title,
            meta_description=meta_desc,
            headings=headings,
            paragraphs=paragraphs,
            links=links,
            images=images,
            raw_html=html if include_html else None,
            status_code=status_code,
        )
