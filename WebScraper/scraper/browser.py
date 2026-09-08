"""Playwright browser lifecycle and context manager."""

import logging
from typing import Any, Dict, Optional
from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_VIEWPORT = {"width": 1280, "height": 800}


class BrowserManager:
    """Manages Playwright browser instance, contexts, and page creation.

    Ensures that a single browser process is reused across requests
    and guarantees proper resource teardown on shutdown.
    """

    def __init__(
        self,
        headless: bool = True,
        timeout_ms: int = 30000,
        user_agent: Optional[str] = None,
        viewport: Optional[Dict[str, int]] = None,
    ) -> None:
        self.headless = headless
        self.timeout_ms = timeout_ms
        self.user_agent = user_agent or DEFAULT_USER_AGENT
        self.viewport = viewport or DEFAULT_VIEWPORT

        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None

    @property
    def is_running(self) -> bool:
        """Check if browser process is currently active."""
        return self._browser is not None and self._browser.is_connected()

    async def start(self) -> None:
        """Launch Playwright and Chromium browser instance."""
        if self.is_running:
            logger.debug("Browser is already running.")
            return

        logger.info(
            "Launching Chromium browser (headless=%s, timeout=%dms)",
            self.headless,
            self.timeout_ms,
        )
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )

        self._context = await self._browser.new_context(
            user_agent=self.user_agent,
            viewport=self.viewport,
            ignore_https_errors=True,
        )
        self._context.set_default_timeout(self.timeout_ms)
        self._context.set_default_navigation_timeout(self.timeout_ms)
        logger.debug("Browser context created successfully.")

    async def new_page(self) -> Page:
        """Create and configure a new page inside the active context."""
        if not self._context:
            await self.start()

        assert self._context is not None
        page = await self._context.new_page()
        page.set_default_timeout(self.timeout_ms)
        page.set_default_navigation_timeout(self.timeout_ms)
        return page

    async def close_page(self, page: Optional[Page]) -> None:
        """Safely close an individual page."""
        if page and not page.is_closed():
            try:
                await page.close()
            except Exception as exc:
                logger.warning("Error closing page: %s", exc)

    async def close(self) -> None:
        """Clean up context, browser instance, and Playwright driver."""
        logger.debug("Cleaning up browser resources...")
        if self._context:
            try:
                await self._context.close()
            except Exception as exc:
                logger.warning("Error closing browser context: %s", exc)
            self._context = None

        if self._browser:
            try:
                await self._browser.close()
            except Exception as exc:
                logger.warning("Error closing browser: %s", exc)
            self._browser = None

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception as exc:
                logger.warning("Error stopping Playwright: %s", exc)
            self._playwright = None

        logger.info("Browser resources cleaned up successfully.")

    async def __aenter__(self) -> "BrowserManager":
        await self.start()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()
