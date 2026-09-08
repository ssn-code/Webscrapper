"""Core Playwright scraper orchestrator."""

import logging
from pathlib import Path
from typing import Optional

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from scraper.browser import BrowserManager
from scraper.extractor import HTMLExtractor
from scraper.models import ScrapedData
from scraper.storage import BaseStorage, JSONStorage
from scraper.utils import validate_url

logger = logging.getLogger(__name__)


class PlaywrightScraper:
    """Asynchronous web scraper leveraging Playwright for JavaScript-rendered pages."""

    def __init__(
        self,
        browser_manager: Optional[BrowserManager] = None,
        extractor: Optional[HTMLExtractor] = None,
        storage: Optional[BaseStorage] = None,
    ) -> None:
        self.browser_manager = browser_manager or BrowserManager()
        self.extractor = extractor or HTMLExtractor()
        self.storage = storage or JSONStorage()

    async def scrape(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        screenshot_path: Optional[str] = None,
        include_html: bool = False,
    ) -> ScrapedData:
        """Scrape a single webpage, extract structured data, and return ScrapedData.

        Args:
            url: The HTTP/HTTPS web address to scrape.
            wait_selector: Optional CSS/XPath selector to wait for before extracting.
            screenshot_path: Optional file path to save a page screenshot.
            include_html: If True, attaches raw HTML to the returned model.

        Returns:
            ScrapedData: Complete structured data model.

        Raises:
            ValueError: If the URL is invalid.
            PlaywrightTimeoutError: If the page takes longer than configured timeout to load.
            PlaywrightError: On browser or network level connection failures.
        """
        valid_url = validate_url(url)
        logger.info("Starting scrape for target URL: %s", valid_url)

        page = await self.browser_manager.new_page()
        status_code: Optional[int] = None

        try:
            logger.debug("Navigating to %s ...", valid_url)
            response = await page.goto(
                valid_url,
                wait_until="domcontentloaded",
                timeout=self.browser_manager.timeout_ms,
            )

            if response:
                status_code = response.status
                logger.info("Navigation response received: HTTP %s for %s", status_code, valid_url)
                if status_code >= 400:
                    logger.warning(
                        "Received HTTP error status %s for URL: %s",
                        status_code,
                        valid_url,
                    )
            else:
                logger.warning("No HTTP response object received for %s (possibly served from cache)", valid_url)

            # Wait for specific selector if requested
            if wait_selector:
                logger.debug("Waiting for selector: %s", wait_selector)
                try:
                    await page.wait_for_selector(wait_selector, timeout=self.browser_manager.timeout_ms)
                except PlaywrightTimeoutError:
                    logger.warning("Timed out waiting for selector '%s' on %s", wait_selector, valid_url)

            # Capture screenshot if requested
            if screenshot_path:
                shot_path = Path(screenshot_path)
                shot_path.parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(shot_path), full_page=True)
                logger.info("Saved screenshot to: %s", shot_path)

            final_url = page.url
            rendered_html = await page.content()

            logger.debug("Extracting structured content for %s", final_url)
            data = self.extractor.extract_all(
                html=rendered_html,
                original_url=valid_url,
                final_url=final_url,
                status_code=status_code,
                include_html=include_html,
            )

            logger.info(
                "Extracted successfully: Title='%s', %d headings, %d paragraphs, %d links, %d images",
                data.title,
                len(data.headings),
                len(data.paragraphs),
                len(data.links),
                len(data.images),
            )
            return data

        except PlaywrightTimeoutError as err:
            logger.error("Timeout occurred while navigating to %s: %s", valid_url, err)
            raise
        except PlaywrightError as err:
            logger.error("Playwright browser error on %s: %s", valid_url, err)
            raise
        except Exception as err:
            logger.error("Unexpected error during scraping %s: %s", valid_url, err, exc_info=True)
            raise
        finally:
            await self.browser_manager.close_page(page)
