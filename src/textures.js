import * as THREE from 'three';
export const LOW_POWER = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
function speckle(g, w, h, n, cols) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }

// Tenement bay: CC0 photo sandstone (Poly Haven) with a painted sash window on top.
// Draws a procedural stone first, then redraws with the photo once it has loaded.
export function tenementTexture(stoneUrl) {
  const [c, g] = canvas(512, 512);
  const draw = (img) => {
    if (img) g.drawImage(img, 0, 0, 512, 512);
    else { g.fillStyle = '#b89a72'; g.fillRect(0, 0, 512, 512); speckle(g, 512, 512, 6000, ['#a3865f', '#c7ab84', '#8f7552']); }
    g.fillStyle = 'rgba(70,52,30,0.18)'; g.fillRect(0, 0, 512, 512); // weathering tint
    g.fillStyle = '#cdb690'; g.fillRect(144, 88, 224, 352); // dressed stone surround
    g.fillStyle = 'rgba(60,45,25,.35)'; g.fillRect(144, 432, 224, 8);
    g.fillStyle = '#1e2630'; g.fillRect(164, 108, 184, 312);
    const gr = g.createLinearGradient(164, 108, 348, 420); gr.addColorStop(0, '#9fb6c9'); gr.addColorStop(0.45, '#4d6276'); gr.addColorStop(1, '#1b232c');
    g.fillStyle = gr; g.fillRect(172, 116, 168, 296);
    g.fillStyle = '#efe9dc'; g.fillRect(172, 256, 168, 12); g.fillRect(250, 116, 12, 296);
    g.fillRect(172, 116, 168, 6); g.fillRect(172, 406, 168, 6); g.fillRect(172, 116, 6, 296); g.fillRect(334, 116, 6, 296);
    g.fillStyle = '#bda57c'; g.fillRect(132, 432, 248, 20);
    t.needsUpdate = true;
  };
  const t = tex(c); draw(null);
  if (stoneUrl) { const img = new Image(); img.onload = () => draw(img); img.src = stoneUrl; }
  return t;
}
const loader = new THREE.TextureLoader();
const cache = {};
function load(url, srgb) {
  if (!cache[url]) { const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = LOW_POWER ? 2 : 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache[url] = t; }
  const t = cache[url].clone(); return t; // clones share the image; each can have its own repeat
}
// PBR set from public/tex/<name>_{diff,nor,rough}.jpg. Returns material params.
// Phones skip normal + roughness maps (big fragment-cost saving); desktop gets the full set.
export function pbr(name, rx = 1, ry = 1, { normal = true, normalScale = 1 } = {}) {
  if (LOW_POWER) { const m = load(import.meta.env.BASE_URL + 'tex/' + name + '_diff.jpg', true); m.repeat.set(rx, ry); return { map: m, roughness: 0.9 }; }
  const base = import.meta.env.BASE_URL + 'tex/' + name;
  const p = { map: load(base + '_diff.jpg', true), roughnessMap: load(base + '_rough.jpg', false) };
  if (normal) { p.normalMap = load(base + '_nor.jpg', false); p.normalScale = new THREE.Vector2(normalScale, normalScale); }
  for (const k of ['map', 'roughnessMap', 'normalMap']) if (p[k]) p[k].repeat.set(rx, ry);
  return p;
}
export const texManager = THREE.DefaultLoadingManager;
export function cobbleTexture() {
  const [c, g] = canvas(256, 256); g.fillStyle = '#3c3a38'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 16; r++) for (let k = 0; k < 9; k++) {
    const x = k * 32 + (r % 2) * 16 - 16, y = r * 16, s = 60 + Math.random() * 40;
    g.fillStyle = `rgb(${s + 20},${s + 15},${s + 10})`;
    g.beginPath(); g.roundRect(x + 2, y + 2, 28, 12, 5); g.fill();
  }
  return tex(c, 3, 3);
}
export function flagTexture() {
  const [c, g] = canvas(256, 256); g.fillStyle = '#8c8781'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 1500, ['#7c7771', '#9b968f']);
  g.strokeStyle = '#5f5b56'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  return tex(c);
}
export function ballTexture() {
  const [c, g] = canvas(256, 128); g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1a1a1a';
  const pts = [[32, 20], [96, 20], [160, 20], [224, 20], [0, 64], [64, 64], [128, 64], [192, 64], [256, 64], [32, 108], [96, 108], [160, 108], [224, 108]];
  for (const [x, y] of pts) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); }
  return tex(c);
}
export function signTexture(text, bg = '#1d3b2a', fg = '#f1d98a', w = 512, h = 96, font = 'bold 54px Georgia, serif', border = fg) {
  const [c, g] = canvas(w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1]);
  while (g.measureText(text).width > w - 36 && size > 12) { size -= 2; g.font = font.replace(/\d+px/, size + 'px'); }
  g.fillText(text, w / 2, h / 2 + 2); const t = tex(c); return t;
}
export function doorTargetTexture() {
  const [c, g] = canvas(128, 256); g.fillStyle = '#8e1c1c'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#5a0f0f'; g.lineWidth = 6; g.strokeRect(14, 14, 100, 100); g.strokeRect(14, 134, 100, 108);
  for (const [r, col] of [[44, '#fff'], [32, '#c22'], [20, '#fff'], [9, '#c22']]) { g.fillStyle = col; g.beginPath(); g.arc(64, 150, r, 0, 7); g.fill(); }
  g.fillStyle = '#d4af37'; g.beginPath(); g.arc(100, 120, 5, 0, 7); g.fill();
  return tex(c);
}
