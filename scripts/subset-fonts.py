"""Regenerate the embedded font subsets in assets/fonts.

One-off tool, run locally when the glyph set or weights change:
    python3 scripts/subset-fonts.py
Needs fontTools and the system fonts Adwaita Sans and JetBrains Mono.
"""

from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"
ADWAITA = "/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf"
JETBRAINS = "/usr/share/fonts/TTF/JetBrainsMono-Regular.ttf"

# Printable ASCII plus the few typographic marks the SVGs use.
TEXT = "".join(chr(c) for c in range(0x20, 0x7F)) + "·–—’→"

FONTS = {
    "display": (ADWAITA, {"opsz": 32, "wght": 500}),
    "text": (ADWAITA, {"opsz": 14, "wght": 400}),
    "mono": (JETBRAINS, None),
}


def subset(src, axes, dest):
    font = TTFont(src)
    if axes:
        font = instantiateVariableFont(font, axes)
    options = Options()
    options.flavor = "woff"
    options.layout_features = ["kern", "liga", "calt", "tnum"]
    options.name_IDs = []
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(text=TEXT)
    subsetter.subset(font)
    font.flavor = "woff"
    font.save(dest)
    print(f"{dest.name}: {dest.stat().st_size // 1024} KiB")


OUT.mkdir(parents=True, exist_ok=True)
for name, (src, axes) in FONTS.items():
    subset(src, axes, OUT / f"{name}.woff")
