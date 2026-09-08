# WebScraper

A modular, extensible, and production-ready asynchronous web scraping application built with **Python 3.11+**, **Playwright**, **asyncio**, **BeautifulSoup**, and **Pydantic**.

Designed from the ground up for reliability, clean separation of concerns, and full testability without requiring live browser instances for unit tests.

---

## 1. Project Overview

WebScraper extracts structured information from modern, JavaScript-rendered web pages while remaining polite, configurable, and robust against navigation and layout changes.

### Key Features (Phase 1)
- **Playwright Chromium Engine**: Headless and headed support with custom viewports and user agents.
- **Resource Management**: Single browser context reused across operations with guaranteed teardown.
- **Decoupled DOM Extractor**: Standalone BeautifulSoup parser testable completely offline.
- **Structured Pydantic Models**: Validated typing for document title, meta tags, hierarchical headings, paragraphs, absolute links, and images.
- **Pluggable Storage**: Abstract storage interface with formatted JSON file serialization.
- **Comprehensive Logging**: Dual-stream logging (clean console output and rotating file log in `logs/scraper.log`).
- **Full Unit Test Suite**: 100% offline unit tests with synthetic HTML fixtures using `pytest`.

---

## 2. Architecture

```text
WebScraper/
│
├── scraper/
│   ├── __init__.py         # Package exports
│   ├── browser.py          # BrowserManager: Playwright lifecycle & context reuse
│   ├── scraper.py          # PlaywrightScraper: orchestrator for navigation & extraction
│   ├── extractor.py        # HTMLExtractor: decoupled DOM parsing (title, headings, links, etc.)
│   ├── models.py           # Pydantic models: ScrapedData, HeadingItem, LinkItem, ImageItem
│   ├── storage.py          # BaseStorage interface & JSONStorage implementation
│   └── utils.py            # URL validation and dual-stream rotating logging
│
├── config/
│   └── config.yaml         # Default configuration settings
│
├── output/                 # Destination for JSON outputs & screenshots
│
├── tests/
│   ├── test_extractor.py   # Unit tests for HTML and tag extraction
│   └── test_scraper.py     # Unit and local-page integration tests
│
├── logs/                   # Rotating log files (scraper.log)
│
├── main.py                 # CLI entry point
├── requirements.txt        # Core dependencies
├── pytest.ini              # Test runner configuration
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
└── README.md               # Documentation
```

### Component Flow
1. **CLI (`main.py`)** parses user input and configures logging.
2. **`BrowserManager`** launches Chromium in the chosen mode (headless/headed) with a persistent context.
3. **`PlaywrightScraper`** navigates to the URL, awaits DOM readiness (or an optional selector), and retrieves the fully rendered DOM.
4. **`HTMLExtractor`** parses the rendered HTML into structured `ScrapedData` models, converting relative links and images into absolute URLs.
5. **`JSONStorage`** writes indented JSON files to `output/` or a custom user-defined path.
6. **`BrowserManager`** cleans up browser contexts, pages, and drivers.

---

## 3. Installation

### Prerequisites
- Python 3.11 or higher
- pip (Python package manager)

### Step 1: Clone or Navigate to Directory
```bash
cd d:/projects/Webscrapper/WebScraper
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

---

## 4. Playwright Browser Installation

Install the required Chromium binaries for Playwright:

```bash
playwright install chromium
```

---

## 5. Basic Usage

Scrape a URL and save the extracted data as JSON in `output/`:

```bash
python main.py https://example.com
```

### Example Console Output
```text
2026-09-08 19:03:07 [INFO] main: Initializing WebScraper...
2026-09-08 19:03:07 [INFO] main: Target: https://example.com | Format: json | Headless: True
2026-09-08 19:03:07 [INFO] scraper.browser: Launching Chromium browser (headless=True, timeout=30000ms)
2026-09-08 19:03:07 [INFO] scraper.scraper: Starting scrape for target URL: https://example.com
2026-09-08 19:03:08 [INFO] scraper.scraper: Navigation response received: HTTP 200 for https://example.com
2026-09-08 19:03:08 [INFO] scraper.scraper: Extracted successfully: Title='Example Domain', 1 headings, 2 paragraphs, 1 links, 0 images
2026-09-08 19:03:08 [INFO] scraper.storage: Scraped data saved to JSON: output\example_com.json
2026-09-08 19:03:08 [INFO] scraper.browser: Browser resources cleaned up successfully.

[+] Scraping successful!
    URL:         https://example.com/
    Title:       Example Domain
    Headings:    1
    Paragraphs:  2
    Links:       1
    Images:      0
    Saved file:  output\example_com.json
```

---

## 6. CLI Options

Run `python main.py --help` to view all available arguments:

| Option | Default | Description |
|---|---|---|
| `url` | *Required* | Target URL to scrape (e.g. `https://example.com`) |
| `--format` | `json` | Output format (`json`, `csv`, `sqlite`) |
| `--output`, `-o` | `None` | Custom output file or directory path |
| `--headless` | `True` | Run browser in headless mode |
| `--headed` | `False` | Run browser with visible GUI window |
| `--timeout` | `30.0` | Navigation & selector timeout in seconds |
| `--delay` | `1.0` | Polite delay between actions in seconds |
| `--max-pages` | `1` | Maximum pages to scrape |
| `--selector` | `None` | CSS/XPath selector to await before extraction |
| `--screenshot` | `False` | Save full-page screenshot to `output/screenshot.png` |
| `--include-html`| `False` | Include raw HTML content in output payload |
| `--verbose`, `-v`| `False` | Enable verbose DEBUG logging in console |

### Command Examples

**Take a screenshot while scraping:**
```bash
python main.py https://example.com --screenshot
```

**Run in headed mode with custom timeout:**
```bash
python main.py https://example.com --headed --timeout 45
```

**Await a dynamic selector before extracting:**
```bash
python main.py https://example.com --selector "div.content"
```

**Save to a custom output path:**
```bash
python main.py https://example.com --output output/custom_data.json
```

---

## 7. Output Format

Extracted JSON data conforms to the following schema:

```json
{
  "url": "https://example.com",
  "final_url": "https://example.com/",
  "title": "Example Domain",
  "meta_description": "",
  "headings": [
    {
      "level": 1,
      "text": "Example Domain"
    }
  ],
  "paragraphs": [
    "This domain is for use in documentation examples without needing permission. Avoid use in operations.",
    "Learn more"
  ],
  "links": [
    {
      "text": "Learn more",
      "href": "https://iana.org/domains/example"
    }
  ],
  "images": [],
  "status_code": 200,
  "timestamp": "2026-09-08T13:33:08.536546+00:00"
}
```

---

## 8. Configuration

Default settings reside in `config/config.yaml`:

```yaml
browser:
  type: chromium
  headless: true
  timeout: 30000
  viewport:
    width: 1280
    height: 800
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36"

scraper:
  delay: 1
  max_pages: 10
  max_requests: 100

robots:
  respect: true

output:
  directory: output
  format: json
```

Environment variables can also be used by copying `.env.example` to `.env`.

---

## 9. Testing

The project includes unit tests for HTML extraction, relative URL resolution, image extraction, fallbacks, storage writing, and browser workflows.

Run the test suite using pytest:

```bash
pytest -v
```

All 15 tests run locally without hitting live external websites:
```text
tests/test_extractor.py::test_extract_title PASSED
tests/test_extractor.py::test_extract_title_fallbacks PASSED
tests/test_extractor.py::test_extract_meta_description PASSED
tests/test_extractor.py::test_extract_meta_description_og_fallback PASSED
tests/test_extractor.py::test_extract_headings PASSED
tests/test_extractor.py::test_extract_paragraphs PASSED
tests/test_extractor.py::test_extract_links PASSED
tests/test_extractor.py::test_extract_images PASSED
tests/test_extractor.py::test_extract_all_complete_model PASSED
tests/test_scraper.py::test_validate_url_valid PASSED
tests/test_scraper.py::test_validate_url_adds_https PASSED
tests/test_scraper.py::test_validate_url_invalid PASSED
tests/test_scraper.py::test_json_storage PASSED
tests/test_scraper.py::test_browser_manager_defaults PASSED
tests/test_scraper.py::test_scraper_end_to_end_local_html PASSED
============================= 15 passed in 1.89s =============================
```

---

## 10. Troubleshooting

- **`playwright._impl._errors.Error: Executable doesn't exist`**:
  Run `playwright install chromium` to download the browser binaries.
- **Timeout on JavaScript heavy pages**:
  Increase the timeout using `--timeout 60` or supply a specific selector using `--selector`.
- **Navigation failures / DNS errors**:
  Check target domain spelling and ensure internet connectivity.
- **Log inspection**:
  Examine `logs/scraper.log` for full timestamped diagnostic records.

---

## 11. Ethical & Legal Considerations

- **Public Data Only**: This tool is designed solely for public web content where scraping is permitted.
- **Respect Policies**: Honor website terms of service and `robots.txt` guidelines.
- **Rate Limiting**: Avoid aggressive scraping loops; adhere to courteous request delays.
- **No Evasion**: Does not include CAPTCHA bypass, authentication circumvention, or stealth evasion tools.

---

## 12. Roadmap (Upcoming Phases)

- **Phase 2**: Custom CSS/XPath/Text selector configuration, CSV export, SQLite storage.
- **Phase 3**: Multi-page pagination, duplicate URL tracking, exponential backoff retries, and robots.txt parsing.
- **Phase 4**: Asynchronous concurrency limiter (asyncio semaphore) for batch scraping.
- **Phase 5**: Plugin architecture and advanced custom extractors.
