#!/usr/bin/env python3
"""Fetch bank logos from IranianBankLogos; knock out baked-in white backgrounds."""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "banks"
DEST.mkdir(parents=True, exist_ok=True)

IBL_BASE = (
    "https://cdn.jsdelivr.net/gh/amastaneh/IranianBankLogos@master/resources/images"
)

# bankId -> (stem, suffix)  suffix: wc | tc (transparent, only refah)
IBL_MAP: dict[str, tuple[str, str]] = {
    "melli": ("bmi", "wc"),
    "mellat": ("mellat", "wc"),
    "tejarat": ("tejarat", "wc"),
    "saderat": ("bsi", "wc"),
    "sepah": ("sepah", "wc"),
    "keshavarzi": ("bki", "wc"),
    "maskan": ("maskan", "wc"),
    "refah": ("rb", "tc"),
    "postbank": ("post", "wc"),
    "sanat_madan": ("ba", "wc"),
    "tosee_taavon": ("tt", "wc"),
    "saman": ("sb", "wc"),
    "pasargad": ("bpi", "wc"),
    "parsian": ("parsian", "wc"),
    "eghtesad_novin": ("en", "wc"),
    "shahr": ("shahr", "wc"),
    "dey": ("day", "wc"),
    "sina": ("sina", "wc"),
    "karafarin": ("kar", "wc"),
    "gardeshgari": ("tourism", "wc"),
    "iran_zamin": ("iz", "wc"),
    "iran_venezuela": ("ivbb", "wc"),
    "resalat": ("resalat", "wc"),
    "mehr_iran": ("mehriran", "wc"),
    "ghavamin": ("ghbi", "wc"),
    "ansar": ("ansar", "wc"),
    "hekmat": ("hi", "wc"),
    "mehr_eghtesad": ("me", "wc"),
}


def knock_out_white(path: Path, tolerance: int = 32) -> None:
    """Make near-white pixels transparent (IBL wc assets are PNG24 on white)."""
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    t = 255 - tolerance
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= t and g >= t and b >= t:
                px[x, y] = (r, g, b, 0)
    img.save(path, optimize=True)


def main() -> None:
    for bank_id, (stem, suffix) in IBL_MAP.items():
        out = DEST / f"{bank_id}.png"
        tmp = DEST / f".{bank_id}.dl.png"
        subprocess.run(
            [
                "curl",
                "-fsSL",
                f"{IBL_BASE}/{stem}-300-{suffix}.png",
                "-o",
                str(tmp),
            ],
            check=True,
        )
        subprocess.run(["sips", "-Z", "256", str(tmp)], check=True, capture_output=True)
        if suffix == "wc":
            knock_out_white(tmp)
        tmp.replace(out)
        print(f"ok {bank_id}")


if __name__ == "__main__":
    main()
