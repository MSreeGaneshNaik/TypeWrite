// ---------- Metrics (the fixed pitch of the machine) ----------
const SIDE = 26, TOP = 70, TOP_FLOWER = 138, MAX_CHARS = 40000, PAPER_W = 358;
// Type size is the machine's pitch: the line stays 306 pt wide, so bigger type means fewer, wider columns.
const SIZES = [{ id: "small", name: "Small", cols: 36 }, { id: "medium", name: "Medium", cols: 30 }, { id: "large", name: "Large", cols: 24 }];
const ALIGNS = [{ id: "left", name: "Left", k: 0 }, { id: "center", name: "Centre", k: 0.5 }, { id: "right", name: "Right", k: 1 }];
// The line-space lever of a real machine: single (six lines to the inch over ten letters), one and a half, double.
const SPACINGS = [{ id: "single", name: "1", lh: 17.6 }, { id: "half", name: "1\u00bd", lh: 26 }, { id: "double", name: "2", lh: 34.6 }];
let COLS = 30, ADV = 10.2, LH = 26, BELL_COL = 24, TYPE_K = 1, ALIGN0 = "left", ALIGN_AT = {};
function useMetrics(s) {
  if (!s.size) s.size = "medium";
  if (!s.align) s.align = "left";
  if (!s.spacing) s.spacing = "half";
  if (!s.aligns) s.aligns = {};
  ALIGN0 = s.align; ALIGN_AT = s.aligns;
  COLS = (SIZES.find(z => z.id === s.size) || SIZES[1]).cols;
  ADV = (PAPER_W - SIDE * 2) / COLS; TYPE_K = ADV / 10.2; LH = byId(SPACINGS, s.spacing).lh * TYPE_K; BELL_COL = COLS - 6;
}
// How far a line moves right, in columns, to sit left, centred or right. Each paragraph has its own alignment (see strikeInto).
function lineShift(line) {
  const k = (ALIGNS.find(a => a.id === line.align) || ALIGNS[0]).k, g = line.glyphs;
  let n = g.length;
  if (line.wrap) while (n && g[n - 1].ch === " ") n--;   // the space a word wrapped at hangs in the margin
  return k ? (COLS - Math.min(n, COLS)) * k : 0;
}

// Real typing stocks. grain: mottling and tooth; age: yellowing, browned edges and foxing; laid: laid and chain lines;
// fibre: visible fibres; cockle: the rippled finish onionskin was made with; sheer: how much shows through a thin sheet;
// soak: how far cloth-ribbon ink wicks into the fibres (soft rag bond drinks it, hard onionskin keeps it on top).
const PAPERS = [
  { id: "cream", name: "Old paper", color: "#ECE7DB", grain: 1, age: 0.5, laid: 0.6, fibre: 0.9, cockle: 0, sheer: 0, soak: 0.55 },
  { id: "bright", name: "Bond", color: "#F0EEE8", grain: 0.7, age: 0.15, laid: 0, fibre: 0.75, cockle: 0, sheer: 0, soak: 0.7 },
  { id: "onion", name: "Onionskin", color: "#E6E4DA", grain: 0.55, age: 0.35, laid: 0, fibre: 0.4, cockle: 1, sheer: 0.05, soak: 0.15 },
  { id: "canary", name: "Second sheet", color: "#EADB9E", grain: 1.15, age: 0.3, laid: 0, fibre: 1.3, cockle: 0, sheer: 0.04, soak: 0.85 },
  { id: "kraft", name: "Kraft", color: "#CFB58D", grain: 1.3, age: 0.45, laid: 0, fibre: 1.5, cockle: 0, sheer: 0, soak: 0.9 },
];
// cloth: the woven ribbon's weave in every letter; crisp: a film ribbon lays down all its coating, sharp and even;
// fuzz: carbon paper under the sheet prints soft and smudged, carbon packed between the fibres.
const INKS = [
  { id: "black", name: "Black", color: "#2A2725", cloth: 1, crisp: 0, fuzz: 0 },
  { id: "red", name: "Red", color: "#9C2B22", cloth: 1, crisp: 0, fuzz: 0 },
  { id: "blue", name: "Blue", color: "#28346E", cloth: 1, crisp: 0, fuzz: 0 },
  { id: "sepia", name: "Worn", color: "#5A4636", cloth: 1, crisp: 0, fuzz: 0.15 },
  { id: "film", name: "Film", color: "#141313", cloth: 0, crisp: 1, fuzz: 0 },
  { id: "carbon", name: "Carbon copy", color: "#2E3148", cloth: 0, crisp: 0, fuzz: 1 },
];
const FACES = [
  { id: "courier", name: "Pica", family: "Courier Prime", size: 17 },
  { id: "elite", name: "Elite", family: "Special Elite", size: 15.5 },
  { id: "office", name: "Office", family: "Cutive Mono", size: 16.8 },
  { id: "gothic", name: "Gothic", family: "Lekton", size: 16.5 },
];
const FLOWERS = [
  { id: "none", name: "None" }, { id: "marigold", name: "Marigold" }, { id: "rose", name: "Rose" },
  { id: "lavender", name: "Lavender" }, { id: "fern", name: "Fern" }, { id: "daisy", name: "Daisy" },
];
const byId = (list, id) => list.find(x => x.id === id) || list[0];

// ---------- Seeded randomness: SplitMix64, identical to the app ----------
const MASK = (1n << 64n) - 1n, GOLDEN = 0x9E3779B97F4A7C15n;
function splitmix(seed) {
  let state = BigInt.asUintN(64, BigInt(seed));
  const next = () => {
    state = (state + GOLDEN) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK;
    return z ^ (z >> 31n);
  };
  const unit = () => Number(next() >> 11n) / 9007199254740992;
  return { unit, sym: r => (unit() * 2 - 1) * r };
}
// How one strike of a type bar landed: nudge, baseline, tilt, ink and bleed.
function inkStrike(seed, index) {
  const r = splitmix(BigInt(seed) ^ ((BigInt(index) * GOLDEN) & MASK));
  const dx = r.sym(0.35), dy = r.sym(0.6), rot = r.sym(1.1) * Math.PI / 180, roll = r.unit();
  let opacity = 0.84 + r.unit() * 0.16, bleed = 0.16 + r.unit() * 0.12;
  if (roll < 0.06) { opacity = 0.5 + r.unit() * 0.15; bleed = 0.06; }
  else if (roll > 0.96) { opacity = 1; bleed = 0.34; }
  return { dx, dy, rot, opacity, bleed };
}
// ---------- The typing engine: same rules as TypeLayout and TypistCore ----------
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const graphemes = s => segmenter ? Array.from(segmenter.segment(s), x => x.segment) : Array.from(s);
function sanitize(input) {
  let out = "";
  for (const ch of String(input).replace(/\r\n?/g, "\n")) {
    const c = ch.codePointAt(0);
    if (c === 10 || c === 0x2028 || c === 0x2029) out += "\n";
    else if (c === 9) out += "    ";
    else if (c < 32 || (c >= 0x7F && c <= 0x9F)) continue;
    else out += ch;
  }
  return out;
}
function emptyLayout() { return { lines: [{ glyphs: [], ret: false, align: ALIGN0 }], line: 0, col: 0 }; }
// A paragraph takes the alignment kept on the line break that starts it. A break is given its paragraph's alignment
// when it is first laid out, so deleting one break never re-aligns the paragraphs after it.
// Appends one character and reports how the carriage moved. index: its place in the text; id: the seed of its ink.
function strikeInto(L, ch, index, id = index) {
  if (ch === "\n") {
    const prev = L.lines[L.lines.length - 1];
    prev.ret = true; prev.end = index;   // end: the character a line break used up
    L.lines.push({ glyphs: [], ret: false, align: ALIGN_AT[id] || (ALIGN_AT[id] = prev.align) }); L.line = L.lines.length - 1; L.col = 0;
    return "returned";
  }
  let move = "advanced";
  if (L.col >= COLS) {
    L.lines[L.lines.length - 1].wrap = true;
    if (ch === " ") { L.lines[L.lines.length - 1].end = index; L.lines.push({ glyphs: [], ret: false, align: L.lines[L.lines.length - 1].align }); L.line = L.lines.length - 1; L.col = 0; return "wrappedOnSpace"; }
    const g = L.lines[L.lines.length - 1].glyphs;
    let space = -1;
    for (let i = g.length - 1; i >= 0; i--) if (g[i].ch === " ") { space = i; break; }
    let carried = [];
    if (space >= 0 && space < g.length - 1) carried = g.splice(space + 1);
    L.lines.push({ glyphs: carried.map((x, c) => ({ ch: x.ch, index: x.index, id: x.id, col: c })), ret: false, align: L.lines[L.lines.length - 1].align });
    L.line = L.lines.length - 1; L.col = carried.length;
    move = "wrapped";
  }
  L.lines[L.lines.length - 1].glyphs.push({ ch, index, id, col: L.col });
  L.col += 1;
  return move;
}
function layoutChars(chars, ids) { const L = emptyLayout(); chars.forEach((c, i) => strikeInto(L, c, i, ids ? ids[i] : i)); return L; }
// Ink ids are stored as runs of consecutive numbers, so a sheet typed straight through stores nothing extra.
function packIds(ids) {
  const out = [];
  for (let i = 0; i < ids.length;) { let j = i + 1; while (j < ids.length && ids[j] === ids[j - 1] + 1) j++; out.push(ids[i], j - i); i = j; }
  return out.length === 2 && out[0] === 0 ? undefined : out;
}
function unpackIds(p, n) {
  if (!Array.isArray(p)) return null;
  const ids = [];
  for (let k = 0; k + 1 < p.length && ids.length <= n; k += 2) for (let m = 0; m < p[k + 1]; m++) ids.push(p[k] + m);
  return ids.length === n ? ids : null;
}
// Line and column of the gap before character b (b = the text's length: the carriage's own place).
function posIn(L, b, n) {
  if (b >= n) return [L.line, L.col];
  for (let li = 0; li < L.lines.length; li++) {
    const g = L.lines[li].glyphs;
    if (g.length && b >= g[0].index && b <= g[g.length - 1].index) return [li, g[b - g[0].index].col];
    if (L.lines[li].end === b) return [li, g.length];
  }
  return [L.line, L.col];
}

class Typist {
  constructor(text, packed) {
    this.chars = graphemes(sanitize(text || "")).slice(0, MAX_CHARS);
    this.ids = unpackIds(packed, this.chars.length) || this.chars.map((_, i) => i);
    this.next = this.ids.reduce((m, v) => Math.max(m, v), -1) + 1;
    this.caret = this.chars.length;
    this.layout = layoutChars(this.chars, this.ids); this.cp = null;
  }
  get text() { return this.chars.join(""); }
  caretPos() { return this.cp || (this.cp = posIn(this.layout, this.caret, this.chars.length)); }
  setCaret(b) { this.caret = Math.max(0, Math.min(b, this.chars.length)); this.cp = null; }
  relayout() { this.layout = layoutChars(this.chars, this.ids); this.cp = null; }
  // Types at the caret. At the end of the text the layout just grows; in the middle the text reflows.
  type(input) {
    const clean = graphemes(sanitize(input));
    if (!clean.length) return [];
    if (this.chars.length >= MAX_CHARS) return ["jammed"];
    const accepted = clean.slice(0, MAX_CHARS - this.chars.length), ids = accepted.map(() => this.next++);
    const before = this.caretPos();
    if (this.caret === this.chars.length) {
      accepted.forEach((c, k) => { strikeInto(this.layout, c, this.chars.length, ids[k]); this.chars.push(c); this.ids.push(ids[k]); });
    } else { this.chars.splice(this.caret, 0, ...accepted); this.ids.splice(this.caret, 0, ...ids); }
    this.setCaret(this.caret + accepted.length);
    if (this.caret < this.chars.length) this.relayout();
    if (accepted.length > 1) return accepted.length < clean.length ? ["key", "jammed"] : ["key"];   // a paste past the limit jams
    const c = accepted[0], now = this.caretPos(), wrapped = now[0] > before[0];
    const events = c === "\n" || (wrapped && c === " ") ? ["return"] : wrapped ? ["return", "key"] : [c === " " ? "space" : "key"];
    if (!wrapped && before[1] < BELL_COL && now[1] >= BELL_COL) events.push("bell");
    return events;
  }
  remove(a, b) {
    if (b <= a) return;
    this.chars.splice(a, b - a); this.ids.splice(a, b - a);
    this.setCaret(this.caret > b ? this.caret - (b - a) : Math.min(this.caret, a));
    this.relayout();
  }
  backspace() { if (!this.caret) return ["jammed"]; this.remove(this.caret - 1, this.caret); return ["backspace"]; }
  forwardDelete() { if (this.caret >= this.chars.length) return ["jammed"]; this.remove(this.caret, this.caret + 1); return ["backspace"]; }
}
