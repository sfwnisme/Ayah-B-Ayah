# Converts the source KFGQPC Uthman Taha Naskh TTF into the woff2 that the
# popup actually loads. Build-time only; the TTF is never shipped.
# Font source: King Fahd Glorious Quran Printing Complex,
# https://fonts.qurancomplex.gov.sa/nashkh-font/
# Usage: python3 scripts/convert-font.py   (needs: pip install fonttools brotli)
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_DIR = Path(__file__).resolve().parent.parent / "fonts"
SRC = FONT_DIR / "UthmanTN_v2-0.ttf"
DEST = FONT_DIR / "uthman-taha-naskh.woff2"

font = TTFont(SRC)
font.flavor = "woff2"
font.save(DEST)
print(f"{DEST.name}: {DEST.stat().st_size // 1024} KB")
