"""Data models for scraped content and metadata."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl


class HeadingItem(BaseModel):
    """Represents an HTML heading element (h1-h6)."""

    level: int = Field(..., ge=1, le=6, description="Heading level, e.g. 1 for <h1>")
    text: str = Field(..., description="Cleaned inner text of heading")


class LinkItem(BaseModel):
    """Represents a hyperlink element with resolved absolute URL."""

    text: str = Field(..., description="Anchor text or description")
    href: str = Field(..., description="Resolved URL destination")


class ImageItem(BaseModel):
    """Represents an image element with source and alternative text."""

    src: str = Field(..., description="Image source URL")
    alt: str = Field(default="", description="Image alternative text")


class ScrapedData(BaseModel):
    """Structured representation of data extracted from a web page."""

    url: str = Field(..., description="Original target URL requested")
    final_url: str = Field(..., description="Final URL after any HTTP or client redirects")
    title: str = Field(default="", description="Document title")
    meta_description: str = Field(default="", description="Meta description tag content")
    headings: List[HeadingItem] = Field(default_factory=list, description="Extracted headings in order")
    paragraphs: List[str] = Field(default_factory=list, description="Extracted text paragraphs")
    links: List[LinkItem] = Field(default_factory=list, description="Extracted hyperlinks")
    images: List[ImageItem] = Field(default_factory=list, description="Extracted images")
    raw_html: Optional[str] = Field(default=None, description="Full raw HTML if requested")
    status_code: Optional[int] = Field(default=None, description="HTTP response status code if available")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of when scraping occurred",
    )

    def to_clean_dict(self, include_html: bool = False) -> Dict[str, Any]:
        """Convert to dictionary matching clean output specifications."""
        data = {
            "url": self.url,
            "final_url": self.final_url,
            "title": self.title,
            "meta_description": self.meta_description,
            "headings": [h.model_dump() for h in self.headings],
            "paragraphs": self.paragraphs,
            "links": [l.model_dump() for l in self.links],
            "images": [i.model_dump() for i in self.images],
            "status_code": self.status_code,
            "timestamp": self.timestamp,
        }
        if include_html and self.raw_html is not None:
            data["raw_html"] = self.raw_html
        return data
