// Builds the two pages from what assemble.mjs made: the GitHub Pages site, ../index.html, and the Mac and iPhone
// app's page, ../TypeWrite/Resources/TypeWrite.html, which carries every asset inside it.
// The page carries its own small stand-in for the canvas runtime: enough of the .dc.html format (holes, sc-for, sc-if,
// events, refs, helmet) to run the artboard on React, which is inlined from node_modules.
import { readFileSync, writeFileSync } from "node:fs";
const here = (f) => new URL(f, import.meta.url);
for (const [from, to] of [["out/Main.site.dc.html", "../index.html"], ["out/Main.app.dc.html", "../TypeWrite/Resources/TypeWrite.html"]]) {
const src = readFileSync(here(from), "utf8");
const headScripts = [...src.match(/<head>([\s\S]*?)<\/head>/)[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((u) => !u.includes("support.js"));
const helmet = src.match(/<helmet>([\s\S]*?)<\/helmet>/)[1];
const body = src.match(/<x-dc>[\s\S]*?<\/helmet>([\s\S]*?)<\/x-dc>/)[1];
const script = src.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'>([\s\S]*?)<\/script>/);
const props = JSON.parse(script[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'"));
const logic = script[2];
const react = readFileSync(here("node_modules/react/umd/react.production.min.js"), "utf8");
const reactDom = readFileSync(here("node_modules/react-dom/umd/react-dom.production.min.js"), "utf8");
const shim = `
const ATTR = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", autocomplete: "autoComplete", autocorrect: "autoCorrect", autocapitalize: "autoCapitalize", spellcheck: "spellCheck", enterkeyhint: "enterKeyHint", maxlength: "maxLength", viewbox: "viewBox", preserveaspectratio: "preserveAspectRatio", "clip-path": "clipPath", "text-anchor": "textAnchor", "font-size": "fontSize", "fill-opacity": "fillOpacity", "stroke-width": "strokeWidth", basefrequency: "baseFrequency", numoctaves: "numOctaves", "xlink:href": "xlinkHref" };
const EVENTS = {}; ["Click","Change","Input","PointerDown","PointerUp","KeyDown","Focus","Blur"].forEach((e) => EVENTS["on" + e.toLowerCase()] = "on" + e);
function look(scope, path) { path = path.trim(); if (path === "true") return true; if (path === "false") return false; if (/^-?\\d/.test(path)) return Number(path); let v = scope; for (const part of path.split(".")) { if (v == null) return undefined; v = v[part]; } return v; }
function interp(scope, text) { return text.replace(/\\{\\{([^}]+)\\}\\}/g, (_, p) => { const v = look(scope, p); return v == null ? "" : String(v); }); }
function value(scope, raw) { const m = raw.match(/^\\s*\\{\\{([^}]+)\\}\\}\\s*$/); if (m) return look(scope, m[1]); if (raw.includes("{{")) return interp(scope, raw); return raw; }
function styleObj(s) { const o = {}; if (typeof s !== "string") return s; s.split(/;(?![^(]*\\))/).forEach((d) => { const i = d.indexOf(":"); if (i < 0) return; const k = d.slice(0, i).trim(); const v = d.slice(i + 1).trim(); if (!k) return; o[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v; }); return o; }
function build(node, scope, key) {
  const h = React.createElement;
  if (node.nodeType === 3) { const t = node.nodeValue; if (!t.includes("{{")) return /^\\s*$/.test(t) ? null : t; return interp(scope, t); }
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  const kids = (sc) => Array.from(node.childNodes).map((c, i) => build(c, sc, i)).filter((x) => x !== null);
  if (tag === "sc-for") { const list = value(scope, node.getAttribute("list")) || []; const as = node.getAttribute("as"); return h(React.Fragment, { key }, list.map((item, i) => h(React.Fragment, { key: item && item.key != null ? item.key : i }, ...kids({ ...scope, [as]: item, $index: i })))); }
  if (tag === "sc-if") { return value(scope, node.getAttribute("value")) ? h(React.Fragment, { key }, ...kids(scope)) : null; }
  const p = { key };
  for (const a of Array.from(node.attributes)) {
    if (a.name.startsWith("hint-")) continue;
    let name = EVENTS[a.name] || ATTR[a.name] || a.name;
    let v = value(scope, a.value);
    if (name === "style") v = styleObj(v);
    if ((name === "readOnly") && v === "") v = true;
    if (name === "value") { name = "defaultValue"; }
    p[name] = v;
  }
  if (tag === "textarea") { delete p.defaultValue; }
  return h(tag, p, ...kids(scope));
}
class DCLogic extends React.Component { render() { const vals = this.renderVals(); return React.createElement(React.Fragment, null, ...Array.from(TEMPLATE.childNodes).map((c, i) => build(c, vals, i)).filter(Boolean)); } }
const TEMPLATE = document.getElementById("tpl").content;
`;
const meta = `<title>TypeWrite by Jericho</title>
<meta name="description" content="A typewriter in your browser. Every key clacks, the bell rings near the margin, the ink sits in old paper, and a sheet can go out as a sealed letter.">
<meta name="theme-color" content="#161514"><meta property="og:title" content="TypeWrite by Jericho">
<meta property="og:description" content="A typewriter in your browser and on your iPhone. Every key clacks."><meta property="og:image" content="Branding/JerichoTile.png">
<link rel="icon" type="image/png" href="Branding/JerichoTile.png"><link rel="apple-touch-icon" href="Branding/AppIcon-1024.png">`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${meta}${headScripts.map((u) => `<script src="${u}"></script>`).join("")}${helmet}</head><body>
<template id="tpl">${body}</template><div id="app"></div>
<script>${react}</script><script>${reactDom}</script>
<script>${shim}
const Component = (function(){ ${logic}; return Component; })();
window.__app = null;
const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(React.createElement(Component, { ref: (c) => (window.__app = c), lamp: "Off" }));
</script></body></html>`;
writeFileSync(here(to), html);
console.log(to, (html.length / 1024).toFixed(0) + " KB", Object.keys(props));
}
