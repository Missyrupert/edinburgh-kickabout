import * as THREE from 'three';
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
function speckle(g, w, h, n, cols) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }

export function tenementTexture() { // one bay: stone courses + sash window
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#b89a72'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 2500, ['#a3865f', '#c7ab84', '#8f7552']);
  g.strokeStyle = 'rgba(70,50,30,.35)'; g.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    for (let x = (y / 32) % 2 ? 0 : 40; x < 256; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
  g.fillStyle = '#d8c3a0'; g.fillRect(72, 44, 112, 176); // stone surround
  g.fillStyle = '#2a3340'; g.fillRect(82, 54, 92, 156);
  const gr = g.createLinearGradient(82, 54, 174, 210); gr.addColorStop(0, '#6d8aa6'); gr.addColorStop(1, '#25303c');
  g.fillStyle = gr; g.fillRect(86, 58, 84, 148);
  g.fillStyle = '#eee8dc'; g.fillRect(86, 128, 84, 6); g.fillRect(125, 58, 6, 148); // sash bars
  g.fillStyle = '#c9b38d'; g.fillRect(66, 216, 124, 10); // sill
  return tex(c);
}
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
