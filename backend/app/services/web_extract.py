"""
AtlasLM website content extraction (Patch 004).

Replaces the naive regex tag-strip with proper main-content extraction:
- Parses HTML with BeautifulSoup (lxml).
- Removes boilerplate elements (nav, footer, header, aside, script,
  style, forms, cookie banners, social widgets).
- Locates the main content container via semantic tags first
  (<article>, <main>, role=main), falling back to text-density scoring.
- Preserves heading structure and paragraph boundaries so chunking
  produces coherent, citable sections.

Output format matches the other parsers: list of
{"page_number": N, "content": str} sections, split per top-level
heading group so citations render as meaningful "Section N" chips.
"""

import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger("atlaslm.ingestion")

# Elements that are never content.
_STRIP_TAGS = [
    "script", "style", "noscript", "iframe", "svg", "canvas",
    "nav", "footer", "header", "aside", "form", "button",
    "input", "select", "textarea", "video", "audio",
]

# id/class fragments that mark boilerplate containers.
_BOILERPLATE_RE = re.compile(
    r"(cookie|consent|banner|sidebar|footer|header|nav(bar|igation)?|"
    r"menu|social|share|subscribe|newsletter|advert|promo|popup|modal|"
    r"breadcrumb|pagination|related|comment)",
    re.IGNORECASE,
)

_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_BLOCK_TAGS = {"p", "li", "td", "th", "blockquote", "pre", "figcaption", "dd", "dt"}

MAX_SECTION_CHARS = 6000  # safety split for very long sections


def extract_text_from_html(html: str, url: str) -> List[Dict[str, Any]]:
    """
    Extract readable main content from an HTML page.
    Raises ValueError when no meaningful content can be extracted.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError as e:
        raise ValueError("Website extraction is not available on this server.") from e

    logger.info("Starting HTML extraction: %s (%d chars)", url, len(html))

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    page_title = ""
    if soup.title and soup.title.string:
        page_title = soup.title.string.strip()

    # 1. Strip non-content elements outright.
    for tag in soup.find_all(_STRIP_TAGS):
        tag.decompose()

    # 2. Strip containers whose id/class look like boilerplate,
    #    unless they hold the bulk of the page text (false-positive guard).
    total_len = len(soup.get_text(" ", strip=True)) or 1
    for el in soup.find_all(attrs={"class": _BOILERPLATE_RE}):
        if len(el.get_text(" ", strip=True)) / total_len < 0.4:
            el.decompose()
    for el in soup.find_all(attrs={"id": _BOILERPLATE_RE}):
        if len(el.get_text(" ", strip=True)) / total_len < 0.4:
            el.decompose()

    # 3. Find the main content root: semantic tags first.
    root = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
    )
    if root is None or len(root.get_text(" ", strip=True)) < 200:
        # Fallback: highest text-density <div>/<section>.
        best, best_len = None, 0
        for el in soup.find_all(["div", "section"]):
            text_len = sum(
                len(t.get_text(" ", strip=True))
                for t in el.find_all(_BLOCK_TAGS, recursive=False)
            ) + sum(
                len(p.get_text(" ", strip=True)) for p in el.find_all("p")
            )
            if text_len > best_len:
                best, best_len = el, text_len
        root = best if best is not None and best_len > 100 else soup.body or soup

    # 4. Walk the root, emitting headings + block text in document order,
    #    grouped into sections at h1/h2 boundaries.
    sections: List[List[str]] = []
    current: List[str] = []
    if page_title:
        current.append(page_title)
    current.append(f"Source URL: {url}")

    seen_texts = set()
    for el in root.descendants:
        name = getattr(el, "name", None)
        if name in _HEADING_TAGS:
            text = el.get_text(" ", strip=True)
            if not text or text in seen_texts:
                continue
            seen_texts.add(text)
            if name in ("h1", "h2") and len("\n".join(current)) > 400:
                sections.append(current)
                current = []
            current.append(f"\n{text}")
        elif name in _BLOCK_TAGS:
            # Only take blocks with no block-level children (leaf blocks)
            # to avoid duplicated nested text.
            if el.find(list(_BLOCK_TAGS)) is not None:
                continue
            text = el.get_text(" ", strip=True)
            if not text or len(text) < 3 or text in seen_texts:
                continue
            seen_texts.add(text)
            prefix = "- " if name == "li" else ""
            current.append(prefix + text)

    if current:
        sections.append(current)

    # 5. Build output pages, applying the safety length split.
    pages: List[Dict[str, Any]] = []
    section_num = 1
    for sec in sections:
        content = "\n".join(sec).strip()
        if not content:
            continue
        while len(content) > MAX_SECTION_CHARS:
            cut = content.rfind("\n", 0, MAX_SECTION_CHARS)
            cut = cut if cut > 1000 else MAX_SECTION_CHARS
            pages.append({"page_number": section_num, "content": content[:cut].strip()})
            section_num += 1
            content = content[cut:].strip()
        if content:
            pages.append({"page_number": section_num, "content": content})
            section_num += 1

    meaningful = [p for p in pages if len(p["content"]) > 80]
    if not meaningful:
        raise ValueError(
            f"No readable content could be extracted from {url}. "
            "The page may be JavaScript-rendered or behind a login."
        )

    logger.info("HTML extracted: %s -> %d sections", url, len(pages))
    return pages
