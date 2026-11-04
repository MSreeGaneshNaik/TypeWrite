const PAPER_VS = `
uniform float uPaperW, uPaperH, uWinTop, uWinH, uTopY, uBow, uCurl, uFlat, uBendY, uBendR, uBendRamp;
varying vec2 vSheet; varying vec3 vWorld; varying vec3 vNormal; varying float vCurl; varying float vRoll;
// How far the sheet has turned after running s points past the bend's start: its curvature grows from nothing
// to 1/uBendR over uBendRamp, so the paper eases backward instead of folding at a line.
float bendAngle(float s) { return s < uBendRamp ? s * s / (2.0 * uBendRamp * uBendR) : (s - 0.5 * uBendRamp) / uBendR; }
void main() {
  float sx = (position.x + 0.5) * uPaperW;
  float sy = clamp(uWinTop + (0.5 - position.y) * uWinH, 0.0, uPaperH);
  vSheet = vec2(sx, sy);
  float k = 1.0 - uFlat;
  float nx = sx / uPaperW * 2.0 - 1.0;
  float t = clamp(1.0 - sy / 64.0, 0.0, 1.0);
  float shape = 0.3 + 0.7 * nx * nx;
  // A sheet in a machine is never flat: it bows a little, and its top edge curls away.
  float z = -(uBow * nx * nx + uCurl * t * t * shape) * k;
  float dzdx = -(uBow * 2.0 * nx + uCurl * t * t * 1.4 * nx) * (2.0 / uPaperW) * k;
  float dzdsy = (uCurl * 2.0 * t * shape / 64.0) * k;
  vec3 nrm = normalize(vec3(-dzdx, dzdsy, 1.0));
  float y = uTopY - sy;
  vRoll = 0.0;
  // Below the type line the sheet wraps round the platen, the way paper does in a real machine:
  // rolling the page back carries the lines down over the roller and out of sight.
  if (k > 0.0 && y < uBendY) {
    float s = uBendY - y, sEnd = 3.14159265 * uBendR + 0.5 * uBendRamp;   // sEnd: half a turn, behind the platen
    float sc = min(s, sEnd), ds = sc / 24.0, dy = 0.0, dz = 0.0;
    for (int i = 0; i < 24; i++) { float th = bendAngle((float(i) + 0.5) * ds); dy += cos(th) * ds; dz += sin(th) * ds; }
    float a = bendAngle(sc);
    y = mix(y, uBendY - dy, k);
    z -= (dz + (s - sc)) * k;
    nrm = normalize(mix(nrm, vec3(0.0, -sin(a), cos(a)), k));
    vRoll = a / 3.14159265;
  }
  vNormal = nrm;
  vCurl = t * k;
  vec4 wp = modelMatrix * vec4(sx - uPaperW * 0.5, y, z, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const PAPER_FS = `
uniform float uPaperW, uPaperH, uFlat, uSeedX, uSeedY;
uniform vec3 uPaperCol, uInkCol;
uniform float uGrain, uAge, uLaid, uFibre, uCockle, uSheer, uSoak;
uniform float uCloth, uCrisp, uFuzz;
uniform sampler2D uInk; uniform float uInkTop, uInkH;
uniform sampler2D uFlower; uniform vec4 uFlowerRect; uniform float uFlowerOn;
uniform float uLamp; uniform vec3 uLampPos; uniform float uLampReach;
uniform float uPxPerPt; uniform vec2 uView;
uniform float uRodY, uRodR, uCaretX;
uniform vec4 uGrid;     // top margin, line height, side margin, column width (points)
uniform vec4 uSel;      // selection: first line, first column, last line, end column; x < 0 when nothing is selected
uniform vec2 uSelShift; // how far the first and last selected lines are shifted by the alignment, in columns
varying vec2 vSheet; varying vec3 vWorld; varying vec3 vNormal; varying float vCurl; varying float vRoll;

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(11.7, 5.3); a *= 0.5; } return v; }

void main() {
  vec2 s = vSheet;
  vec2 p = s + vec2(uSeedX, uSeedY);
  // Worn, slightly uneven edges.
  float rag = (vnoise(p * 0.45) - 0.5) * 0.55 + (vnoise(p * 1.9) - 0.5) * 0.14;
  float inset = min(min(s.x, uPaperW - s.x), min(s.y, uPaperH - s.y)) - 0.35 - rag;
  float alpha = clamp(inset * uPxPerPt + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) discard;

  // ---- The paper: tone, mottling, fibres, specks, foxing, browned edges, laid and chain lines ----
  float mott = fbm(p / 95.0);
  float mid = fbm(p / 16.0);
  float tooth = vnoise(p * 1.6) * 0.6 + vnoise(p * 4.1) * 0.4;
  float f1 = vnoise(vec2(p.x * 1.1, p.y * 0.09) + 3.0), f2 = vnoise(vec2(p.x * 0.09, p.y * 1.1) + 9.0);
  float fib = smoothstep(0.72, 0.95, max(f1 * vnoise(p * 0.35), f2 * vnoise(p * 0.33 + 4.0)) * 1.25);
  vec2 sc = floor(p / 7.0);
  vec2 sp = (sc + 0.2 + 0.6 * vec2(hash(sc + 1.3), hash(sc + 7.1))) * 7.0;
  float sr = 0.22 + 0.5 * pow(hash(sc + 3.7), 3.0);
  float speck = step(0.83, hash(sc + 11.0)) * (1.0 - smoothstep(sr * 0.35, sr, length(p - sp)));
  vec2 fc = floor(p / 52.0);
  vec2 fp = (fc + 0.2 + 0.6 * vec2(hash(fc + 2.1), hash(fc + 6.4))) * 52.0;
  float fr = 1.5 + 9.0 * pow(hash(fc + 4.4), 2.0);
  float fd = length(p - fp) + (fbm(p / 3.5) - 0.5) * fr * 1.1;
  float fox = step(1.0 - 0.14 * uAge, hash(fc + 8.8)) * (1.0 - smoothstep(fr * 0.25, fr, fd));
  float foxCore = fox * (1.0 - smoothstep(0.0, fr * 0.35, fd));
  float ed = min(min(s.x, uPaperW - s.x), min(s.y, uPaperH - s.y));
  float edge = (1.0 - smoothstep(0.0, 18.0 + 26.0 * fbm(p / 28.0), ed)) * uAge;
  float laidRib = uLaid * (0.5 + 0.5 * sin(s.y * 6.2831853 / 2.4));
  float cx = abs(fract((s.x + 9.0) / 72.0) - 0.5) * 72.0;
  float chain = uLaid * (1.0 - smoothstep(0.5, 2.2, cx));

  vec3 col = uPaperCol;
  col = mix(col, col * vec3(1.0, 0.965, 0.88), uAge * 0.55);
  col *= 1.0 - uGrain * (0.075 * (mott - 0.5) + 0.04 * (mid - 0.5) + 0.03 * (tooth - 0.5));
  col = mix(col, col * vec3(0.84, 0.8, 0.72), fib * 0.32 * uFibre);
  col = mix(col, vec3(0.19, 0.16, 0.13), speck * 0.82);
  col = mix(col, col * vec3(0.8, 0.63, 0.45), fox * 0.42 + foxCore * 0.25);
  col = mix(col, col * vec3(0.79, 0.67, 0.5), edge * 0.62);
  col *= 1.0 - 0.012 * laidRib - 0.022 * chain;

  // ---- The ink: a cloth ribbon pressed into paper fibres ----
  vec2 iuv = vec2(s.x / uPaperW, (s.y - uInkTop) / uInkH);
  float inside = step(0.0, iuv.y) * step(iuv.y, 1.0);
  vec4 sharp = texture2D(uInk, iuv);
  vec4 soft = texture2D(uInk, iuv, 1.4 + uFuzz * 0.9);
  float halo = texture2D(uInk, iuv, 3.2 + uFuzz * 0.6).a;
  float strength = max(sharp.g, soft.g / max(soft.a, 0.05) * step(0.02, soft.a));
  strength = clamp(strength, 0.0, 1.0);
  float n1 = vnoise(p * 3.4 + 7.0), n2 = vnoise(p * 1.1 + 3.0);
  // Cloth ink wicks into the fibres (soft paper drinks more); film coating sits sharp on top; carbon paper smudges.
  strength = mix(strength, 0.97, uCrisp * 0.85);
  float shape = mix(sharp.a, soft.a, clamp(0.3 + 0.25 * uSoak - 0.25 * uCrisp + 0.4 * uFuzz, 0.05, 0.85));
  float ragged = (1.0 - 0.75 * uCrisp) * (1.0 + 0.6 * uFuzz);
  float thr = 0.47 + ((n1 - 0.5) * 0.36 + (n2 - 0.5) * 0.14) * ragged + (1.0 - strength) * 0.14 * (1.0 - uCrisp);
  float edgeW = mix(0.07, 0.025, uCrisp) + 0.06 * uFuzz;
  float cov = smoothstep(thr - edgeW, thr + edgeW, shape);
  vec2 q = vec2(s.x + s.y, s.x - s.y) * 1.4;
  float weave = 0.74 + 0.26 * smoothstep(-0.3, 0.7, sin(q.x * 6.2831853) * sin(q.y * 6.2831853));
  float weaveOn = smoothstep(1.4, 3.2, uPxPerPt);
  float inkAmt = cov * strength * mix(1.0, weave, 0.85 * weaveOn * uCloth);
  inkAmt = max(inkAmt, halo * (0.11 + 0.05 * uSoak + 0.16 * uFuzz) * strength);
  inkAmt *= 1.0 - 0.22 * uFuzz * (1.0 - tooth);       // carbon catches on the paper's tooth, skips the hollows
  inkAmt *= (0.9 + 0.1 * tooth) * inside;
  // ---- A selection: a soft blue wash behind the chosen letters, under the ink ----
  if (uSel.x >= 0.0 && uFlat < 0.5) {
    float sl = floor((s.y - uGrid.x) / uGrid.y + 0.74), sc = (s.x - uGrid.z) / uGrid.w;
    float inLine = step(0.0, sc) * step(sc, (uPaperW - 2.0 * uGrid.z) / uGrid.w);
    float picked = step(uSel.x, sl) * step(sl, uSel.z) * inLine
                 * (sl > uSel.x ? 1.0 : step(uSel.y, sc - uSelShift.x))
                 * (sl < uSel.z ? 1.0 : step(sc - uSelShift.y, uSel.w));
    col = mix(col, col * vec3(0.7, 0.82, 1.0), picked);
  }
  col = mix(col, uInkCol, clamp(inkAmt, 0.0, 1.0) * 0.95);

  // ---- The pressed flower: dyes soaked into the sheet, and a faint stain around it ----
  if (uFlowerOn > 0.5) {
    vec2 fuv = (s - uFlowerRect.xy) / uFlowerRect.zw;
    if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
      vec4 fl = texture2D(uFlower, fuv);
      float stain = texture2D(uFlower, fuv, 3.5).a;
      col *= 1.0 - 0.07 * stain * (1.0 - fl.a);
      col = mix(col, col * mix(vec3(1.0), fl.rgb / max(fl.a, 0.01), 0.92), fl.a * 0.92);
    }
  }

  // ---- Light: a soft key from above, the bow and the curl, every dent each key left ----
  float cockle = uCockle * (fbm(p / 11.0) - 0.5 + 0.5 * (vnoise(p / 4.5) - 0.5));
  float hgt = tooth * 0.55 + (mid - 0.5) * 0.5 + laidRib * 0.18 + fib * 0.25 - soft.a * strength * (1.6 + 0.6 * (1.0 - uCrisp)) + cockle * 7.0;
  vec2 grad = vec2(dFdx(hgt), dFdy(hgt)) * uPxPerPt;
  vec3 N = normalize(vNormal + vec3(-grad, 0.0) * 0.14);
  vec3 KEY = normalize(vec3(-0.35, 0.55, 1.0));
  float lit = dot(N, KEY) / KEY.z;
  float day = max(mix(1.0, lit, 0.9), 0.12) * (1.0 - 0.35 * smoothstep(0.04, 0.45, vRoll));
  vec2 scr = gl_FragCoord.xy / uView;
  float vig = 1.0 - (0.11 * smoothstep(0.5, 1.0, scr.y) + 0.05 * smoothstep(0.3, 0.0, scr.y) + 0.06 * smoothstep(0.55, 1.0, abs(scr.x - 0.5) * 2.0)) * (1.0 - uFlat);
  day *= vig * (1.0 - 0.1 * vCurl);
  vec3 Lv = uLampPos - vWorld; float d = length(Lv);
  float fall = 1.0 / (1.0 + d * d / (uLampReach * uLampReach));
  vec2 away = vWorld.xy - uLampPos.xy;
  float beam = smoothstep(-0.25, 0.65, away.y / max(length(away), 0.001));
  float lambert = max(dot(N, Lv / max(d, 0.001)), 0.0);
  vec3 lamp = vec3(1.0, 0.83, 0.6) * (0.035 + 1.45 * fall * mix(0.3, 1.0, beam) * (0.3 + 0.7 * lambert));
  vec3 light = mix(vec3(day), lamp, uLamp);
  // The rod and the guide shade the page just below them.
  float below = (uRodY - uRodR) - vWorld.y;
  float rodShade = (1.0 - smoothstep(0.0, 10.0, below)) * step(-1.0, below) * 0.2;
  vec2 pd = (vWorld.xy - vec2(uCaretX, uRodY - 12.0)) / vec2(52.0, 16.0);
  float pillShade = (1.0 - smoothstep(0.25, 1.0, length(pd))) * 0.22;
  light *= 1.0 - (rodShade + pillShade) * (1.0 - uFlat) * (1.0 - 0.6 * uLamp);
  col *= light;
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  alpha *= 1.0 - uSheer * (1.0 - uFlat) * (1.0 - inkAmt);
  gl_FragColor = vec4(col * alpha, alpha);
}`;
const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
