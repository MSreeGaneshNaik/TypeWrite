"""Writes TypeWrite's vector icons: the iOS app icon and the Jericho tile.

The Jericho mark in ink black on cream old paper, with a smooth finish.
Pure vector: paths, circles, gradients and clip paths. No filters, no bitmaps.
  - Old paper: a warm cream body that darkens with age toward the edges,
    soft foxing spots, and fine specks and fibres drawn as tiny shapes.
  - The mark: ink black with a faint lacquer sheen and a lit inner rim.

Usage: python3 Tools/make_icons.py Branding
"""
import os
import random
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."

# The Jericho mark: eight quarter-circle leaves in a 448 square at (288, 288).
# Middle petals that touch edge-to-edge are drawn as one cup each, so the
# shared edge can't show up as a seam (anti-aliasing or rim light).
TOP = ("M288 288A112 112 0 0 1 400 400L400 512A112 112 0 0 1 288 400Z"
       "M400 288A112 112 0 0 1 512 400A112 112 0 0 1 624 288L624 400A112 112 0 0 1 512 512A112 112 0 0 1 400 400Z"
       "M736 288A112 112 0 0 0 624 400L624 512A112 112 0 0 0 736 400Z")
BOTTOM = ("M288 736A112 112 0 0 0 400 624L400 512A112 112 0 0 0 288 624Z"
          "M400 736A112 112 0 0 0 512 624A112 112 0 0 0 624 736L624 624A112 112 0 0 0 512 512A112 112 0 0 0 400 624Z"
          "M736 736A112 112 0 0 1 624 624L624 512A112 112 0 0 1 736 624Z")


def row_gradients(name, y0, y1):
    return f"""
    <linearGradient id="{name}Body" gradientUnits="userSpaceOnUse" x1="0" y1="{y0}" x2="0" y2="{y1}">
      <stop offset="0" stop-color="#2B2723"/><stop offset=".5" stop-color="#1A1714"/><stop offset="1" stop-color="#0D0B09"/>
    </linearGradient>
    <linearGradient id="{name}Gloss" gradientUnits="userSpaceOnUse" x1="0" y1="{y0}" x2="0" y2="{y1}">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".3" stop-color="#FFFFFF" stop-opacity=".04"/><stop offset=".46" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="{name}Rim" gradientUnits="userSpaceOnUse" x1="0" y1="{y0}" x2="0" y2="{y1}">
      <stop offset="0" stop-color="#FFF6E4" stop-opacity=".28"/><stop offset=".45" stop-color="#FFF6E4" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".3"/>
    </linearGradient>
    <clipPath id="{name}Clip"><path d="{TOP if name == 'top' else BOTTOM}"/></clipPath>"""


def mark():
    # Soft warm shadow: stacked translucent offset copies instead of a blur filter.
    shadow = "".join(
        f'<g fill-opacity="{a}" transform="translate(0 {dy})"><path d="{TOP}"/><path d="{BOTTOM}"/></g>'
        for dy, a in [(2, ".05"), (5, ".04"), (9, ".03"), (14, ".022"), (20, ".014")]
    )
    rows = ""
    for name, d in [("top", TOP), ("bottom", BOTTOM)]:
        rows += f"""
    <path fill="url(#{name}Body)" d="{d}"/>
    <path fill="url(#{name}Gloss)" d="{d}"/>
    <g clip-path="url(#{name}Clip)"><path d="{d}" fill="none" stroke="url(#{name}Rim)" stroke-width="5"/></g>"""
    return f'<g fill="#4A3826">{shadow}</g>{rows}'


GRADIENTS = row_gradients("top", 288, 512) + row_gradients("bottom", 512, 736)

PAPER_DEFS = """
    <radialGradient id="paper" gradientUnits="userSpaceOnUse" cx="512" cy="430" r="760">
      <stop offset="0" stop-color="#F7EFDD"/><stop offset=".55" stop-color="#EFE3C8"/><stop offset=".85" stop-color="#E3D2AE"/><stop offset="1" stop-color="#D3BE95"/>
    </radialGradient>
    <radialGradient id="fox" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#A9824D" stop-opacity=".16"/><stop offset=".6" stop-color="#A9824D" stop-opacity=".06"/><stop offset="1" stop-color="#A9824D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="560">
      <stop offset="0" stop-color="#FFFDF6" stop-opacity=".55"/><stop offset=".6" stop-color="#FFFDF6" stop-opacity=".12"/><stop offset="1" stop-color="#FFFDF6" stop-opacity="0"/>
    </linearGradient>"""


def aging(x0, y0, size, seed=1924):
    """Foxing spots, specks and fibres for a paper square, all as vector shapes."""
    rng = random.Random(seed)
    parts = []
    # Foxing: soft brown blooms, mostly toward the edges and corners.
    for _ in range(9):
        edge = rng.random() < 0.75
        if edge:
            side = rng.choice("tblr")
            t = rng.uniform(0.05, 0.95)
            cx = x0 + (t * size if side in "tb" else (rng.uniform(0, 0.16) if side == "l" else rng.uniform(0.84, 1)) * size)
            cy = y0 + (t * size if side in "lr" else (rng.uniform(0, 0.16) if side == "t" else rng.uniform(0.84, 1)) * size)
        else:
            cx, cy = x0 + rng.uniform(0.1, 0.9) * size, y0 + rng.uniform(0.1, 0.9) * size
        r = rng.uniform(18, 70) * size / 1024
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#fox)"/>')
    # Specks of pulp.
    for _ in range(170):
        cx, cy = x0 + rng.random() * size, y0 + rng.random() * size
        r = rng.uniform(0.6, 2.0) * size / 1024
        a = rng.uniform(0.08, 0.24)
        parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.2f}" fill="#6F5A40" fill-opacity="{a:.2f}"/>')
    # Fibres.
    for _ in range(46):
        sx, sy = x0 + rng.random() * size, y0 + rng.random() * size
        length = rng.uniform(10, 34) * size / 1024
        ang = rng.uniform(0, 6.283)
        import math
        ex, ey = sx + math.cos(ang) * length, sy + math.sin(ang) * length
        bend = rng.uniform(-6, 6) * size / 1024
        mx = (sx + ex) / 2 - math.sin(ang) * bend
        my = (sy + ey) / 2 + math.cos(ang) * bend
        parts.append(f'<path d="M{sx:.1f} {sy:.1f}Q{mx:.1f} {my:.1f} {ex:.1f} {ey:.1f}" fill="none" '
                     f'stroke="#8A7253" stroke-opacity="{rng.uniform(0.08, 0.16):.2f}" stroke-width="{rng.uniform(0.9, 1.6):.1f}" stroke-linecap="round"/>')
    return "".join(parts)


def app_icon():
    """iOS: full bleed, because iOS draws its own rounded mask."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="TypeWrite by Jericho: black Jericho petal mark on cream old paper">
  <!-- Pure vector: paths, circles, gradients and clip paths only. Generated by Tools/make_icons.py. -->
  <defs>{PAPER_DEFS}{GRADIENTS}
  </defs>
  <rect width="1024" height="1024" fill="url(#paper)"/>
  {aging(0, 0, 1024)}
  <path d="M0 0H1024V470C780 560 244 560 0 470Z" fill="url(#sheen)"/>
  <g transform="translate(512 512) scale(1.24) translate(-512 -512)">
    {mark()}
  </g>
</svg>
"""


def tile():
    """A rounded tile with a soft shadow, for the README and other branding."""
    shade = "".join(
        f'<rect x="{100 - g}" y="{100 - g + dy}" width="{824 + 2 * g}" height="{824 + 2 * g}" rx="{184 + g}" fill-opacity="{a}"/>'
        for g, dy, a in [(2, 6, ".04"), (6, 10, ".032"), (11, 16, ".024"), (17, 24, ".016"), (24, 34, ".01")]
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-label="Jericho petal mark: black petals on a cream old-paper tile">
  <!-- Pure vector: paths, circles, gradients and clip paths only. Generated by Tools/make_icons.py. -->
  <defs>{PAPER_DEFS}
    <linearGradient id="edge" x1="0" y1="110" x2="0" y2="914" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFBF0" stop-opacity=".9"/><stop offset=".5" stop-color="#FFFBF0" stop-opacity=".15"/><stop offset="1" stop-color="#9C8660" stop-opacity=".45"/>
    </linearGradient>
    <clipPath id="face"><rect x="100" y="100" width="824" height="824" rx="184"/></clipPath>{GRADIENTS}
  </defs>
  <g fill="#2A1E10">{shade}</g>
  <g clip-path="url(#face)">
    <rect x="100" y="100" width="824" height="824" fill="url(#paper)"/>
    {aging(100, 100, 824)}
    <path d="M100 100H924V500C730 570 294 570 100 500Z" fill="url(#sheen)"/>
  </g>
  <rect x="102" y="102" width="820" height="820" rx="182" fill="none" stroke="url(#edge)" stroke-width="4"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="183.5" fill="none" stroke="#3A2A16" stroke-opacity=".12"/>
  {mark()}
</svg>
"""


with open(f"{OUT}/AppIcon.svg", "w") as f:
    f.write(app_icon())
with open(f"{OUT}/JerichoTile.svg", "w") as f:
    f.write(tile())
print("wrote AppIcon.svg and JerichoTile.svg")

# The Mac app's icon: macOS doesn't round icons for you (iOS does), so the Mac sizes come from
# the rounded tile, which already follows Apple's macOS grid (824 px body, 100 px margin).
import json, shutil, subprocess
iconset = os.path.join(os.path.dirname(os.path.abspath(OUT)), "TypeWrite", "Assets.xcassets", "AppIcon.appiconset")
if shutil.which("rsvg-convert") and os.path.isdir(iconset):
    images = [{"filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}]
    for points in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = points * scale
            name = f"mac-{points}@{scale}x.png"
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "-o", os.path.join(iconset, name), f"{OUT}/JerichoTile.svg"], check=True)
            images.append({"filename": name, "idiom": "mac", "scale": f"{scale}x", "size": f"{points}x{points}"})
    with open(os.path.join(iconset, "Contents.json"), "w") as f:
        json.dump({"images": images, "info": {"author": "xcode", "version": 1}}, f, indent=2)
        f.write("\n")
    subprocess.run(["rsvg-convert", "-w", "1024", "-h", "1024", "-o", f"{OUT}/JerichoTile.png", f"{OUT}/JerichoTile.svg"], check=True)
    print("wrote the Mac icon sizes and JerichoTile.png")
