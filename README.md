# WebScraper

Production-ready modular web scraper built using Python and Playwright.

---

## 🐳 Running with Docker (Standalone)

Run the Playwright scraper in a container with all browser binaries and dependencies pre-installed:

### 1. Build the Docker Image
```powershell
docker build -f Dockerfile.webscrapper -t webscrapper .
```

### 2. View CLI Help
```powershell
docker run --rm webscrapper --help
```

### 3. Run a Scraping Job
```powershell
docker run --rm -v ${PWD}/output:/app/output webscrapper "https://example.com" --format json
```
