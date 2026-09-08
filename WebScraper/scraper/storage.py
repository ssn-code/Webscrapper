"""Storage architecture and output serializers for scraped data."""

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Union
from urllib.parse import urlparse

from scraper.models import ScrapedData

logger = logging.getLogger(__name__)


class BaseStorage(ABC):
    """Abstract interface for all storage backends."""

    @abstractmethod
    def save(self, data: ScrapedData, destination: Optional[Union[str, Path]] = None) -> Path:
        """Persist scraped data to the target destination and return file path."""
        pass


class JSONStorage(BaseStorage):
    """Saves scraped data as structured JSON files."""

    def __init__(self, default_output_dir: Union[str, Path] = "output", indent: int = 2) -> None:
        self.output_dir = Path(default_output_dir)
        self.indent = indent
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _generate_filename(self, url: str) -> str:
        """Derive a safe filesystem name from the target URL."""
        parsed = urlparse(url)
        hostname = parsed.netloc.replace(":", "_").replace(".", "_")
        path_part = parsed.path.strip("/").replace("/", "_")
        name = f"{hostname}_{path_part}".strip("_")
        if not name:
            name = "scraped_page"
        return f"{name}.json"

    def save(self, data: ScrapedData, destination: Optional[Union[str, Path]] = None) -> Path:
        """Save a ScrapedData instance as formatted JSON.

        Args:
            data: The ScrapedData model to persist.
            destination: Custom file or directory path. If None, derives filename in output_dir.

        Returns:
            Path: The resolved path to the written JSON file.
        """
        if destination:
            target_path = Path(destination)
            if target_path.is_dir() or str(destination).endswith(("/", "\\")):
                target_path.mkdir(parents=True, exist_ok=True)
                target_path = target_path / self._generate_filename(data.url)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
        else:
            target_path = self.output_dir / self._generate_filename(data.url)

        payload = data.to_clean_dict(include_html=bool(data.raw_html))
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=self.indent, ensure_ascii=False)

        logger.info("Scraped data saved to JSON: %s", target_path)
        return target_path


class CSVStorage(BaseStorage):
    """Placeholder storage backend for CSV output (scheduled for Phase 2)."""

    def save(self, data: ScrapedData, destination: Optional[Union[str, Path]] = None) -> Path:
        raise NotImplementedError("CSV storage is scheduled for Phase 2.")


class SQLiteStorage(BaseStorage):
    """Placeholder storage backend for SQLite output (scheduled for Phase 2)."""

    def save(self, data: ScrapedData, destination: Optional[Union[str, Path]] = None) -> Path:
        raise NotImplementedError("SQLite storage is scheduled for Phase 2.")
