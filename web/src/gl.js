// ---------- three.js: the view, the page, the guide on its rod, and the machine drawn in anatomy tones ----------
// Where the parts sit, in sheet points relative to the line being typed (y up, z toward you).
const ROD_Y = -42, ROD_R = 7, PILL_R = 13.5, PILL_LEN = 82, BEND_Y = -24, PLATEN_R = 44, PAPER_SHARE = 0.8, FOV = 30, BOW = 9, CURL = 44;
const PLATEN_Z = -(PLATEN_R + BOW + 0.6), PLATEN_HALF = 196, PLATE_X = 197, KNOB_X = 205;
const LAMP_COLOURS = [0x3dff7a, 0xffc23d, 0xff4438];
const FULL_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PAINT_FS = `
uniform vec2 uRes; uniform float uPadX;
varying vec2 vUv;
${PAINT_GLSL}
void main() { gl_FragColor = paintingLayer(vec2(vUv.x * (uRes.x + 2.0 * uPadX) - uPadX, (1.0 - vUv.y) * uRes.y), uRes); }`;

function createGL(app, glCanvas, viewCanvas) {
  const THREE = window.THREE;
  if (!THREE) return null;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  // ----- The view: its own canvas and clock behind the machine, so it can move every frame -----
  let VIEW = null;
  try {
    const r = new THREE.WebGLRenderer({ canvas: viewCanvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.PlaneGeometry(2, 2);
    const U = { uRes: { value: new THREE.Vector2(1, 1) }, uPadX: { value: 0 }, uRollerY: { value: 0 }, uNight: { value: 0 }, uLayer: { value: 0 } };
    const mats = [0, 1].map((ssaa) => new THREE.ShaderMaterial({ vertexShader: FULL_VS, fragmentShader: PAINT_FS, uniforms: U, defines: { SSAA: ssaa },
      depthTest: false, depthWrite: false, extensions: { derivatives: true } }));
    const paintMesh = new THREE.Mesh(quad, mats[1]), paintScene = new THREE.Scene(); paintScene.add(paintMesh);
    const V = { uPlate: { value: null }, uClouds: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uBodyY: { value: 0 }, uRollerY: { value: 0 }, uNight: { value: 0 }, uLamp: { value: 0 }, uTime: { value: 0 }, uPad: { value: 0.06 }, uPar: { value: new THREE.Vector2() } };
    const viewMat = new THREE.ShaderMaterial({ vertexShader: FULL_VS, fragmentShader: VIEW_FS, uniforms: V, depthTest: false, depthWrite: false });
    const viewScene = new THREE.Scene(); viewScene.add(new THREE.Mesh(quad, viewMat));
    const opts = { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const layers = (n) => Array.from({ length: n }, () => new THREE.WebGLRenderTarget(1, 1, opts));
    const hi = layers(2), lo = layers(2);
    let painted = "", size = "";
    const paint = (set, w, h, rollerY, night, ssaa) => {
      paintMesh.material = mats[ssaa];
      set.forEach((rt, i) => {
        const pad = i === 1 ? Math.round(w * V.uPad.value) : 0;
        rt.setSize(w + pad * 2, h);
        U.uRes.value.set(w, h); U.uPadX.value = pad; U.uRollerY.value = rollerY * h / app.H; U.uNight.value = night; U.uLayer.value = i;
        r.setRenderTarget(rt); r.render(paintScene, cam);
      });
      r.setRenderTarget(null);
      [V.uPlate.value, V.uClouds.value] = set.map((rt) => rt.texture);
    };
    VIEW = {
      draw(seconds) {
        const W = app.W, H = app.H, DPR = app.DPR, sp = app.spring;
        if (size !== `${W}x${H}@${DPR}`) { size = `${W}x${H}@${DPR}`; r.setPixelRatio(DPR); r.setSize(W, H, false); }
        const d = app.camDist(), zoom = app.zoom, kPl = d / (d + PLATEN_R + BOW + 0.6);
        const rollerTop = H / 2 - (BEND_Y + PLATEN_R - (sp.sy.to - H / 2) / zoom) * zoom * kPl;
        const bodyY = H / 2 - (BEND_Y - (sp.sy.v - H / 2) / zoom) * zoom * kPl;
        const night = sp.lamp.v, fading = Math.abs(night - sp.lamp.to) > 0.002 || Math.abs(sp.lamp.vel) > 0.002;
        const want = `${size}:${Math.round(rollerTop)}:${night.toFixed(3)}`;
        if (fading) { paint(lo, W, H, rollerTop, night, 0); painted = ""; }
        else if (painted !== want) { paint(hi, Math.round(W * DPR), Math.round(H * DPR), rollerTop, night, 1); painted = want; }
        V.uRes.value.set(W * DPR, H * DPR); V.uBodyY.value = bodyY * DPR; V.uRollerY.value = rollerTop * DPR;
        V.uNight.value = night; V.uLamp.value = night; V.uTime.value = seconds;
        const pa = app.parallax; pa.x += (pa.tx - pa.x) * 0.06; pa.y += (pa.ty - pa.y) * 0.06; V.uPar.value.set(pa.x, pa.y);
        r.render(viewScene, cam);
      },
      dispose() { r.dispose(); r.forceContextLoss(); },
    };
  } catch (e) { VIEW = null; }

  // ----- The page and the machine -----
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);

  const uniforms = {
    uPaperW: { value: PAPER_W }, uPaperH: { value: 600 }, uWinTop: { value: 0 }, uWinH: { value: 600 }, uTopY: { value: 0 },
    uBow: { value: BOW }, uCurl: { value: CURL }, uFlat: { value: 0 }, uSeedX: { value: 0 }, uSeedY: { value: 0 },
    uPaperCol: { value: new THREE.Vector3() }, uInkCol: { value: new THREE.Vector3() },
    uGrain: { value: 1 }, uAge: { value: 0.6 }, uLaid: { value: 1 }, uFibre: { value: 1 }, uCockle: { value: 0 }, uSheer: { value: 0 }, uSoak: { value: 0.5 },
    uCloth: { value: 1 }, uCrisp: { value: 0 }, uFuzz: { value: 0 },
    uInk: { value: null }, uInkTop: { value: 0 }, uInkH: { value: 1 },
    uFlower: { value: null }, uFlowerRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uFlowerOn: { value: 0 },
    uLamp: { value: 0 }, uLampPos: { value: new THREE.Vector3() }, uLampReach: { value: 120 },
    uPxPerPt: { value: 1 }, uView: { value: new THREE.Vector2(1, 1) },
    uRodY: { value: ROD_Y }, uRodR: { value: ROD_R }, uCaretX: { value: 0 },
    uBendY: { value: 0 }, uBendR: { value: 62 }, uBendRamp: { value: 84 },
    uGrid: { value: new THREE.Vector4() }, uSel: { value: new THREE.Vector4(-1, 0, 0, 0) }, uSelShift: { value: new THREE.Vector2() },
  };
  const paperMat = new THREE.ShaderMaterial({ uniforms, vertexShader: PAPER_VS, fragmentShader: PAPER_FS, extensions: { derivatives: true },
    transparent: true, premultipliedAlpha: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 220), paperMat);
  paper.frustumCulled = false; paper.renderOrder = 5; scene.add(paper);

  // ----- Light and finish: the machine stands in the same morning (or under the same lamp) as the painted view -----
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;                           // shadows are redrawn only when a part that casts one moves
  const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  let shadowSig = "";
  // What the gloss reflects: a studio painted from the view's own colours (sky, sunrise, meadow, earth); at night,
  // the moonlit sky and the warm lamp in front.
  const pmrem = new THREE.PMREMGenerator(renderer);
  function envFrom(stops, glow) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
    const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([o, col]) => grad.addColorStop(o, col));
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    for (const [x, y, r, col] of glow) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.encoding = THREE.sRGBEncoding;
    const env = pmrem.fromEquirectangular(tex).texture; tex.dispose();
    return env;
  }
  const ENV_DAY = envFrom([[0, "#BFCBCB"], [0.3, "#E4DFCB"], [0.44, "#F3E2C0"], [0.5, "#FFF6E2"], [0.54, "#B4BC8E"], [0.62, "#9AA77F"], [0.8, "#6B7650"], [1, "#3E4630"]],
    [[256, 250, 170, "rgba(255,247,227,1)"], [768, 200, 260, "rgba(255,250,240,.55)"]]);
  const ENV_NIGHT = envFrom([[0, "#10132A"], [0.36, "#232650"], [0.48, "#3A3566"], [0.52, "#1D2A2A"], [1, "#07090B"]],
    [[768, 205, 190, "rgba(255,206,150,1)"], [768, 150, 320, "rgba(255,190,120,.45)"], [256, 120, 60, "rgba(210,220,255,.6)"]]);
  scene.environment = ENV_DAY;
  const hemi = new THREE.HemisphereLight(0xf6e8c8, 0x5e6a44, 1.1);
  const DAY_SKY = new THREE.Color(0xf6e8c8), NIGHT_SKY = new THREE.Color(0x2a3160), DAY_GROUND = new THREE.Color(0x5e6a44), NIGHT_GROUND = new THREE.Color(0x0e1214);
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(-170, 430, 390); key.target.position.set(0, -70, -20);
  key.castShadow = true; key.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
  Object.assign(key.shadow.camera, { left: -300, right: 300, top: 260, bottom: -300, near: 60, far: 1600 });
  key.shadow.bias = -0.00025; key.shadow.normalBias = 0.8; key.shadow.radius = 5;
  const DAY_KEY = new THREE.Color(0xfff1dc), NIGHT_KEY = new THREE.Color(0x9fb0ff);
  const rim = new THREE.DirectionalLight(0xffd9a0, 1.1);             // the sunrise behind the machine catches its top edges
  rim.position.set(40, 220, -520);
  const lampLight = new THREE.PointLight(0xffd3a0, 0, 320, 0);
  scene.add(hemi, key, key.target, rim, lampLight);

  // Materials: baked enamel in the hills' sage, warm brass like the sunrise, bright nickel, bakelite, platen rubber, ivory.
  const M = {
    enamel: new THREE.MeshPhysicalMaterial({ color: 0x6b7a52, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0 }),
    plate: new THREE.MeshPhysicalMaterial({ color: 0x66744e, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.78, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a464, metalness: 0.95, roughness: 0.26 }),
    collar: new THREE.MeshStandardMaterial({ color: 0x7f8b60, metalness: 0.1, roughness: 0.42 }),
    bakelite: new THREE.MeshPhysicalMaterial({ color: 0x221e1a, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc4c7ca, metalness: 1, roughness: 0.2 }),
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xefeae0, roughness: 0.34, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.22 }),
    pointer: new THREE.MeshStandardMaterial({ color: 0x3b3936, metalness: 0.6, roughness: 0.34 }),
    ribbon: new THREE.MeshStandardMaterial({ color: 0x2a2725, roughness: 0.9, metalness: 0 }),
  };
  const ENV_BASE = new Map([[M.enamel, 1], [M.plate, 1], [M.rubber, 0.22], [M.brass, 1], [M.collar, 1], [M.bakelite, 1], [M.chrome, 1], [M.ivory, 0.6], [M.pointer, 1], [M.ribbon, 0.3]]);
  function part(geo, mat, { parent = scene, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
  // A smooth turned profile (r, h), drawn through as a spline so a knob or a spool has no facets.
  const turned = (pts, n = 64, seg = 128) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([r, h]) => new THREE.Vector2(r, h))).getPoints(n), seg);
  // A grip ring with fine knurling: the rim pushed in and out as it goes round.
  function knurled(r, h, ridges, seg = 384) {
    const geo = new THREE.CylinderGeometry(r, r, h, seg, 6, false);
    const pos = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const rad = Math.hypot(v.x, v.z);
      if (rad > r * 0.999) { const k = 1 + 0.028 * Math.cos(Math.atan2(v.z, v.x) * ridges); pos.setXYZ(i, v.x * k, v.y, v.z * k); }
    }
    geo.computeVertexNormals();
    return geo;
  }
  const X = (geo) => { geo.rotateZ(Math.PI / 2); return geo; };        // turned about x instead of y

  // ----- The carriage: the rubber platen the sheet wraps round, its end plates and knobs -----
  const platen = part(X(new THREE.CylinderGeometry(PLATEN_R - 0.6, PLATEN_R - 0.6, PLATEN_HALF * 2, 160, 1, false)), M.rubber);
  platen.position.set(0, BEND_Y, PLATEN_Z);
  const plateShape = new THREE.Shape();
  { const z0 = PLATEN_Z - 58, z1 = PLATEN_Z + 50, y0 = BEND_Y - 60, y1 = BEND_Y + 52, rr = 26;
    plateShape.moveTo(z0 + rr, y0); plateShape.lineTo(z1 - rr, y0); plateShape.quadraticCurveTo(z1, y0, z1, y0 + rr); plateShape.lineTo(z1, y1 - rr);
    plateShape.quadraticCurveTo(z1, y1, z1 - rr, y1); plateShape.lineTo(z0 + rr, y1); plateShape.quadraticCurveTo(z0, y1, z0, y1 - rr); plateShape.lineTo(z0, y0 + rr);
    plateShape.quadraticCurveTo(z0, y0, z0 + rr, y0); }
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 6, bevelEnabled: true, bevelSize: 2.4, bevelThickness: 2.4, bevelSegments: 8, curveSegments: 48 });
  plateGeo.rotateY(-Math.PI / 2);
  [-1, 1].forEach((side) => { const p = part(plateGeo, M.plate); p.position.x = side > 0 ? PLATE_X + 6 : -PLATE_X; });
  // Platen knobs: domed bakelite with a knurled grip, on a nickel collar.
  const knobGeo = turned([[0, 0], [6.5, 0.2], [7, 2.5], [21, 3.6], [24.4, 6.5], [25.2, 11], [25, 16], [23.6, 20.5], [19.5, 24.2], [12, 26.6], [0, 27.4]]);
  const gripGeo = knurled(25.9, 8.5, 72);
  const hubGeo = turned([[0, -0.1], [9.5, 0], [10, 1.2], [9.6, 3.4], [8, 4.2], [0, 4.3]], 32, 96);
  const knobs = [];
  [-1, 1].forEach((side) => {
    const g = new THREE.Group(); scene.add(g);
    g.position.set(side * KNOB_X, BEND_Y, PLATEN_Z); g.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const hub = part(hubGeo, M.chrome, { parent: g }); hub.position.y = -3.6;
    const knob = part(knobGeo, M.bakelite, { parent: g });
    const grip = part(gripGeo, M.bakelite, { parent: g }); grip.position.y = 12.5;
    [hub, knob, grip].forEach((m) => { m.userData.knob = side; });
    knobs.push(g);
  });
  // The carriage return lever: nickel, sweeping out from the left end plate.
  const leverCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-PLATE_X - 4, BEND_Y + 36, PLATEN_Z + 20), new THREE.Vector3(-PLATE_X - 12, BEND_Y + 50, PLATEN_Z + 42),
    new THREE.Vector3(-PLATE_X - 22, BEND_Y + 56, PLATEN_Z + 62), new THREE.Vector3(-PLATE_X - 30, BEND_Y + 57, PLATEN_Z + 74)]);
  const leverGroup = new THREE.Group(); scene.add(leverGroup);
  const lever = part(new THREE.TubeGeometry(leverCurve, 120, 3.2, 32, false), M.chrome, { parent: leverGroup });
  const paddle = part(new THREE.SphereGeometry(7, 64, 48), M.chrome, { parent: leverGroup });
  paddle.scale.set(1, 0.72, 1.5); paddle.position.copy(leverCurve.getPoint(1));
  lever.userData.lever = paddle.userData.lever = true;

  // ----- The rod in front of the sheet, its collars and the arms that hold it -----
  const zRod = 14;
  const rod = part(X(new THREE.CylinderGeometry(ROD_R, ROD_R, (PLATE_X + 4) * 2, 96, 1, true)), M.brass);
  rod.position.set(0, ROD_Y, zRod);
  const collarGeo = X(turned([[ROD_R + 0.2, -7.5], [ROD_R + 2.0, -7.4], [ROD_R + 2.3, -6.4], [ROD_R + 2.3, 6.4], [ROD_R + 2.0, 7.4], [ROD_R + 0.2, 7.5]], 24, 96));
  [-1, 1].forEach((side) => { const c = part(collarGeo, M.collar); c.position.set(side * (PLATE_X - 4), ROD_Y, zRod); });
  const armShape = new THREE.Shape(); armShape.absarc(0, 0, 3.4, 0, Math.PI * 2, false);
  [-1, 1].forEach((side) => {
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(side * (PLATE_X + 1), ROD_Y, zRod), new THREE.Vector3(side * (PLATE_X + 2), ROD_Y + 6, (zRod + PLATEN_Z + 50) / 2), new THREE.Vector3(side * (PLATE_X + 3), ROD_Y + 14, PLATEN_Z + 46)]);
    part(new THREE.TubeGeometry(path, 40, 3, 24, false), M.chrome);
  });

  // ----- The body: the enamel top cover, sloping down toward you under the rod, every edge rounded -----
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-80, -460); bodyShape.lineTo(-80, -82); bodyShape.quadraticCurveTo(-80, -72, -66, -72); bodyShape.lineTo(-30, -72);
  bodyShape.quadraticCurveTo(-20, -72, -12, -79); bodyShape.lineTo(30, -116); bodyShape.bezierCurveTo(46, -130, 56, -140, 56, -162); bodyShape.lineTo(58, -460); bodyShape.lineTo(-80, -460);
  const BODY_HALF = 216;
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: BODY_HALF * 2 - 24, bevelEnabled: true, bevelSize: 12, bevelThickness: 12, bevelSegments: 14, curveSegments: 64 });
  bodyGeo.rotateY(-Math.PI / 2); bodyGeo.translate(BODY_HALF - 12, 0, 0);
  part(bodyGeo, M.enamel);
  // A nickel trim line along the top of the cover, under the platen.
  const trim = part(X(new THREE.CylinderGeometry(2.2, 2.2, BODY_HALF * 2 - 30, 48, 1, false)), M.chrome);
  trim.position.set(0, -72 + 12 - 1, -40);
  // Ribbon spools on the deck: nickel spools wound with the ribbon in the machine.
  const deckN = new THREE.Vector3(0, 42, 37).normalize();
  const deckAt = (x, z) => new THREE.Vector3(x, -79 + (z + 12) * (-37 / 42), z).addScaledVector(deckN, 12);
  const flangeGeo = turned([[5, 0], [24, 0], [25.4, 0.7], [25.4, 1.5], [24, 2.2], [5, 2.2]], 24, 160);
  const woundGeo = turned([[6, 0], [17.4, 0], [18, 0.6], [18, 6.4], [17.4, 7], [6, 7]], 24, 160);
  const spoolHubGeo = turned([[0, 0], [5.6, 0], [5.8, 6], [4.6, 11], [3.2, 12.4], [0, 12.6]], 32, 96);
  const spools = [-1, 1].map((side) => {
    const g = new THREE.Group(); scene.add(g);
    g.position.copy(deckAt(side * 150, 2)); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deckN);
    const parts = [part(flangeGeo, M.chrome, { parent: g }), part(woundGeo, M.ribbon, { parent: g }), part(spoolHubGeo, M.chrome, { parent: g })];
    parts[1].position.y = 2.2;
    const top = part(flangeGeo, M.chrome, { parent: g }); top.position.y = 9.2; top.scale.set(0.56, 1, 0.56); parts.push(top);
    parts.forEach((p) => { p.userData.spool = side; });
    return g;
  });

  // ----- The type guide: the ivory capsule riding the rod, three lamps and the T pointer -----
  const guide = new THREE.Group(); scene.add(guide);
  const pill = part(new THREE.CapsuleGeometry(PILL_R, PILL_LEN - PILL_R * 2, 32, 96), M.ivory, { parent: guide });
  pill.rotation.z = Math.PI / 2; pill.scale.set(1, 1, 0.82); pill.position.set(0, 0, 4);
  const front = 4 + PILL_R * 0.82;
  const lampGeo = new THREE.SphereGeometry(3.1, 48, 32);
  const glowCanvas = document.createElement("canvas"); glowCanvas.width = glowCanvas.height = 128;
  { const gg = glowCanvas.getContext("2d"), glowGrad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    glowGrad.addColorStop(0, "rgba(255,255,255,1)"); glowGrad.addColorStop(0.18, "rgba(255,255,255,.55)"); glowGrad.addColorStop(0.45, "rgba(255,255,255,.12)"); glowGrad.addColorStop(1, "rgba(255,255,255,0)");
    gg.fillStyle = glowGrad; gg.fillRect(0, 0, 128, 128); }
  const glowTex = new THREE.CanvasTexture(glowCanvas); glowTex.encoding = THREE.sRGBEncoding;
  const haloGeo = new THREE.PlaneGeometry(1, 1);
  // At rest a lamp is a dim, faintly glowing bead; a strike flares it to full colour with a halo.
  const lamps = LAMP_COLOURS.map((hex, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.32), emissive: hex, emissiveIntensity: 0.2, roughness: 0.22 });
    const bulb = part(lampGeo, mat, { parent: guide, cast: false });
    bulb.position.set((i - 1) * 10.5, 0, front + 0.6); bulb.scale.set(1, 1, 0.55);
    const haloMat = new THREE.MeshBasicMaterial({ map: glowTex, color: hex, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set((i - 1) * 10.5, 0, front + 3.4); halo.renderOrder = 20; guide.add(halo);
    return { mat, halo };
  });
  const stemTop = -ROD_Y - 7, stemBottom = PILL_R - 1.5;
  const bar = part(new THREE.BoxGeometry(9.5, 2, 2), M.pointer, { parent: guide });
  const stem = part(new THREE.BoxGeometry(2, stemTop - stemBottom, 2), M.pointer, { parent: guide });
  const collar = part(new THREE.CylinderGeometry(2.6, 3.2, 2.2, 48), M.pointer, { parent: guide });
  bar.position.set(0, stemTop, 2); stem.position.set(0, (stemTop + stemBottom) / 2, 2); collar.position.set(0, PILL_R - 0.6, 2.5);

  const clickable = [];
  scene.traverse((o) => { if (o.isMesh && (o.userData.knob || o.userData.lever || o.userData.spool)) clickable.push(o); });
  const raycaster = new THREE.Raycaster();

  // ----- Ink: a tall texture covering the part of the sheet near the screen; typing patches a band -----
  const INK = { canvas: null, g: null, tex: null, S: 1, top: -1e9, h: 0, band: null, bandG: null, sig: "", dirty: true };
  function setupInk() {
    const maxTex = Math.min(renderer.capabilities.maxTextureSize, 4096);
    const S = Math.max(1.8, Math.min(3.4, app.zoom * app.DPR * 0.62));
    const w = Math.ceil(PAPER_W * S);
    if (INK.canvas && INK.canvas.width === w && INK.canvas.height === maxTex) return;
    if (INK.tex) INK.tex.dispose();
    INK.canvas = document.createElement("canvas"); INK.canvas.width = w; INK.canvas.height = maxTex;
    INK.g = INK.canvas.getContext("2d"); INK.S = w / PAPER_W; INK.h = maxTex / INK.S; INK.top = -1e9;
    INK.tex = new THREE.CanvasTexture(INK.canvas);
    INK.tex.flipY = false; INK.tex.generateMipmaps = true; INK.tex.minFilter = THREE.LinearMipmapLinearFilter; INK.tex.magFilter = THREE.LinearFilter;
    INK.tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    INK.band = document.createElement("canvas"); INK.band.width = w; INK.band.height = 8; INK.bandG = INK.band.getContext("2d");
    uniforms.uInk.value = INK.tex; uniforms.uInkH.value = INK.h;
  }
  const inkSig = () => [app.sheet.id, app.sheet.face, app.sheet.size, app.sheet.spacing, app.sheet.align, topMargin(app.sheet), app.typist.chars.length, app.typist.layout.lines.length, app.sheet.title || ""].join("|");
  function redrawInk(centre) {
    INK.top = Math.floor(centre - INK.h / 2);
    const g = INK.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, INK.canvas.width, INK.canvas.height);
    g.setTransform(INK.S, 0, 0, INK.S, 0, -INK.top * INK.S);
    drawInk(g, app.sheet, app.typist.layout, INK.top, INK.h);
    INK.tex.needsUpdate = true; INK.sig = inkSig(); INK.dirty = false;
    uniforms.uInkTop.value = INK.top;
  }
  function patchInk(fromLine, toLine) {
    if (toLine - fromLine > 8) { INK.dirty = true; return false; }
    const tm = topMargin(app.sheet);
    return patchBand(tm + fromLine * LH - 20, tm + toLine * LH + 8);
  }
  // Redraws one band of the ink (in sheet points) and uploads just that strip of the texture.
  function patchBand(bandTop, bandBottom) {
    if (INK.dirty || INK.top === -1e9 || INK.sig === "" || bandTop < INK.top || bandBottom > INK.top + INK.h) { INK.dirty = true; return false; }
    const y0 = Math.max(0, Math.floor((bandTop - INK.top) * INK.S)), y1 = Math.min(INK.canvas.height, Math.ceil((bandBottom - INK.top) * INK.S));
    if (y1 - y0 < 2) return true;
    const top = INK.top + y0 / INK.S, h = (y1 - y0) / INK.S;
    const L = { lines: app.typist.layout.lines.slice(0) };
    INK.band.height = y1 - y0;
    const bg = INK.bandG; bg.setTransform(INK.S, 0, 0, INK.S, 0, -(INK.top * INK.S + y0));
    drawInk(bg, app.sheet, L, top, h);
    const g = INK.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(0, y0, INK.canvas.width, y1 - y0); g.clip();
    g.clearRect(0, y0, INK.canvas.width, y1 - y0); g.setTransform(INK.S, 0, 0, INK.S, 0, -INK.top * INK.S);
    drawInk(g, app.sheet, L, top, h); g.restore();
    const props = renderer.properties.get(INK.tex);
    if (props.__webglTexture && props.__version === INK.tex.version) {
      const gl = renderer.getContext();
      renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, gl.RGBA, gl.UNSIGNED_BYTE, INK.band);
      gl.generateMipmap(gl.TEXTURE_2D);
      renderer.state.unbindTexture();
    }
    INK.sig = inkSig();
    return true;
  }

  // The flower: drawn once per sheet into its own small texture.
  const FL = { canvas: document.createElement("canvas"), tex: null, sig: "" };
  FL.canvas.width = FL.canvas.height = 384;
  FL.tex = new THREE.CanvasTexture(FL.canvas); FL.tex.flipY = false;
  FL.tex.generateMipmaps = true; FL.tex.minFilter = THREE.LinearMipmapLinearFilter;
  uniforms.uFlower.value = FL.tex;
  const FLOWER_BOX = 132;
  function updateFlower() {
    const s = app.sheet, sig = s.flower + ":" + s.seed;
    if (sig === FL.sig) return;
    FL.sig = sig;
    const g = FL.canvas.getContext("2d"), k = FL.canvas.width / FLOWER_BOX;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, FL.canvas.width, FL.canvas.height);
    if (s.flower && s.flower !== "none") {
      const r = splitmix(BigInt(s.seed) ^ 0xF10EF10En);
      g.setTransform(k, 0, 0, k, 0, 0);
      drawFlower(g, s.flower, FLOWER_BOX / 2, FLOWER_BOX / 2, 104, -24 + r.sym(10), s.seed);
    }
    FL.tex.needsUpdate = true;
    uniforms.uFlowerOn.value = !s.flower || s.flower === "none" ? 0 : 1;
    uniforms.uFlowerRect.value.set(PAPER_W - 70 - FLOWER_BOX / 2, 66 - FLOWER_BOX / 2, FLOWER_BOX, FLOWER_BOX);
  }
  const lastInk = { id: "" };
  function applyStyle() {
    const s = app.sheet, paperDef = byId(PAPERS, s.paper), ink = byId(INKS, s.ink);
    uniforms.uPaperCol.value.set(...hex3(paperDef.color));
    uniforms.uInkCol.value.set(...hex3(ink.color));
    uniforms.uGrain.value = paperDef.grain; uniforms.uAge.value = paperDef.age; uniforms.uLaid.value = paperDef.laid; uniforms.uFibre.value = paperDef.fibre;
    uniforms.uCockle.value = paperDef.cockle; uniforms.uSheer.value = paperDef.sheer; uniforms.uSoak.value = paperDef.soak;
    uniforms.uCloth.value = ink.cloth; uniforms.uCrisp.value = ink.crisp; uniforms.uFuzz.value = ink.fuzz;
    uniforms.uSeedX.value = (s.seed % 997) * 7.31; uniforms.uSeedY.value = (s.seed % 991) * 3.17;
    if (lastInk.id !== ink.id) { lastInk.id = ink.id; M.ribbon.color.set(ink.id === "carbon" || ink.id === "film" ? "#2a2725" : ink.color); }
    updateFlower();
  }

  let pressT = 0;
  function render() {
    const W = app.W, H = app.H, zoom = app.zoom, sp = app.spring, s = app.sheet;
    applyStyle();
    const sy = sp.sy.v, topY = topMargin(s) + sp.y.v;
    const fov = camera.fov * Math.PI / 180, dist = (H / 2) / zoom / Math.tan(fov / 2);
    camera.position.set(0, (sy - H / 2) / zoom, dist); camera.near = dist * 0.3; camera.far = dist * 3; camera.updateProjectionMatrix();
    const viewTop = topY - sy / zoom, viewBottom = topY + (H - sy) / zoom;
    const paperH = Math.max(sheetHeight(s, app.typist.layout), viewBottom + 160);
    uniforms.uPaperH.value = paperH; uniforms.uTopY.value = topY;
    uniforms.uWinTop.value = viewTop - 90; uniforms.uWinH.value = (viewBottom - viewTop) + 180;
    if (INK.dirty || INK.sig !== inkSig() || viewTop - 30 < INK.top || viewBottom + 30 > INK.top + INK.h) redrawInk((viewTop + viewBottom) / 2);
    uniforms.uPxPerPt.value = zoom * app.DPR; uniforms.uView.value.set(W * app.DPR, H * app.DPR);
    uniforms.uGrid.value.set(topMargin(s), LH, SIDE, ADV);
    const box = app.selBox();
    if (box) { uniforms.uSel.value.set(...box.slice(0, 4)); uniforms.uSelShift.value.set(box[4], box[5]); } else uniforms.uSel.value.x = -1;
    const cx = sp.x.v - PAPER_W / 2, camY = camera.position.y;
    uniforms.uCaretX.value = cx;
    // Parts in front of the sheet are placed so they line up with the type at their own depth.
    const zGuide = zRod + ROD_R * 0.4, kGuide = (dist - zGuide) / (dist - app.paperDepth(cx));
    const dip = Math.max(0, 1 - (performance.now() - pressT) / 90) * 1.1;
    guide.position.set(cx * kGuide, camY + (ROD_Y - camY) * kGuide - dip, zGuide);
    lamps.forEach((l, i) => {
      const g = app.lampGlow[i];
      l.mat.emissiveIntensity = 0.25 + 0.9 * g;
      l.halo.material.opacity = 0.8 * g;
      const sz = 10 + 22 * g; l.halo.scale.set(sz, sz, 1);
    });
    // Day to night: the sun and sky fade to moonlight, the lamp comes up warm at the type guide.
    const lamp = sp.lamp.v;
    uniforms.uLamp.value = lamp;
    uniforms.uLampPos.value.set(cx, -8, 34);
    hemi.intensity = 1.1 * (1 - lamp * 0.8); hemi.color.lerpColors(DAY_SKY, NIGHT_SKY, lamp); hemi.groundColor.lerpColors(DAY_GROUND, NIGHT_GROUND, lamp);
    key.intensity = 2.2 * (1 - lamp * 0.86); key.color.lerpColors(DAY_KEY, NIGHT_KEY, lamp);
    rim.intensity = 1.1 * (1 - lamp);
    lampLight.position.set(cx * kGuide, camY + (-6 - camY) * kGuide, 40); lampLight.intensity = 2.6 * lamp;
    const night = lamp > 0.5, envK = 1 - lamp * 0.3;
    if (scene.environment !== (night ? ENV_NIGHT : ENV_DAY)) scene.environment = night ? ENV_NIGHT : ENV_DAY;
    ENV_BASE.forEach((base, m) => { m.envMapIntensity = base * envK; });
    M.pointer.emissive.setRGB(0.9 * lamp, 0.55 * lamp, 0.2 * lamp); M.pointer.emissiveIntensity = 0.35;
    // The carriage return lever kicks when a line comes back; the knobs turn with the platen.
    const kick = Math.max(0, 1 - (performance.now() - app.returnT) / 260);
    leverGroup.position.x = -Math.sin(Math.PI * kick) * 6;
    knobs.forEach((k) => { k.rotation.x = -sp.y.v / PLATEN_R; });
    const sig = guide.position.x.toFixed(1) + ":" + guide.position.y.toFixed(1) + ":" + leverGroup.position.x.toFixed(1) + ":" + knobs[0].rotation.x.toFixed(2);
    if (sig !== shadowSig) { shadowSig = sig; renderer.shadowMap.needsUpdate = true; }
    renderer.render(scene, camera);
  }
  function pick(lx, ly) {
    raycaster.setFromCamera(new THREE.Vector2((lx / app.W) * 2 - 1, -(ly / app.H) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(clickable, false)[0];
    if (!hit) return null;
    const u = hit.object.userData;
    return u.knob ? { knob: u.knob } : u.lever ? { lever: true } : u.spool ? { spool: u.spool } : null;
  }
  function resize() {
    renderer.setPixelRatio(app.DPR); renderer.setSize(app.W, app.H, false);
    camera.aspect = app.W / app.H;
    setupInk();
  }
  // Downloads go through the same shader, flat and evenly lit, a band at a time.
  function exportPng(L, paperH, scale, from = 0, to = paperH) {   // the slice [from, to] of the sheet, in points
    const outW = Math.round(PAPER_W * scale), outH = Math.round((to - from) * scale);
    const out = document.createElement("canvas"); out.width = outW; out.height = outH;
    const og = out.getContext("2d");
    const band = Math.min(2048, renderer.capabilities.maxTextureSize);
    const ec = document.createElement("canvas"); ec.width = outW; ec.height = band + 64;
    const eg2 = ec.getContext("2d");
    const etex = new THREE.CanvasTexture(ec);
    etex.flipY = false; etex.generateMipmaps = true; etex.minFilter = THREE.LinearMipmapLinearFilter;
    const cam = new THREE.OrthographicCamera(-PAPER_W / 2, PAPER_W / 2, 0, -1, -200, 200);
    const keep = {}; for (const k of ["uFlat", "uInk", "uInkTop", "uInkH", "uWinTop", "uWinH", "uTopY", "uPaperH", "uLamp", "uPxPerPt", "uSel"]) keep[k] = uniforms[k].value;
    const keepSel = uniforms.uSel.value.clone(), keepView = uniforms.uView.value.clone();
    const hidden = scene.children.filter((o) => o !== paper);
    hidden.forEach((o) => { o.visible = false; });
    renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
    try {
      applyStyle();   // the sheet being exported may differ from the one on screen (a blank one for the envelope)
      for (let y0 = 0; y0 < outH; y0 += band) {
        const bh = Math.min(band, outH - y0);
        renderer.setSize(outW, bh, false);
        const sTop = from + y0 / scale, sBot = from + (y0 + bh) / scale, inkTop = sTop - 16;
        eg2.setTransform(1, 0, 0, 1, 0, 0); eg2.clearRect(0, 0, ec.width, ec.height);
        eg2.setTransform(scale, 0, 0, scale, 0, -inkTop * scale);
        drawInk(eg2, app.sheet, L, inkTop, ec.height / scale);
        etex.needsUpdate = true;
        uniforms.uFlat.value = 1; uniforms.uInk.value = etex; uniforms.uInkTop.value = inkTop; uniforms.uInkH.value = ec.height / scale;
        uniforms.uTopY.value = 0; uniforms.uWinTop.value = sTop - 2; uniforms.uWinH.value = (sBot - sTop) + 4; uniforms.uPaperH.value = paperH;
        uniforms.uLamp.value = 0; uniforms.uPxPerPt.value = scale; uniforms.uView.value.set(outW, bh); uniforms.uSel.value.x = -1;
        cam.top = -sTop; cam.bottom = -sBot; cam.updateProjectionMatrix();
        renderer.render(scene, cam);
        og.drawImage(renderer.domElement, 0, y0);
      }
    } finally {
      for (const k in keep) uniforms[k].value = keep[k];
      uniforms.uSel.value.copy(keepSel); uniforms.uView.value.copy(keepView);
      hidden.forEach((o) => { o.visible = true; });
      etex.dispose();
      renderer.setPixelRatio(app.DPR); renderer.setSize(app.W, app.H, false); renderer.setClearColor(0x000000, 0);
      render();
    }
    return out;
  }
  return { render, resize, patchInk, patchTop: () => patchBand(-8, topMargin(app.sheet) + 8), redrawAll: () => { INK.dirty = true; }, exportPng, pick, press: () => { pressT = performance.now(); }, hidePaper: (on) => { paper.visible = !on; },
    view: VIEW, dispose() { renderer.dispose(); renderer.forceContextLoss(); if (VIEW) VIEW.dispose(); } };   // browsers cap live contexts
}
