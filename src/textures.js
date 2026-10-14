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
  draw(null);
  const img = new Image(); img.onload = () => draw(img); img.src = BASE + 'tex/sandstone_diff.webp';
  return t;
}
function sash(g, x, y, w, h, { lit = false, panes = 2, surround = true } = {}) {
  if (surround) { g.fillStyle = '#d2bc94'; g.fillRect(x - 10, y - 10, w + 20, h + 22); g.fillStyle = 'rgba(40,30,15,.3)'; g.fillRect(x - 10, y + h + 8, w + 20, 4); }
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
  g.fillStyle = '#cdb68d'; g.fillRect(70, 40, 116, 216); // surround
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
    case F.sashB: g.fillStyle = '#d2bc94'; g.fillRect(64, 18, 128, 14); sash(g, 80, 46, 96, 164, { panes: 3 }); break;
    case F.triple: sash(g, 30, 50, 52, 160, { surround: true }); sash(g, 98, 50, 60, 160); sash(g, 174, 50, 52, 160); break;
    case F.small: sash(g, 88, 70, 80, 110); break;
    case F.door: door(g, '#1d3b2a'); break;
    case F.blind: g.fillStyle = '#c3ad86'; g.fillRect(70, 30, 116, 190); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(80, 40, 96, 170); break; // blocked window (window tax)
    case F.lit: sash(g, 78, 40, 100, 170, { lit: true }); break;
    case F.flowers: sash(g, 78, 30, 100, 160); g.fillStyle = '#5a3b22'; g.fillRect(70, 196, 116, 22); for (let k = 0; k < 9; k++) { g.fillStyle = ['#c62d4a', '#f2c94c', '#e86fb0'][k % 3]; g.beginPath(); g.arc(80 + k * 12, 192, 7, 0, 7); g.fill(); } break;
    case F.pediment: g.fillStyle = '#d2bc94'; g.beginPath(); g.moveTo(60, 40); g.lineTo(128, 6); g.lineTo(196, 40); g.fill(); sash(g, 80, 50, 96, 160); break;
    case F.rustic: g.strokeStyle = 'rgba(40,28,14,.5)'; g.lineWidth = 5; for (let y = 32; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } sash(g, 82, 60, 92, 120); break;
    case F.arch: g.fillStyle = '#cdb68d'; g.fillRect(50, 60, 156, 196); g.fillStyle = '#121418'; g.fillRect(66, 110, 124, 146); g.beginPath(); g.arc(128, 110, 62, Math.PI, 0); g.fill(); break;
    case F.shopUpper: g.fillStyle = 'rgba(40,28,14,.25)'; g.fillRect(0, 200, 256, 56); sash(g, 78, 30, 100, 150); break;
    case F.doorRed: door(g, '#7a1a1a'); break;
    case F.doorGreen: door(g, '#20304f'); break;
    case F.smallLit: sash(g, 88, 70, 80, 110, { lit: true }); break;
  }
}

// ---------- sign atlas: all signs, plaques and the target door share one texture ----------
export class SignAtlas {
  constructor() {
    this.W = PRESET.texSize <= 512 ? 1024 : 2048; this.H = this.W; this.k = this.W / 2048;
    [this.c, this.g] = canvas(this.W, this.H); this.x = 0; this.y = 0; this.rowH = 0;
    this.tex = canvasTex(this.c, false);
  }
  alloc(w, h) { // in 2048-space px
    w *= this.k; h *= this.k;
    if (this.x + w > this.W) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; }
    const r = { x: this.x, y: this.y, w, h }; this.x += w + 2; this.rowH = Math.max(this.rowH, h);
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
  draw(w, h, fn) { const r = this.alloc(w, h), g = this.g; g.save(); g.translate(r.x, r.y); g.scale(this.k, this.k); fn(g, w, h); g.restore(); this.tex.needsUpdate = true; return this.uv(r); }
}
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
