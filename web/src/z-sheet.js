// ---------- Paper texture: a seamless tile of specks, fibres and mottling ----------
function makeGrain() {
  const side = 384, k = 2, c = document.createElement("canvas");
  c.width = c.height = side * k;
  const g = c.getContext("2d"); g.scale(k, k);
  const r = splitmix(0xC1AC5EEDn);
  const wrapped = (x, y, reach, draw) => {
    for (const dx of [-side, 0, side]) for (const dy of [-side, 0, side]) {
      const px = x + dx, py = y + dy;
      if (px + reach < 0 || px - reach > side || py + reach < 0 || py - reach > side) continue;
      draw(px, py);
    }
  };
  for (let i = 0; i < 28; i++) {
    const x = r.unit() * side, y = r.unit() * side, rad = 24 + r.unit() * 60, a = 0.012 + r.unit() * 0.014;
    g.fillStyle = `rgba(107,84,56,${a})`;
    wrapped(x, y, rad, (px, py) => { g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill(); });
  }
  for (let i = 0; i < 2400; i++) {
    const x = r.unit() * side, y = r.unit() * side, rad = 0.2 + r.unit() * 0.7, warm = r.unit(), a = 0.025 + r.unit() * 0.09;
    g.fillStyle = `rgba(${Math.round((0.30 + warm * 0.15) * 255)},${Math.round((0.26 + warm * 0.08) * 255)},51,${a})`;
    wrapped(x, y, rad, (px, py) => { g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill(); });
  }
  g.lineCap = "round"; g.lineWidth = 0.35;
  for (let i = 0; i < 130; i++) {
    const x = r.unit() * side, y = r.unit() * side, len = 4 + r.unit() * 12, ang = r.unit() * Math.PI * 2, bend = (r.unit() * 2 - 1) * 3;
    const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len, cx = ex / 2 - Math.sin(ang) * bend, cy = ey / 2 + Math.cos(ang) * bend;
    g.strokeStyle = `rgba(89,74,54,${0.05 + r.unit() * 0.05})`;
    wrapped(x, y, len, (px, py) => { g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + cx, py + cy, px + ex, py + ey); g.stroke(); });
  }
  return c;
}
// ---------- Pressed flowers, drawn as vector paths ----------
function petal(len, w, round) {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.bezierCurveTo(len * 0.3, -w, len * round, -w * 0.9, len, 0);
  p.bezierCurveTo(len * round, w * 0.9, len * 0.3, w, 0, 0);
  p.closePath();
  return p;
}
function curve(s, c, e) {
  return {
    point: t => { const u = 1 - t; return [u * u * s[0] + 2 * u * t * c[0] + t * t * e[0], u * u * s[1] + 2 * u * t * c[1] + t * t * e[1]]; },
    angle: t => { const u = 1 - t; return Math.atan2(2 * u * (c[1] - s[1]) + 2 * t * (e[1] - c[1]), 2 * u * (c[0] - s[0]) + 2 * t * (e[0] - c[0])); },
    stroke: (g, color, w) => { g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(c[0], c[1], e[0], e[1]); g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.stroke(); },
  };
}
function place(g, path, at, angle, fill, edge, edgeW) {
  g.save(); g.translate(at[0], at[1]); g.rotate(angle);
  if (fill) { g.fillStyle = fill; g.fill(path); }
  if (edge) { g.strokeStyle = edge; g.lineWidth = edgeW || 0.6; g.stroke(path); }
  g.restore();
}
function leaf(g, cv, t, side, len, color, vein, round = 0.62, breadth = 0.28) {
  const base = cv.point(t), angle = cv.angle(t) + Math.PI + side * 0.8;
  place(g, petal(len, len * breadth, round), base, angle, color);
  g.save(); g.translate(base[0], base[1]); g.rotate(angle); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.85, 0); g.strokeStyle = vein; g.lineWidth = 0.7; g.stroke(); g.restore();
}
function disc(g, at, rad, fill, dots, r) {
  g.beginPath(); g.arc(at[0], at[1], rad, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  for (let i = 0; i < 10; i++) {
    const a = r.unit() * Math.PI * 2, d = r.unit() * rad * 0.75;
    g.beginPath(); g.arc(at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d, 0.8, 0, Math.PI * 2); g.fillStyle = dots; g.fill();
  }
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const FLOWER_ART = {
  marigold(g, r) {
    const head = [0, -16], stalk = curve(head, [-10, 18], [8, 50]);
    stalk.stroke(g, "#6E7A42", 2.6);
    leaf(g, stalk, 0.55, 1, 20, "#74833F", "#56622E"); leaf(g, stalk, 0.76, -1, 16, "#74833F", "#56622E");
    for (const ring of [[17, 25, "#D27A27", "#A9561A"], [12, 16, "#E49438", "#B86A1F"]]) {
      const off = r.unit() * Math.PI * 2;
      for (let i = 0; i < ring[0]; i++) {
        const a = off + i / ring[0] * Math.PI * 2 + r.sym(0.06), len = ring[1] * (0.88 + r.unit() * 0.22);
        place(g, petal(len, len * 0.28, 0.95), head, a, rgba(ring[2], 0.85 + r.unit() * 0.15), rgba(ring[3], 0.55));
      }
    }
    disc(g, head, 6, "#7A4216", rgba("#5A3010", 0.8), r);
  },
  rose(g, r) {
    const head = [0, -14], stalk = curve(head, [8, 16], [-4, 50]);
    stalk.stroke(g, "#5C6B3A", 2.4);
    leaf(g, stalk, 0.5, -1, 18, "#63743D", "#46532A", 0.78, 0.42); leaf(g, stalk, 0.72, 1, 15, "#63743D", "#46532A", 0.78, 0.42);
    for (const layer of [[6, 20, 0.62, "#B4464E"], [5, 13, 0.7, "#A23A45"]]) {
      const off = r.unit() * Math.PI * 2;
      for (let i = 0; i < layer[0]; i++) {
        const a = off + i / layer[0] * Math.PI * 2 + r.sym(0.12), len = layer[1] + r.unit() * 4;
        place(g, petal(len, len * layer[2], 0.98), head, a, rgba(layer[3], 0.8), rgba("#8C2F3A", 0.5), 0.5);
      }
    }
    let a = r.unit() * Math.PI * 2, rad = 7.5;
    g.beginPath(); g.moveTo(head[0] + Math.cos(a) * rad, head[1] + Math.sin(a) * rad);
    while (rad > 1) { a += 0.35; rad -= 0.3; g.lineTo(head[0] + Math.cos(a) * rad, head[1] + Math.sin(a) * rad); }
    g.strokeStyle = rgba("#6E2230", 0.85); g.lineWidth = 1.1; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  },
  lavender(g, r) {
    const stalk = curve([-6, -46], [5, 0], [2, 50]);
    stalk.stroke(g, "#76845A", 1.5);
    leaf(g, stalk, 0.72, 1, 24, "#8A9670", "#6B7652", 0.62, 0.14); leaf(g, stalk, 0.8, -1, 21, "#8A9670", "#6B7652", 0.62, 0.14);
    for (let step = 0; step < 13; step++) {
      const t = 0.03 + step * 0.034, p = stalk.point(t), up = stalk.angle(t) + Math.PI, bud = 2.6 + step * 0.11;
      for (const side of [-1, 1]) {
        const tone = (step + side) % 2 === 0 ? "#8C78B6" : "#7A66A7";
        place(g, petal(bud * 2.3, bud * 0.75, 0.9), p, up + side * (0.5 + r.sym(0.12)), rgba(tone, 0.9));
      }
    }
    place(g, petal(6, 2, 0.9), stalk.point(0), stalk.angle(0) + Math.PI, "#8C78B6");
  },
  fern(g, r) {
    const rachis = curve([-4, -48], [10, 0], [4, 50]);
    rachis.stroke(g, "#5E7A40", 1.6);
    for (let t = 0.04; t < 0.9; t += 0.055) {
      const p = rachis.point(t), up = rachis.angle(t) + Math.PI, len = 4 + 22 * Math.pow(t, 0.75);
      for (const side of [-1, 1]) place(g, petal(len, len * 0.2, 0.6), p, up + side * (1.15 + r.sym(0.06)), rgba("#6E8D4C", 0.8 + r.unit() * 0.15));
    }
  },
  daisy(g, r) {
    const head = [0, -14], stalk = curve(head, [-6, 20], [6, 50]);
    stalk.stroke(g, "#6E7D46", 2.2);
    leaf(g, stalk, 0.66, 1, 19, "#75854A", "#56633A");
    const off = r.unit() * Math.PI * 2;
    for (let i = 0; i < 20; i++) {
      const a = off + i / 20 * Math.PI * 2 + r.sym(0.05), len = 22 + r.unit() * 3;
      place(g, petal(len, 4.2, 0.97), head, a, "#F8F4E8", "#CBBFA4", 0.7);
    }
    disc(g, head, 7, "#DDA52C", rgba("#B07C17", 0.8), r);
  },
};
function drawFlower(g, kind, cx, cy, size, rotationDeg, seed) {
  if (kind === "none" || !FLOWER_ART[kind]) return;
  g.save(); g.translate(cx, cy); g.rotate(rotationDeg * Math.PI / 180); g.scale(size / 100, size / 100); g.globalAlpha *= 0.92;
  FLOWER_ART[kind](g, splitmix((BigInt(seed) + 0x5EEDn) & MASK));
  g.restore();
}

// ---------- Drawing a sheet: shared by the machine, the thumbnails and the download ----------
const strikeCache = new Map();
function strikeFor(seed, index) {
  const key = seed + ":" + index;
  let s = strikeCache.get(key);
  if (!s) { s = inkStrike(seed, index); strikeCache.set(key, s); if (strikeCache.size > 120000) strikeCache.clear(); }
  return s;
}
const TITLE_GAP = 46;                               // a title takes about two lines above the first one
const filled = s => !!(s.text.trim() || (s.title || "").trim());
// With a pressed flower the title sits beside it, so the first line stays just under the flower.
function topMargin(s) { return s.flower !== "none" ? TOP_FLOWER : TOP + ((s.title || "").trim() ? TITLE_GAP : 0); }
// The title: a size up, centred in the space it has (the whole line, or beside the flower), shrinking to fit when long.
// Seeded like the letters below it.
function titleLayout(s, face) {
  const chars = graphemes((s.title || "").trim());
  if (!chars.length) return null;
  const flower = s.flower !== "none", right = flower ? PAPER_W - 70 - 60 : PAPER_W - SIDE, width = right - SIDE;
  const adv = Math.min(10.2 * 1.6, width / chars.length), x0 = SIDE + (width - adv * chars.length) / 2;
  return { base: flower ? 66 + face.size * adv / 10.2 * 0.3 : TOP, fs: face.size * adv / 10.2, adv,
           glyphs: chars.map((ch, i) => ({ ch, index: -1 - i, x: x0 + (i + 0.5) * adv })) };
}
// g: context already scaled to sheet points. view: visible height in sheet points.
function drawSheet(g, s, L, ox, oy, paperH, viewW, viewH, shadow) {
  const paper = byId(PAPERS, s.paper), ink = byId(INKS, s.ink), face = byId(FACES, s.face);
  const h = paperH != null ? paperH : Math.max(viewH - oy + 240, 400);
  if (shadow) {
    for (const [spread, a] of [[16, 0.05], [9, 0.08], [4, 0.12], [1.5, 0.2]]) {
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.beginPath(); g.roundRect(ox - spread, oy - spread + spread * 0.45, PAPER_W + spread * 2, h + spread * 2, spread); g.fill();
    }
  }
  g.fillStyle = paper.color; g.fillRect(ox, oy, PAPER_W, h);
  if (grainTile) {
    const pattern = g.createPattern(grainTile, "repeat");
    pattern.setTransform(new DOMMatrix().translate(ox, oy).scale(0.5));
    g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = paper.grain; g.fillStyle = pattern; g.fillRect(ox, oy, PAPER_W, h); g.restore();
  }
  g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 0.75; g.strokeRect(ox, oy, PAPER_W, h);

  if (s.flower !== "none") {
    const r = splitmix(BigInt(s.seed) ^ 0xF10EF10En);
    drawFlower(g, s.flower, ox + PAPER_W - 70, oy + 66, 104, -24 + r.sym(10), s.seed);
  }

  const first = Math.max(0, Math.floor((-LH * 2 - (oy + topMargin(s))) / LH));
  const last = Math.min(L.lines.length - 1, Math.floor((viewH + LH * 2 - (oy + topMargin(s))) / LH));
  g.font = `${face.size * TYPE_K}px "${face.family}"`; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = ink.color;
  const left = ox + SIDE;
  for (let li = first; li <= last; li++) {
    const base = oy + topMargin(s) + li * LH, shift = lineShift(L.lines[li]);
    for (const gl of L.lines[li].glyphs) {
      if (gl.ch === " ") continue;
      const k = strikeFor(s.seed, gl.id), cx = left + (gl.col + 0.5 + shift) * ADV;
      g.save(); g.translate(cx + k.dx, base + k.dy); g.rotate(k.rot);
      g.globalAlpha = k.bleed; g.fillText(gl.ch, 0.45, 0.2);
      g.globalAlpha = k.opacity; g.fillText(gl.ch, 0, 0);
      g.restore();
    }
  }
  const t = titleLayout(s, face);
  if (t) {
    g.font = `${t.fs}px "${face.family}"`;
    for (const q of t.glyphs) {
      if (q.ch === " ") continue;
      const k = strikeFor(s.seed, q.index);
      g.save(); g.translate(ox + q.x + k.dx, oy + t.base + k.dy); g.rotate(k.rot);
      g.globalAlpha = k.bleed; g.fillText(q.ch, 0.45, 0.2); g.globalAlpha = k.opacity; g.fillText(q.ch, 0, 0);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}
function sheetHeight(s, L) { return Math.max(topMargin(s) + L.lines.length * LH + 70, PAPER_W * 1.294); }

// ---------- This machine's own typebars ----------
// Every slug on a real machine has small faults of its own, the same on every strike: the marks a document examiner
// reads to match a page to its typewriter. One letter sits a hair high, another leans, one prints light on one side
// ("off its feet"), a dirty one fills its counters. Capitals ride the shifted basket, a touch high and light, and now
// and then a rushed shift lets one fly above the line. Little-finger keys land softly on a manual; stops cut in hard.
const MACHINE_SEED = 0x7E57AB1En;
const barCache = new Map();
const LIGHT_KEYS = "aqz1!`~0)p;:/?-_=+[]{}'\"\\|";
function barOf(ch) {
  let b = barCache.get(ch);
  if (b) return b;
  let h = 7n;
  for (const c of ch) h = (h * 131n + BigInt(c.codePointAt(0))) & MASK;
  const r = splitmix(MACHINE_SEED ^ ((h * GOLDEN) & MASK)), bent = r.unit();
  b = {
    dx: bent < 0.12 ? r.sym(0.45) : r.sym(0.08),
    dy: bent > 0.84 ? r.sym(0.7) : r.sym(0.12),
    rot: (r.unit() < 0.09 ? r.sym(1.6) : r.sym(0.25)) * Math.PI / 180,
    feet: r.unit() * Math.PI * 2, footTilt: r.unit() < 0.25 ? 0.14 + r.unit() * 0.22 : 0.02 + r.unit() * 0.07,
    dirty: r.unit() < 0.35 ? 0.16 + r.unit() * 0.3 : 0.015,
    touch: LIGHT_KEYS.includes(ch.toLowerCase()) ? 0.9 + r.unit() * 0.05 : 0.97 + r.unit() * 0.05,
    upper: ch !== ch.toLowerCase(),
  };
  if (b.upper) { b.dy -= 0.3; b.touch *= 0.95; }
  barCache.set(ch, b);
  return b;
}
// What a single strike leaves: this bar's faults, plus how this one landed (nudge, depth, how the ribbon was inked).
const lookCache = new Map();
function glyphLook(seed, index, ch) {
  const key = seed + ":" + index + ":" + ch;
  let k = lookCache.get(key);
  if (k) return k;
  const base = strikeFor(seed, index), bar = barOf(ch);
  const r = splitmix((BigInt(seed) * 31n + BigInt(index) * 0x9E37n + 0xA11CEn) & MASK);
  const angle = bar.feet + r.sym(0.5), tilt = Math.max(0.02, bar.footTilt * (0.75 + r.unit() * 0.5));
  const clog = r.unit() < bar.dirty, ghost = r.unit() < 0.018, flying = bar.upper && r.unit() < 0.015;
  // A cloth ribbon fades as it is used and is fresher where it has rested: a slow drift along the sheet.
  const wear = 0.9 + 0.1 * Math.sin(index * 0.017 + (seed % 97)) * Math.cos(index * 0.0041 + (seed % 13));
  let strength = Math.min(1, base.opacity * wear * bar.touch);
  if (".,;:'!".includes(ch)) strength = Math.max(strength, 0.97);   // small faces strike hard
  k = { dx: base.dx * 0.7 + bar.dx, dy: base.dy * 0.7 + bar.dy - (flying ? 1 + r.unit() * 0.8 : 0), rot: base.rot * 0.6 + bar.rot,
        strength, angle, tilt, clog, ghost };
  lookCache.set(key, k);
  if (lookCache.size > 120000) lookCache.clear();
  return k;
}
const COUNTERS = "aeobdgpqABDOPQR04689&@";
// Draws ink as data for the paper shader: alpha is the letter's shape, green is how hard it struck.
const inkTone = v => `rgb(255,${Math.round(Math.max(0, Math.min(1, v)) * 255)},0)`;
// One strike as data for the shader: alpha is the letter's shape, green is how hard it struck.
function inkGlyph(g, seed, ch, index, cx, base, fs, adv) {
  const k = glyphLook(seed, index, ch);
  g.save(); g.translate(cx + k.dx, base + k.dy); g.rotate(k.rot);
  if (k.ghost) { g.fillStyle = inkTone(k.strength * 0.32); g.fillText(ch, 0.7, -0.45); }
  const ux = Math.cos(k.angle) * adv * 0.55, uy = Math.sin(k.angle) * adv * 0.55 - fs * 0.3;
  const grad = g.createLinearGradient(-ux, -fs * 0.3 - uy, ux, -fs * 0.3 + uy);
  grad.addColorStop(0, inkTone(k.strength * (1 - k.tilt)));
  grad.addColorStop(1, inkTone(k.strength));
  g.fillStyle = grad; g.fillText(ch, 0, 0);
  if (k.clog && COUNTERS.includes(ch)) {
    const upper = ch === ch.toUpperCase() && !"04689&".includes(ch);
    g.fillStyle = inkTone(k.strength * 0.85); g.beginPath();
    g.ellipse(0, -fs * (upper ? 0.42 : 0.24), fs * 0.13, fs * (upper ? 0.16 : 0.1), 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
function drawInk(g, s, L, top, h) {
  const face = byId(FACES, s.face), tm = topMargin(s), fs = face.size * TYPE_K;
  const first = Math.max(0, Math.floor((top - tm - LH) / LH)), last = Math.min(L.lines.length - 1, Math.ceil((top + h - tm + LH) / LH));
  g.font = `${fs}px "${face.family}"`; g.textAlign = "center"; g.textBaseline = "alphabetic";
  for (let li = first; li <= last; li++) {
    const base = tm + li * LH, shift = lineShift(L.lines[li]);
    for (const gl of L.lines[li].glyphs) if (gl.ch !== " ") inkGlyph(g, s.seed, gl.ch, gl.id, SIDE + (gl.col + 0.5 + shift) * ADV, base, fs, ADV);
  }
  const t = titleLayout(s, face);
  if (t && t.base + 20 > top && t.base - 40 < top + h) {
    g.font = `${t.fs}px "${face.family}"`;
    for (const q of t.glyphs) if (q.ch !== " ") inkGlyph(g, s.seed, q.ch, q.index, q.x, t.base, t.fs, t.adv);
  }
}
