# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Sharers:** anyone who wants a note that looks typed on a real machine, to download and post or send.
- **Writers and journalers:** people who want a calm, focused place to write one page at a time.

## Product Purpose

TypeWrite is a typewriter you use in the browser (and, from the same repository, a native iPhone app). Every key clacks, the bell rings near the margin, the type guide slides along a steel rod, and the ink sits in aged paper like the real thing. The look follows the Platen reel that inspired it. Success for the web version is that people type a sheet and download it, as a picture of the page or as plain text.

## Positioning

The machine's behaviour is the product, not a typewriter font on a text box. There is a type guide that steps one cell per key along a rod, a paper roll that feeds a line at every Return, a margin bell, a fixed 30-column pitch with word wrap, per-letter ink that never changes once struck, and the sounds of real manual typewriters (credited recordings). The page is drawn in three.js (aged paper, ribbon weave, key dents, a desk lamp), and the downloaded sheet is drawn by the same shader.

## Operating Context

- Used on laptops and phones, often in short sessions: one note, one page, one download.
- Sheets are kept in the browser that typed them; there is no account and no sync.
- The iPhone app is the second option, installed with one Terminal line on a Mac (`install.sh`).

## Capabilities and Constraints

- Four papers (old paper, bond, kraft, onionskin), four ribbons, two typefaces (Pica: Courier Prime; Elite: Special Elite), five vector pressed flowers, a desk lamp.
- The paper is 80% of the window's width at every size (Boss's call). It falls back to a flat 2D drawing without WebGL.
- Download as PNG (the whole sheet at up to 3x) and as .txt.
- Sound is **on by default**: the clack is the point. It can be muted.
- **Free, no ads.** Nothing to buy.
- Hosted on GitHub Pages from the repository root (`index.html`); assets are served from the iOS project folder (`TypeWrite/Resources`).
- Undecided: whether the web version ever syncs sheets between devices.

## Brand Commitments

- Name: **TypeWrite by Jericho**.
- Mark: the Jericho petal mark (eight quarter-circle leaves), drawn as vector only. The app icon is the mark in ink black on cream old paper, in a rounded square, with a smooth finish.
- Same rules, look and sounds on web and iPhone.

## Evidence on Hand

- Synthesized sounds: `TypeWrite/Resources/Sounds/*.wav` (made by `Tools/make_sounds.py`).
- Typefaces with licences: `TypeWrite/Resources/Fonts/`.
- Vector icon and tile: `Branding/AppIcon.svg`, `Branding/JerichoTile.svg`.
- No testimonials, users, press or usage numbers exist. None may be invented.

## Product Principles

1. The machine leads. The paper and the strike point are the screen; everything else stays out of the way.
2. Keep every sheet. Nothing typed is lost to a reload, and leaving with a download is always one click away.
3. Feel before features. Sound, touch and motion land on the same frame as the keystroke.
4. The sheet on screen is the sheet you download.
