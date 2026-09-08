"""Modular web scraper using Python and Playwright."""

from scraper.browser import BrowserManager
from scraper.extractor import HTMLExtractor
from scraper.models import HeadingItem, ImageItem, LinkItem, ScrapedData
from scraper.scraper import PlaywrightScraper
from scraper.storage import BaseStorage, CSVStorage, JSONStorage, SQLiteStorage
from scraper.utils import setup_logging, validate_url

__all__ = [
    "BrowserManager",
    "PlaywrightScraper",
    "HTMLExtractor",
    "BaseStorage",
    "JSONStorage",
    "CSVStorage",
    "SQLiteStorage",
    "ScrapedData",
    "HeadingItem",
    "LinkItem",
    "ImageItem",
    "setup_logging",
    "validate_url",
]
