---
name: TypeWrite
description: A typewriter in the browser, drawn in three.js. Aged paper, cloth-ribbon ink, a steel rod and a sliding type guide.
colors:
  desk: "#161514"
  surface: "#F2F1EE"
  raised: "#E6E4DF"
  rule: "#DAD7D0"
  control: "#C9C5BC"
  text: "#23211E"
  muted: "#55504A"
  faint: "#6A645B"
  primary: "#23211E"
  primary-hover: "#3A3733"
  on-primary: "#F2F1EE"
  hud-on-paper: "#3A3733"
  hud-on-desk: "#D6D2C9"
  focus: "#A06A1C"
  alarm: "#B23A2C"
  paper-old: "#ECE7DB"
  paper-bond: "#EFEDE7"
  paper-kraft: "#CFB58D"
  paper-onionskin: "#E4E2D8"
  ink-black: "#2A2725"
  ink-red: "#9C2B22"
  ink-blue: "#28346E"
  ink-worn: "#5A4636"
  guide-cream: "#F1EDE4"
  rod-steel: "#5D6168"
  platen-rubber: "#121110"
  lamp-key: "#3DFF7A"
  lamp-space: "#FFC23D"
  lamp-delete: "#FF4438"
typography:
  wordmark:
    fontFamily: "Special Elite, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: "24px"
  type-pica:
    fontFamily: "Courier Prime, ui-monospace, monospace"
    fontSize: "17pt × zoom"
  type-elite:
    fontFamily: "Special Elite, ui-monospace, monospace"
    fontSize: "15.5pt × zoom"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  count:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    lineHeight: "16px"
    fontFeature: "tnum"
rounded:
  tile: "10px"
  panel: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  dock:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "6px"
  dock-button:
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    size: "44px"
  dock-button-pressed:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  hud-button:
    textColor: "{colors.hud-on-paper}"
    rounded: "{rounded.pill}"
    size: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  option-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.tile}"
    padding: "13px 16px"
  option:
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "13px 16px"
  toast:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
---

# Design System: TypeWrite

## Overview

**Creative North Star: "A machine on a dark desk"**

The window is a desk at night. One sheet sits in the machine, lit softly from above. The type guide slides along a steel rod as you type, and the paper rolls up a line at every Return. Everything else is quiet chrome that floats over the page: a back arrow, a character count and a share button at the top, and one light pill dock at the bottom. The look follows the Platen reel that inspired it, made in our own code. The paper is never a flat colour: it has fibres, specks, foxing and browned edges, and every letter shows the ribbon's weave and the dent its key left.

The paper takes 80% of the window's width at every size. Type scales with it, so a laptop shows a close-up of the page: about seven lines above the strike line. A phone shows most of a sheet.

**Key Characteristics:**
- The page and the machine are the screen. The chrome is small, light and floats over the page.
- The paper stays put sideways and the guide moves (the reel's model). The strike line sits just above the dock, between 50% and 76% of the visible height.
- Everything on the page is seeded per sheet, so a letter or a fox spot never changes once it exists.
- The desk lamp is the one dramatic moment: the room goes dark and the guide throws warm light up the page.

## Colors

The desk is a neutral near-black. The chrome is a near-neutral light grey that never reads as yellow, because the paper owns the cream.

- **Desk** (#161514): behind the page; also the HUD's light colour (#D6D2C9) when an icon sits over it.
- **Surface / Raised / Rule** (#F2F1EE / #E6E4DF / #DAD7D0): the dock, panels and toasts; the hover and selected fill; dividers and outlines.
- **Text tiers** (#23211E / #55504A / #6A645B): primary, secondary and meta. Each is at least 4.5:1 on the surface.
- **Primary** (#23211E): the one filled action in a panel ("Picture of the sheet"), switches when on, the pressed desk lamp, and the toast.
- **Focus** (#A06A1C): focus rings only.
- **Alarm** (#B23A2C): throwing a sheet away.
- **Radium lamps** (#3DFF7A / #FFC23D / #FF4438): the guide's three lamps are signals, not chrome. They glow faintly at rest and flare with a halo when they fire: green on every key and Return, amber on space, red on delete.
- **Papers and ribbons** are data, not chrome. They are used only on the page and in the pickers.

## Typography

- **The page:** Courier Prime (Pica) or Special Elite (Elite), at a fixed pitch of 10.2 pt and a 26 pt line, scaled by the zoom.
- **The wordmark:** Special Elite, "TypeWrite" in the sheets panel masthead, beside "by Jericho" in the label style.
- **Chrome:** the system face, at 15/600 for panel titles, 14 for body and buttons, and 12 for labels and sublines. Labels are sentence case and never tracked capitals.
- **The count:** monospace with tabular figures and a typewriter-era thousands mark: `175 / 40'000`.

## Layout

- **Page:** 358 × 463 pt (US letter proportions), 30 columns, side margin 26 pt, top margin 70 pt (138 pt with a pressed flower). On screen the paper always runs past the bottom of the window. The download keeps the page size.
- **Strike line:** placed from the bottom of the visual viewport so the guide clears the dock (`strikeLine()`: the guide's depth plus 104 px above the bottom, held between 50% and 76% of the height). It moves above a phone keyboard. Rod centre 42 pt below the baseline. Guide capsule 82 × 27 pt with a dark glass bezel holding the three lamps 10.5 pt apart. The T pointer sits 7 pt under the baseline.
- **HUD:** 60 px high, 10 px side inset, 44 px targets. Each side picks its colour from what is behind it (page or desk).
- **Dock:** centred, 18 px above the safe area. It slides away while typing.
- **Panels:** popovers anchored to their button on screens 720 px and wider; full-width bottom sheets with a grabber below that.

## Elevation & Depth

Depth is physical, not decorative:
- **The page:** a perspective camera (30° FOV, positioned so the plane z = 0 maps exactly at the zoom). The sheet bows 9 pt and its top edge curls 44 pt away, which gives the reel's arched top edge and darker sides.
- **Platen:** 24 pt below the baseline the sheet wraps over a rubber roller (radius 44 pt). Lines that roll over it darken as they turn away from the light.
- **Light:** a soft key light from above-left on the bump of the paper tooth and the key dents, plus a screen vignette at the top and sides. The rod and guide cast a band of shade on the page.
- **Desk lamp:** ambient and key light drop to about 10%, and a warm point at the guide lights a pool and an upward beam.
- **Floating chrome:** the dock, popovers, sheets and toast carry a real shadow because they float. Nothing resting has one.

## Shapes

- Pills (999 px) for the dock, its buttons, HUD buttons, the toast and the type guide.
- 18 px for panels and 10 px for tiles, options and list rows.
- Paper chips and ribbon chips are 40 px circles drawn on the paper itself.
- The page edges are worn: an anti-aliased, noise-driven edge of about ±0.3 pt.

## Components

- **Paper shader (`PAPER_FS`):** fbm mottling, tooth, fibres, sparse specks, foxing (reddish-brown spots with a darker core), edge browning scaled by age, and laid and chain lines for old paper. Ink comes from a canvas texture:
  - Alpha is the letter shape and green is strike strength.
  - Ragged edges come from thresholding against fibre noise.
  - Light strikes break up, and a 45° ribbon weave shows when there are at least 1.4 px per point.
  - A faint halo shows ink wicking into the fibres.
  - Letters dent the bump map.
- **Per-strike look (`glyphLook`):**
  - Position jitter, tilt and strength come from the engine.
  - About 28% of strikes are "off their feet", printing lighter on one side.
  - 5% have clogged counters, and 1.8% leave a faint double strike.
  - The ribbon wears slowly across the sheet, and punctuation strikes hard.
- **Ink texture:** a window of the sheet up to 4,096 px tall around the view. Typing re-inks only the touched lines with a direct `texSubImage2D` band upload. The window recentres when the view leaves it.
- **Dock:** new sheet, typeface, pressed flower, paper, ribbon | desk lamp, key sounds. Icon-only with names on hover and for screen readers.
- **Panels:** springs (opening response 0.32 to 0.44 s, damping 0.86 to 0.88; closing critically damped). Phone sheets drag from the grabber, rubber-band upwards, and dismiss on projected travel past half their height. The scrim follows the drag.
- **Reading back:** drag with rubber-banding past either end. On release the page coasts with UIScrollView's 0.998/ms deceleration, and a spring takes over at the ends with the coast's speed. Wheel, arrows, Page Up/Down, Home and End also scroll. Rolling by hand gives a ratchet click (and a haptic tap) for every line that passes the strike line.
- **Download:** the same shader renders flat and evenly lit in 2,048 px bands, as a PNG with a transparent outside edge.

## Do's and Don'ts

- **Do** keep the paper at 80% of the window width and the strike line just above the dock.
- **Do** seed anything that appears on the page from the sheet's seed and the character index.
- **Do** keep chrome light and floating. Its colour follows what is behind it.
- **Don't** use the typewriter faces for controls. They are for the page and the wordmark.
- **Don't** give resting elements shadows or gradients. Depth belongs to the page, the rod and the guide.
- **Don't** add yellow cream to the chrome. The paper owns it.
- **Don't** let the download differ from the screen beyond lighting: one shader draws both.
