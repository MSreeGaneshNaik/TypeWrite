// ---------- Storage: sheets live in this browser ----------
const store = {
  get(key, fallback) { try { const v = window.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
};
const newSeed = () => 1 + Math.floor(Math.random() * 2147483646);
function newSheet() {
  const d = store.get("tw.defaults", {});
  return { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: "", title: "", created: Date.now(), updated: Date.now(),
    paper: d.paper || "cream", ink: d.ink || "black", face: d.face || "courier", flower: d.flower || "none",
    size: d.size || "medium", align: d.align || "left", spacing: d.spacing || "half", seed: newSeed() };
}
function readSheets() {
  let v = store.get("tw.sheets", null);
  if (!Array.isArray(v)) v = store.get("tw2.sheets", []);               // sheets typed on the earlier machine come along
  return Array.isArray(v) ? v.filter((s) => s && typeof s.text === "string" && s.id).map((s) => ({ flower: "none", spacing: "half", ...s })) : [];
}
function mergeSheets(...lists) {
  const m = new Map();
  for (const list of lists) for (const s of list) { const prev = m.get(s.id); if (!prev || (s.updated || 0) >= (prev.updated || 0)) m.set(s.id, s); }
  return [...m.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
function sheetName(s) { return (s.title || "").trim() || ((s.text || "").split("\n").find((l) => l.trim()) || "").trim().slice(0, 60) || "New sheet"; }
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// ---------- Sound: the recorded machine, decoded once, played with a little pitch drift ----------
const SOUND_NAMES = ["key1", "key2", "key3", "key4", "space", "backspace", "bell", "return", "feed", "jam"];
const audio = { ctx: null, gain: null, buffers: {}, lastKey: "" };
function unlockAudio() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC({ latencyHint: "interactive" });
    audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 0.9; audio.gain.connect(audio.ctx.destination);
    fetch(ASSETS.sounds).then((r) => r.json()).then((all) => Promise.all(SOUND_NAMES.map(async (name) => {
      try {
        const bin = atob(all[name]), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        audio.buffers[name] = await new Promise((ok, bad) => audio.ctx.decodeAudioData(bytes.buffer, ok, bad));
      } catch (e) { /* that sound stays silent */ }
    }))).catch(() => {});
    Object.keys(LETTER_SOUNDS).forEach((name) => fetch(LETTER_SOUNDS[name]).then((r) => r.arrayBuffer())
      .then((b) => new Promise((ok, bad) => audio.ctx.decodeAudioData(b, ok, bad))).then((buf) => { audio.buffers["letter-" + name] = buf; }).catch(() => {}));
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  if (!nature.out && typeof window !== "undefined" && window.__twLamp != null) mixNature(window.__twLamp);
}
let soundOn = store.get("tw.sound", true), buzzOn = store.get("tw.buzz", true);
function play(name, volume = 1) {
  if (!soundOn || !audio.ctx || !audio.buffers[name]) return;
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.buffers[name];
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * (name === "bell" ? 0.008 : 0.02);
  if (volume === 1) src.connect(audio.gain);
  else { const v = audio.ctx.createGain(); v.gain.value = volume; src.connect(v); v.connect(audio.gain); }
  src.start();
}
function playKey() {
  const keys = ["key1", "key2", "key3", "key4"];
  let pick = keys[Math.floor(Math.random() * 4)];
  if (pick === audio.lastKey) pick = keys[(keys.indexOf(pick) + 1) % 4];
  audio.lastKey = pick; play(pick, 0.85 + Math.random() * 0.15);
}
// ---------- Outside: birdsong in the meadow by day, a field of crickets at night ----------
// Real field recordings, each a seamless loop, streamed through two players that hand over with a long crossfade,
// so the loop point never shows. By day, birds in a park copse (Thimras, CC0); at night, crickets (dklon, CC BY 3.0).
let natureOn = store.get("tw.nature", true), letterOpens = store.get("tw.letterOpens", true);
const nature = { out: null, day: null, night: null };
function looper(ctx, out, mp4, webm) {
  const probe = new Audio();
  const url = probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? mp4 : probe.canPlayType('audio/webm; codecs="opus"') ? webm : mp4;
  const level = ctx.createGain(); level.gain.value = 0; level.connect(out);
  const players = [0, 1].map(() => {
    const a = new Audio(); a.src = url; a.preload = "auto"; a.crossOrigin = "anonymous";
    const g = ctx.createGain(); g.gain.value = 0;
    try { ctx.createMediaElementSource(a).connect(g); } catch (e) {}
    g.connect(level);
    return { a, g };
  });
  const FADE = 2.5;
  let cur = -1, timer = 0, want = 0, idle = 0;
  const start = (i) => {
    const p = players[i]; p.a.currentTime = 0;
    p.a.play().catch(() => {});
    p.g.gain.cancelScheduledValues(ctx.currentTime); p.g.gain.setTargetAtTime(1, ctx.currentTime, FADE / 4);
  };
  const tick = () => {
    if (cur < 0) return;
    const p = players[cur], d = p.a.duration;
    if (d && d - p.a.currentTime < FADE) {          // hand over to the other player, crossfading the seam away
      const old = p; cur = 1 - cur; start(cur);
      old.g.gain.cancelScheduledValues(ctx.currentTime); old.g.gain.setTargetAtTime(0, ctx.currentTime, FADE / 4);
      setTimeout(() => { if (players[cur] !== old) old.a.pause(); }, FADE * 1000 + 400);
    }
  };
  return {
    set(v) {
      want = v;
      level.gain.cancelScheduledValues(ctx.currentTime); level.gain.setTargetAtTime(v, ctx.currentTime, 0.9);
      if (v > 0.001) {
        clearTimeout(idle);
        if (cur < 0) { cur = 0; start(0); }
        else if (players[cur].a.paused) players[cur].a.play().catch(() => {});
        if (!timer) timer = setInterval(tick, 200);
      } else if (cur >= 0) {
        clearTimeout(idle);
        idle = setTimeout(() => { if (want <= 0.001) { players.forEach((p) => p.a.pause()); clearInterval(timer); timer = 0; } }, 5000);
      }
    },
    pause() { players.forEach((p) => p.a.pause()); },
    resume() { if (want > 0.001 && cur >= 0) players[cur].a.play().catch(() => {}); },
  };
}
function mixNature(lamp) {
  if (!audio.ctx) return;
  window.__nature = nature; window.__audio = audio;
  if (!nature.out) {
    nature.out = audio.ctx.createGain(); nature.out.gain.value = 0.55; nature.out.connect(audio.ctx.destination);
    nature.day = looper(audio.ctx, nature.out, ASSETS.dayMp4, ASSETS.dayWebm);
    nature.night = looper(audio.ctx, nature.out, ASSETS.nightMp4, ASSETS.nightWebm);
  }
  const on = natureOn && soundOn ? 1 : 0;
  nature.day.set(on * (1 - lamp)); nature.night.set(on * lamp * 0.9);
}
// Inside the Mac and iPhone app, the shell gives real haptics and a share sheet (see TypeWrite/Views/MachineView.swift).
const shell = (name) => window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[name];
function buzz(ms) { if (!buzzOn) return; try { if (shell("buzz")) shell("buzz").postMessage(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function stepSpring(s, dt, resp, damp) {
  const k = Math.pow(2 * Math.PI / resp, 2), c = 4 * Math.PI * damp / resp;
  s.vel += (-k * (s.v - s.to) - c * s.vel) * dt; s.v += s.vel * dt;
}
const DECEL = 0.998;
const rubber = (over, dim) => (1 - 1 / (over * 0.55 / dim + 1)) * dim;
function pushSample(list, e) { list.push({ t: e.timeStamp, y: e.clientY }); while (list.length > 2 && e.timeStamp - list[0].t > 100) list.shift(); }
function velocityOf(list, now) {
  if (list.length < 2) return 0;
  const a = list[0], b = list[list.length - 1];
  if (now - b.t > 60) return 0;
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? (b.y - a.y) / dt : 0;
}
const finePointer = () => !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.sheets = readSheets();
    const cur = store.get("tw.current", store.get("tw2.current", ""));
    this.sheet = this.sheets.find((s) => s.id === cur) || newSheet();
    if (!this.sheet.flower) this.sheet.flower = "none";
    useMetrics(this.sheet);
    this.typist = new Typist(this.sheet.text, this.sheet.ids);
    const lamp = this.props.lamp === "On" ? true : store.get("tw.lamp", false);
    this.state = { v: 0, panel: null, toast: null, typing: false, lamp, sel: false, armed: false, ready: false };
    window.__twLamp = lamp ? 1 : 0;
    this.spring = {
      x: { v: 0, vel: 0, to: 0, resp: 0.1, damp: 0.95 }, y: { v: 0, vel: 0, to: 0, resp: 0.1, damp: 0.95 },
      sy: { v: 0, vel: 0, to: 0, resp: 0.4, damp: 1 }, lamp: { v: lamp ? 1 : 0, vel: 0, to: lamp ? 1 : 0, resp: 0.55, damp: 1 },
    };
    this.lampGlow = [0, 0, 0]; this.review = 0; this.coast = null; this.sel = null; this.undo = []; this.lastEdit = 0;
    this.W = 1440; this.H = 900; this.DPR = 1; this.zoom = 1; this.kb = 0; this.returnT = 0;
    this.running = false; this.lastT = 0; this.handRollUntil = 0; this.lastRollLine = null; this.lastTick = 0;
    this.thumbs = new Map(); this.tiles = {}; this.parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    this.el = {};
    this.ref = (name) => (this.el["fn_" + name] = this.el["fn_" + name] || ((el) => { this.el[name] = el; }));
  }

  // ---------- lifecycle ----------
  componentDidMount() {
    const { keys, root, stage } = this.el;
    if (!keys || !root || !stage) return;
    this.off = [];
    const on = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); this.off.push(() => el.removeEventListener(type, fn, opts)); };
    const SENT = "  ";
    const reset = () => { keys.value = SENT; try { keys.setSelectionRange(SENT.length, SENT.length); } catch (e) {} };
    this.resetKeys = reset; reset();
    let composing = false;
    const BACK = new Set(["deleteContentBackward", "deleteWordBackward", "deleteSoftLineBackward", "deleteHardLineBackward"]);
    on(keys, "compositionstart", () => { composing = true; });
    on(keys, "compositionend", (e) => { composing = false; if (e.data) this.strike(e.data); reset(); });
    on(keys, "beforeinput", (e) => {
      if (composing || e.isComposing) return;
      const t = e.inputType;
      if (t === "insertText" || t === "insertReplacementText") { e.preventDefault(); this.strike(e.data || (e.dataTransfer && e.dataTransfer.getData("text/plain")) || ""); }
      else if (t === "insertLineBreak" || t === "insertParagraph") { e.preventDefault(); this.strike("\n"); }
      else if (t === "insertFromPaste" || t === "insertFromDrop") { e.preventDefault(); this.strike((e.dataTransfer && e.dataTransfer.getData("text/plain")) || e.data || ""); }
      else if (BACK.has(t)) { e.preventDefault(); this.takeBack(false); }
      else if (t === "deleteContentForward") { e.preventDefault(); this.takeBack(true); }
      else if (t && t.startsWith("delete")) e.preventDefault();
    });
    on(keys, "input", () => {
      if (composing) return;
      const v = keys.value;
      if (v.length > SENT.length && v.startsWith(SENT)) this.strike(v.slice(SENT.length));
      else if (v.length < SENT.length) this.takeBack(false);
      reset();
    });
    on(keys, "paste", (e) => { const t = e.clipboardData && e.clipboardData.getData("text/plain"); if (t) { e.preventDefault(); this.strike(t); } });
    on(keys, "blur", () => { if (this.state.typing && !this.state.panel && !this.keepTyping) this.setTyping(false); });
    on(root, "keydown", (e) => this.onKey(e));
    on(root, "paste", (e) => {
      if (e.target === keys || this.state.panel) return;
      const t = e.clipboardData && e.clipboardData.getData("text/plain");
      if (t) { e.preventDefault(); this.setTyping(true); this.strike(t); }
    });
    on(stage, "pointerdown", (e) => this.stageDown(e));
    on(stage, "pointermove", (e) => this.stageMove(e));
    on(stage, "pointerup", (e) => this.endDrag(e));
    on(stage, "pointercancel", (e) => this.endDrag(e));
    on(stage, "dblclick", (e) => { const p = this.local(e); const w = this.wordAround(this.boundaryAt(p[0], p[1])); if (w[0] < w[1]) this.setSel(w[0], w[1]); });
    on(stage, "contextmenu", (e) => e.preventDefault());
    // The view shifts a little with the pointer: the near meadow more than the hills, the hills more than the clouds.
    on(root, "pointermove", (e) => { if (e.pointerType !== "mouse") return; const [lx, ly] = this.local(e); this.parallax.tx = clamp(lx / this.W * 2 - 1, -1, 1); this.parallax.ty = clamp(ly / this.H * 2 - 1, -1, 1); });
    on(root, "pointerleave", () => { this.parallax.tx = 0; this.parallax.ty = 0; });
    on(stage, "wheel", (e) => {
      e.preventDefault(); this.coast = null;
      this.review = clamp(this.review - e.deltaY / this.zoom, this.reviewMin(), this.reviewLimit());
      this.rollingByHand(); this.setFeel(["y"], 0.14, 1); this.retarget(); this.kick();
    }, { passive: false });
    on(window, "storage", (e) => {   // another tab saved: its list decides which sheets exist, so its deletes stick here too
      if (e.key !== "tw.sheets") return;
      const stored = readSheets(), ids = new Set(stored.map((s) => s.id));
      this.sheets = mergeSheets(stored, this.sheets.filter((s) => ids.has(s.id))).filter((s) => s.id !== this.sheet.id);
    });
    on(window, "pagehide", () => this.persist(true));
    on(document, "visibilitychange", () => {
      if (document.hidden) { this.persist(true); if (nature.day) { nature.day.pause(); nature.night.pause(); } }
      else { this.startView(); if (nature.day) { nature.day.resume(); nature.night.resume(); } }
    });
    const vv = window.visualViewport;
    if (vv) {
      const fit = () => { this.kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); this.retarget(); if (this.state.typing) this.placeKeys(); this.kick(); };
      on(vv, "resize", fit); on(vv, "scroll", fit);
    }
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(root); this.off.push(() => this.ro.disconnect()); }
    else on(window, "resize", () => this.resize());
    this.grain = makeGrain();
    grainTile = this.grain;
    const start = async () => {
      try { await Promise.all(FACES.map((f) => document.fonts.load(`${f.size}px "${f.family}"`))); } catch (e) {}
      if (this.dead) return;
      try { this.GL = createGL(this, this.el.gl, this.el.view); } catch (err) { this.GL = null; if (window.console) console.warn("TypeWrite: drawing flat", err); }
      this.makeTiles();
      this.resize();
      mixNature(this.state.lamp ? 1 : 0);   // back after a remount, if sound was already started
      this.setState({ ready: true });
    };
    start();
  }
  componentWillUnmount() {
    this.dead = true;
    (this.off || []).forEach((f) => f());
    this.persist(true); clearTimeout(this.toastTimer); clearTimeout(this.armTimer);
    if (nature.day) { nature.day.pause(); nature.night.pause(); }
    if (this.GL) this.GL.dispose();
  }
  bump() { this.setState((s) => ({ v: s.v + 1 })); }

  // ---------- geometry: where the sheet lands on screen ----------
  camDist() { return (this.H / 2) / this.zoom / Math.tan(FOV * Math.PI / 360); }
  paperDepth(x) { const nx = 2 * x / PAPER_W; return -BOW * nx * nx; }
  toScreen(x, y) {
    const camY = (this.spring.sy.v - this.H / 2) / this.zoom, d = this.camDist(), k = this.GL ? d / (d - this.paperDepth(x)) : 1;
    return [this.W / 2 + x * this.zoom * k, this.H / 2 - (y - camY) * this.zoom * k];
  }
  local(e) {
    const r = this.el.stage.getBoundingClientRect();
    return [(e.clientX - r.left) * (this.W / (r.width || 1)), (e.clientY - r.top) * (this.H / (r.height || 1))];
  }
  viewportH() { return this.H - this.kb; }
  // The type line sits as low as the machine allows: room under it for the rod, the guide and the dock.
  strikeLine() { const vh = this.viewportH(), below = (-ROD_Y + PILL_R) * this.zoom + 104; return Math.round(clamp(vh - below, vh * 0.5, vh * 0.76)); }
  caretLine() { return this.typist.caretPos()[0]; }
  caretX() { const [li, col] = this.typist.caretPos(); return SIDE + (Math.min(col, COLS) + 0.5 + lineShift(this.typist.layout.lines[li])) * ADV; }
  reviewLimit() { return this.caretLine() * LH + topMargin(this.sheet); }
  reviewMin() { return Math.min(0, (this.caretLine() - (this.typist.layout.lines.length - 1)) * LH); }
  setFeel(names, resp, damp) { for (const n of names) { this.spring[n].resp = resp; this.spring[n].damp = damp; } }
  retarget(jump) {
    const sp = this.spring;
    sp.x.to = this.caretX(); sp.y.to = this.caretLine() * LH - this.review; sp.sy.to = this.strikeLine(); sp.lamp.to = this.state.lamp ? 1 : 0;
    if (jump) for (const k in sp) { if (k === "lamp") continue; sp[k].v = sp[k].to; sp[k].vel = 0; }
  }
  rollingByHand() { this.handRollUntil = performance.now() + 700; }
  resize() {
    const root = this.el.root; if (!root) return;
    const W = Math.max(1, root.clientWidth), H = Math.max(1, root.clientHeight);
    this.W = W; this.H = H; this.DPR = Math.min(window.devicePixelRatio || 1, 3);
    this.zoom = PAPER_SHARE * W / PAPER_W;
    if (this.GL) this.GL.resize();
    else if (this.el.flat) { this.el.flat.width = Math.round(W * this.DPR); this.el.flat.height = Math.round(H * this.DPR); }
    this.retarget(true); this.kick();
  }
  kick() { if (!this.running) { this.running = true; this.lastT = performance.now(); requestAnimationFrame((t) => this.frame(t)); } }
  frame(t) {
    if (this.dead) return;
    const sp = this.spring, dt = clamp((t - this.lastT) / 1000, 0, 0.05); this.lastT = Math.max(this.lastT, t);
    const calm = reduceMotion();
    if (this.coast) {
      this.review += this.coast.v * dt; this.coast.v *= Math.pow(DECEL, dt * 1000);
      const lim = this.reviewLimit();
      if (this.review < this.reviewMin() || this.review > lim) {
        this.review = clamp(this.review, this.reviewMin(), lim);
        sp.y.to = this.caretLine() * LH - this.review; sp.y.vel = -this.coast.v; this.setFeel(["y"], 0.42, 1); this.coast = null;
      } else {
        sp.y.to = sp.y.v = this.caretLine() * LH - this.review; sp.y.vel = -this.coast.v;
        if (Math.abs(this.coast.v) < 4) { this.coast = null; sp.y.vel = 0; }
      }
    }
    const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
    for (const k in sp) {
      const s = sp[k];
      if (this.coast && k === "y") continue;
      const r = calm ? 0.06 : s.resp, d = calm ? 1 : s.damp;
      for (let i = 0; i < steps; i++) stepSpring(s, h, r, d);
    }
    for (let i = 0; i < 3; i++) this.lampGlow[i] = this.lampGlow[i] < 0.004 ? 0 : this.lampGlow[i] * Math.exp(-dt * (calm ? 30 : 5.5));
    const rollLine = Math.round(sp.y.v / LH);
    if (this.lastRollLine !== null && rollLine !== this.lastRollLine && performance.now() < this.handRollUntil && t - this.lastTick > 28) { this.ratchet(); this.lastTick = t; }
    this.lastRollLine = rollLine;
    this.draw();
    this.startView();
    const busy = performance.now() - this.returnT < 300;
    const settled = !busy && this.lampGlow.every((g) => g === 0) && !this.coast && Object.values(sp).every((s) => Math.abs(s.v - s.to) < 0.01 && Math.abs(s.vel) < 0.01);
    if (settled) { for (const k in sp) { sp[k].v = sp[k].to; sp[k].vel = 0; } this.draw(); this.running = false; }
    else requestAnimationFrame((tt) => this.frame(tt));
  }
  startView() {
    const V = this.GL && this.GL.view;
    if (!V || this.viewLive) return;
    this.viewLive = true;
    const loop = (t) => {
      if (this.dead) return;
      V.draw(reduceMotion() ? 0 : t / 1000);
      if (reduceMotion() || document.hidden) { this.viewLive = false; return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  draw() {
    if (this.GL) this.GL.render(); else this.drawFlat();
    this.placeGhost();
  }
  placeGhost() {
    const ask = this.el.ghostAsk, startEl = this.el.ghostStart;
    if (!ask || !startEl) return;
    const face = byId(FACES, this.sheet.face), k = byId(ALIGNS, this.alignAtCaret()).k;
    const [sx, base] = this.toScreen(SIDE - PAPER_W / 2 + k * (PAPER_W - SIDE * 2), this.spring.y.v);
    ask.style.fontSize = Math.max(12, face.size * 0.46 * this.zoom) + "px";
    ask.style.left = this.W / 2 + "px"; ask.style.top = (base - LH * 1.35 * this.zoom) + "px";
    startEl.style.fontFamily = `"${face.family}", ui-monospace, monospace`;
    startEl.style.fontSize = face.size * TYPE_K * this.zoom + "px";
    startEl.style.left = sx + "px"; startEl.style.top = base + "px"; startEl.style.translate = `${-k * 100}% 0`;
  }
  placeKeys() { const k = this.el.keys; if (k) k.style.top = Math.round(this.spring.sy.to) + "px"; }
  // Without WebGL: the same layout, flat in 2D.
  drawFlat() {
    const c = this.el.flat; if (!c) return;
    const g = c.getContext("2d"), sp = this.spring, W = this.W, H = this.H, zoom = this.zoom, sy = sp.sy.v, n = sp.lamp.v;
    g.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    const rodLine = sy - ROD_Y * zoom, skyG = g.createLinearGradient(0, 0, 0, rodLine);
    skyG.addColorStop(0, n > 0.5 ? "#1E2246" : "#BFCBCB"); skyG.addColorStop(0.7, n > 0.5 ? "#3A3566" : "#F2E4C6"); skyG.addColorStop(1, n > 0.5 ? "#1D2A2A" : "#A9B07A");
    g.fillStyle = skyG; g.fillRect(0, 0, W, rodLine); g.fillStyle = n > 0.5 ? "#151A1E" : "#8F9A72"; g.fillRect(0, rodLine, W, H - rodLine);
    g.save(); g.translate(W / 2, sy); g.scale(zoom, zoom);
    const ox = -PAPER_W / 2, oy = -topMargin(this.sheet) - sp.y.v, viewTop = -sy / zoom;
    g.translate(0, viewTop);
    drawSheet(g, this.sheet, this.typist.layout, ox, oy - viewTop, null, W / zoom, H / zoom, true);
    g.restore();
    const ry = sy - ROD_Y * zoom, cx = W / 2 + (sp.x.v - PAPER_W / 2) * zoom;
    g.fillStyle = "#C9A464"; g.fillRect(0, ry - ROD_R * zoom, W, ROD_R * 2 * zoom);
    g.fillStyle = "#F1EDE4"; g.beginPath(); g.roundRect(cx - PILL_LEN / 2 * zoom, ry - PILL_R * zoom, PILL_LEN * zoom, PILL_R * 2 * zoom, PILL_R * zoom); g.fill();
  }

  // ---------- sheets on disk ----------
  persist(now) {
    clearTimeout(this.saveTimer);
    const write = () => {
      this.sheets = mergeSheets(readSheets(), this.sheets).filter((s) => s.id !== this.sheet.id && filled(s));
      if (filled(this.sheet)) this.sheets.unshift(this.sheet);
      if (!store.set("tw.sheets", this.sheets)) { if (!this.full) { this.full = true; this.toast("This browser's storage is full, so this sheet isn't being saved. Save the words, or throw old sheets away."); } return; }
      this.full = false; store.set("tw.current", this.sheet.id);
      try { localStorage.removeItem("tw2.sheets"); localStorage.removeItem("tw2.current"); } catch (e) {}   // moved over: drop the earlier machine's copy
    };
    if (now) write(); else this.saveTimer = setTimeout(write, 400);
  }
  refresh() {
    const s = this.sheet; s.text = this.typist.text; s.ids = packIds(this.typist.ids); s.updated = Date.now(); this.persist();
    this.review = clamp(this.review, this.reviewMin(), this.reviewLimit()); this.coast = null;
    if (this.GL) this.GL.redrawAll();
    this.retarget(); this.kick(); this.bump();
  }

  // ---------- typing ----------
  strike(input) {
    if (!input) return;
    if (this.selRange()) this.removeSel(true); else this.clearSel();
    unlockAudio(); this.undoMark();
    this.edit(() => this.typist.type(input));
  }
  takeBack(forward) {
    if (this.selRange()) { this.deleteSel(); return; }
    this.clearSel(); unlockAudio(); this.undoMark();
    this.edit(() => (forward ? this.typist.forwardDelete() : this.typist.backspace()));
  }
  edit(change) {
    const ty = this.typist, atEnd = ty.caret === ty.chars.length, beforeLine = this.caretLine(), beforeCount = ty.layout.lines.length;
    const events = change();
    this.feedback(events);
    if (!events.length || (events.length === 1 && events[0] === "jammed")) return;
    if (events.includes("return")) this.setFeel(["x", "y"], 0.42, 0.86); else this.setFeel(["x", "y"], 0.1, 0.95);
    this.review = 0; this.coast = null;
    const s = this.sheet; s.text = ty.text; s.ids = packIds(ty.ids); s.updated = Date.now(); this.persist();
    const now = this.caretLine(), lines = ty.layout.lines;
    if (this.GL) {
      if (atEnd && ty.caret === ty.chars.length) this.GL.patchInk(Math.max(0, Math.min(beforeLine, now) - 1), Math.max(beforeLine, now) + 1);
      else if (lines.length !== beforeCount) this.GL.redrawAll();
      else { let end = now; while (end < lines.length - 1 && !lines[end].ret) end++; this.GL.patchInk(Math.max(0, Math.min(beforeLine, now) - 1), end + 1); }
    }
    this.retarget(); this.kick(); this.bump();
  }
  feedback(events) {
    for (const e of events) {
      if (e === "key") { playKey(); buzz(6); this.flash(0); if (this.GL) this.GL.press(); }
      else if (e === "space") { play("space"); buzz(4); this.flash(1); }
      else if (e === "bell") play("bell");
      else if (e === "return") { play("return"); buzz(14); this.flash(0); this.returnT = performance.now(); }
      else if (e === "backspace") { play("backspace"); buzz(4); this.flash(2); }
      else if (e === "jammed") { play("jam"); buzz([20, 40, 20]); }
    }
  }
  flash(i) { this.lampGlow[i] = 1; this.kick(); }
  ratchet() {
    if (soundOn && audio.ctx && audio.buffers.feed) {
      const src = audio.ctx.createBufferSource(); src.buffer = audio.buffers.feed;
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.04;
      src.connect(audio.gain); src.start(0, 0, 0.05);
    }
    buzz(3);
  }
  setTyping(on) {
    const keys = this.el.keys;
    if (on === this.state.typing && (!on || document.activeElement === keys)) return;
    this.coast = null;
    if (on) {
      unlockAudio(); this.resetKeys && this.resetKeys(); this.review = 0;
      this.setFeel(["x", "y"], 0.42, 0.9); this.retarget(); this.placeKeys();
      if (keys) keys.focus({ preventScroll: true });
    } else {
      if (keys && document.activeElement === keys) keys.blur();
      this.setFeel(["x", "y"], 0.42, 0.9); this.retarget();
    }
    this.setState({ typing: on });
    this.kick();
  }

  // ---------- selection, undo, clipboard ----------
  selRange() { const s = this.sel; if (!s) return null; const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b); return a < b ? [a, b] : null; }
  selText() { const r = this.selRange(); return r ? this.typist.chars.slice(r[0], r[1]).join("") : ""; }
  charPos(i) {
    const lines = this.typist.layout.lines;
    for (let li = 0; li < lines.length; li++) {
      const g = lines[li].glyphs;
      if (g.length && i >= g[0].index && i <= g[g.length - 1].index) return [li, g[i - g[0].index].col];
      if (lines[li].end === i) return [li, g.length];
    }
    const li = lines.length - 1; return [li, lines[li].glyphs.length];
  }
  selBox() {
    const r = this.selRange(); if (!r) return null;
    const A = this.charPos(r[0]), B = this.charPos(r[1] - 1), lines = this.typist.layout.lines;
    return [A[0], A[1], B[0], B[1] + 1, lineShift(lines[A[0]]), lineShift(lines[B[0]])];
  }
  setSel(a, b) { this.sel = { a, b }; if (!this.state.sel) this.setState({ sel: true }); this.kick(); }
  clearSel() { if (!this.sel) return; this.sel = null; if (this.state.sel) this.setState({ sel: false }); this.kick(); }
  // Which gap between letters sits under a point on the stage (the inverse of toScreen, bow included).
  boundaryAt(px, py) {
    const d = this.camDist(), camY = (this.spring.sy.v - this.H / 2) / this.zoom;
    let x = (px - this.W / 2) / this.zoom, k = 1;
    if (this.GL) for (let i = 0; i < 2; i++) { k = d / (d - this.paperDepth(x)); x = (px - this.W / 2) / this.zoom / k; }
    const y = camY - (py - this.H / 2) / (this.zoom * k), tm = topMargin(this.sheet);
    const sheetX = x + PAPER_W / 2, sheetY = tm + this.spring.y.v - y;
    const lines = this.typist.layout.lines, li = clamp(Math.floor((sheetY - tm) / LH + 0.74), 0, lines.length - 1);
    const line = lines[li], c = (sheetX - SIDE) / ADV - lineShift(line);
    for (const g of line.glyphs) if (c < g.col + 0.5) return g.index;
    if (line.end != null) return line.end;
    return line.glyphs.length ? line.glyphs[line.glyphs.length - 1].index + 1 : this.typist.chars.length;
  }
  wordAround(i) {
    const c = this.typist.chars, inWord = (k) => k >= 0 && k < c.length && !/\s/.test(c[k]);
    let a = inWord(i) ? i : inWord(i - 1) ? i - 1 : -1;
    if (a < 0) return [i, i];
    while (inWord(a - 1)) a--;
    let b = a; while (inWord(b)) b++;
    return [a, b];
  }
  selectAll() { if (this.typist.chars.length) this.setSel(0, this.typist.chars.length); }
  snapshot() { return { text: this.typist.text, ids: packIds(this.typist.ids), caret: this.typist.caret }; }
  pushUndo() { this.undo.push(this.snapshot()); if (this.undo.length > 50) this.undo.shift(); this.lastEdit = performance.now(); }
  undoMark() { if (performance.now() - this.lastEdit > 1200) this.pushUndo(); this.lastEdit = performance.now(); }
  removeSel(quiet) {
    const r = this.selRange(); if (!r) return 0;
    this.pushUndo(); this.clearSel();
    this.typist.remove(r[0], r[1]); this.typist.setCaret(r[0]); this.refresh();
    if (!quiet) this.feedback(["backspace"]);
    return r[1] - r[0];
  }
  deleteSel() { const n = this.removeSel(); if (n) this.toast(n === 1 ? "Took back 1 letter." : `Took back ${thousands(n)} letters.`, "Undo", () => this.undoEdit()); }
  undoEdit() {
    if (!this.undo.length) return;
    const sn = this.undo.pop();
    this.clearSel(); this.typist = new Typist(sn.text, sn.ids); this.typist.setCaret(sn.caret); this.review = 0; this.refresh();
    unlockAudio(); play("feed", 0.6);
  }
  copyText(text) {
    const t = this.el.clip; if (!t) return false;
    this.keepTyping = true; t.value = text; t.select(); try { t.setSelectionRange(0, text.length); } catch (e) {}
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    this.keepTyping = false;
    if (this.state.typing && this.el.keys) this.el.keys.focus({ preventScroll: true });
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => this.toast("This browser won't let the page copy. Try ⌘C or Ctrl+C."));
    return true;
  }
  copySel() { const t = this.selText(); if (!t) return false; this.copyText(t); this.toast("Copied."); return true; }
  cutSel() { const t = this.selText(); if (!t) return; this.copyText(t); this.removeSel(); this.toast("Cut.", "Undo", () => this.undoEdit()); }
  async pasteClipboard() {
    let text = "";
    try { text = navigator.clipboard ? await navigator.clipboard.readText() : ""; } catch (e) {}
    if (text) { this.setTyping(true); this.strike(text); }
    else this.toast(finePointer() ? "The browser keeps the clipboard private here. Press ⌘V or Ctrl+V." : "The browser keeps the clipboard private here. Tap the page, then paste from your keyboard.");
  }

  // ---------- the caret and the keys ----------
  moveCaret(b, extend) {
    const from = this.typist.caret; this.lastEdit = 0;
    if (extend) { const anchor = this.sel ? this.sel.a : from; this.typist.setCaret(b); this.setSel(anchor, this.typist.caret); }
    else { this.clearSel(); this.typist.setCaret(b); }
    this.review = 0; this.coast = null; this.setFeel(["x", "y"], 0.3, 0.9); this.retarget(); this.kick();
  }
  boundaryOnLine(li, c) {
    const line = this.typist.layout.lines[clamp(li, 0, this.typist.layout.lines.length - 1)];
    for (const g of line.glyphs) if (c < g.col + 0.5) return g.index;
    if (line.end != null) return line.end;
    return line.glyphs.length ? line.glyphs[line.glyphs.length - 1].index + 1 : this.typist.chars.length;
  }
  caretKey(e) {
    const [li, col] = this.typist.caretPos(), r = this.selRange(), n = this.typist.chars.length, lines = this.typist.layout.lines;
    const mod = e.metaKey || e.ctrlKey, k = e.key;
    const across = (to) => col - 0.5 + lineShift(lines[li]) - lineShift(lines[to]);   // the same place on screen, whatever the alignment
    let b = null;
    if (k === "ArrowLeft") b = mod ? this.boundaryOnLine(li, -1) : r && !e.shiftKey ? r[0] : this.typist.caret - 1;
    else if (k === "ArrowRight") b = mod ? this.boundaryOnLine(li, 1e9) : r && !e.shiftKey ? r[1] : this.typist.caret + 1;
    else if (k === "ArrowUp") b = mod ? 0 : li > 0 ? this.boundaryOnLine(li - 1, across(li - 1)) : 0;
    else if (k === "ArrowDown") b = mod ? n : li < lines.length - 1 ? this.boundaryOnLine(li + 1, across(li + 1)) : n;
    else if (k === "Home") b = mod ? 0 : this.boundaryOnLine(li, -1);
    else if (k === "End") b = mod ? n : this.boundaryOnLine(li, 1e9);
    if (b === null) return false;
    e.preventDefault(); this.moveCaret(b, e.shiftKey); return true;
  }
  onKey(e) {
    const keys = this.el.keys, mod = (e.metaKey || e.ctrlKey) && !e.altKey, low = (e.key || "").toLowerCase();
    if (this.state.panel) { if (e.key === "Escape") { e.preventDefault(); this.closePanel(); } return; }
    if (mod && low === "s") { e.preventDefault(); this.setTyping(false); this.openPanel("save"); return; }
    if (mod && low === "a") { e.preventDefault(); this.selectAll(); return; }
    if (mod && low === "c") { if (this.selText()) { e.preventDefault(); this.copySel(); } return; }
    if (mod && low === "x") { if (this.selText()) { e.preventDefault(); this.cutSel(); } return; }
    if (mod && low === "z" && !e.shiftKey) { e.preventDefault(); this.undoEdit(); return; }
    if (e.altKey && e.code === "KeyN") { e.preventDefault(); this.feedNew(); return; }
    if (e.target === keys) {
      if (!e.altKey && this.caretKey(e)) return;
      if (e.key === "Escape") { e.preventDefault(); if (this.sel) this.clearSel(); else this.setTyping(false); }
      else if (e.key === "Tab") { e.preventDefault(); this.strike("\t"); }
      return;
    }
    if (e.key === "Escape") { this.clearSel(); return; }
    if (this.selRange() && (e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); this.deleteSel(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = e.target.closest && e.target.closest("button, a, input, [role=radio]");
    if (onControl && (e.key === " " || e.key === "Enter")) return;
    const page = (this.H / this.zoom) * 0.7;
    const reading = { ArrowUp: 3 * LH, ArrowDown: -3 * LH, PageUp: page, PageDown: -page, Home: 1e9, End: -1e9 };
    if (e.key in reading) { e.preventDefault(); this.scrollBy(reading[e.key]); return; }
    if (e.key.length === 1 || e.key === "Enter") { e.preventDefault(); this.setTyping(true); this.strike(e.key === "Enter" ? "\n" : e.key); }
  }
  scrollBy(points) {
    this.coast = null;
    this.review = clamp(this.review + points, this.reviewMin(), this.reviewLimit());
    this.rollingByHand(); this.setFeel(["y"], 0.38, 1); this.retarget(); this.kick();
  }

  // ---------- reading back: drag the page, flick it, it coasts and settles ----------
  stageDown(e) {
    const swallowed = this.swallowTap; this.swallowTap = false;
    if (e.button !== 0) return;
    if (e.pointerType === "mouse") e.preventDefault();
    unlockAudio();
    const [lx, ly] = this.local(e);
    // The machine's own parts: a knob rolls the page, the lever returns the carriage, a spool changes the ribbon.
    const hit = this.GL && this.GL.pick(lx, ly);
    if (hit) {
      if (hit.knob) { this.scrollBy(hit.knob < 0 ? LH : -LH); this.ratchet(); return; }
      if (hit.lever) { this.setTyping(true); this.strike("\n"); return; }
      if (hit.spool) { this.openPanel("ink"); return; }
    }
    const sp = this.spring, moving = this.coast || Math.abs(sp.y.vel) > 40;
    this.coast = null;
    const start = this.caretLine() * LH - sp.y.v;
    if (moving) { this.review = start; sp.y.to = sp.y.v; sp.y.vel = 0; }
    const d = this.drag = { id: e.pointerId, x: e.clientY, cx: e.clientX, y: e.clientY, start, moved: false, caught: moving || swallowed, samples: [{ t: e.timeStamp, y: e.clientY }] };
    try { this.el.stage.setPointerCapture(e.pointerId); } catch (err) {}
    const at = d.at = this.boundaryAt(lx, ly);
    if (e.pointerType === "mouse") {
      d.pick = e.shiftKey && this.sel ? this.sel.a : at;
      if (e.shiftKey && this.sel) { d.selecting = d.moved = true; this.setSel(this.sel.a, at); }
    } else {
      d.hold = setTimeout(() => {
        if (!this.drag || this.drag.moved) return;
        const w = this.wordAround(at); this.drag.pick = w[0]; this.drag.selecting = this.drag.moved = true;
        this.setSel(w[0], w[1]); buzz(10);
      }, 450);
    }
  }
  stageMove(e) {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    if (d.pick != null) {
      if (!d.selecting && Math.hypot(e.clientX - d.cx, e.clientY - d.y) < 4) return;
      d.selecting = d.moved = true;
      const [lx, ly] = this.local(e);
      this.setSel(d.pick, this.boundaryAt(lx, ly));
      return;
    }
    const dy = (e.clientY - d.y) * (this.H / (this.el.stage.getBoundingClientRect().height || this.H));
    if (!d.moved && Math.abs(dy) > 6) { d.moved = true; clearTimeout(d.hold); }
    pushSample(d.samples, e);
    if (!d.moved) return;
    const raw = d.start + dy / this.zoom, lim = this.reviewLimit(), low = this.reviewMin(), dim = this.H / this.zoom;
    this.review = raw < low ? low - rubber(low - raw, dim) : raw > lim ? lim + rubber(raw - lim, dim) : raw;
    const sp = this.spring; sp.y.to = sp.y.v = this.caretLine() * LH - this.review; sp.y.vel = 0;
    this.rollingByHand(); this.kick();
  }
  endDrag(e) {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    this.drag = null; clearTimeout(d.hold);
    if (d.selecting) { if (!this.selRange() && e.pointerType === "mouse") this.clearSel(); else if (this.state.typing && this.el.keys) this.el.keys.focus({ preventScroll: true }); return; }
    const sp = this.spring;
    if (!d.moved) {
      const lim = this.reviewLimit();
      if (this.review < this.reviewMin() || this.review > lim) { this.review = clamp(this.review, this.reviewMin(), lim); this.setFeel(["y"], 0.42, 1); this.retarget(); this.kick(); }
      if (d.caught) return;
      const [lx, ly] = this.local(e);
      const left = this.toScreen(-PAPER_W / 2, 0)[0], right = this.toScreen(PAPER_W / 2, 0)[0], top = this.toScreen(0, topMargin(this.sheet) + sp.y.v)[1];
      if (lx < left || lx > right || ly < top) { this.clearSel(); if (this.state.typing) this.setTyping(false); return; }
      this.moveCaret(d.at);
      this.setTyping(true);
      return;
    }
    const v = velocityOf(d.samples, e.timeStamp) * (this.H / (this.el.stage.getBoundingClientRect().height || this.H)) / this.zoom, lim = this.reviewLimit();
    if (this.review < this.reviewMin() || this.review > lim) {
      this.review = clamp(this.review, this.reviewMin(), lim);
      sp.y.to = this.caretLine() * LH - this.review; sp.y.vel = -v; this.setFeel(["y"], 0.42, 1);
    } else if (Math.abs(v) > 30 && !reduceMotion()) { this.coast = { v }; this.handRollUntil = performance.now() + 2500; }
    else sp.y.to = sp.y.v;
    this.kick();
  }

  // ---------- sheets ----------
  openSheet(s, isNew, skipSave) {
    clearTimeout(this.saveTimer);
    if (!skipSave && filled(this.sheet)) this.persist(true);
    this.clearSel(); this.undo = [];
    if (!s.flower) s.flower = "none";
    this.sheet = s; useMetrics(s); this.typist = new Typist(s.text, s.ids); this.review = 0; this.coast = null;
    store.set("tw.current", s.id);
    this.retarget(true);
    if (isNew) { unlockAudio(); play("feed"); if (!reduceMotion()) { this.spring.y.v -= 420; this.setFeel(["y"], 0.62, 0.9); } }
    if (this.GL) this.GL.redrawAll();
    this.makeTiles(); this.kick(); this.bump();
  }
  feedNew() { this.closePanel(); this.openSheet(newSheet(), true); this.setTyping(true); }
  throwAway(s) {
    const wasCurrent = s.id === this.sheet.id, idx = this.sheets.findIndex((x) => x.id === s.id);
    this.sheets = this.sheets.filter((x) => x.id !== s.id); store.set("tw.sheets", this.sheets);
    this.lastThrown = { s, idx, wasCurrent };
    if (wasCurrent) this.openSheet(newSheet(), false, true);
    this.toast("Sheet thrown away.", "Undo", () => {
      const t = this.lastThrown; if (!t) return; this.lastThrown = null;
      this.sheets.splice(clamp(t.idx, 0, this.sheets.length), 0, t.s); store.set("tw.sheets", this.sheets);
      if (t.wasCurrent) this.openSheet(t.s, false, true); else this.bump();
    });
    this.bump();
  }
  armReset() {
    if (!this.state.armed) { this.setState({ armed: true }); clearTimeout(this.armTimer); this.armTimer = setTimeout(() => this.setState({ armed: false }), 4000); return; }
    clearTimeout(this.armTimer); this.setState({ armed: false }); this.closePanel(); this.resetAll();
  }
  resetAll() {
    this.persist(true);
    const backup = { sheets: readSheets(), current: this.sheet.id, defaults: store.get("tw.defaults", {}), sound: soundOn, buzz: buzzOn, lamp: this.state.lamp };
    this.sheets = []; store.set("tw.sheets", []); store.set("tw.defaults", {});
    soundOn = true; store.set("tw.sound", true); buzzOn = true; store.set("tw.buzz", true);
    this.setLamp(false);
    this.openSheet(newSheet(), true, true);
    this.toast("Everything is cleared.", "Undo", () => {
      store.set("tw.sheets", backup.sheets); store.set("tw.defaults", backup.defaults); this.sheets = backup.sheets;
      soundOn = backup.sound; store.set("tw.sound", soundOn); buzzOn = backup.buzz; store.set("tw.buzz", buzzOn);
      this.setLamp(backup.lamp);
      this.openSheet(backup.sheets.find((x) => x.id === backup.current) || newSheet(), false, true);
    });
  }
  choose(key, value) {
    unlockAudio(); playKey();
    if (key === "align") this.alignHere(value);
    else { this.sheet[key] = value; const d = store.get("tw.defaults", {}); d[key] = value; store.set("tw.defaults", d); }
    if (filled(this.sheet)) this.persist(true);
    if (key === "size" || key === "spacing") {
      this.clearSel(); const at = this.typist.caret; useMetrics(this.sheet); this.typist = new Typist(this.sheet.text, this.sheet.ids); this.typist.setCaret(at);
      this.review = clamp(this.review, this.reviewMin(), this.reviewLimit());
    }
    if (this.GL && ["face", "size", "align", "spacing", "flower"].includes(key)) this.GL.redrawAll();
    if (key === "paper" || key === "ink" || key === "face") this.makeTiles();
    this.retarget(); this.kick(); this.bump();
  }
  alignAtCaret() { return this.typist.layout.lines[this.typist.caretPos()[0]].align; }
  // Alignment belongs to paragraphs: the one at the caret, or every one the selection touches. Every other paragraph keeps
  // its own (each line break holds one, see strikeInto), and paragraphs typed from here on carry the new one.
  alignHere(value) {
    const s = this.sheet, ty = this.typist, ch = ty.chars, r = this.selRange() || [ty.caret, ty.caret];
    const start = r[0] ? ch.lastIndexOf("\n", r[0] - 1) : -1, end = ch.indexOf("\n", Math.max(r[0], r[1] - 1));
    const at = { ...(s.aligns || {}) };
    if (start < 0) s.align = value; else at[ty.ids[start]] = value;
    for (let i = start + 1; i < (end < 0 ? ch.length : end); i++) if (ch[i] === "\n") at[ty.ids[i]] = value;
    const breaks = new Set(ty.ids.filter((_, i) => ch[i] === "\n"));   // forget alignments of line breaks since deleted
    s.aligns = Object.fromEntries(Object.entries(at).filter(([id]) => breaks.has(+id)));
    useMetrics(s); ty.relayout(); s.updated = Date.now();
  }
  setTitle(v) {
    const tm = topMargin(this.sheet);
    this.sheet.title = sanitize(v).replace(/\n/g, " ").slice(0, 48); this.sheet.updated = Date.now(); this.persist();
    if (this.GL && !(topMargin(this.sheet) === tm && this.GL.patchTop())) this.GL.redrawAll();   // same margin: only the title band changes
    this.review = clamp(this.review, this.reviewMin(), this.reviewLimit()); this.retarget(); this.kick(); this.bump();
  }
  setSound(on) { soundOn = on; store.set("tw.sound", on); if (on) { unlockAudio(); playKey(); } mixNature(this.state.lamp ? 1 : 0); this.bump(); }
  setBuzz(on) { buzzOn = on; store.set("tw.buzz", on); this.bump(); }
  setLamp(on) { store.set("tw.lamp", on); window.__twLamp = on ? 1 : 0; this.spring.lamp.to = on ? 1 : 0; this.setState({ lamp: on }); mixNature(on ? 1 : 0); this.kick(); this.startView(); }
  setLetterOpens(on) { letterOpens = on; store.set("tw.letterOpens", on); this.bump(); }
  setNature(on) { natureOn = on; store.set("tw.nature", on); unlockAudio(); mixNature(this.state.lamp ? 1 : 0); this.bump(); }

  // ---------- panels and the toast ----------
  openPanel(name) {
    if (this.state.typing) this.setTyping(false);
    if (this.state.panel === name) { this.closePanel(); return; }
    if (name === "sheets") this.makeThumbs();
    this.setState({ panel: name, armed: false });
    if (name === "title") setTimeout(() => { const f = this.el.titleField; if (f) f.focus({ preventScroll: true }); }, 60);
  }
  closePanel() { if (this.state.panel) this.setState({ panel: null, armed: false }); }
  toast(text, label, run) {
    clearTimeout(this.toastTimer);
    this.toastRun = run || null;
    this.setState({ toast: { text, label: label || "" } });
    this.toastTimer = setTimeout(() => this.setState({ toast: null }), label ? 5000 : 2200);
  }

  // ---------- picture tiles for the pickers: drawn once, shown as images ----------
  tile(w, h, paint) {
    const k = Math.min(window.devicePixelRatio || 1, 3), c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext("2d"); g.scale(k, k); paint(g);
    try { return c.toDataURL("image/png"); } catch (e) { return ""; }
  }
  paperFill(g, w, h, p) {
    g.fillStyle = p.color; g.fillRect(0, 0, w, h);
    if (this.grain) { const pat = g.createPattern(this.grain, "repeat"); pat.setTransform(new DOMMatrix().scale(0.5)); g.save(); g.globalCompositeOperation = "multiply"; g.globalAlpha = Math.min(1, p.grain * 0.8); g.fillStyle = pat; g.fillRect(0, 0, w, h); g.restore(); }
  }
  makeTiles() {
    const s = this.sheet, paperDef = byId(PAPERS, s.paper), ink = byId(INKS, s.ink), dot = (g) => { g.beginPath(); g.arc(20, 20, 20, 0, Math.PI * 2); g.clip(); };
    const T = this.tiles;
    if (!T.papers) T.papers = Object.fromEntries(PAPERS.map((p) => [p.id, this.tile(40, 40, (g) => { dot(g); this.paperFill(g, 40, 40, p); })]));
    T.inks = Object.fromEntries(INKS.map((k) => [k.id, this.tile(40, 40, (g) => { dot(g); this.paperFill(g, 40, 40, paperDef); g.fillStyle = k.color; g.globalAlpha = k.fuzz ? 0.85 : 1; g.beginPath(); g.arc(20, 20, 11, 0, Math.PI * 2); g.fill(); })]));
    T.faces = Object.fromEntries(FACES.map((f) => [f.id, this.tile(150, 64, (g) => { this.paperFill(g, 150, 64, paperDef); g.fillStyle = ink.color; g.font = `30px "${f.family}"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Aa Qq", 75, 34); })]));
    T.flowers = Object.fromEntries(FLOWERS.map((f) => [f.id, this.tile(100, 64, (g) => { this.paperFill(g, 100, 64, paperDef); if (f.id !== "none") drawFlower(g, f.id, 50, 32, 58, -16, s.seed); })]));
  }
  makeThumbs() {
    const all = [this.sheet, ...this.sheets.filter((s) => s.id !== this.sheet.id)];
    for (const s of all) {
      const key = s.id + ":" + s.updated + ":" + s.paper + s.ink + s.face + s.flower + s.size + s.spacing;
      if (this.thumbs.get(s.id) && this.thumbs.get(s.id).key === key) continue;
      const src = this.tile(44, 57, (g) => {
        const sc = 44 / PAPER_W; g.scale(sc, sc);
        const chars = graphemes(sanitize(s.text || "")), ids = unpackIds(s.ids, chars.length);
        useMetrics(s); drawSheet(g, s, layoutChars(chars.slice(0, 1400), ids && ids.slice(0, 1400)), 0, 0, 57 / sc, PAPER_W, 57 / sc, false); useMetrics(this.sheet);
      });
      this.thumbs.set(s.id, { key, src });
    }
    for (const id of this.thumbs.keys()) if (!all.some((s) => s.id === id)) this.thumbs.delete(id);
  }

  // ---------- downloads ----------
  fileBase() { const first = sheetName(this.sheet).slice(0, 40).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase(); return "typewrite-" + (first || "sheet"); }
  async saveBlob(blob, name) {
    if (shell("save")) {   // the app shows its share sheet: Save to Files, AirDrop, Messages
      const data = await new Promise((done) => { const r = new FileReader(); r.onload = () => done(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
      shell("save").postMessage({ name, type: blob.type, data }); return true;
    }
    let dl = null;
    try { dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); return true; }
      catch (e) {
        const code = e && e.code;
        if (code === "declined") return false;
        if (code === "rate_limited") { this.toast("A save is already waiting for an answer."); return false; }
        if (!["unavailable", "not_granted", "capability_disabled", "capability_removed"].includes(code)) { this.toast("Couldn't save that file here."); return false; }
      }
    }
    const a = this.el.dl; if (!a) return false;
    const url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }
  sheetLayout() { const L = layoutChars(this.typist.chars, this.typist.ids); return { L, h: sheetHeight(this.sheet, L) }; }
  // The slice [from, to] of the sheet (in points) as a picture.
  sheetCanvas(L, h, scale, from = 0, to = h) {
    if (this.GL) return this.GL.exportPng(L, h, scale, from, to);
    const c = document.createElement("canvas"); c.width = Math.round(PAPER_W * scale); c.height = Math.round((to - from) * scale);
    const g = c.getContext("2d"); g.scale(scale, scale); g.translate(0, -from); drawSheet(g, this.sheet, L, 0, 0, h, PAPER_W, h, false);
    return c;
  }
  // Where a long sheet is cut into pages: each at most `most` points, cut in the gap under a line of type.
  pageCuts(h, most) {
    const n = Math.ceil(h / most), tm = topMargin(this.sheet), cuts = [0];
    for (let k = 1; k < n; k++) cuts.push(tm + (Math.floor((k * h / n - tm) / LH) + 0.27) * LH);
    return cuts.concat(h);
  }
  exportPng() {
    this.closePanel();
    // A picture can be at most 14000 px tall (what phones can draw): a long sheet goes out as pages, each at twice size or more.
    const { L, h } = this.sheetLayout(), cuts = this.pageCuts(h, 7000), pages = cuts.length - 1;
    const scale = Math.min(3, 14000 / Math.max(...cuts.slice(1).map((y, i) => y - cuts[i])));
    (async () => {
      for (let i = 0; i < pages; i++) {
        const b = await new Promise((done) => this.sheetCanvas(L, h, scale, cuts[i], cuts[i + 1]).toBlob(done, "image/png"));
        if (!b) { this.toast("Couldn't make the picture. Try the words instead."); return; }
        if (!(await this.saveBlob(b, this.fileBase() + (pages > 1 ? "-page-" + (i + 1) : "") + ".png"))) return;
      }
      this.toast(pages > 1 ? "Saved the picture as " + pages + " pages." : "Saved the picture.");
    })();
  }
  // ---------- Send as a letter: one HTML file, a sealed envelope that the reader tears open ----------
  letterHtml(parts, back, env) {
    const s = this.sheet, paper = byId(PAPERS, s.paper).color, ground = this.state.lamp ? "#151A22" : "#E7E1CF";
    const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    const words = ((s.title || "").trim() ? s.title.trim() + "\n\n" : "") + this.typist.text;
    const fill = { TITLE: esc(sheetName(s)), PAPER: paper, IMG1: this.flatten(parts[0], ground).toDataURL("image/jpeg", 0.9), IMG2: this.flatten(parts[1], ground).toDataURL("image/jpeg", 0.9), IMG3: this.flatten(parts[2], ground).toDataURL("image/jpeg", 0.9), BACK: this.flatten(back, paper).toDataURL("image/jpeg", 0.82), ENVIMG: this.flatten(env, paper).toDataURL("image/jpeg", 0.85), IMGW: parts[0].width, IMGH: parts[0].height + parts[1].height + parts[2].height, WORDS: esc(words), ANIMATE: letterOpens ? "true" : "false", BODY: this.state.lamp ? "night" : "", SOUNDS: JSON.stringify({ tear: LETTER_SOUNDS.tear, fold: LETTER_SOUNDS.fold, unfold: LETTER_SOUNDS.unfold, slide: LETTER_SOUNDS.slide }) };
    return LETTER_HTML.replace(/%%([A-Z0-9]+)%%/g, (_, k) => fill[k]);
  }
  blankPaper(hPt, scale) {
    const keep = this.sheet;
    this.sheet = { ...keep, text: "", title: "", flower: "none" };
    try {
      if (this.GL) return this.GL.exportPng({ lines: [] }, hPt, scale);
      const c = document.createElement("canvas"); c.width = Math.round(PAPER_W * scale); c.height = Math.round(hPt * scale);
      const g = c.getContext("2d"); g.scale(scale, scale); drawSheet(g, this.sheet, { lines: [] }, 0, 0, hPt, PAPER_W, hPt, false);
      return c;
    } finally { this.sheet = keep; if (this.GL) { this.GL.redrawAll(); this.GL.render(); } }
  }
  // JPEG has no transparency: lay the sheet's worn, see-through edges on the ground the letter will be read on.
  flatten(c, ground) {
    const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
    const g = o.getContext("2d"); g.fillStyle = ground; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0);
    return o;
  }
  async shareLetter() {
    if (!filled(this.sheet) || this.state.send) return;
    this.closePanel(); this.setTyping(false); unlockAudio();
    // The letter folds in three, so each third is its own picture: a long letter stays sharp (each up to 14000 px).
    const { L, h } = this.sheetLayout(), scale = Math.min(2.2, 14000 / (h / 3));
    const parts = [0, 1, 2].map((k) => this.sheetCanvas(L, h, scale, k * h / 3, (k + 1) * h / 3));
    // The send-off on screen needs only one small picture of the whole sheet.
    const s2 = Math.min(2.2, 9000 / h), c = document.createElement("canvas"), cg = c.getContext("2d");
    c.width = Math.round(PAPER_W * s2); c.height = Math.round(h * s2);
    parts.forEach((p, k) => cg.drawImage(p, 0, Math.round(k * h / 3 * s2), c.width, Math.round(h / 3 * s2)));
    // The back of the letter and the envelope are the same stock as the sheet: its colour, grain, fibres, foxing and edges.
    const back = this.blankPaper(h, Math.min(1.3, scale * 0.6, 9000 / h)), env = this.blankPaper(PAPER_W * 4.125 / 9.5, 2);
    const blob = new Blob([this.letterHtml(parts, back, env)], { type: "text/html;charset=utf-8" });
    await this.sendOff(c, h, back, env);
    if (await this.saveBlob(blob, this.fileBase() + "-letter.html")) this.toast("Your letter is sealed. Send the file to anyone.");
  }
  // The sheet tears out of the machine, folds in three, slips into an envelope, is sealed and flies off.
  async sendOff(c, h, back, env) {
    if (!this.GL || reduceMotion()) return;
    const blobUrl = async (cv, type) => URL.createObjectURL(await new Promise((r) => cv.toBlob(r, type, 0.88)));
    const url = await blobUrl(c, "image/png"), backUrl = await blobUrl(back, "image/jpeg"), envUrl = await blobUrl(env, "image/jpeg");
    const W = this.W, H = this.H, sp = this.spring;
    const left = this.toScreen(-PAPER_W / 2, 0)[0], pw = this.toScreen(PAPER_W / 2, 0)[0] - left;
    const top = this.toScreen(0, topMargin(this.sheet) + sp.y.v)[1], tear = this.toScreen(0, BEND_Y)[1], hs = pw * h / PAPER_W;
    const fit = Math.min(0.62 * H / hs, 0.5 * W / pw, 1), ew = Math.min(W * 0.7, 520), eh = ew * 4.125 / 9.5, cx = W / 2, cy = H * 0.47, ey = cy + 30;
    const fit2 = Math.min(ew * 0.9 / pw, eh * 0.84 / (hs / 3)), mid = top + hs / 2, px = (n) => n.toFixed(1) + "px";
    const style = { "--x": px(left), "--y": px(top), "--w": px(pw), "--h": px(hs), "--tear": px(tear), "--pull": px(-(top + hs - tear + 16)),
      "--fx": px(cx - (left + pw / 2)), "--fy": px(cy - mid), "--fit": fit.toFixed(4), "--fit2": fit2.toFixed(4), "--hy": px(ey - eh * 0.95 - mid), "--iy": px(ey + eh * 0.06 - mid),
      "--ex": px(cx - ew / 2), "--ey": px(ey - eh / 2), "--ew": px(ew), "--eh": px(eh), "--ox": px(cx), "--oy": px(ey), "--ax": px(W - 34 - cx), "--ay": px(30 - ey),
      "--img": `url(${url})`, "--back": `url(${backUrl})`, "--paper": byId(PAPERS, this.sheet.paper).color };
    const css = Object.entries(style).map(([k, v]) => k + ":" + v).join(";");
    const step = (phase, ms, sound) => new Promise((done) => { this.setState({ send: { phase, css, env: envUrl } }); if (sound) play(sound[0], sound[1]); setTimeout(done, ms); });
    this.GL.hidePaper(true); this.kick();
    await step("start", 60);
    await step("pull", 540, ["feed", 0.8]);
    await step("float", 560, ["letter-tear", 0.9]);
    await step("fold3", 440, ["letter-fold", 0.7]);
    await step("fold1", 460, ["letter-fold", 0.6]);
    await step("env", 520, ["letter-slide", 0.5]);
    await step("insert", 460, ["letter-slide", 0.7]);
    await step("close", 520, ["letter-seal", 0.9]);
    await step("away", 560, ["letter-slide", 0.5]);
    this.setState({ send: null }); [url, backUrl, envUrl].forEach((u) => URL.revokeObjectURL(u));
    this.GL.hidePaper(false);
    if (!reduceMotion()) { sp.y.v -= 420; this.setFeel(["y"], 0.62, 0.9); }   // a fresh copy of the sheet rolls back up into the machine
    play("feed"); this.kick();
  }
  exportTxt() {
    this.closePanel();
    const head = (this.sheet.title || "").trim() ? this.sheet.title.trim() + "\n\n" : "";
    this.saveBlob(new Blob([head + this.sheet.text.replace(/\s+$/, "") + "\n"], { type: "text/plain;charset=utf-8" }), this.fileBase() + ".txt").then((ok) => { if (ok) this.toast("Saved the words."); });
  }

  // ---------- what the template shows ----------
  renderVals() {
    const s = this.sheet, st = this.state, panel = st.panel, T = this.tiles, n = this.typist.chars.length;
    const radio = (key, list, extra, cur = s[key]) => list.map((item) => ({ ...item, key: item.id, on: cur === item.id ? "true" : "false", tab: cur === item.id ? "0" : "-1", choose: () => this.choose(key, item.id), ...(extra ? extra(item) : {}) }));
    const sheetsList = panel !== "sheets" ? [] : [s, ...this.sheets.filter((x) => x.id !== s.id)].filter((x) => filled(x) || x.id === s.id).map((x) => {
      const cur = x.id === s.id, words = wordCount(x.text || "");
      return { key: x.id, name: filled(x) ? sheetName(x) : "Blank sheet", current: cur ? "true" : "false", thumb: (this.thumbs.get(x.id) || {}).src || "",
        sub: (cur ? "In the machine" : new Date(x.updated).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })) + " · " + (words === 1 ? "1 word" : words + " words"),
        canThrow: filled(x), open: () => { if (!cur) this.openSheet(x, false); this.closePanel(); }, throwAway: () => this.throwAway(x), throwLabel: "Throw away " + sheetName(x) };
    });
    const blank = !filled(s), toast = st.toast, expanded = (name) => (panel === name ? "true" : "false");
    const alignRows = { left: [[4, 16], [4, 12], [4, 16], [4, 10]], center: [[4, 16], [6, 12], [4, 16], [7, 10]], right: [[4, 16], [8, 12], [4, 16], [10, 10]] };
    return {
      setRoot: this.ref("root"), setStage: this.ref("stage"), setView: this.ref("view"), setGl: this.ref("gl"), setFlat: this.ref("flat"),
      setKeys: this.ref("keys"), setClip: this.ref("clip"), setDl: this.ref("dl"), setGhostAsk: this.ref("ghostAsk"), setGhostStart: this.ref("ghostStart"), setTitleField: this.ref("titleField"),
      typingAttr: st.typing ? "true" : "false", selAttr: st.sel ? "true" : "false", lampAttr: st.lamp ? "true" : "false", readyAttr: st.ready ? "true" : "false",
      panelAttr: panel || "none", touchTyping: st.typing && !finePointer(),
      stageLabel: s.text ? "Your sheet: " + s.text.slice(0, 2000) : "A blank sheet in a typewriter",
      ghostOn: n === 0 ? "true" : "false", ghostAskText: finePointer() ? "No first line yet? Just start typing." : "No first line yet? Tap the page.",
      ghostAskOn: n === 0 && !st.typing ? "true" : "false", ghostStartFade: st.typing ? "true" : "false",
      ghostDown: (e) => { e.preventDefault(); if (this.swallowTap) { this.swallowTap = false; return; } if (!panel) this.setTyping(true); },
      count: thousands(n) + " / " + thousands(MAX_CHARS),
      soundOn: soundOn ? "true" : "false", buzzOn: buzzOn ? "true" : "false", lampOn: st.lamp ? "true" : "false",
      sheetsOpen: panel === "sheets", saveOpen: panel === "save", paperOpen: panel === "paper", inkOpen: panel === "ink", faceOpen: panel === "face", titleOpen: panel === "title", flowerOpen: panel === "flower",
      sheetsX: expanded("sheets"), saveX: expanded("save"), paperX: expanded("paper"), inkX: expanded("ink"), faceX: expanded("face"), titleX: expanded("title"), flowerX: expanded("flower"),
      openSheets: () => this.openPanel("sheets"), openSave: () => this.openPanel("save"), openPaper: () => this.openPanel("paper"), openInk: () => this.openPanel("ink"),
      openFace: () => this.openPanel("face"), openTitle: () => this.openPanel("title"), openFlower: () => this.openPanel("flower"), closePanel: () => this.closePanel(),
      feedNew: () => this.feedNew(), done: () => this.setTyping(false),
      toggleLamp: () => { unlockAudio(); play("backspace"); this.setLamp(!st.lamp); },
      toggleSound: () => this.setSound(!soundOn), toggleBuzz: () => this.setBuzz(!buzzOn), toggleNature: () => this.setNature(!natureOn), natureOn: natureOn ? "true" : "false",
      papers: radio("paper", PAPERS, (p) => ({ img: (T.papers || {})[p.id] || "" })),
      inks: radio("ink", INKS, (k) => ({ img: (T.inks || {})[k.id] || "" })),
      faces: radio("face", FACES, (f) => ({ img: (T.faces || {})[f.id] || "" })),
      flowers: radio("flower", FLOWERS, (f) => ({ img: (T.flowers || {})[f.id] || "" })),
      sizes: radio("size", SIZES), spacings: radio("spacing", SPACINGS),
      aligns: radio("align", ALIGNS, (a) => ({ d: alignRows[a.id].map(([x, w], i) => `M${x} ${6 + i * 4}h${w}`).join("") }), this.alignAtCaret()),
      paperNote: byId(PAPERS, s.paper).id === "onion" ? "Onionskin: thin, rag-strong and cockled, made for carbon copies. Hold it to the light and the machine shows through."
        : byId(PAPERS, s.paper).id === "canary" ? "The yellow second sheet: cheap manifold stock that took the carbon copy under the top sheet."
        : byId(PAPERS, s.paper).id === "bright" ? "Twenty-pound cotton bond: the ribbon's ink wicks into the rag fibres." : "Every sheet ages in its own way: its own specks, fibres and foxing.",
      inkNote: byId(INKS, s.ink).cloth ? "A cloth ribbon: the weave shows in every letter, and the ink soaks into the fibres." : byId(INKS, s.ink).crisp ? "A film ribbon: each strike lays down all its coating, crisp and even." : "A carbon copy: soft, smudged letters with carbon caught in the paper's tooth.",
      sheetsList, titleValue: s.title || "", onTitle: (e) => this.setTitle(e.target.value), titleKey: (e) => { if (e.key === "Enter") { e.preventDefault(); this.closePanel(); } },
      saveBlank: blank, saveNote: blank ? "Type something first, then come back to share it." : "The letter and the picture are the sheet exactly as it looks here: paper, ink and flower.",
      shareLetter: () => { if (!blank) this.shareLetter(); }, letterOpens: letterOpens ? "true" : "false", toggleLetterOpens: () => this.setLetterOpens(!letterOpens),
      sendOn: !!st.send, sendPhase: st.send ? st.send.phase : "", sendCss: st.send ? st.send.css : "", sendEnv: st.send ? st.send.env : "",
      savePng: () => { if (!blank) this.exportPng(); }, saveTxt: () => { if (!blank) this.exportTxt(); },
      armed: st.armed ? "true" : "false", resetLabel: st.armed ? "Click again to erase everything" : "Reset everything",
      resetHint: st.armed ? "All your sheets, and paper, ribbon, type and sound settings" : "Erases every sheet and setting in this browser", resetAll: () => this.armReset(),
      editCopy: () => this.copySel(), editCut: () => this.cutSel(), editDelete: () => this.deleteSel(), editPaste: () => this.pasteClipboard(), editAll: () => this.selectAll(),
      editHold: (e) => e.preventDefault(), noSel: !this.selRange(),
      toastOn: !!toast, toastText: toast ? toast.text : "", toastLabel: toast ? toast.label : "", toastHasAction: !!(toast && toast.label),
      toastRun: () => { const run = this.toastRun; this.setState({ toast: null }); if (run) run(); },
      scrimDown: () => { this.swallowTap = true; this.closePanel(); },
      flatOn: st.ready && !this.GL,
    };
  }
}
