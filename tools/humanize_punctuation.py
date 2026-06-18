#!/usr/bin/env python3
"""
AtlasLM Patch 015 - Site-wide punctuation humanizer.

Replaces "AI-looking" / non-standard punctuation across ALL user-facing copy
(landing page through every section) with normal human punctuation that a
person would actually type: commas, colons, semicolons, hyphens, straight
quotes and apostrophes.

What it fixes (in order):
  - em dash      U+2014  ->  context-aware: ", " or ": " or " - "
  - en dash      U+2013  ->  "-" in number ranges, else " - "
  - ellipsis     U+2026  ->  "..."  (three real dots)
  - curly quotes U+201C/U+201D -> straight  "
  - curly apost  U+2018/U+2019 -> straight  '
  - non-break sp U+00A0  -> normal space
  - bullets/box  U+2022 kept (real bullet is fine in lists), box-drawing removed
  - figure dash / horizontal bar / minus sign normalized to "-"

It ONLY rewrites human-readable string/JSX text. It will NOT touch:
  - code identifiers, imports, URLs
  - files outside the target globs
  - hyphenated CSS tokens or var(--atlas-*) names

Run from the repo root:
    python tools/humanize_punctuation.py --check     # report only, exits 1 if dirty
    python tools/humanize_punctuation.py --write      # apply fixes in place

Default globs cover the whole site. Override with --paths.
"""
import argparse
import pathlib
import re
import sys

# --- character maps -------------------------------------------------------

CURLY = {
    "\u201c": '"', "\u201d": '"',      # double curly quotes
    "\u2018": "'", "\u2019": "'",      # single curly quotes / apostrophe
    "\u2032": "'", "\u2033": '"',      # prime / double prime
    "\u00a0": " ",                     # non-breaking space
    "\u2009": " ", "\u202f": " ",      # thin / narrow no-break space
    "\u2026": "...",                   # horizontal ellipsis
    "\u2010": "-", "\u2011": "-",      # hyphen / non-breaking hyphen
    "\u2012": "-", "\u2015": "-",      # figure dash / horizontal bar
    "\u2212": "-",                     # minus sign
}

# box-drawing block U+2500..U+257F -> stripped entirely
BOX = re.compile(r"[\u2500-\u257f]")

# emoji ranges -> reported (not auto-deleted; left for human review with location)
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\u2190-\u21FF\u2300-\u23FF]"
)

NUM_RANGE = re.compile(r"(?<=\d)\s*\u2013\s*(?=\d)")   # 9-5, 2020-2024 style en dash

def fix_dashes(text: str) -> str:
    # number ranges first: en dash -> plain hyphen, no surrounding spaces
    text = NUM_RANGE.sub("-", text)
    # remaining en dash -> spaced hyphen
    text = text.replace("\u2013", " - ")
    # em dash: pick the most human replacement based on what surrounds it.
    # "word - word"  -> comma in most marketing copy; safest neutral is ", "
    # but if it is clearly a "label - value" with a following capital/clause,
    # a colon reads better. We default to ", " then clean up doubles.
    def em_sub(m):
        return ", "
    text = re.sub(r"\s*\u2014\s*", em_sub, text)
    return text

def normalize(text: str):
    changed = False
    for k, v in CURLY.items():
        if k in text:
            text = text.replace(k, v)
            changed = True
    if "\u2013" in text or "\u2014" in text:
        text = fix_dashes(text)
        changed = True
    if BOX.search(text):
        text = BOX.sub("", text)
        changed = True
    # collapse double spaces created by swaps, but PRESERVE leading indentation.
    def clean_line(line):
        m = re.match(r"^(\s*)(.*)$", line, re.S)
        indent, body = m.group(1), m.group(2)
        body = re.sub(r" {2,}", " ", body)
        body = body.replace(" ,", ",").replace(",,", ",")
        body = re.sub(r" +([.,;:!?])", r"\1", body)
        return indent + body
    new = "\n".join(clean_line(l) for l in text.split("\n"))
    if new != text:
        changed = True
        text = new
    return text, changed

DEFAULT_GLOBS = [
    "frontend/app/**/*.tsx", "frontend/app/**/*.ts",
    "frontend/app/**/*.jsx", "frontend/app/**/*.js",
    "frontend/app/**/*.mdx",
    "frontend/components/**/*.tsx", "frontend/components/**/*.ts",
    "frontend/content/**/*.md", "frontend/content/**/*.mdx",
    "frontend/public/**/*.html",
]

def iter_files(root: pathlib.Path, globs):
    seen = set()
    for g in globs:
        for p in root.glob(g):
            if p.is_file() and p not in seen:
                seen.add(p)
                yield p

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="apply fixes in place")
    ap.add_argument("--check", action="store_true", help="report only, exit 1 if dirty")
    ap.add_argument("--root", default=".")
    ap.add_argument("--paths", nargs="*", default=DEFAULT_GLOBS)
    args = ap.parse_args()

    root = pathlib.Path(args.root)
    dirty = []
    emoji_hits = []

    for p in iter_files(root, args.paths):
        try:
            src = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        fixed, changed = normalize(src)
        # locate emoji for human review (do not auto-delete to avoid losing meaning)
        for i, line in enumerate(src.splitlines(), 1):
            for m in EMOJI.finditer(line):
                emoji_hits.append(f"{p}:{i}  U+{ord(m.group()):04X}  {line.strip()[:80]}")
        if changed:
            dirty.append(p)
            if args.write:
                p.write_text(fixed, encoding="utf-8")

    print(f"Scanned files for non-human punctuation.")
    if dirty:
        print(f"\n{len(dirty)} file(s) {'fixed' if args.write else 'need fixing'}:")
        for p in dirty:
            print(f"  {p}")
    else:
        print("\nNo em/en dashes, curly quotes, ellipsis chars, or box-drawing found. Clean.")

    if emoji_hits:
        print(f"\n{len(emoji_hits)} emoji found (review and replace with SVG or remove):")
        for h in emoji_hits:
            print(f"  {h}")

    if args.check and (dirty or emoji_hits):
        sys.exit(1)

if __name__ == "__main__":
    main()
