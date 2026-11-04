// Stitches the styles, the shaders, the engine and the component into one .dc.html artboard, three times:
// canvas/project/Main.dc.html points at the claude.ai artifact's stored assets (assets.json);
// out/Main.site.dc.html at the files in this repo, relative to its root, for build-site.mjs to turn into ../index.html;
// out/Main.app.dc.html carries every asset inside it, for the Mac and iPhone app's TypeWrite.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url);
const read = (f) => readFileSync(here(f), "utf8");
const FONTS = "TypeWrite/Resources/Fonts/";   // the same files the Mac and iPhone app ship
// The key sounds ship as one JSON file of base64 WAVs, made from the app's recordings (Tools/make_sounds.py).
const KEYS = ["key1", "key2", "key3", "key4", "space", "backspace", "bell", "return", "feed", "jam"];
writeFileSync(here("assets/typewriter-sounds.json"), JSON.stringify(Object.fromEntries(KEYS.map((n) => [n, readFileSync(here(`../TypeWrite/Resources/Sounds/${n}.wav`)).toString("base64")]))));
const SITE = { three: "web/assets/three-r149.min.js", courier: FONTS + "CourierPrime-Regular.ttf", cutive: FONTS + "CutiveMono-Regular.ttf", lekton: FONTS + "Lekton-Regular.ttf", elite: FONTS + "SpecialElite-Regular.ttf",
  sounds: "web/assets/typewriter-sounds.json", dayMp4: "web/assets/ambience-day.mp4", dayWebm: "web/assets/ambience-day.webm", nightMp4: "web/assets/ambience-night.mp4", nightWebm: "web/assets/ambience-night.webm" };
const inline = (file, type) => `data:${type};base64,` + readFileSync(here(file)).toString("base64");
const APP = { three: inline("assets/three-r149.min.js", "text/javascript"), courier: inline("../" + FONTS + "CourierPrime-Regular.ttf", "font/ttf"),
  cutive: inline("../" + FONTS + "CutiveMono-Regular.ttf", "font/ttf"), lekton: inline("../" + FONTS + "Lekton-Regular.ttf", "font/ttf"), elite: inline("../" + FONTS + "SpecialElite-Regular.ttf", "font/ttf"),
  sounds: inline("assets/typewriter-sounds.json", "application/json"), dayMp4: inline("assets/ambience-day.mp4", "audio/mp4"), dayWebm: "",
  nightMp4: inline("assets/ambience-night.mp4", "audio/mp4"), nightWebm: "" };   // WebKit plays the AAC loops, so the app carries no WebM
const parts = ["src/z-engine.js", "src/z-sheet.js", "src/z-paper-glsl.js", "src/z-view-glsl.js", "src/gl.js", "src/app-main.js"];
function build(assets, out) {
  const css = read("app.css").replace("__F_COURIER__", assets.courier).replace("__F_ELITE__", assets.elite).replace("__F_CUTIVE__", assets.cutive).replace("__F_LEKTON__", assets.lekton);
  const script = "// TypeWrite by Jericho: a typewriter on the bench. The page and the view are the earlier web machine's; the machine is drawn in anatomy tones.\n"
    + "const LETTER_HTML = " + JSON.stringify(read("src/letter.html")).replace(/<\//g, "<\\/") + ";\nconst LETTER_SOUNDS = " + read("assets/letter/sounds.json") + ";\n" + "const ASSETS = " + JSON.stringify({ sounds: assets.sounds, dayMp4: assets.dayMp4, dayWebm: assets.dayWebm, nightMp4: assets.nightMp4, nightWebm: assets.nightWebm }) + ";\nlet grainTile = null;\n" + parts.map(read).join("\n");
  const html = read("template.html").replace("__THREE__", assets.three).replace("__CSS__", () => css).replace("__SCRIPT__", () => script);
  writeFileSync(here(out), html);
  return html.length;
}
mkdirSync(here("canvas/project/"), { recursive: true });
mkdirSync(here("out/"), { recursive: true });
const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log("canvas", kb(build(JSON.parse(read("assets.json")), "canvas/project/Main.dc.html")), "site", kb(build(SITE, "out/Main.site.dc.html")), "app", kb(build(APP, "out/Main.app.dc.html")));
