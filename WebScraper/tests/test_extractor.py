"""Unit tests for HTMLExtractor using local HTML fixtures."""

import pytest
from scraper.extractor import HTMLExtractor
from scraper.models import ScrapedData


SAMPLE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sample Test Webpage</title>
    <meta name="description" content="This is an awesome sample test description.">
</head>
<body>
    <header>
        <h1>Main Heading 1</h1>
        <h2>Subheading 2.1</h2>
        <h2>Subheading 2.2</h2>
        <h3>Sub-subheading 3.1</h3>
    </header>

    <main>
        <p>This is the first paragraph with interesting information.</p>
        <p>   </p> <!-- empty paragraph -->
        <p>Second paragraph featuring a <a href="/internal/page">internal relative link</a> and an <a href="https://external.org/test">external absolute link</a>.</p>
        <a href="#section-anchor">Anchor jump link</a>
        <a href="javascript:void(0)">JS script link</a>
        <a href="mailto:contact@test.com">Mailto link</a>

        <div class="gallery">
            <img src="/images/logo.png" alt="Company Logo">
            <img src="https://cdn.example.com/banner.jpg" alt="Hero Banner">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Data URI Image">
            <img src="/images/no-alt.webp">
        </div>
    </main>
</body>
</html>
"""


@pytest.fixture
def extractor() -> HTMLExtractor:
    return HTMLExtractor()


def test_extract_title(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    title = extractor.extract_title(soup)
    assert title == "Sample Test Webpage"


def test_extract_title_fallbacks(extractor: HTMLExtractor):
    # Test og:title fallback
    og_html = "<html><head><meta property='og:title' content='OG Social Title'></head><body></body></html>"
    soup = extractor._get_soup(og_html)
    assert extractor.extract_title(soup) == "OG Social Title"

    # Test h1 fallback
    h1_html = "<html><body><h1>Fallback H1 Title</h1></body></html>"
    soup = extractor._get_soup(h1_html)
    assert extractor.extract_title(soup) == "Fallback H1 Title"

    # Test missing
    empty_html = "<html><body></body></html>"
    soup = extractor._get_soup(empty_html)
    assert extractor.extract_title(soup) == ""


def test_extract_meta_description(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    desc = extractor.extract_meta_description(soup)
    assert desc == "This is an awesome sample test description."


def test_extract_meta_description_og_fallback(extractor: HTMLExtractor):
    og_html = "<html><head><meta property='og:description' content='Social summary'></head></html>"
    soup = extractor._get_soup(og_html)
    assert extractor.extract_meta_description(soup) == "Social summary"


def test_extract_headings(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    headings = extractor.extract_headings(soup)

    assert len(headings) == 4
    assert headings[0].level == 1
    assert headings[0].text == "Main Heading 1"
    assert headings[1].level == 2
    assert headings[1].text == "Subheading 2.1"
    assert headings[2].level == 2
    assert headings[2].text == "Subheading 2.2"
    assert headings[3].level == 3
    assert headings[3].text == "Sub-subheading 3.1"


def test_extract_paragraphs(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    paragraphs = extractor.extract_paragraphs(soup)

    # Empty paragraph should be ignored
    assert len(paragraphs) == 2
    assert paragraphs[0] == "This is the first paragraph with interesting information."
    assert "internal relative link" in paragraphs[1]


def test_extract_links(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    links = extractor.extract_links(soup, base_url="https://example.com/subpath/")

    # Should resolve relative link, keep external link, and ignore anchor/js/mailto
    assert len(links) == 2
    hrefs = [item.href for item in links]
    assert "https://example.com/internal/page" in hrefs
    assert "https://external.org/test" in hrefs


def test_extract_images(extractor: HTMLExtractor):
    soup = extractor._get_soup(SAMPLE_HTML)
    images = extractor.extract_images(soup, base_url="https://example.com/")

    # Should resolve relative image, keep absolute, ignore data URI, and capture no-alt
    assert len(images) == 3
    srcs = [img.src for img in images]
    assert "https://example.com/images/logo.png" in srcs
    assert "https://cdn.example.com/banner.jpg" in srcs
    assert "https://example.com/images/no-alt.webp" in srcs

    # Check alt texts
    logo_img = next(img for img in images if "logo.png" in img.src)
    assert logo_img.alt == "Company Logo"

    no_alt_img = next(img for img in images if "no-alt.webp" in img.src)
    assert no_alt_img.alt == ""


def test_extract_all_complete_model(extractor: HTMLExtractor):
    scraped = extractor.extract_all(
        html=SAMPLE_HTML,
        original_url="https://example.com",
        final_url="https://example.com/home",
        status_code=200,
        include_html=True,
    )

    assert isinstance(scraped, ScrapedData)
    assert scraped.url == "https://example.com"
    assert scraped.final_url == "https://example.com/home"
    assert scraped.title == "Sample Test Webpage"
    assert scraped.status_code == 200
    assert scraped.raw_html is not None

    clean_dict = scraped.to_clean_dict(include_html=True)
    assert clean_dict["url"] == "https://example.com"
    assert clean_dict["final_url"] == "https://example.com/home"
    assert len(clean_dict["headings"]) == 4
    assert len(clean_dict["paragraphs"]) == 2
    assert "timestamp" in clean_dict
