#!/usr/bin/env python3
"""CLI entry point for the WebScraper application."""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

from scraper.browser import BrowserManager
from scraper.extractor import HTMLExtractor
from scraper.scraper import PlaywrightScraper
from scraper.storage import CSVStorage, JSONStorage, SQLiteStorage
from scraper.utils import setup_logging, validate_url

logger = logging.getLogger("main")


def parse_arguments() -> argparse.Namespace:
    """Configure and parse command-line flags."""
    parser = argparse.ArgumentParser(
        prog="WebScraper",
        description="Production-Ready Modular Web Scraper using Python and Playwright.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "url",
        help="Target web address to scrape (e.g., https://example.com)",
    )

    parser.add_argument(
        "--format",
        choices=["json", "csv", "sqlite"],
        default="json",
        help="Output serialization format (Phase 1 supports 'json').",
    )

    parser.add_argument(
        "--output",
        "-o",
        dest="output_path",
        default=None,
        help="Custom output file or directory path.",
    )

    parser.add_argument(
        "--headless",
        dest="headless",
        action="store_true",
        default=True,
        help="Run browser in headless background mode (default).",
    )

    parser.add_argument(
        "--headed",
        dest="headless",
        action="store_false",
        help="Launch browser in visible UI window.",
    )

    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Navigation and selector timeout in seconds.",
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Polite delay between operations in seconds.",
    )

    parser.add_argument(
        "--max-pages",
        type=int,
        default=1,
        help="Maximum pages to scrape (single-page in Phase 1).",
    )

    parser.add_argument(
        "--selector",
        default=None,
        help="Optional CSS or XPath selector to await before data extraction.",
    )

    parser.add_argument(
        "--screenshot",
        action="store_true",
        help="Capture and save a full-page screenshot of the scraped page.",
    )

    parser.add_argument(
        "--include-html",
        action="store_true",
        help="Include full raw page HTML in the output payload.",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable detailed DEBUG level logging to console.",
    )

    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> int:
    """Execute asynchronous scraping workflow."""
    # Setup logging
    setup_logging(log_dir="logs", verbose=args.verbose)

    logger.info("Initializing WebScraper...")
    logger.info("Target: %s | Format: %s | Headless: %s", args.url, args.format, args.headless)

    # Validate URL early
    try:
        target_url = validate_url(args.url)
    except ValueError as err:
        logger.error("Invalid URL provided: %s", err)
        print(f"Error: {err}", file=sys.stderr)
        return 1

    # Select storage backend
    if args.format == "json":
        storage = JSONStorage(default_output_dir="output")
    elif args.format == "csv":
        try:
            storage = CSVStorage()
        except NotImplementedError as err:
            logger.error("CSV storage not supported in Phase 1: %s", err)
            print(f"Error: {err}", file=sys.stderr)
            return 1
    elif args.format == "sqlite":
        try:
            storage = SQLiteStorage()
        except NotImplementedError as err:
            logger.error("SQLite storage not supported in Phase 1: %s", err)
            print(f"Error: {err}", file=sys.stderr)
            return 1
    else:
        logger.error("Unsupported format: %s", args.format)
        return 1

    # Configure screenshot target if requested
    screenshot_path: Optional[str] = None
    if args.screenshot:
        output_dir = Path("output")
        output_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = str(output_dir / "screenshot.png")

    timeout_ms = int(args.timeout * 1000)

    # Initialize Browser Manager
    browser_manager = BrowserManager(
        headless=args.headless,
        timeout_ms=timeout_ms,
    )

    extractor = HTMLExtractor()
    scraper = PlaywrightScraper(
        browser_manager=browser_manager,
        extractor=extractor,
        storage=storage,
    )

    try:
        async with browser_manager:
            data = await scraper.scrape(
                url=target_url,
                wait_selector=args.selector,
                screenshot_path=screenshot_path,
                include_html=args.include_html,
            )

            # Persist extracted data
            saved_path = storage.save(data, destination=args.output_path)
            logger.info("Successfully scraped and saved to: %s", saved_path)

            print(f"\n[+] Scraping successful!")
            print(f"    URL:         {data.final_url}")
            print(f"    Title:       {data.title}")
            print(f"    Headings:    {len(data.headings)}")
            print(f"    Paragraphs:  {len(data.paragraphs)}")
            print(f"    Links:       {len(data.links)}")
            print(f"    Images:      {len(data.images)}")
            print(f"    Saved file:  {saved_path}")
            if screenshot_path:
                print(f"    Screenshot:  {screenshot_path}")

            return 0

    except Exception as err:
        logger.error("Scraping execution failed: %s", err)
        print(f"\n[-] Execution failed: {err}", file=sys.stderr)
        return 1


def main() -> None:
    """CLI synchronous wrapper."""
    args = parse_arguments()
    exit_code = asyncio.run(async_main(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
