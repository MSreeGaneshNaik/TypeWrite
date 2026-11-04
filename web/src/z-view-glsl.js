// ---------- The view: a painted sky and land behind the machine, sunrise by day, moonlit with the lamp on ----------
// painting(px, res): px from the top-left in device pixels. uRollerY: where the roller begins. uNight: 0 day, 1 night.
const PAINT_GLSL = `
#ifndef SSAA
#define SSAA 1            // 1: 4x rotated-grid supersampling, 0: one sample per pixel
#endif
#ifndef SSAA_ADAPTIVE
#define SSAA_ADAPTIVE 1   // 1: only supersample 2x2 quads with visible contrast
#endif
#ifndef SSAA_THRESHOLD
#define SSAA_THRESHOLD 0.035
#endif

uniform float uRollerY;
uniform float uNight;

// ---------------------------------------------------------------- palette ---
const vec3 C_ZENITH  = vec3(0.749, 0.796, 0.796); // #BFCBCB
const vec3 C_CREAM   = vec3(0.949, 0.894, 0.776); // #F2E4C6
const vec3 C_PEACH   = vec3(0.965, 0.835, 0.604); // #F6D59A
const vec3 C_SUN     = vec3(1.000, 0.969, 0.890); // #FFF7E3
const vec3 C_CLOUDHI = vec3(0.984, 0.941, 0.847); // #FBF0D8
const vec3 C_CLOUDSH = vec3(0.722, 0.702, 0.765); // #B8B3C3
const vec3 C_FAR     = vec3(0.682, 0.714, 0.635); // #AEB6A2
const vec3 C_MID     = vec3(0.557, 0.604, 0.424); // #8E9A6C
const vec3 C_MEADOW1 = vec3(0.784, 0.749, 0.475); // #C8BF79
const vec3 C_MEADOW2 = vec3(0.655, 0.651, 0.369); // #A7A65E
const vec3 C_YELLOW  = vec3(0.953, 0.769, 0.263); // #F3C443
const vec3 C_ORANGE  = vec3(0.933, 0.604, 0.298); // #EE9A4C
const vec3 C_WHITE   = vec3(1.000, 0.961, 0.875); // #FFF5DF
const vec3 C_MIST    = vec3(0.969, 0.941, 0.886); // #F7F0E2

// ------------------------------------------------------------ hash / noise --
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 h32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = h12(i);
  float b = h12(i + vec2(1.0, 0.0));
  float c = h12(i + vec2(0.0, 1.0));
  float d = h12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vn1(float x) {
  float i = floor(x);
  float f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(h11(i), h11(i + 1.0), f);
}
float fbm1(float x) {
  float s = 0.5 * vn1(x); x = x * 2.07 + 1.3;
  s += 0.25 * vn1(x);     x = x * 2.11 + 4.7;
  s += 0.125 * vn1(x);
  return s / 0.875;
}

// directional brush texture: long along dir, narrow across. Returns ~[0,1].
float brush(vec2 p, vec2 dir, float len, float wid) {
  vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
  return vn(vec2(q.x / len, q.y / wid));
}
// turn a smooth value into soft painted tonal steps whose borders wander with n
float bands(float v, float n, float levels, float soft) {
  float x = v * levels + (n - 0.5) * 0.9;
  float i = floor(x);
  float f = x - i;
  return (i + smoothstep(0.5 - soft, 0.5 + soft, f)) / levels;
}

// ------------------------------------------------------------ time of day --
// everything below depends on uNight only through these per-pixel globals
float gHalfW, gHor, gRoll;
vec2  gSun, gSunDay, gMoon;
vec4  gW;                         // keyframe weights: day, sunset, dusk, night
float gSet, gNight, gMoonVis, gSunVis, gLightMix, gLightUp;
vec3  gZen, gMidSky, gHorSky, gGlowC, gCoreC, gTwiC;
float gGlowAmt, gTwiAmt, gBloomAmt, gCoreAmt;
vec3  gCSh, gCMid, gCLit, gRim;
float gRimAmt, gNearWarm, gCloudK, gChroma, gRimW;
vec3  gFarG, gNearG;              // land grade (far / near), weighted by non-day keys

vec3  tod(vec3 a, vec3 b, vec3 c, vec3 d) { return a * gW.x + b * gW.y + c * gW.z + d * gW.w; }
float todf(vec4 v) { return dot(v, gW); }

void setupScene(vec2 res) {
  float H = res.y;
  gHalfW = 0.5 * res.x / H;
  gRoll = (uRollerY > 1.0 ? uRollerY : 0.7 * H) / H;
  gHor = gRoll - 0.22;
  float u = clamp(uNight, 0.0, 1.0);
  float ka = smoothstep(0.0, 0.35, u), kb = smoothstep(0.35, 0.62, u), kc = smoothstep(0.62, 1.0, u);
  gW = vec4(1.0 - ka, ka - kb, kb - kc, kc);

  // the sun swings along an arc, down and to the right, behind the far hills
  gSunDay = vec2(0.0, clamp(gHor - 0.10, 0.30, 0.40));
  gSet = pow(clamp(u * 2.0, 0.0, 1.0), 1.3);       // touches the hills around 0.35
  float ph = gSet * 1.5708;
  vec2 s1 = vec2(min(0.30, gHalfW * 0.6), gHor + 0.05);
  gSun = vec2(s1.x * sin(ph), gSunDay.y + (s1.y - gSunDay.y) * (1.0 - cos(ph)));
  gSunVis = 1.0 - smoothstep(0.42, 0.56, u);
  // the moon rises on the opposite side
  float mr = smoothstep(0.42, 1.0, u);
  float pm = mr * 1.5708;
  vec2 m0 = vec2(-min(0.34, gHalfW * 0.62), gHor + 0.06);
  vec2 m1 = vec2(-min(0.22, gHalfW * 0.25), mix(0.29, 0.22, smoothstep(0.2, 0.9, gHalfW)));
  gMoon = vec2(m0.x + (m1.x - m0.x) * (1.0 - cos(pm)), m0.y + (m1.y - m0.y) * sin(pm));
  gMoonVis = smoothstep(0.45, 0.75, u);
  gNight = smoothstep(0.55, 0.95, u);
  gLightMix = smoothstep(0.52, 0.72, u);            // cloud key light: sun -> moon
  gLightUp = todf(vec4(-0.8, 0.15, 0.0, -0.5));     // sunset light comes from below

  //                day                      sunset                  dusk                    night
  gZen    = tod(C_ZENITH,               vec3(0.46, 0.50, 0.70), vec3(0.20, 0.21, 0.41), vec3(0.118, 0.133, 0.275));
  gMidSky = tod(C_CREAM,                vec3(0.90, 0.66, 0.64), vec3(0.40, 0.31, 0.50), vec3(0.17, 0.17, 0.34));
  gHorSky = tod(C_PEACH,                vec3(0.99, 0.62, 0.38), vec3(0.66, 0.40, 0.47), vec3(0.227, 0.208, 0.40));
  gGlowC  = tod(vec3(0.99, 0.80, 0.52), vec3(1.0, 0.52, 0.24),  vec3(0.92, 0.42, 0.30), vec3(0.50, 0.40, 0.48));
  gCoreC  = tod(C_SUN,                  vec3(1.0, 0.84, 0.56),  vec3(1.0, 0.70, 0.45),  vec3(1.0, 0.70, 0.45));
  gTwiC   = tod(C_PEACH,                vec3(1.0, 0.50, 0.26),  vec3(0.88, 0.40, 0.32), vec3(0.36, 0.26, 0.42));
  gGlowAmt  = todf(vec4(0.70, 0.62, 0.40, 0.0));
  gTwiAmt   = todf(vec4(0.0, 0.62, 0.75, 0.20));
  gBloomAmt = todf(vec4(0.20, 0.22, 0.10, 0.0));
  gCoreAmt  = todf(vec4(0.45, 0.40, 0.0, 0.0));

  gCSh  = tod(vec3(0.71, 0.72, 0.84), vec3(0.62, 0.54, 0.68), vec3(0.34, 0.30, 0.48), vec3(0.13, 0.15, 0.25));
  gCMid = tod(vec3(0.95, 0.89, 0.83), vec3(0.95, 0.68, 0.62), vec3(0.56, 0.42, 0.56), vec3(0.20, 0.23, 0.34));
  gCLit = tod(vec3(1.0, 0.95, 0.81),  vec3(1.0, 0.83, 0.58),  vec3(0.90, 0.60, 0.56), vec3(0.38, 0.44, 0.58));
  gCloudK = todf(vec4(1.0, 1.0, 0.85, 0.5));
  gRimW   = todf(vec4(0.03, 0.03, 0.022, 0.012));
  gRim  = tod(vec3(1.0, 0.95, 0.80),  vec3(1.0, 0.76, 0.40),  vec3(1.0, 0.66, 0.52), vec3(0.78, 0.85, 1.0));
  gRimAmt   = todf(vec4(0.55, 0.80, 0.55, 0.75));
  gNearWarm = todf(vec4(0.8, 1.0, 0.6, 0.0));

  gFarG  = vec3(0.84, 0.58, 0.54) * gW.y + vec3(0.42, 0.33, 0.48) * gW.z + vec3(0.19, 0.23, 0.33) * gW.w;
  gNearG = vec3(0.24, 0.18, 0.24) * gW.y + vec3(0.13, 0.13, 0.19) * gW.z + vec3(0.065, 0.11, 0.125) * gW.w;
  gChroma = todf(vec4(0.0, 0.40, 0.18, 0.14));
}

// re-light a day colour for sunset / dusk / night. d: 0 far .. 1 near
vec3 grade(vec3 c, float d) {
  float L = dot(c, vec3(0.30, 0.55, 0.15));
  vec3 g = mix(gFarG, gNearG, d) * (0.62 + 0.9 * (L - 0.55));
  return c * gW.x + g + (c - L) * gChroma;
}

// ------------------------------------------------------------------- clouds --
// a cloud mass blob in edge-relative coords e = (distance from side edge, y).
// returns (mass, base y)
vec2 gMassQ;   // position inside the winning blob, set by cloudMass
vec2 blob(vec2 e, vec2 ctr, vec2 rad, float base, inout vec2 best) {
  vec2 q = (e - ctr) / rad;
  float m = min(1.0 - length(q), (base - e.y) * 6.0);
  if (m > best.x) { best = vec2(m, base); gMassQ = q; }
  return best;
}

// where cumulus billows may live (x > 0 inside), and the local cloud base
vec2 cloudMass(vec2 c) {
  float ex = gHalfW - abs(c.x);
  vec2 e = vec2(ex, c.y);
  vec2 m = vec2(-1e3, 0.0);
  float wv = smoothstep(0.2, 0.9, gHalfW);
  if (c.x < 0.0) {
    blob(e, vec2(0.0 + 0.10 * wv, 0.19), vec2(0.15 + 0.22 * wv, 0.20), 0.34, m);
    blob(e, vec2(0.18 + 0.2 * wv, gHor - 0.07), vec2(0.16 + 0.12 * wv, 0.065), gHor - 0.03, m);
  } else {
    blob(e, vec2(0.01 + 0.11 * wv, 0.14), vec2(0.14 + 0.20 * wv, 0.16), 0.27, m);
    blob(e, vec2(0.06 + 0.08 * wv, gHor - 0.09), vec2(0.18 + 0.16 * wv, 0.07), gHor - 0.04, m);
    gMassQ.x = -gMassQ.x;                      // edge-relative x runs leftward on the right
  }
  // keep a window around the (day) sun
  float ds = length((c - gSunDay) * vec2(1.0, 1.3));
  m.x = min(m.x, (ds - 0.15) * 4.0);
  m.x += sin(c.x * 11.0 + sin(c.y * 9.0) * 1.7) * sin(c.y * 14.0 + c.x * 6.0 + 1.0) * 0.17;
  return m;
}
// conservative test: could any billow reach p?
bool nearCloud(vec2 p) {
  const float G = 0.10;   // billow reach + warp + soft edge
  float ex = gHalfW - abs(p.x);
  vec2 e = vec2(ex, p.y);
  float wv = smoothstep(0.2, 0.9, gHalfW);
  float d;
  if (p.x < 0.0) {
    d = min(length((e - vec2(0.10 * wv, 0.19)) / vec2(0.15 + 0.22 * wv + G, 0.20 + G)),
            length((e - vec2(0.18 + 0.2 * wv, gHor - 0.07)) / vec2(0.16 + 0.12 * wv + G, 0.065 + G)));
  } else {
    d = min(length((e - vec2(0.01 + 0.11 * wv, 0.14)) / vec2(0.14 + 0.20 * wv + G, 0.16 + G)),
            length((e - vec2(0.06 + 0.08 * wv, gHor - 0.09)) / vec2(0.18 + 0.16 * wv + G, 0.07 + G)));
  }
  return d < 1.0;
}

float smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

// Silhouette of the billow union, as a soft coverage (> 0 inside, roughly a distance),
// plus the billow nearest the surface here (centre, radius) for curved brush strokes.
// The billows only shape the outline; they are never shaded on their own.
void cloudCover(vec2 p, vec2 Ld, float cs, float seed, float mmin, vec3 M, float base,
                inout float cov, inout vec2 head) {
  vec2 id = floor(p / cs);
  float reach = 0.9 * cs + 0.02;
  float reach2 = reach * reach;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cid = id + vec2(float(i), float(j));
      vec3 h = h32(cid + seed);
      vec2 c = (cid + 0.2 + 0.6 * h.xy) * cs;
      vec2 dc = p - c;
      if (dot(dc, dc) > reach2) continue;
      float m = M.x + dot(M.yz, c - p);       // mass from the local linear model
      if (m <= mmin) continue;
      float r = cs * (0.62 + 0.28 * h.z) * (0.4 + 0.6 * smoothstep(0.0, 0.4, m))
              * smoothstep(mmin, mmin + 0.12, m);
      // distant clouds near the horizon are flatter
      vec2 S = vec2(1.0, 1.0 + 0.45 * smoothstep(gHor - 0.16, gHor - 0.05, c.y));
      float e = min(r - length(dc * S), base + 0.012 - p.y);
      if (r < 0.004) continue;
      cov = smax(cov, e, 0.025);              // soft union: no creases between billows
      // the billow whose rim is closest to the outer surface, upper ones first
      float k = e / r - 0.6 * (c.y - p.y) / r;
      // a soft, blended "which way do the billows here face" field (no per-billow edges)
      float wt = smoothstep(-0.01, 0.035, e) * r;
      head += vec2(wt * clamp(dot(dc, Ld) / r, -1.0, 1.0), wt);
    }
  }
}

vec4 clouds(vec2 p) {
  if (!nearCloud(p)) return vec4(0.0);
  // airy, broken silhouette: warp the lookup a little
  vec2 w = vec2(vn(p * 14.0), vn(p * 40.0 + 7.7)) - 0.5;
  w = vec2(w.x + w.y * 0.45, w.y - w.x * 0.6);
  vec2 pw = p + w * 0.017;

  // key light: the sun (from below at sunset), then the moon
  vec2 toSun = gSun - p;
  float dSun = length(toSun);
  vec2 LdS = normalize(toSun / max(dSun, 1e-3) + vec2(0.0, gLightUp));
  vec2 toMoon = gMoon - p;
  float dMoon = length(toMoon);
  vec2 LdM = normalize(toMoon / max(dMoon, 1e-3) + vec2(0.0, -0.5));
  vec2 Ld = mix(LdS, LdM, gLightMix);
  Ld = Ld / max(length(Ld), 0.2);
  float sunNear = exp(-dSun * 3.0) * gNearWarm;
  float moonNear = exp(-dMoon * 3.5) * gMoonVis;
  float glowNear = max(sunNear, moonNear);

  // local linear model of the mass field (3 evaluations instead of one per billow)
  float mx = cloudMass(pw + vec2(0.02, 0.0)).x;
  float my = cloudMass(pw + vec2(0.0, 0.02)).x;
  vec2 m0 = cloudMass(pw);                         // last, so gMassQ belongs to pw
  vec2 Q = gMassQ;
  vec3 M = vec3(m0.x, (mx - m0.x) / 0.02, (my - m0.x) / 0.02);
  float base = m0.y;
  float cov = -1.0;
  vec2 head = vec2(0.0, 1e-4);
  cloudCover(pw, Ld, 0.075, 0.0, 0.0, M, base, cov, head);
  cloudCover(pw, Ld, 0.036, 13.0, 0.10, M, base, cov, head);
  float hf = head.x / head.y;
  // 1 near the outer silhouette, 0 deep inside the mass: small gaps between billows
  // inside a cloud are filled in and never get edge treatment
  float outer = smoothstep(0.45, 0.18, M.x);
  cov = max(cov, 0.03 - 0.12 * outer);

  // brush marks used for the edges and the paint texture
  float st  = brush(p, vec2(0.80, -0.60), 0.045, 0.014);
  // dry-brush breakup along diagonal strokes (rotated so the noise lattice never shows)
  vec2 dq = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float dry = vn(vec2(dq.x * 38.0, dq.y * 120.0) + 2.3) * 0.6 + vn(dq * 70.0 + 5.1) * 0.4;
  float edge = cov + (dry - 0.5) * 0.010 + (st - 0.5) * 0.006;
  if (edge < -0.03) return vec4(0.0);

  // ONE smooth light gradient across the whole mass: sunlit side toward the light,
  // cool shade on the far, lower side
  float L = 0.50 + (0.45 + 0.12 * gW.x) * dot(Q, Ld) - 0.22 * Q.y * (1.0 - gW.y)
          - 0.22 * smoothstep(base - 0.10, base + 0.01, p.y) * (1.0 - gW.y);
  // the billow heads that face the light are painted a touch lighter, softly
  L += (0.20 + 0.08 * gW.x) * smoothstep(0.0, 0.8, hf) - 0.06 * smoothstep(0.0, -0.8, hf);
  // broad, soft-edged patches of lighter and darker paint, blocked in with a wet brush
  float pt = vn(p * 7.0 + 4.1) * 0.7 + vn(p * 16.0 + 1.7) * 0.3;
  L += (bands(pt, st, 3.0, 0.4) - 0.5) * 0.13;
  // curved, elongated strokes that run along the cloud's outline (the noise is narrow
  // across the edge-distance contours and long along them), in a band inside the edge
  float sk = 1.0 - 0.45 * gW.w - 0.5 * gW.z - 0.3 * gW.y;   // calmer when the light is coloured
  float ctr = vn(vec2(cov * 150.0 + 3.0, p.x * 13.0 + p.y * 8.0));
  float band = smoothstep(-0.004, 0.008, cov) * (1.0 - smoothstep(0.03, 0.075, cov)) * outer;
  float facing = 0.5 + 0.5 * dot(Q, Ld) + 0.5 * hf;
  L += smoothstep(0.55, 0.85, ctr) * band * (0.06 + 0.20 * smoothstep(0.5, 1.0, facing)) * sk;
  L -= smoothstep(0.6, 0.9, 1.0 - ctr) * band * 0.06 * smoothstep(0.5, 0.1, facing) * sk;
  L = clamp(L, 0.0, 1.0);

  vec3 shadowC = mix(gCSh, gCSh * vec3(0.95, 0.99, 1.05), smoothstep(0.25, 0.05, p.y) * 0.6);
  vec3 midC = mix(gCMid, gCMid * vec3(1.04, 1.0, 0.92), sunNear);
  vec3 litC = mix(gCLit, gCLit * vec3(1.0, 0.95, 0.82), sunNear * 0.7);
  vec3 col = L < 0.5 ? mix(shadowC, midC, smoothstep(0.0, 0.5, L))
                     : mix(midC, litC, smoothstep(0.5, 0.95, L));
  // slight paint-texture colour drift
  col += (vn(p * 52.0 + 9.0) - 0.5) * vec3(0.022, 0.008, -0.018);
  col *= 1.0 + (st - 0.5) * 0.03;

  // luminous edge where the cloud faces the light: a soft glow, feathered outward
  float lightSide = smoothstep(0.55, 0.95, 0.5 + 0.5 * dot(Q, Ld));
  float rim = (1.0 - smoothstep(-0.004, 0.03, cov)) * lightSide * outer;
  col = mix(col, gRim, rim * gRimAmt * (0.35 + 0.65 * glowNear));
  // distant clouds take on the colour of the haze
  float far = smoothstep(gHor - 0.17, gHor - 0.05, p.y);
  col = mix(col, mix(gMidSky, gHorSky, 0.45), far * 0.45);

  // feathered, dry-brushed edges; thin parts stay translucent
  float soft = mix(0.0045, 0.009, lightSide) + 0.009 * smoothstep(base - 0.06, base, p.y);
  float a = smoothstep(-soft, soft, edge);
  a *= mix(1.0, 0.6 + 0.4 * smoothstep(0.25, 0.75, dry), 1.0 - smoothstep(0.0, 0.025, cov));
  a *= 0.93 + 0.07 * smoothstep(0.0, 0.04, cov);
  a *= 1.0 - 0.3 * exp(-dSun * 3.0) * gSunVis * (1.0 - smoothstep(0.0, 0.03, cov));
  // a few wisps trailing off the edges
  float wisp = smoothstep(0.70, 0.93, brush(p + 4.3, vec2(0.99, 0.12), 0.055, 0.008));
  float aw = wisp * smoothstep(-0.045, -0.006, cov) * (1.0 - smoothstep(-0.006, 0.004, cov)) * 0.4 * (1.0 - a);
  // and a faint glow just outside the light-facing edge
  float ah = smoothstep(-0.035, 0.0, cov) * (1.0 - smoothstep(-0.004, 0.006, cov)) * lightSide
           * glowNear * 0.30 * gRimAmt * (1.0 - a - aw);
  float at = a + aw + ah;
  if (at <= 0.0) return vec4(0.0);
  col = (col * a + mix(midC, litC, 0.6) * aw + gRim * ah) / at;
  return vec4(col, clamp(at, 0.0, 1.0));
}

// ---------------------------------------------------------------------- sky --
vec3 sky(vec2 p) {
  // broad gouache strokes (constant directions: a position-dependent rotation would swirl)
  float n1 = brush(p, vec2(0.995, 0.0998), 0.11, 0.024);
  float n2 = brush(p + vec2(0.0, 0.37), vec2(0.990, -0.141), 0.05, 0.011);
  float t = clamp(p.y / gHor, 0.0, 1.0);
  float tb = mix(t, bands(t, n1, 8.0, 0.25), 0.55);
  vec3 c = mix(gZen, gMidSky, smoothstep(0.0, 0.72, tb));
  c = mix(c, gHorSky, smoothstep(0.6, 1.05, tb) * 0.6);

  // twilight band hugging the horizon around the setting point
  float tw = exp(-max(gHor - p.y, 0.0) * 7.0) * exp(-abs(p.x - gSun.x) * 1.3);
  c = mix(c, gTwiC, clamp(tw * gTwiAmt, 0.0, 1.0));

  // the sun glow, painted as soft concentric tonal steps; it flattens as it sets
  vec2 d = p - gSun;
  float r = length(d * vec2(0.8 - 0.35 * gSet, 1.1 + 0.4 * gSet));
  float g = exp(-r * 2.6);
  float gb = mix(g, bands(g, n2, 7.0, 0.25), 0.55);
  c = mix(c, gGlowC, gb * gGlowAmt);
  float core = gSunVis;
  if (core > 0.0) {
    c = mix(c, mix(gCoreC, vec3(1.0, 0.93, 0.76), gW.x), smoothstep(0.3, 1.0, exp(-r * 4.5)) * 0.9 * core);
    c = mix(c, gCoreC, smoothstep(0.45, 1.0, exp(-r * 7.0)) * core);
    c = mix(c, mix(gCoreC, vec3(1.0), 0.6), smoothstep(0.045, 0.02, r) * core);
    // soft rays
    vec2 rd = d / max(length(d), 1e-4);
    float rays = smoothstep(0.45, 0.8, vn(rd * 3.6 + 5.0)) * exp(-r * 1.8) * smoothstep(0.03, 0.14, r);
    c = mix(c, mix(gCoreC, vec3(1.0, 0.96, 0.86), 0.5), rays * 0.30 * core * (1.0 - gSet * 0.5));
  }

  if (gNight > 0.0) {
    // painterly stars: soft dabs, denser toward the top
    float dens = mix(0.42, 0.04, smoothstep(0.0, gHor, p.y));
    for (int l = 0; l < 2; l++) {
      float cs = l == 0 ? 0.036 : 0.018;
      vec2 id = floor(p / cs);
      vec3 h = h32(id + 31.0 + float(l) * 17.0);
      if (h.z < dens * (l == 0 ? 0.8 : 0.45)) {
        vec2 ctr = (id + 0.3 + 0.4 * h.xy) * cs;
        vec2 dd = (p - ctr) * vec2(1.0, 0.75 + 0.5 * h.y);
        float sz = (l == 0 ? 0.0019 + 0.0034 * h.x * h.x * h.x : 0.0015);
        float dl = length(dd);
        float b = (0.35 + 0.65 * fract(h.x * 13.7 + h.y * 7.1)) * gNight * (l == 0 ? 1.0 : 0.6);
        float s = smoothstep(sz, sz * 0.2, dl + (vn(dd * 900.0) - 0.5) * sz * 0.5)
                + 0.3 * exp(-dl * dl / (sz * sz * 4.0));
        vec3 sc = fract(h.y * 9.3) < 0.3 ? vec3(1.0, 0.92, 0.78) : vec3(0.88, 0.92, 1.0);
        c = mix(c, sc, clamp(s * b, 0.0, 1.0));
      }
    }
  }
  if (gMoonVis > 0.0) {
    // a soft painted moon with a halo
    vec2 dm = p - gMoon;
    float rm = length(dm);
    c = mix(c, vec3(0.55, 0.60, 0.80), exp(-rm * 4.0) * 0.30 * gMoonVis);
    c = mix(c, vec3(0.78, 0.82, 0.95), exp(-rm * 16.0) * 0.45 * gMoonVis);
    const float MR = 0.03;
    float edge = smoothstep(MR, MR - 0.004, rm + (vn(dm * 220.0) - 0.5) * 0.003);
    float maria = bands(vn(dm * 55.0 + 3.0), vn(dm * 140.0), 3.0, 0.2);
    vec3 mc = mix(vec3(0.99, 0.97, 0.89), vec3(0.84, 0.86, 0.86), maria * 0.6);
    mc *= 1.0 - 0.12 * smoothstep(0.0, MR, length(dm + vec2(-0.01, -0.008)));
    c = mix(c, mc, edge * gMoonVis);
  }
  c *= 1.0 + (n2 - 0.5) * 0.035;
  c += (n1 - 0.5) * vec3(0.016, 0.004, -0.014);
  return c;
}

// --------------------------------------------------------------------- land --
// back-to-front "over" compositing with premultiplied alpha; w carries depth
void over(inout vec4 acc, inout float accD, vec3 c, float m, float d) {
  acc = vec4(c, 1.0) * m + acc * (1.0 - m);
  accD = d * m + accD * (1.0 - m);
}

float rise(float x) { return smoothstep(0.08, gHalfW + 0.1, abs(x)); }

// ridge line (y, measured downward) of a hill layer
// prm: (offset below horizon, amplitude, frequency, phase); ra: rise toward the edges
float ridge(float x, vec4 prm, float ra) {
  return gHor + prm.x - prm.y * fbm1(x * prm.z + prm.w) - ra * rise(x);
}

// painted tree clumps sitting on a ridge line. returns (colour, coverage)
vec4 clumps(vec2 p, float cs, float base, float sink, float dens, float haze, float seed) {
  base += sink;
  if (p.y > base + 0.008 || p.y < base - 2.0 * cs) return vec4(0.0);
  float tid = floor(p.x / cs);
  float leafy = vn(p * (9.0 / cs)) - 0.5;
  float best = 0.0, bdl = 2.0, bcx = 0.0, bid = 0.0;
  vec2 bdv = vec2(0.0);
  for (int k = -1; k <= 1; k++) {
    float cid = tid + float(k);
    float hh = h11(cid * 1.37 + seed);
    float cxx = (cid + 0.5 + (hh - 0.5) * 0.6) * cs;
    float pres = smoothstep(0.55, 0.85, vn1(cid * 0.21 + seed) + dens + 0.45 * rise(cxx));
    if (pres <= 0.0) continue;
    float r = cs * (0.65 + 0.55 * h11(cid * 2.13 + seed)) * (0.55 + 0.45 * pres);
    vec2 dv = (p - vec2(cxx, base - r * 0.55)) / r;
    dv.y *= 1.12;
    float dl = length(dv) + leafy * 0.28;
    float inside = smoothstep(1.03, 0.95, dl);
    if (inside > best) { best = inside; bdl = dl; bdv = dv; bcx = cxx; bid = cid; }
  }
  if (best <= 0.0) return vec4(0.0);
  best *= smoothstep(base + 0.006, base - 0.002, p.y);
  float sx = clamp((gSun.x - bcx) * 3.0, -0.8, 0.8);
  vec3 L = normalize(vec3(sx, -0.75, 0.45));
  float lit = clamp(dot(normalize(vec3(bdv, 0.55)), L) * 0.8 + 0.3, 0.0, 1.0);
  float leaf = vn(p * (16.0 / cs) + bid);
  float lb = mix(lit, bands(lit, leaf, 3.0, 0.14), 0.85);
  vec3 c = mix(vec3(0.29, 0.34, 0.25), vec3(0.50, 0.55, 0.34), smoothstep(0.1, 0.55, lb));
  c = mix(c, vec3(0.74, 0.72, 0.46), smoothstep(0.6, 0.95, lb));
  // warm rim on the sun side
  c = mix(c, vec3(0.86, 0.80, 0.55), smoothstep(0.82, 0.98, bdl) * step(0.0, sx * bdv.x - bdv.y * 0.3) * 0.6);
  c = mix(c, mix(C_FAR, C_CREAM, 0.35), haze);
  return vec4(c, best);
}

// returns colour (already re-lit for the time of day) and coverage
vec4 land(vec2 p) {
  float x = p.x;
  const vec4 PA = vec4(-0.006, 0.016, 6.0, 20.0);
  const vec4 PB = vec4(0.016, 0.024, 4.2, 11.0);
  const vec4 PM = vec4(0.056, 0.030, 2.8, 2.0);
  const vec4 PG = vec4(0.112, 0.018, 1.6, 4.0);
  float raM = x < 0.0 ? 0.090 : 0.075;
  float yA = ridge(x, PA, 0.022);
  if (p.y < yA - 0.07) return vec4(0.0);
  float yB = ridge(x, PB, 0.040);
  float yM = ridge(x, PM, raM);
  float yG = ridge(x, PG, 0.070);

  float sunPull = exp(-abs(x - gSunDay.x) * 2.5);
  vec3 haze = mix(C_CREAM, vec3(0.98, 0.90, 0.74), sunPull);
  float sb = brush(p, vec2(0.981, 0.196), 0.05, 0.007);
  float sb2 = brush(p, vec2(0.970, -0.243), 0.03, 0.005);
  float lsx = sign(gSun.x - x + 1e-4);

  vec4 acc = vec4(0.0);
  float accD = 0.0;
  if (p.y < yG + 0.004) {
  if (p.y < yM + 0.004) {
  // far range A: barely there
  over(acc, accD, mix(mix(C_FAR, haze, 0.55), vec3(0.74, 0.77, 0.76), 0.25),
       smoothstep(-0.0015, 0.0015, p.y - yA + (sb - 0.5) * 0.003), 0.0);

  // far range B: hazy sage, lit tops, fading into valley haze
  {
    float m = smoothstep(-0.0015, 0.0015, p.y - yB + (sb2 - 0.5) * 0.003);
    float lit = clamp(0.5 + (fbm1(x * 9.0 + 3.0) - 0.5) * 1.6, 0.0, 1.0);
    vec3 c = mix(C_FAR * 0.95, mix(C_FAR, C_CREAM, 0.45), bands(lit, sb, 3.0, 0.2));
    c = mix(c, haze, 0.25 + 0.3 * smoothstep(0.0, 0.03, p.y - yB));
    over(acc, accD, c, m, 0.22);
  }
  // small far trees on ridge B
  {
    vec4 t = clumps(p, 0.011, yB, 0.004, -0.05, 0.55, 7.0);
    over(acc, accD, t.rgb, t.a, 0.28);
  }
  }
  // mid hills: olive-sage with sunlit slopes and strokes along the slope
  if (p.y > yM - 0.003) {
    float m = smoothstep(-0.0015, 0.0015, p.y - yM + (sb - 0.5) * 0.003);
    float sl = (ridge(x + 0.010, PM, raM) - yM) / 0.010;
    float st = vn(vec2(x / 0.035, (p.y - yM) / 0.006));     // strokes parallel to the ridge
    float roll = vn(vec2(x * 7.0, (p.y - yM) * 14.0) + 3.0);
    float lit = clamp(0.45 + sl * lsx * 1.2 + (roll - 0.5) * 0.5, 0.0, 1.0);
    float lb = mix(lit, bands(lit, st, 3.0, 0.25), 0.6);
    vec3 c = mix(vec3(0.50, 0.56, 0.44), C_MID, smoothstep(0.0, 0.5, lb));
    c = mix(c, vec3(0.76, 0.75, 0.51), smoothstep(0.5, 1.0, lb));
    c = mix(c, vec3(0.88, 0.83, 0.62), smoothstep(0.010, 0.0, p.y - yM) * 0.55);   // lit ridge
    c = mix(c, haze, 0.18 + 0.45 * smoothstep(0.004, 0.06, p.y - yM));        // valley mist
    c *= 1.0 + (st - 0.5) * 0.06;
    over(acc, accD, c, m, 0.5);
  }
  // tree clumps on the mid hills
  {
    vec4 t = clumps(p, 0.017, yM, 0.010, -0.12, 0.30, 3.0);
    over(acc, accD, t.rgb, t.a, 0.58);
  }
  }
  // near tree clumps behind the meadow edge
  {
    vec4 t = clumps(p, 0.030, yG, 0.006, 0.0, 0.0, 1.0);
    over(acc, accD, t.rgb, t.a, 0.9);
  }

  // meadow
  float z = clamp((p.y - yG) / max(gRoll - yG, 0.02), 0.0, 1.0);
  if (p.y > yG - 0.003) {
    float gm = smoothstep(-0.0015, 0.0015, p.y - yG + (sb - 0.5) * 0.003);
    // perspective rows: row height and cell width both grow with distance below y0,
    // so cells stay roughly square on screen
    const float A = 0.16;
    float lv = log(max(p.y - (gHor - 0.02), 0.01)) / A;
    float lp = vn(vec2(x * 4.0, p.y * 13.0) + 5.0);
    vec3 gc = mix(vec3(0.88, 0.83, 0.58), C_MEADOW1, smoothstep(0.0, 0.35, z));
    gc = mix(gc, C_MEADOW2, smoothstep(0.4, 1.0, z) * 0.6);
    // grass flicks: short near-vertical strokes, one set per perspective row
    float rv = lv * 2.0;
    float ir = floor(rv);
    float fr = rv - ir;
    float uu = x / (A * exp((ir + 0.5) * 0.5 * A) * 0.5);
    float g1 = vn(vec2(uu * 4.0 + fr * 1.2 + ir * 7.1, fr * 0.7 + ir * 3.3));
    float g2 = vn(vec2(uu * 9.0 - fr * 0.8 + ir * 1.9, fr * 1.3 + ir * 5.7));
    float shade = bands(clamp(lp + (g1 - 0.5) * 0.3, 0.0, 1.0), g2, 3.0, 0.15);
    gc = mix(gc * vec3(0.84, 0.88, 0.80), gc, smoothstep(0.66, 0.42, shade));     // shadow patches
    gc = mix(gc, vec3(0.95, 0.86, 0.55), smoothstep(0.40, 0.16, shade) * 0.5);   // sun patches
    gc = mix(gc, vec3(0.95, 0.89, 0.66), sunPull * (1.0 - z) * 0.35);
    gc *= 0.90 + 0.16 * mix(g1, g2, 0.45);
    gc = mix(gc, vec3(0.90, 0.85, 0.62), smoothstep(0.012, 0.0, p.y - yG) * 0.35);
    float dM = 0.75 + 0.25 * z;
    over(acc, accD, gc, gm, dM);

    // flowers: dabs in perspective cells, gathered into drifts
    float drift = vn(vec2(x * 6.0, p.y * 11.0) + 11.0);
    float prob = smoothstep(0.40, 0.62, drift + z * 0.15) * 0.8 + 0.05;
    for (int l = 0; l < 2; l++) {
      float fl = float(l);
      float sc = 1.0 + fl * 0.8;
      float vv = lv * sc + fl * 0.61;
      float iv = floor(vv);
      float cw = A * exp((iv + 0.5 - fl * 0.61) / sc * A) / sc;  // cell width on screen
      float fu = x / cw + h11(iv + fl * 17.0) * 9.0;
      vec2 id = vec2(floor(fu), iv);
      vec2 f = vec2(fu, vv) - id;
      vec3 h = h32(id + 41.0 * fl);
      if (h.z > prob) continue;
      vec2 ctr = 0.3 + 0.4 * h.xy;
      float rr = 0.16 + 0.13 * h.y;
      vec2 dd = (f - ctr) * vec2(1.0, 1.25);
      float wob = (vn(f * 5.0 + id * 1.7) - 0.5) * 0.55;
      float fm = smoothstep(1.05, 0.85, length(dd) / rr + wob) * gm * smoothstep(0.0, 0.12, z);
      float sh = smoothstep(1.1, 0.6, length(dd - vec2(0.03, rr * 0.6)) / rr) * gm * 0.4;
      acc.rgb *= 1.0 - sh * (1.0 - fm) * vec3(0.30, 0.25, 0.42);
      float pick = fract(h.x * 7.31 + h.y * 3.17);
      vec3 fc = pick < 0.5 ? C_YELLOW : (pick < 0.8 ? C_ORANGE : C_WHITE);
      fc *= 0.85 + 0.2 * smoothstep(0.4, -0.5, dd.y / rr);
      fc = mix(fc, haze, (1.0 - z) * 0.3);
      over(acc, accD, fc, fm, dM);
    }
  }

  // morning mist lying on the meadow, thickest at the bottom
  float mb = brush(p, vec2(1.0, 0.0), 0.10, 0.012);
  float mist = smoothstep(gRoll - 0.065, gRoll - 0.002, p.y) * (0.72 + 0.38 * mb);
  mist = max(mist, exp(-pow((p.y - yG - 0.012) / 0.014, 2.0)) * 0.30 * smoothstep(-0.002, 0.002, p.y - yG) * (0.6 + 0.6 * mb));
  mist = clamp(mist, 0.0, 0.92);
  acc.rgb = mix(acc.rgb, C_MIST * acc.a, mist);

  vec3 col = acc.rgb / max(acc.a, 1e-4);
  float dep = accD / max(acc.a, 1e-4);
  col = grade(col, mix(dep, 0.45, mist * 0.6));

  if (gNight > 0.0 && p.y > yG) {
    // a few warm fireflies drifting over the meadow
    const float FC = 0.045;
    vec2 id = floor(p / FC);
    vec3 h = h32(id + 77.0);
    if (h.z < 0.13) {
      vec2 dd = p - (id + 0.3 + 0.4 * h.xy) * FC;
      float d2 = dot(dd, dd);
      float glow = exp(-d2 / 0.0000045) + 0.35 * exp(-d2 / 0.00003);
      col += vec3(1.0, 0.80, 0.40) * glow * gNight * (0.6 + 0.4 * h.x) * (1.0 - mist * 0.7);
    }
  }
  return vec4(col, acc.a);
}

// --------------------------------------------------------------- composite --
// atmospheric bloom: sun (spreading along the horizon as it sets), then the moon
vec3 bloom(vec3 col, vec2 p) {
  vec2 d = p - gSun;
  float r = length(d * vec2(0.7 - 0.3 * gSet, 1.1 + 0.6 * gSet));
  col = mix(col, gGlowC, exp(-r * 2.2) * gBloomAmt);
  col = mix(col, gCoreC, exp(-r * 6.5) * gCoreAmt);
  if (gMoonVis > 0.0) col = mix(col, vec3(0.70, 0.76, 0.92), exp(-length(p - gMoon) * 9.0) * 0.18 * gMoonVis);
  return col;
}
// The high clouds are painted on their own layer so the live view can drift them; the low ones stay behind the hills.
float highCloud(vec2 p) { return smoothstep(gHor - 0.13, gHor - 0.22, p.y); }
vec3 paintSample(vec2 px, vec2 res) {
  vec2 p = vec2((px.x - 0.5 * res.x) / res.y, px.y / res.y);
  if (p.y > gRoll + 0.004) {
    // hidden under the typewriter roller: just let the mist continue, cheaply
    float mb = vn(vec2(p.x * 10.0, p.y * 80.0));
    return grade(mix(C_MIST, C_MEADOW1, 0.10 + 0.10 * mb), 0.5);
  }
  vec3 col = vec3(0.0);
  if (p.y < gHor + 0.002) {
    col = sky(p);
    if (p.y < gHor + 0.02) {
      vec4 c = clouds(p);
      col = mix(col, c.rgb, c.a * (1.0 - highCloud(p)));
    }
  }
  if (p.y > gHor - 0.12) {
    vec4 l = land(p);
    col = mix(col, l.rgb, l.a);
  }
  return clamp(bloom(col, p), 0.0, 1.0);
}

// paper / pigment grain, applied once per pixel after supersampling
vec3 paperGrain(vec3 col, vec2 px, vec2 res) {
  vec2 p = px / res.y;
  float gr = vn(p * 620.0) * 0.6 + vn(p * 210.0 + 5.0) * 0.4;
  return col * (0.976 + 0.04 * gr);
}

vec3 painting(vec2 px, vec2 res) {
  setupScene(res);
#if SSAA
  // 4x rotated-grid supersampling
  vec3 c = paintSample(px + vec2( 0.125,  0.375), res);
#if SSAA_ADAPTIVE
  // quads whose first sample is already smooth skip the other three
  // (needs painting() to be called in uniform control flow, as from main())
  vec3 dc = abs(dFdx(c)) + abs(dFdy(c));
  if (max(dc.r, max(dc.g, dc.b)) > SSAA_THRESHOLD) {
#endif
    c += paintSample(px + vec2(-0.375,  0.125), res);
    c += paintSample(px + vec2(-0.125, -0.375), res);
    c += paintSample(px + vec2( 0.375, -0.125), res);
    c *= 0.25;
#if SSAA_ADAPTIVE
  }
#endif
#else
  vec3 c = paintSample(px, res);
#endif
  return paperGrain(c, px, res);
}

// Layer 0: the painting without its high clouds. Layer 1: the high clouds alone, premultiplied, for the view to drift.
uniform float uLayer;
vec4 paintingLayer(vec2 px, vec2 res) {
  if (uLayer < 0.5) return vec4(painting(px, res), 1.0);
  setupScene(res);
  vec2 p = vec2((px.x - 0.5 * res.x) / res.y, px.y / res.y);
  float k = highCloud(p);
  if (k <= 0.0) return vec4(0.0);
  vec4 c = clouds(p);
  float a = c.a * k;
  return vec4(paperGrain(bloom(c.rgb, p), px, res) * a, a);
}
`;
// The live view, every frame: the high clouds billow and drift like a slow fluid, wind ribbons stream across,
// pollen floats in the sun; at night stars twinkle and fireflies wander. Then the machine's enamel body.
const VIEW_FS = `
uniform sampler2D uPlate, uClouds;
uniform vec2 uRes, uPar; uniform float uBodyY, uRollerY, uNight, uLamp, uTime, uPad;
varying vec2 vUv;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p) { float n = h21(p); return vec2(n, h21(p + n * 17.0)); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * vn(p) + 0.3 * vn(p * 2.03 + 3.1) + 0.2 * vn(p * 4.01 + 7.7); }
// drifting specks: one per cell at most, moving with the wind; returns brightness
float specks(vec2 q, float cell, vec2 wind, float t, float size, float density, float blink) {
  vec2 g = (q - wind * t) / cell, id = floor(g), f = fract(g);
  vec2 r = h22(id);
  if (r.x > density) return 0.0;
  vec2 c = 0.2 + 0.6 * h22(id + 3.7) + 0.18 * vec2(sin(t * (0.6 + r.y) + r.x * 40.0), cos(t * (0.5 + r.x) + r.y * 30.0));
  float d = length(f - c) * cell;
  float tw = mix(1.0, 0.5 + 0.5 * sin(t * (1.5 + 2.0 * r.y) + r.x * 60.0), blink);
  return exp(-d * d / (size * size)) * tw;
}
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// A bird far off, the way it is drawn: two curved wing strokes meeting at the body. flap 1: wings up, 0: level.
float birdD(vec2 p, float s, float flap) {
  p.x = abs(p.x);
  float lift = s * (0.08 + 0.5 * flap);
  vec2 knee = vec2(s * 0.42, -lift * 0.55 - s * 0.17), tip = vec2(s, -lift + s * 0.1);
  return min(segD(p, vec2(0.0, 0.02 * s), knee), segD(p, knee, tip));
}
// Small flocks crossing the sky at different distances: nearer ones larger, darker and quicker; each bird flaps
// in its own rhythm and glides now and then, bobbing a little in the air.
vec4 birds(vec2 q, float aspect, float t, float H) {
  float a = 0.0; float best = 0.0;
  for (int f = 0; f < 4; f++) {
    float ff = float(f);
    float near = h21(vec2(ff, 3.1));
    float s = mix(0.0032, 0.0072, near);
    float dir = mod(ff, 2.0) < 0.5 ? 1.0 : -1.0;
    float vx = mix(0.006, 0.014, near) * (0.85 + 0.3 * h21(vec2(ff, 7.7)));
    float span = aspect + 0.7;
    float x0 = mod(h21(vec2(ff, 1.3)) * span + vx * t, span) - 0.35;
    float lx = dir > 0.0 ? x0 : aspect - x0;
    float ly = 0.09 + 0.2 * h21(vec2(ff, 5.9)) + 0.012 * sin(t * 0.21 + ff * 2.0);
    float n = 3.0 + floor(h21(vec2(ff, 9.2)) * 5.0);
    if (abs(q.x - lx) > 0.2 || abs(q.y - ly) > 0.09) continue;
    for (int j = 0; j < 7; j++) {
      float fj = float(j);
      if (fj >= n) break;
      float k = floor((fj + 1.0) * 0.5), side = mod(fj, 2.0) < 0.5 ? 1.0 : -1.0;
      vec2 jit = h22(vec2(ff * 13.0 + fj, 4.4)) - 0.5;
      vec2 c = vec2(lx - dir * (k * 0.024 + jit.x * 0.012), ly + side * k * 0.012 + jit.y * 0.014);
      c.y += 0.0035 * sin(t * (0.7 + jit.x) + fj * 1.9);
      float glide = smoothstep(-0.3, 0.3, sin(t * (0.35 + 0.2 * jit.y) + fj * 2.3 + ff));
      float flap = mix(0.55, 0.5 + 0.5 * sin(t * (17.0 + 5.0 * jit.x) + fj * 1.7), glide);
      vec2 p = q - c; p.x *= dir;
      float d = birdD(p, s * (0.9 + 0.2 * jit.y), flap);
      float w = mix(0.0006, 0.0011, near), aa = 1.2 / H;
      float cov = smoothstep(w + aa, w - aa * 0.3, d) * mix(0.4, 0.72, near);
      if (cov > a) { a = cov; best = near; }
    }
  }
  return vec4(vec3(mix(0.42, 0.2, best), mix(0.42, 0.21, best), mix(0.44, 0.24, best)), a);
}
void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float H = uRes.y, aspect = uRes.x / H, t = uTime;
  vec2 q = vec2(px.x / H, px.y / H);
  float roller = uRollerY / H, horizon = roller - 0.22;
  vec2 par = uPar * vec2(1.0, 0.6);
  vec3 col = texture2D(uPlate, (vUv - 0.5) * 0.994 + 0.5 - par * 0.0028).rgb;

  // Clouds: a slow fluid billow (curl of two noise fields) and a long, gentle drift.
  vec2 w = vec2(fbm(q * 2.4 + vec2(t * 0.030, 1.7)), fbm(q * 2.4 + vec2(5.2, -t * 0.026))) - 0.5;
  w += 0.5 * (vec2(fbm(q * 5.1 - vec2(t * 0.05, 0.0)), fbm(q * 5.1 + vec2(0.0, t * 0.045) + 9.0)) - 0.5);
  float drift = uPad * 0.85 * sin(t * 0.021 + 1.3);
  vec2 cuv = vec2(vUv.x + drift + w.x * 0.012 / aspect - par.x * 0.0012, vUv.y + w.y * 0.010 - par.y * 0.0008);
  cuv.x = (cuv.x + uPad) / (1.0 + 2.0 * uPad);
  vec4 cl = texture2D(uClouds, cuv);
  col = col * (1.0 - cl.a) + cl.rgb;
  float day = 1.0 - smoothstep(0.35, 0.7, uNight), night = smoothstep(0.55, 0.95, uNight);

  // Birds, by day, below the clouds.
  if (day > 0.0 && q.y < horizon - 0.02) {
    vec4 b = birds(q, aspect, t, H);
    col = mix(col, b.rgb, b.a * day * smoothstep(horizon - 0.02, horizon - 0.08, q.y));
  }

  // Wind ribbons: thin streams of light that run across the sky and the meadow.
  vec3 ribbonCol = mix(vec3(1.0, 0.96, 0.86), vec3(0.72, 0.80, 1.0), uNight);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float base = horizon - 0.16 + fi * 0.13;
    float y = base + 0.035 * sin(q.x * 1.6 + t * 0.21 + fi * 2.1) + 0.018 * sin(q.x * 3.7 - t * 0.33 + fi * 1.3)
            + 0.02 * (fbm(vec2(q.x * 0.9 + fi * 4.0, t * 0.05)) - 0.5);
    float d = abs(q.y - y), width = 0.0035 + 0.0025 * sin(q.x * 2.3 + fi);
    float strand = smoothstep(width * 2.6, 0.0, d);
    float run = smoothstep(0.55, 0.95, sin(q.x * 1.2 - t * (0.42 + 0.07 * fi) + fi * 2.7));   // short bright runs travel along it
    col = mix(col, ribbonCol, strand * run * (0.22 - 0.08 * uNight));
  }


  // Shadows of the clouds sliding over the land, foreshortened toward the horizon; a soft haze where the land meets the sky.
  if (q.y > horizon + 0.002 && q.y < roller + 0.03) {
    float dd = 0.045 / max(q.y - horizon, 0.003);
    vec2 g = vec2((q.x - 0.5 * aspect) * dd * 1.3, dd);
    float sh = smoothstep(0.48, 0.74, fbm(g * 0.5 + vec2(t * 0.016, t * 0.003)));
    col *= 1.0 - 0.2 * sh * smoothstep(0.0, 0.05, q.y - horizon) * day;
    vec3 haze = mix(vec3(0.96, 0.9, 0.78), vec3(0.2, 0.22, 0.34), uNight);
    col = mix(col, haze, 0.16 * exp(-(q.y - horizon) * 32.0) * (1.0 - 0.6 * night));
  }

  // Pollen in the sunlight by day; at night, twinkling stars and wandering fireflies.
  if (day > 0.0) {
    float pollen = specks(q, 0.11, vec2(0.012, -0.006), t, 0.0028, 0.35, 0.3) * smoothstep(roller, horizon - 0.25, q.y);
    col = mix(col, vec3(1.0, 0.95, 0.78), pollen * 0.55 * day);
  }
  if (night > 0.0) {
    float stars = specks(q * vec2(1.0, 1.0) + 13.0, 0.045, vec2(0.0), t, 0.0016, 0.55, 0.9) * smoothstep(horizon - 0.02, 0.0, q.y);
    stars *= 1.0 - cl.a;
    col += vec3(0.95, 0.93, 1.0) * stars * 0.85 * night;
    float flies = specks(q + 5.0, 0.07, vec2(0.006, 0.002), t * 0.8, 0.0035, 0.3, 1.0) * smoothstep(horizon - 0.04, horizon + 0.04, q.y) * smoothstep(roller + 0.01, roller - 0.03, q.y);
    col += vec3(1.0, 0.82, 0.38) * flies * 1.4 * night;
  }

  float below = px.y - uBodyY;
  if (below > 0.0) {
    float b = clamp(below / max(uRes.y - uBodyY, 1.0), 0.0, 1.0);
    vec3 body = mix(mix(vec3(0.62, 0.67, 0.52), vec3(0.47, 0.53, 0.40), b), mix(vec3(0.13, 0.16, 0.19), vec3(0.07, 0.08, 0.11), b), uNight);
    body *= 1.0 - 0.35 * exp(-below / (0.035 * H));                     // shade tucked under the roller
    body += (h21(floor(px)) - 0.5) * 0.012;                              // a fine enamel grain against banding
    body = mix(body, body * vec3(1.9, 1.45, 1.0), uLamp * 0.6 * exp(-pow((px.x / uRes.x - 0.5) * 2.2, 2.0)) * exp(-below / (0.25 * H)));
    col = body;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
