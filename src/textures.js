import * as THREE from 'three';
import { PRESET } from './settings.js';

const BASE = import.meta.env.BASE_URL;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function canvasTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = PRESET.name === 'low' ? 1 : 4; track(c.width, c.height); return t;
}
// Rough GPU texture memory estimate (RGBA8 + mip chain), for the perf overlay.
export const texStats = { bytes: 0, count: 0 };
function track(w, h) { texStats.bytes += w * h * 4 * 1.33; texStats.count++; }

export const texManager = THREE.DefaultLoadingManager;
const loader = new THREE.TextureLoader();
const cache = {};
function load(url, srgb) {
  if (!cache[url]) {
    const t = loader.load(url, (tx) => track(tx.image.width, tx.image.height));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = PRESET.name === 'low' ? 1 : 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache[url] = t;
  }
  return cache[url];
}
// Material maps for a CC0 photo set public/tex/<name>_*.webp. UVs are pre-scaled in geometry, so no repeat here.
export function pbrMaps(name, { normal = true } = {}) {
  const b = BASE + 'tex/' + name;
  const p = { map: load(b + (PRESET.texSize <= 512 ? '_diff_512.webp' : '_diff.webp'), true) };
  if (PRESET.normalMaps && normal) p.normalMap = load(b + '_nor.webp', false);
  if (PRESET.pbr) p.roughnessMap = load(b + '_rough.webp', false);
  return p;
}
export function skyTexture() {
  const t = loader.load(BASE + (PRESET.name === 'low' ? 'hdri/sky_1k.webp' : 'hdri/sky_2k.webp'), (tx) => track(tx.image.width, tx.image.height));
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- tenement facade atlas: 4x4 cells, photo sandstone background ----------
// Cells (col,row): see FACADE below. Each cell is one window bay (~3.4 m x one storey).
export const FACADE = { plain: 0, sashA: 1, sashB: 2, triple: 3, small: 4, door: 5, blind: 6, lit: 7, flowers: 8, pediment: 9, rustic: 10, arch: 11, shopUpper: 12, doorRed: 13, doorGreen: 14, smallLit: 15 };
export function facadeAtlas(onReady) {
  const S = PRESET.texSize <= 512 ? 512 : 1024, C = S / 4;
  const [c, g] = canvas(S, S);
  const t = canvasTex(c, false); t.generateMipmaps = true;
  const draw = (img) => {
    for (let i = 0; i < 16; i++) {
      const x0 = (i % 4) * C, y0 = Math.floor(i / 4) * C;
      g.save(); g.beginPath(); g.rect(x0, y0, C, C); g.clip(); g.translate(x0, y0); g.scale(C / 256, C / 256);
      if (img) g.drawImage(img, (i * 97) % 512, (i * 53) % 512, 512, 512, 0, 0, 256, 256);
      else { g.fillStyle = '#b89a72'; g.fillRect(0, 0, 256, 256); }
      g.fillStyle = 'rgba(70,52,30,0.16)'; g.fillRect(0, 0, 256, 256);
      cell(g, i); g.restore();
    }
    t.needsUpdate = true; onReady && onReady();
  };
  // v2.8: the honey photo is gone - each bay is generated coursed ashlar in cool Edinburgh grey (16 different seeds)
  for (let i = 0; i < 16; i++) { const x0 = (i % 4) * C, y0 = Math.floor(i / 4) * C; g.save(); g.beginPath(); g.rect(x0, y0, C, C); g.clip(); g.translate(x0, y0); g.scale(C / 256, C / 256);
    const [cc, gg] = canvas(256, 256); drawEdinStone(gg, 256, 256, 20 + i, { courses: 10, soot: 0.6 }); g.drawImage(cc, 0, 0); cell(g, i); g.restore(); }
  t.needsUpdate = true; onReady && onReady();
  return t;
}
function sash(g, x, y, w, h, { lit = false, panes = 2, surround = true } = {}) {
  if (surround) { g.fillStyle = '#bdb7aa'; g.fillRect(x - 10, y - 10, w + 20, h + 22); g.fillStyle = 'rgba(40,30,15,.3)'; g.fillRect(x - 10, y + h + 8, w + 20, 4); }
  g.fillStyle = '#1b2129'; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  if (lit) { gr.addColorStop(0, '#f7d58f'); gr.addColorStop(1, '#a8743a'); } else { gr.addColorStop(0, '#a9bfd0'); gr.addColorStop(0.5, '#4b6074'); gr.addColorStop(1, '#1a222b'); }
  g.fillStyle = gr; g.fillRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle = '#efe9dc';
  g.fillRect(x + 4, y + h / 2 - 3, w - 8, 6); // meeting rail
  for (let k = 1; k < panes; k++) g.fillRect(x + (w * k) / panes - 2, y + 4, 4, h - 8);
  g.lineWidth = 4; g.strokeStyle = '#efe9dc'; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
}
function door(g, col) {
  g.fillStyle = '#b9b3a6'; g.fillRect(70, 40, 116, 216); // surround
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(128, 82, 40, Math.PI, 0); g.fill(); // fanlight
  g.fillStyle = '#87a0b4'; g.beginPath(); g.arc(128, 82, 34, Math.PI, 0); g.fill();
  g.strokeStyle = '#eee'; g.lineWidth = 3; for (let a = 1; a < 6; a++) { g.beginPath(); g.moveTo(128, 82); g.lineTo(128 - Math.cos(a / 6 * Math.PI) * 34, 82 - Math.sin(a / 6 * Math.PI) * 34); g.stroke(); }
  g.fillStyle = col; g.fillRect(90, 86, 76, 170);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.strokeRect(98, 96, 60, 64); g.strokeRect(98, 172, 60, 74);
  g.fillStyle = '#d4af37'; g.beginPath(); g.arc(152, 170, 4, 0, 7); g.fill(); g.fillRect(118, 130, 20, 6);
}
function cell(g, i) {
  const F = FACADE;
  switch (i) {
    case F.plain: break;
    case F.sashA: sash(g, 78, 40, 100, 170); break;
    case F.sashB: g.fillStyle = '#bdb7aa'; g.fillRect(64, 18, 128, 14); sash(g, 80, 46, 96, 164, { panes: 3 }); break;
    case F.triple: sash(g, 30, 50, 52, 160, { surround: true }); sash(g, 98, 50, 60, 160); sash(g, 174, 50, 52, 160); break;
    case F.small: sash(g, 88, 70, 80, 110); break;
    case F.door: door(g, '#1d3b2a'); break;
    case F.blind: g.fillStyle = '#a9a398'; g.fillRect(70, 30, 116, 190); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(80, 40, 96, 170); break; // blocked window (window tax)
    case F.lit: sash(g, 78, 40, 100, 170, { lit: true }); break;
    case F.flowers: sash(g, 78, 30, 100, 160); g.fillStyle = '#5a3b22'; g.fillRect(70, 196, 116, 22); for (let k = 0; k < 9; k++) { g.fillStyle = ['#c62d4a', '#f2c94c', '#e86fb0'][k % 3]; g.beginPath(); g.arc(80 + k * 12, 192, 7, 0, 7); g.fill(); } break;
    case F.pediment: g.fillStyle = '#bdb7aa'; g.beginPath(); g.moveTo(60, 40); g.lineTo(128, 6); g.lineTo(196, 40); g.fill(); sash(g, 80, 50, 96, 160); break;
    case F.rustic: g.strokeStyle = 'rgba(40,28,14,.5)'; g.lineWidth = 5; for (let y = 32; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } sash(g, 82, 60, 92, 120); break;
    case F.arch: g.fillStyle = '#b9b3a6'; g.fillRect(50, 60, 156, 196); g.fillStyle = '#121418'; g.fillRect(66, 110, 124, 146); g.beginPath(); g.arc(128, 110, 62, Math.PI, 0); g.fill(); break;
    case F.shopUpper: g.fillStyle = 'rgba(40,28,14,.25)'; g.fillRect(0, 200, 256, 56); sash(g, 78, 30, 100, 150); break;
    case F.doorRed: door(g, '#7a1a1a'); break;
    case F.doorGreen: door(g, '#20304f'); break;
    case F.smallLit: sash(g, 88, 70, 80, 110, { lit: true }); break;
  }
}

// ---------- sign atlas: all signs, plaques and the target door share one texture ----------
export class SignAtlas {
  constructor() {
    this.W = 1536; this.H = 2048; /* v2.8: same atlas on every preset (k = 0.75 stays sharp; 2048 at k = 1 overflowed on medium/high) */ this.k = this.W / 2048; /* v2.7: taller on low. v2.8 fix: a comment here had swallowed this.k, so every sign was drawn at NaN (blank/black) in v2.7 */ // v2.3: signs stay sharp on low (k=0.75); wall/road textures unchanged
    [this.c, this.g] = canvas(this.W, this.H); this.x = 0; this.y = 0; this.rowH = 0;
    this.g.fillStyle = '#8a857c'; this.g.fillRect(0, 0, this.W, this.H); // v2.8: unused atlas space is mid-grey, not transparent black (mip levels were bleeding black into signs seen at a grazing angle)
    this.tex = canvasTex(this.c, false); this.tex.anisotropy = 8;
  }
  alloc(w, h) { // in 2048-space px
    w *= this.k; h *= this.k;
    if (this.x + w > this.W) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; }
    const r = { x: this.x, y: this.y, w, h }; this.x += w + 2; this.rowH = Math.max(this.rowH, h); if (!(w > 0 && h > 0)) console.warn('sign atlas full (bad alloc)'); if (location.search.includes('atlasdebug')) console.log('ALLOC', r.x | 0, r.y | 0, w | 0, h | 0, new Error().stack.split('\n')[3]);
    if (this.y + h > this.H) console.warn('sign atlas full');
    return r;
  }
  uv(r) { return [r.x / this.W, 1 - (r.y + r.h) / this.H, (r.x + r.w) / this.W, 1 - r.y / this.H]; }
  sign(text, bg = '#1d3b2a', fg = '#f1d98a', aspect = 5.3, font = 'bold 54px Georgia, serif', border = fg) {
    const w = 400, h = Math.max(24, Math.round(400 / aspect)), r = this.alloc(w, h), g = this.g;
    g.save(); g.translate(r.x, r.y); g.scale(this.k, this.k);
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = Math.min(parseInt(font.match(/(\d+)px/)[1]), h * 0.62); g.font = font.replace(/\d+px/, size + 'px');
    while (g.measureText(text).width > w - 36 && size > 10) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
    g.fillText(text, w / 2, h / 2 + 2); g.restore(); this.tex.needsUpdate = true; return this.uv(r);
  }
  // v2.0: painted shop fascia - slab-serif name with a drop shadow, condensed strapline, worn edges.
  fascia(name, sub, bg, fg, aspect = 5.3) {
    const w = 512, h = Math.max(40, Math.round(512 / aspect));
    return this.draw(w, h, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg); gr.addColorStop(1, shade(bg, -0.25)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2E2F2C'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.strokeStyle = fg; g.globalAlpha = 0.7; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28); g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const nameH = sub ? h * 0.56 : h * 0.8, fit = (font, txt, max, px) => { let sz = px; g.font = font.replace('#', sz); while (g.measureText(txt).width > max && sz > 10) { sz -= 2; g.font = font.replace('#', sz); } };
      fit('#px "Alfa Slab One", Georgia, serif', name, w - 60, Math.round(nameH * 0.62));
      const ny = sub ? h * 0.4 : h / 2 + 2;
      g.fillStyle = '#2E2F2C'; g.fillText(name, w / 2 + 3, ny + 3); g.fillStyle = fg; g.fillText(name, w / 2, ny);
      if (sub) { fit('700 #px "Barlow Condensed", Arial Narrow, sans-serif', sub, w - 80, Math.round(h * 0.2)); g.fillStyle = '#EFE3C8'; g.fillText(sub, w / 2, h * 0.76); }
      let sd = 77; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,248,230,${0.05 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 3); } // weathered paint
    });
  }
  draw(w, h, fn) { const r = this.alloc(w, h), g = this.g; g.save(); g.translate(r.x, r.y); g.scale(this.k, this.k); fn(g, w, h); g.restore(); this.tex.needsUpdate = true; return this.uv(r); }
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
export function drawTargetDoor(g) {
  g.fillStyle = '#8e1c1c'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#5a0f0f'; g.lineWidth = 6; g.strokeRect(14, 14, 100, 100); g.strokeRect(14, 134, 100, 108);
  for (const [r, col] of [[44, '#fff'], [32, '#c22'], [20, '#fff'], [9, '#c22']]) { g.fillStyle = col; g.beginPath(); g.arc(64, 150, r, 0, 7); g.fill(); }
  g.fillStyle = '#d4af37'; g.beginPath(); g.arc(100, 120, 5, 0, 7); g.fill();
}

// ---------- football: original 1970s-style "triad" ball (no branding) ----------
// The pattern is computed in 3D for every texel of an equirectangular map that matches
// THREE.SphereGeometry's UV layout, so there is no stretching or seam at the poles/date line.
const ballCache = {};
// style 'tango' (default, Tango/Telstar-inspired) or 'winter' (unlockable: 1980s-style orange winter ball, black pentagons)
export function ballTexture(style = 'tango') {
  if (ballCache[style]) return ballCache[style];
  const W = PRESET.texSize <= 512 ? 512 : 1024, H = W / 2;
  const [c, g] = canvas(W, H), img = g.createImageData(W, H), d = img.data;
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  const Fi = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const Fc = Fi.map(([a, b, cc]) => norm([V[a][0] + V[b][0] + V[cc][0], V[a][1] + V[b][1] + V[cc][1], V[a][2] + V[b][2] + V[cc][2]]));
  // tilt so the pattern isn't aligned with the UV poles
  const rot = (p) => { const a = 0.37, b = 0.21; let [x, y, z] = p; [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)]; return [x, y, z]; };
  const Vr = V.map(rot), Fr = Fc.map(rot);
  // plane distances of the pentagon / hexagon faces (truncation at 1/3 of each icosahedron edge)
  const P = V[0].map((v, i) => v + (V[5][i] - v) / 3);
  const HP = V[0][0] * P[0] + V[0][1] * P[1] + V[0][2] * P[2], HH = Fc[1][0] * P[0] + Fc[1][1] * P[1] + Fc[1][2] * P[2];
  // Tango-style: white ball; a black curved band (arc) around each of the 12 white circles, broken at the
  // 30 edge midpoints so the arcs group into 20 three-armed "triads" around the hexagon centres.
  const E = []; for (const [a, b, cc] of Fi) for (const [i, j] of [[a, b], [b, cc], [cc, a]]) if (i < j) E.push(norm([V[i][0] + V[j][0], V[i][1] + V[j][1], V[i][2] + V[j][2]]));
  const Er = E.map(rot), deg = Math.PI / 180;
  const R_IN = Math.cos(22 * deg), R_OUT = Math.cos(28 * deg), R_GAP = Math.cos(9 * deg), R_HUB = Math.cos(3.5 * deg);
  const SS = 2;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let acc = 0, seam = 0, pent = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = (px + (sx + 0.5) / SS) / W, v = (py + (sy + 0.5) / SS) / H;
      const phi = u * Math.PI * 2, th = v * Math.PI;
      const x = -Math.cos(phi) * Math.sin(th), y = Math.cos(th), z = Math.sin(phi) * Math.sin(th);
      let bv = -2, bv2 = -2; for (const q of Vr) { const dd = q[0] * x + q[1] * y + q[2] * z; if (dd > bv) { bv2 = bv; bv = dd; } else if (dd > bv2) bv2 = dd; }
      let bf = -2, bf2 = -2; for (const q of Fr) { const dd = q[0] * x + q[1] * y + q[2] * z; if (dd > bf) { bf2 = bf; bf = dd; } else if (dd > bf2) bf2 = dd; }
      let be = -2; for (const q of Er) { const dd = q[0] * x + q[1] * y + q[2] * z; if (dd > be) be = dd; }
      // band around the circle, widening toward the triad hub; hub itself is a small black curved triangle
      const band = bv < R_IN && bv > R_OUT && be < R_GAP;
      const black = band || (bf > R_HUB && bv < R_IN);
      acc += black ? 1 : 0;
      if (bv / HP > bf / HH) pent++; // inside one of the 12 pentagon panels
      // panel seams: edges of the 32-panel truncated icosahedron (12 pentagons + 20 hexagons),
      // i.e. where the two best face-plane scores (n.p / plane distance) tie.
      const a1 = bv / HP, a2 = bv2 / HP, c1 = bf / HH, c2 = bf2 / HH;
      const top = Math.max(a1, c1), second = a1 > c1 ? Math.max(a2, c1) : Math.max(c2, a1);
      if (top - second < 0.0045) seam++;
    }
    const k = acc / (SS * SS), s = seam / (SS * SS), o = (py * W + px) * 4;
    let r = 244 - k * 226, gg = 243 - k * 225, b = 238 - k * 220;
    if (style === 'special') { const pk = pent / (SS * SS); r = 22 + pk * 212; gg = 92 + pk * 86; b = 52 - pk * 14; }
    if (style === 'winter') { const pk = pent / (SS * SS); r = 246 - pk * 226; gg = 118 - pk * 100; b = 24 - pk * 8; }
    r -= s * 45; gg -= s * 45; b -= s * 42;
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; track(W, H);
  ballCache[style] = tx; return tx;
}
function norm(p) { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; }

// Harling / pebbledash: small procedural speckle (256 px, tiled). Tinted per building with vertex colours.
let harlCache = null;
export function harlTexture() {
  if (harlCache) return harlCache;
  const S = 256, [c, g] = canvas(S, S), img = g.createImageData(S, S), d = img.data;
  let seed = 9; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < S * S; i++) { const v = 205 + r() * 40 - (r() < 0.08 ? 70 * r() : 0); d[i * 4] = v; d[i * 4 + 1] = v * 0.99; d[i * 4 + 2] = v * 0.96; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // faint rain streaks
  g.globalAlpha = 0.06; g.fillStyle = '#3a3a3a'; for (let i = 0; i < 40; i++) g.fillRect(r() * S, r() * S * 0.3, 1 + r() * 2, 40 + r() * 120);
  harlCache = canvasTex(c, true); return harlCache;
}

// ---------- v2.0 "Nostalgic Street Realism" procedural textures (stylised, cheap: 256 px each, cached) ----------
const v2Cache = {};
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
// Warm pebbledash: chunky light/dark pebbles over a cream base. Tinted per building with vertex colours.
export function harlTextureV2() { // v2.7: grey pebbledash (West Pilton flats), stays light so vertex colour can tint it
  if (v2Cache.harl) return v2Cache.harl;
  const S = 256, [c, g] = canvas(S, S), r = rng(11);
  g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7000; i++) { const x = r() * S, y = r() * S, s = 0.6 + r() * 1.6, v = r();
    g.fillStyle = v < 0.4 ? `rgba(90,88,84,${0.2 + r() * 0.3})` : v < 0.75 ? `rgba(255,255,252,${0.5 + r() * 0.4})` : `rgba(140,130,118,${0.35 + r() * 0.3})`;
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  g.globalAlpha = 0.08; g.fillStyle = '#3a3630'; for (let i = 0; i < 30; i++) g.fillRect(r() * S, r() * S * 0.4, 1 + r() * 2, 50 + r() * 140); // rain streaks
  g.globalAlpha = 1; return (v2Cache.harl = canvasTex(c, true));
}
// Brick: muted brick courses with lime mortar, a few darker/lighter bricks.
export function brickTexture() {
  if (v2Cache.brick) return v2Cache.brick;
  const S = 256, [c, g] = canvas(S, S), r = rng(23), bw = 64, bh = 21.33;
  g.fillStyle = '#cfc4ae'; g.fillRect(0, 0, S, S);
  for (let row = 0; row < 12; row++) for (let k = -1; k < 5; k++) {
    const x = k * bw + (row % 2 ? bw / 2 : 0), y = row * bh, t = r();
    const base = t < 0.15 ? [120, 58, 44] : t < 0.3 ? [176, 98, 74] : [154, 78, 60];
    g.fillStyle = `rgb(${base.map((v) => v + (r() - 0.5) * 18 | 0).join(',')})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 2, y + bh - 5, bw - 4, 3);
  }
  return (v2Cache.brick = canvasTex(c, true));
}
// Up-and-over garage door: horizontal ribs, handle, scuffs. White-ish so vertex colour paints it.
export function garageDoorTexture() {
  if (v2Cache.garage) return v2Cache.garage;
  const W = 256, H = 224, [c, g] = canvas(W, H), r = rng(37);
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
  for (let y = 10; y < H; y += 14) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, W, 3); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, y + 3, W, 2); }
  g.strokeStyle = 'rgba(30,30,28,.55)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.fillStyle = '#5a5a56'; g.fillRect(W / 2 - 18, H * 0.62, 36, 8); g.beginPath(); g.arc(W / 2, H * 0.62 + 18, 6, 0, 7); g.fill();
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,70,50' : '255,255,255'},${0.08 + r() * 0.15})`; g.fillRect(r() * W, H * 0.55 + r() * H * 0.45, 4 + r() * 20, 2 + r() * 6); } // scuffs from years of fitba
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(90,50,20,.18)'; g.fillRect(r() * W, 0, 2 + r() * 3, H * (0.2 + r() * 0.5)); } // rust drips
  return (v2Cache.garage = canvasTex(c, false));
}
// Tarmac: warm grey aggregate with patch repairs and a few cracks.
export function tarmacTexture() {
  if (v2Cache.tarmac) return v2Cache.tarmac;
  const S = 256, [c, g] = canvas(S, S), r = rng(51);
  g.fillStyle = '#8e908b'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { const v = 90 + r() * 110 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},.5)`; g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
  g.fillStyle = 'rgba(40,40,38,.18)'; g.fillRect(40, 150, 90, 60); g.fillRect(170, 30, 50, 44); // patch repairs
  g.strokeStyle = 'rgba(30,30,28,.4)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += r() * 18; g.lineTo(x, y); } g.stroke(); }
  return (v2Cache.tarmac = canvasTex(c, true));
}

// v2.7: soft weathering decals (2x2 atlas): 0 ground blotch, 1 oil/damp stain, 2 vertical wall streaks, 3 kerb-edge dirt
export function grimeTexture() {
  if (v2Cache.grime) return v2Cache.grime;
  const S = 256, H = S / 2, [c, g] = canvas(S, S), r = rng(77);
  const blot = (ox, oy, n, col) => { for (let i = 0; i < n; i++) { const x = ox + H / 2 + (r() - 0.5) * H * 0.6, y = oy + H / 2 + (r() - 0.5) * H * 0.6, rr = 6 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col.replace('A', (0.10 + r() * 0.14).toFixed(2))); gr.addColorStop(1, col.replace('A', '0')); g.fillStyle = gr; g.fillRect(ox, oy, H, H); } };
  g.save(); g.beginPath(); g.rect(0, 0, H, H); g.clip(); blot(0, 0, 26, 'rgba(40,34,26,A)'); g.restore();
  g.save(); g.beginPath(); g.rect(H, 0, H, H); g.clip(); blot(H, 0, 14, 'rgba(20,20,22,A)'); g.restore();
  for (let i = 0; i < 40; i++) { const x = r() * H, w = 1 + r() * 5, len = H * (0.3 + r() * 0.7); const gr = g.createLinearGradient(0, H, 0, H + len); gr.addColorStop(0, `rgba(45,40,34,${0.18 + r() * 0.2})`); gr.addColorStop(1, 'rgba(45,40,34,0)'); g.fillStyle = gr; g.fillRect(x, H, w, len); }
  { const gr = g.createLinearGradient(0, S, 0, H + H * 0.4); gr.addColorStop(0, 'rgba(38,34,28,.35)'); gr.addColorStop(1, 'rgba(38,34,28,0)'); g.fillStyle = gr; g.fillRect(H, H, H, H); }
  return (v2Cache.grime = canvasTex(c, true));
}
export const GRIME_UV = [[0.002, 0.502, 0.498, 0.998], [0.502, 0.502, 0.998, 0.998], [0.002, 0.002, 0.498, 0.498], [0.502, 0.002, 0.998, 0.498]];

// ---------- v2.8: Edinburgh stone, generated in code ----------
// Cool grey Craigleith-type sandstone: coursed ashlar (or random rubble) blocks, each with its own tone
// (grey, blue-grey, the odd buff or rust-stained stone), speckle grain, lime mortar joints with a shadowed
// upper edge, patchy black soot crust and rain streaks. Tileable in x and y.
const STONE_TONES = [[150, 148, 142], [138, 136, 131], [160, 156, 148], [128, 128, 126], [146, 140, 128], [168, 162, 150], [120, 118, 114], [152, 142, 124]];
export function drawEdinStone(g, W, H, seed = 5, { rubble = false, courses = 8, soot = 0.5, mortar = '#a8a296' } = {}) {
  const r = rng(seed * 7919 + 13);
  g.fillStyle = mortar; g.fillRect(0, 0, W, H);
  const block = (x, y, w, h) => { const t = STONE_TONES[Math.floor(r() * STONE_TONES.length)], v = (r() - 0.5) * 18;
    const col = (k = 0) => `rgb(${t[0] + v + k | 0},${t[1] + v + k | 0},${t[2] + v + k | 0})`;
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { const X = x + dx, Y = y + dy; if (X > W || X + w < 0 || Y > H || Y + h < 0) continue;
      const gr = g.createLinearGradient(X, Y, X, Y + h); gr.addColorStop(0, col(8)); gr.addColorStop(1, col(-10)); g.fillStyle = gr;
      if (rubble) { g.beginPath(); g.moveTo(X + r() * 3, Y + r() * 3); g.lineTo(X + w - r() * 3, Y + r() * 3); g.lineTo(X + w - r() * 3, Y + h - r() * 3); g.lineTo(X + r() * 3, Y + h - r() * 3); g.fill(); }
      else g.fillRect(X, Y, w, h);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(X, Y, w, Math.max(1, h * 0.06)); // shadow under the joint above
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(X, Y + h - Math.max(1, h * 0.05), w, Math.max(1, h * 0.05)); } };
  if (rubble) { let y = 0; while (y < H) { const ch = H / courses * (0.6 + r() * 0.8); let x = -r() * 20; while (x < W) { const w = ch * (1 + r() * 1.6); block(x + 1.5, y + 1.5, w - 3, ch - 3); x += w; } y += ch; } }
  else { const ch = H / courses; for (let i = 0; i < courses; i++) { let x = -r() * 40; const bw = ch * (2.2 + r() * 0.8); while (x < W) { const w = bw * (0.7 + r() * 0.6); block(x + 1, i * ch + 1, w - 2, ch - 2); x += w; } } }
  const img = g.getImageData(0, 0, W, H), d = img.data; // grain speckle
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 18 * soot; i++) { const x = r() * W, y = r() * H, rr = (0.05 + r() * 0.18) * W; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(28,28,30,${0.25 + r() * 0.3})`); gr.addColorStop(1, 'rgba(28,28,30,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 26; i++) { const x = r() * W, w = 1 + r() * W * 0.02, len = H * (0.2 + r() * 0.6), y = r() * H; const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(40,40,42,${0.1 + r() * 0.15})`); gr.addColorStop(1, 'rgba(40,40,42,0)'); g.fillStyle = gr; g.fillRect(x, y, w, len); }
}
export function stoneTexture(kind = 'ashlar') {
  const key = 'stone_' + kind; if (v2Cache[key]) return v2Cache[key];
  const S = PRESET.texSize <= 512 ? 256 : 512, [c, g] = canvas(S, S);
  drawEdinStone(g, S, S, kind === 'rubble' ? 9 : 3, { rubble: kind === 'rubble', courses: kind === 'rubble' ? 9 : 8 });
  const t = canvasTex(c, true); t.generateMipmaps = true; return (v2Cache[key] = t);
}
// Castle faces: one small canvas with five painted elevations (rubble walls, irregular small windows, string courses).
// Regions (u0,v0,u1,v1) in CASTLE_UV.
export const CASTLE_UV = { barracks: [0, 0.5, 0.5, 1], hall: [0.5, 0.5, 1, 1], palace: [0, 0, 0.5, 0.5], tower: [0.5, 0, 0.75, 0.5], plain: [0.75, 0, 1, 0.5] };
export function castleFaceTexture() {
  if (v2Cache.castle) return v2Cache.castle;
  const S = PRESET.texSize <= 512 ? 512 : 1024, k = S / 1024, [c, g] = canvas(S, S / 2 * 2), r = rng(1544);
  const region = (x, y, w, h, fn) => { g.save(); g.beginPath(); g.rect(x * k, y * k, w * k, h * k); g.clip(); g.translate(x * k, y * k); g.scale(k, k);
    const [cc, gg] = canvas(w, h); drawEdinStone(gg, w, h, (x + y) | 0, { rubble: true, courses: Math.round(h / 22), soot: 0.8, mortar: '#8e8a82' }); g.drawImage(cc, 0, 0); fn(w, h); g.restore(); };
  const win = (x, y, w, h, lit = false) => { g.fillStyle = '#bdb8ac'; g.fillRect(x - 3, y - 3, w + 6, h + 6); g.fillStyle = lit ? '#c99a52' : '#1c2026'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(160,180,200,.25)'; g.fillRect(x + 1, y + 1, w - 2, h * 0.4); };
  const course = (y, w) => { g.fillStyle = 'rgba(200,196,186,.55)'; g.fillRect(0, y, w, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 4, w, 2); };
  region(0, 0, 512, 512, (w, h) => { for (let row = 0; row < 4; row++) { course(60 + row * 110 - 14, w); for (let i = 0; i < 12; i++) win(14 + i * 41.5, 60 + row * 110, 18, 46, r() < 0.06); } }); // New Barracks: regular grid
  region(512, 0, 512, 512, (w, h) => { course(90, w); for (let i = 0; i < 7; i++) { const x = 30 + i * 68; win(x, 200, 30, 180); g.fillStyle = '#1c2026'; g.beginPath(); g.arc(x + 15, 200, 15, Math.PI, 0); g.fill(); } }); // Great Hall: tall arched windows
  region(0, 512, 512, 512, (w, h) => { for (let row = 0; row < 4; row++) { course(80 + row * 105 - 18, w); for (let i = 0; i < 6; i++) if (r() > 0.15) win(24 + i * 82 + (r() - 0.5) * 16, 80 + row * 105 + (r() - 0.5) * 10, 22 + r() * 10, 40 + r() * 16, r() < 0.08); } // Palace: irregular windows, a corbelled parapet
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let x = 0; x < w; x += 22) g.fillRect(x, 20, 10, 14); });
  region(1024 * 0.5, 512, 256, 512, (w, h) => { for (let row = 0; row < 5; row++) win(110 + (row % 2) * 12, 50 + row * 92, 26, 44); course(30, w); g.fillStyle = '#efe9da'; g.beginPath(); g.arc(128, 260, 26, 0, 7); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 260); g.lineTo(128, 240); g.moveTo(128, 260); g.lineTo(142, 266); g.stroke(); }); // Palace tower with its clock
  region(1024 * 0.75, 512, 256, 512, () => {}); // plain rubble
  const t = canvasTex(c, false); t.generateMipmaps = true; return (v2Cache.castle = t);
}
