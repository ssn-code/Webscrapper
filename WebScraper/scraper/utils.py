"""Utility helpers for logging, URL validation, and sanitization."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse


def setup_logging(
    log_dir: str = "logs",
    log_filename: str = "scraper.log",
    verbose: bool = False,
) -> logging.Logger:
    """Configure console and file logging.

    Args:
        log_dir: Directory where log files are persisted.
        log_filename: Primary log file name.
        verbose: If True, sets console log level to DEBUG; otherwise INFO.

    Returns:
        The configured root or package logger.
    """
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    full_log_file = log_path / log_filename

    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(log_format, date_format)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    # Avoid duplicate handlers if setup_logging is called multiple times
    if not any(isinstance(h, RotatingFileHandler) for h in root_logger.handlers):
        file_handler = RotatingFileHandler(
            full_log_file,
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler) for h in root_logger.handlers):
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG if verbose else logging.INFO)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    return root_logger


def validate_url(url: str) -> str:
    """Validate and normalize a URL string.

    Args:
        url: User-provided URL.

    Returns:
        Normalized URL string with scheme.

    Raises:
        ValueError: If URL has invalid syntax or unsupported scheme.
    """
    cleaned = url.strip()
    if not cleaned:
        raise ValueError("URL cannot be empty.")

    parsed = urlparse(cleaned)
    if not parsed.scheme:
        # Scheme missing; default to https://
        cleaned = f"https://{cleaned}"
        parsed = urlparse(cleaned)

    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are supported.")

    if not parsed.netloc:
        raise ValueError(f"Invalid URL domain name in '{url}'.")

    return cleaned

