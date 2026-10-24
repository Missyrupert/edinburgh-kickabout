// Level 6: Easter Road (v3.5.1). Match day on Easter Road: a long, wide sandstone main street of tenements and shops. About halfway
// up, Albion Road turns LEFT (+x), a narrower street with the green-and-white East Stand of the (fictional) Lochend Rovers FC rising
// at its end - the walk to the ground. Corner pub, chippy, newsagent on Easter Road; programme stall, turnstiles and stewards' hut at
// the ground. All names fictional; no real club, crest or brand. NEW twist: the turnstile goal (kick only). Plus a crossbar challenge
// on a goal painted on a tenement gable. North = +z along Easter Road. Ground is y = 0.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, concretePanelTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const ER = { EX: -24, ERW: 4.5, EPV: 8, ZS: -44, ZN: 44, ARW: 3.5, APV: 7, AE: 22, TX: 35.25 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1875), pick = (a) => a[Math.floor(rand() * a.length)];
  const B = new Batcher(), atlas = new SignAtlas(), facadeTex = facadeAtlas();
  const targets = [], dynamics = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {}, CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(x, y, z), q, V(sx, sy, sz)); };
  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, surface = null, playerOnly = false } = {}) {
    const b = new CANNON.Body({ mass: 0, material, shape }); b.position.set(x, y, z); eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
    if (playerOnly) { b.collisionFilterGroup = G_PWALL; b.collisionFilterMask = G_PLAYER; }
    if (target || surface) b.userData = { target, surface }; world.addBody(b); return b; }
  const boxBody = (x, y, z, w, h, d, o = {}) => body(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), x, y, z, o);
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, grime = 0, target = null, surface = null } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile, grime }); return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, surface }) : null; }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null, rx = 0, rz = 0 } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1, rx, 0, rz), color, {}); return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface, rx, rz }) : null; }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, grime = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, tile });
  const sign = (text, x, y, z, w, h, ry, bg, fg, font, border) => quad('atlas', x, y, z, w, h, ry, atlas.sign(text, bg, fg, w / h, font, border));
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const { EX, ERW, EPV, ZS, ZN, ARW, APV, AE, TX } = ER, AX0 = EX + EPV, FZ = APV + 12, ACC = 0x0F8A5F, IRON = 0x222428, CLUBG = 0x1f7a4a, WHITE = 0xf4f6f2;
  const SAND = [0xd8cdb8, 0xcfc3ac, 0xdcd2be, 0xc8bca4, 0xd2c6b0, 0xbfb39c];
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * k, c.b * (k + (rand() - 0.5) * 0.05)).getHex(); };
  const flatG = (key, x0, x1, z0, z1, col, o = {}) => quad(key, (x0 + x1) / 2, o.y ?? 0.012, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, null, col, { rx: -Math.PI / 2, tile: o.tile || 0 });
  const KERB = 0xa8a49c, TAR = 0x7e807e, SLAB = 0xc4c0b6;

  // ---------- ground: Easter Road (wide, north-south), Albion Road (narrower, branching LEFT = +x at the junction), setts at the ground ----------
  boxBody(5, -1, 0, 110, 2, 100, { surface: 'tarmac' });
  flatG('tarmac', EX - ERW, EX + ERW, ZS, ZN, TAR, { tile: 4 }); flatG('tarmac', EX + ERW, AE, -ARW, ARW, TAR, { tile: 4 });
  flatG('slab', EX - EPV, EX - ERW, ZS, ZN, SLAB, { tile: 1.8, y: 0.02 });
  for (const s of [-1, 1]) { flatG('slab', EX + ERW, EX + EPV, s > 0 ? APV : ZS, s > 0 ? ZN : -APV, SLAB, { tile: 1.8, y: 0.02 }); flatG('slab', EX + ERW, AE, s > 0 ? ARW : -APV, s > 0 ? APV : -ARW, SLAB, { tile: 1.8, y: 0.02 }); }
  flatG('cobble', AE, TX - 1.25, -FZ, FZ, 0xb0aaa0, { tile: 1.4, y: 0.016 }); // the setts in front of the ground
  solid('stone', EX - ERW, 0.06, 0, 0.28, 0.12, ZN - ZS, KERB, { phys: false });
  for (const s of [-1, 1]) { solid('stone', EX + ERW, 0.06, s * (ARW + (ZN - ARW) / 2), 0.28, 0.12, ZN - ARW, KERB, { phys: false }); solid('stone', (EX + ERW + AE) / 2, 0.06, s * ARW, AE - EX - ERW, 0.12, 0.28, KERB, { phys: false }); }
  for (let z = ZS + 2; z < ZN - 2; z += 4.5) if (Math.abs(z + 1.1) > ARW + 1.5) flatG('flat', EX - 0.08, EX + 0.08, z, z + 2.2, 0xe8e6de, { y: 0.024 }); // Easter Road centre line
  for (let x = AX0 + 2; x < AE - 2; x += 4.5) flatG('flat', x, x + 2.2, -0.08, 0.08, 0xe8e6de, { y: 0.024 }); // Albion Road centre line
  for (const s of [-1, 1]) for (const dz of [0.3, 0.45]) flatG('flat', AX0 + 1, AE - 1, s * (ARW - dz) - 0.05, s * (ARW - dz) + 0.05, 0xd8b23a, { y: 0.024 }); // double yellows (match days)
  for (let i = 0; i < 46; i++) { const onE = rand() < 0.55, x = onE ? EX + (rand() - 0.5) * 2 * EPV : AX0 + rand() * (TX - AX0), z = onE ? ZS + rand() * (ZN - ZS) : (rand() - 0.5) * 2 * (x > AE ? FZ : APV); quad('grime', x, 0.03, z, 1.5 + rand() * 2.5, 1.5 + rand() * 2, 0, GRIME_UV[rand() < 0.7 ? 0 : 1], 0xffffff, { rx: -Math.PI / 2 }); }

  // ---------- shop-window interiors (simple painted display hints, unlit) ----------
  const winCache = {}, WIN = {
    shelves: (g, w, h) => { g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(0, 0, w, 14); for (let r = 0; r < 4; r++) { const y = 26 + r * 26; g.fillStyle = '#7a6248'; g.fillRect(6, y + 16, w - 12, 4); for (let x = 10; x < w - 14; x += 9 + (x * 7) % 6) { g.fillStyle = ['#c8202a', '#f4d35e', '#1f7a4a', '#2a4f8a', '#efe3c8', '#e07a2a'][(x + r * 3) % 6]; g.fillRect(x, y + 2 + (x % 5), 7, 14 - (x % 5)); } } },
    counter: (g, w, h) => { g.fillStyle = '#e4dccb'; g.fillRect(0, 0, w, h); g.strokeStyle = '#cfc6b2'; for (let x = 0; x < w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.fillStyle = '#26282a'; g.fillRect(16, 8, w - 32, 34); g.fillStyle = '#f4d35e'; for (let r = 0; r < 3; r++) g.fillRect(24, 14 + r * 9, 60 + r * 14, 4); g.fillStyle = '#f4d35e'; for (let r = 0; r < 3; r++) g.fillRect(w - 50, 14 + r * 9, 24, 4); g.fillStyle = '#a8b0b4'; g.fillRect(0, h - 42, w, 42); g.fillStyle = '#d8dee0'; g.fillRect(0, h - 46, w, 6); g.fillStyle = '#e8b04a'; for (let x = 20; x < w - 20; x += 30) g.fillRect(x, h - 58, 20, 12); },
    pub: (g, w, h) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h); for (let x = 24; x < w; x += 48) { const gr = g.createRadialGradient(x, 22, 2, x, 22, 30); gr.addColorStop(0, 'rgba(255,214,140,0.95)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(x - 30, 0, 60, 60); } g.fillStyle = '#5a3a20'; g.fillRect(0, h - 44, w, 44); g.fillStyle = '#7a5230'; g.fillRect(0, h - 48, w, 6); for (let x = 8; x < w - 8; x += 8) { g.fillStyle = ['#2f6b3a', '#7a2a1a', '#c8a050', '#3a5a7a'][x % 4]; g.fillRect(x, 50, 5, 18); } g.fillStyle = '#7a5230'; g.fillRect(0, 68, w, 3); },
    display: (g, w, h) => { g.fillStyle = '#e6e0d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfc8b8'; g.fillRect(0, h - 24, w, 24); for (const [x, c] of [[w * 0.28, '#1f7a4a'], [w * 0.62, '#f4f6f2']]) { g.fillStyle = '#555'; g.fillRect(x - 2, h - 70, 4, 46); g.fillStyle = c; g.fillRect(x - 22, h - 112, 44, 46); g.fillStyle = c === '#1f7a4a' ? '#f4f6f2' : '#1f7a4a'; g.fillRect(x - 22, h - 112, 44, 8); g.fillRect(x - 3, h - 104, 6, 38); g.fillStyle = '#d8c0a0'; g.beginPath(); g.arc(x, h - 122, 9, 0, 7); g.fill(); } for (let x = 10; x < w; x += 22) { g.fillStyle = x % 44 ? '#1f7a4a' : '#f4f6f2'; g.fillRect(x, h - 20, 16, 10); } },
    laundry: (g, w, h) => { g.fillStyle = '#eef0ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0d6d8'; g.fillRect(0, h - 70, w, 70); for (let x = 22; x < w; x += 40) { g.fillStyle = '#9aa4a8'; g.beginPath(); g.arc(x, h - 36, 15, 0, 7); g.fill(); g.fillStyle = '#5a7a8a'; g.beginPath(); g.arc(x, h - 36, 10, 0, 7); g.fill(); } g.fillStyle = '#3a6a8a'; g.fillRect(10, 10, w - 20, 10); },
    cafe: (g, w, h) => { g.fillStyle = '#5a3a28'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,230,180,0.5)'; g.fillRect(0, 0, w, 20); for (let x = 20; x < w; x += 46) { g.fillStyle = '#8a5a3a'; g.fillRect(x, h - 50, 30, 6); g.fillRect(x + 13, h - 44, 4, 30); g.fillStyle = '#efe3c8'; g.fillRect(x + 6, h - 58, 8, 8); } g.fillStyle = '#f4d35e'; g.fillRect(14, 30, 70, 6); },
  };
  const winUV = (k) => (winCache[k] ||= atlas.draw(192, 128, WIN[k] || WIN.shelves));

  // ---------- sandstone tenements: 4 storeys, sash windows, chimney stacks, shopfronts or stair doors at street level ----------
  // facade on a line (along z at x = c, or along x at z = c), facing (nx, nz); the block runs D metres back
  function tenement(alongZ, c, a0, a1, dir, floors, shops = [], D = 10) {
    const nx = alongZ ? dir : 0, nz = alongZ ? 0 : dir, ry = Math.atan2(nx, nz), len = a1 - a0, mid = (a0 + a1) / 2, h = 1 + floors * 3.2, tone = pick(SAND);
    const at = (u, off = 0) => alongZ ? [c + nx * off, u] : [u, c + nz * off];
    { const [bx, bz] = at(mid, -D / 2); solid('stone', bx, h / 2, bz, alongZ ? D : len, h, alongZ ? len : D, tone, { tile: 3.2 + rand() }); B.add('roof', ROOF, M4(bx, h, bz, D + 0.3, 3.2, len + 0.05, 0, alongZ ? 0 : Math.PI / 2), 0x5c6168, { tile: 2.2 }); }
    { const [cx, cz] = at(mid, 0.12); solid('stone', cx, 4.1, cz, alongZ ? 0.24 : len, 0.28, alongZ ? len : 0.24, 0xe2d6be, { phys: false }); const [ex, ez] = at(mid, 0.18); solid('stone', ex, h - 0.25, ez, alongZ ? 0.4 : len + 0.2, 0.5, alongZ ? len + 0.2 : 0.4, 0xe2d6be, { phys: false }); }
    const bays = Math.max(2, Math.round(len / 3.4));
    for (let i = 0; i < bays; i++) for (let j = 1; j < floors; j++) { const u = a0 + (i + 0.5) * len / bays, [qx, qz] = at(u + (rand() - 0.5) * 0.1, 0.01); quad('facade', qx, 4.3 + (j - 0.5) * 3.2, qz, len / bays * 0.82, 3.0, ry, cellUV(j === floors - 1 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit, FACADE.sashA])), vt()); }
    for (let u = a0 + 2.5; u < a1 - 1; u += 7) { const [sx, sz] = at(u, -D / 2); solid('stone', sx, h + 2.2, sz, alongZ ? 2.8 : 1.0, 2.6, alongZ ? 1.0 : 2.8, tone, { phys: false, tile: 2.6 }); }
    const n = Math.max(1, Math.round(len / 5)), sw = len / n;
    for (let i = 0; i < n; i++) { const u = a0 + (i + 0.5) * sw, shop = shops[i];
      if (shop) { const col = shop.col; const P2 = (off, du = 0) => at(u + du, off);
        { const [x, z] = P2(0.06); solid('wood', x, 1.9, z, alongZ ? 0.12 : sw - 0.5, 3.8, alongZ ? sw - 0.5 : 0.12, col, { phys: false }); }
        { const [x, z] = P2(0.13, shop.door ? -sw * 0.12 : 0); quad('atlasLit', x, 1.7, z, sw - (shop.door ? 2.6 : 1.4), 2.1, ry, winUV(shop.win)); }
        { const [x, z] = P2(0.16); quad('atlasLit', x, 3.35, z, sw - 0.8, 0.62, ry, atlas.fascia(shop.name, shop.sub || null, '#' + new THREE.Color(col).getHexString(), shop.fg || '#F1E6C8', (sw - 0.8) / 0.62)); }
        for (let k = 0; k <= 1; k++) { const [x, z] = P2(0.0, (k - 0.5) * sw); solid('stone', x, 2.0, z, alongZ ? 0.36 : 0.5, 4.0, alongZ ? 0.5 : 0.36, 0xe2d6be, { phys: false }); }
        if (shop.door) { const [x, z] = P2(0.2, sw * 0.32); solid('wood', x, 1.2, z, alongZ ? 0.1 : 1.1, 2.4, alongZ ? 1.1 : 0.1, 0x1d1d1d, { target: shop.door, surface: 'board', phys: true }); const [x2, z2] = P2(0.26, sw * 0.32); quad('atlas', x2, 1.2, z2, 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); shop.doorAt = at(u + sw * 0.32, 0); shop.n = [nx, nz]; } }
      else { const [x, z] = at(u, 0.01); quad('facade', x, 1.6, z, 2.2, 3.0, ry, cellUV(i % 2 ? FACADE.door : FACADE.sashA), vt()); } }
    { const [gx, gz] = at(mid, 0.03); quad('grime', gx, 1.0, gz, len, 2.0, ry, GRIME_UV[0]); }
  }
  const S = (name, col, win, sub, fg) => ({ name, col, win, sub, fg });
  const CHIP = { ...S('THE GOLDEN FRY', 0x2a4f8a, 'counter', 'FISH · CHIPS · PIES', '#F4D35E'), door: 'chippy' };
  const NEWS = { ...S('ALBION NEWS', 0x7a1f1f, 'shelves', 'PAPERS · SWEETS · LOTTO'), door: 'newsagent' };
  const PUB = { ...S('THE TERRACE BAR', 0x1f3d2c, 'pub', 'LIVE FITBA · REAL ALES', '#E8C766'), door: 'pubdoor' };
  // Easter Road, west side (continuous) - the spawn end has the newsagent and the chippy
  tenement(true, EX - EPV, ZS, -14, 1, 4, [null, S('EASTER BAKES', 0x6b4a2b, 'cafe', 'ROLLS · PIES · TEA'), NEWS, null, CHIP, null]);
  tenement(true, EX - EPV, -14, 14, 1, 4, [S("DOUGIE'S BARBERS", 0x8a2a2a, 'shelves'), null, S('LOCHEND LAUNDERETTE', 0x3a6a8a, 'laundry'), null, null, S('GREEN & WHITE SPORTS', CLUBG, 'display', 'SCARVES · KITS · BOOTS')]);
  tenement(true, EX - EPV, 14, ZN, 1, 4, [null, S('EASTER ROAD TAXIS', 0x2E2F2C, 'shelves', null, '#F4D35E'), null, null, null, null]);
  // Easter Road, east side - broken by the Albion Road junction; the corner pub sits on the north corner
  tenement(true, EX + EPV, ZS, -APV, -1, 4, [null, null, S('EASTSIDE PHARMACY', 0x2a6a5a, 'shelves'), null, null, null, S('THE KICK-OFF CAFE', 0x6b4a2b, 'cafe', 'BREAKFASTS · ROLLS')]);
  tenement(true, EX + EPV, APV, ZN, -1, 4, [PUB, null, null, S('RAINBOW SWEETS', 0x8a3a6a, 'shelves'), null, null, null]);
  // end stops so Easter Road doesn't run into the void (the road bends away beyond)
  tenement(false, ZS, EX - EPV - 10, EX + EPV + 10, 1, 4, [], 8); tenement(false, ZN, EX - EPV - 10, EX + EPV + 10, -1, 4, [], 8);
  // Albion Road: two rows, ending in gables at the ground's forecourt
  tenement(false, APV, AX0, AE, -1, 4, [S('ROVERS SUPPORTERS CLUB', CLUBG, 'pub', 'MEMBERS & GUESTS'), null, null, null, null, null, null, S('MATCHDAY SCARVES', CLUBG, 'display')], 12);
  tenement(false, -APV, AX0, AE, 1, 4, [null, null, S('ALBION CHIPPY', 0x2a4f8a, 'counter', 'OPEN TILL KICK-OFF', '#F4D35E'), null, null, null, null, null], 12);

  // ---------- forecourt: gables (painted goal = crossbar challenge), side walls closing the forecourt ----------
  for (const s of [-1, 1]) { const zc = s * (APV + 6); solid('stone', AE + 0.01, 7, zc, 0.04, 14, 12, pick(SAND), { phys: false, tile: 3.2 }); // gable skins
    for (let j = 1; j < 4; j++) quad('facade', AE + 0.04, 4.3 + (j - 0.5) * 3.2, zc - s * 3, 1.6, 2.6, Math.PI / 2, cellUV(FACADE.small), vt());
    solid('stone', (AE + TX) / 2, 7, s * (FZ + 0.4), TX - AE + 1, 14, 0.8, pick(SAND), { tile: 3.2 }); // forecourt side walls (close the gap)
    for (let x = AE + 2; x < TX - 1; x += 3.4) for (let j = 1; j < 4; j++) quad('facade', x, 4.3 + (j - 0.5) * 3.2, s * (FZ - 0.02), 1.6, 2.6, s > 0 ? Math.PI : 0, cellUV(FACADE.small), vt());
    solid('stone', (AE + TX) / 2, 0.6, s * (FZ - 0.1), TX - AE, 1.2, 0.2, 0xb0aaa0, { phys: false }); }
  { const gz = APV + 6, gw = 5.0, gh = 1.9, x = AE + 0.05; // painted goal on the north gable (white posts + bar, net lines); the bar is a proud box target
    for (const s of [-1, 1]) quad('flat', x, gh / 2, gz + s * gw / 2, 0.14, gh, Math.PI / 2, null, 0xf4f2ea); quad('flat', x, gh, gz, gw + 0.14, 0.14, Math.PI / 2, null, 0xf4f2ea);
    for (let k = 1; k < 8; k++) quad('flat', x + 0.005, gh / 2, gz - gw / 2 + k * gw / 8, 0.03, gh, Math.PI / 2, null, 0xdedad0); for (let k = 1; k < 4; k++) quad('flat', x + 0.005, k * gh / 4, gz, gw, 0.03, Math.PI / 2, null, 0xdedad0);
    solid('flat', AE + 0.28, gh, gz, 0.56, 0.6, gw + 0.2, 0xf4f2ea, { target: 'crossbar', surface: 'metal' });
    sign('CROSSBAR CHALLENGE', x + 0.02, gh + 0.85, gz, 3.4, 0.45, Math.PI / 2, '#1f7a4a', '#ffffff', 'bold 46px Arial');
    addTarget({ id: 'crossbar', name: 'Crossbar Challenge', hint: 'hit the crossbar of the goal painted on the gable', points: 150, kind: 'hit', pos: V(AE + 1.5, 0, gz), ringR: 1.2, stand: V(AE + 5.5, 0, gz), aim: V(AE, gh, gz),
      lines: ['DING! Crossbar challenge: nailed.', "Aff the bar! The whole street went 'OOOH'.", 'Woodwork. On purpose. Legend.'] }); }

  // ---------- the ground: turnstile wall across the end of Albion Road, the East Stand in green and white rising behind ----------
  { const x0 = TX + 1.25, X1 = 100;
    const gates = [-12, -5, 5, 12], open = -5, GW = 1.4, GH = 2.4, WC = 0xeef0ec;
    { let z = -FZ; for (const gz of [...gates, FZ + GW / 2]) { const za = z, zb = Math.min(FZ, gz - GW / 2); if (zb > za) solid('cpanel', TX, 2.0, (za + zb) / 2, 2.5, 4.0, zb - za, WC, { tile: 1.6 }); z = gz + GW / 2; } }
    solid('flat', TX - 1.27, 3.7, 0, 0.04, 0.5, FZ * 2, CLUBG, { phys: false }); // green band along the turnstile wall
    for (const gz of gates) { solid('cpanel', TX, (GH + 4.0) / 2, gz, 2.5, 4.0 - GH, GW, WC, { tile: 1.6 }); // lintel
      sign(gz === open ? 'TURNSTILE 7 · OPEN' : 'TURNSTILE ' + (gates.indexOf(gz) + 4), TX - 1.28, GH + 0.45, gz, 1.6, 0.32, -Math.PI / 2, gz === open ? '#1f7a4a' : '#2E2F2C', '#ffffff', 'bold 40px Arial');
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; solid('metal', TX - 0.4, 1.0 + Math.sin(a) * 0.3, gz + Math.cos(a) * 0.3, 0.05, 0.05, 0.6, 0x9a9ea2, { phys: false, rx: a }); } // turnstile arms (scenery)
      if (gz !== open) solid('metal', TX - 0.6, GH / 2, gz, 0.08, GH, GW, 0x3a3e42, { surface: 'metal' }); // closed shutter
      else { boxBody(TX - 0.9, 1.5, gz, 0.3, 3, GW, { playerOnly: true }); solid('flat', TX + 2.6, 1.3, gz, 0.2, 2.6, GW + 0.4, 0x2a2d31); for (const s of [-1, 1]) solid('cpanel', TX + 1.9, 1.3, gz + s * (GW / 2 + 0.15), 1.4, 2.6, 0.3, WC); B.add('interior', QUAD, M4(TX + 2.48, 1.2, gz, GW, 2.4, 1, 0, -Math.PI / 2), 0x1f4a32, {}); } }
    addTarget({ id: 'turnstile', name: 'Turnstile Goal', hint: 'NEW: kick it clean through the open turnstile (no walking it in)', points: 150, kind: 'zone', kickOnly: true, pos: V(TX - 3, 0, open), ringR: 1.2, stand: V(TX - 6.5, 0, open), aim: V(TX + 1.5, 0.6, open),
      zone: new THREE.Box3(V(TX + 0.6, 0, open - GW / 2), V(TX + 2.5, GH, open + GW / 2)), lines: ["Through the turnstile! That's you in for free.", 'Clicked through. The steward says ticket next time.', "In! Best seat in the hoose."] });
    for (const s of [-1, 1]) sign('LOCHEND ROVERS FC', TX - 1.28, 3.0, s * 15.8, 5, 0.55, -Math.PI / 2, '#1f7a4a', '#ffffff', 'bold 54px Arial');
    // white concourse block, then the big green back wall of the stand with white bands, white stair towers, white roof fascia
    solid('flat', x0 + 8.3, 6, 0, 11.4, 12, 64, WC);
    solid('flat', x0 + 8.3 - 5.72, 12.4, 0, 0.1, 0.8, 64.2, CLUBG, { phys: false });
    for (let z = -24; z <= 24; z += 6) solid('glass', x0 + 2.55, 8, z, 0.1, 1.4, 3.6, 0x55606a, { phys: false });
    const xb = x0 + 14; solid('flat', (xb + X1) / 2, 20, 0, X1 - xb, 40, 72, CLUBG, { phys: false });
    for (const y of [15, 27.5]) solid('flat', xb - 0.06, y, 0, 0.12, 1.6, 72.2, WHITE, { phys: false }); // white bands
    for (let z = -34; z <= 34; z += 3) solid('flat', xb - 0.05, 20, z, 0.1, 40, 0.14, 0x166a3e, { phys: false }); // cladding ribs
    quad('atlasLit', xb - 0.14, 33.5, 0, 34, 4.2, -Math.PI / 2, atlas.sign('LOCHEND ROVERS', '#1f7a4a', '#ffffff', 34 / 4.2, 'bold 64px Arial', '#f4f6f2'));
    quad('atlasLit', xb - 0.14, 21.2, 0, 16, 1.8, -Math.PI / 2, atlas.sign('EAST STAND', '#1f7a4a', '#ffffff', 16 / 1.8, 'bold 60px Arial', '#1f7a4a'));
    for (const z of [-26, 26]) { solid('flat', xb - 1.2, 18, z, 2.4, 36, 6, WHITE, { phys: false }); for (let y = 3; y < 35; y += 3.2) solid('glass', xb - 2.42, y, z, 0.1, 1.4, 4.6, 0x7f98a2, { phys: false }); } // white stair towers
    solid('flat', xb + 11, 41.2, 0, 22, 0.8, 76, 0xdfe4e6, { phys: false }); solid('flat', xb - 0.4, 40.6, 0, 1.4, 2.4, 76, WHITE, { phys: false }); solid('flat', xb - 1.15, 39.6, 0, 0.1, 0.5, 76, CLUBG, { phys: false }); // roof + white fascia with a green trim
    for (const z of [-30, 30]) { cyl('metal', x0 + 30, 27, z, 0.5, 0.8, 54, 0x9a9ea2, { phys: false, seg: 8 }); solid('flat', x0 + 29, 55, z, 0.8, 4, 6, 0xdfe4e6, { phys: false }); B.add('lamp', BOX, M4(x0 + 28.55, 55, z, 0.1, 3.4, 5.4), 0xffffff, {}); } // floodlight masts
    boxBody(x0 + 16, 15, 0, 6, 30, 80); }

  // ---------- match-day touches ----------
  { // fanzine A-board on Easter Road, just ahead of the spawn (easy first target)
    const ax = EX - EPV + 2.2, az = -31, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.12, 0, 0), 0x1f7a4a); add(new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(-0.2).setPosition(-0.12, 0, 0), 0x1f7a4a);
    add(new THREE.BoxGeometry(0.01, 0.6, 0.5), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.155, 0.05, 0), 0xf4f2ea); add(new THREE.BoxGeometry(0.012, 0.12, 0.44), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.165, 0.25, 0), 0x1f7a4a);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 0.5, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.12, 0.47, 0.31)) }); b.position.set(ax, 0.48, az); b.userData = { target: 'fanzine', surface: 'board' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'fanzine', name: 'Fanzine Board', hint: 'knock over the fanzine board', points: 50, kind: 'topple', body: b, pos: V(ax, 0, az), stand: V(ax + 4.5, 0, az), aim: V(ax, 0.5, az), lines: ['Hold the back page!', '"FANZINE OOT NOO" - and so is the board.', 'Read all aboot it: ball wins.'] }); }
  { // programme seller's stall near the ground, at the end of Albion Road (faces back down the road)
    const x = AE - 2.5, z = -2.4; solid('wood', x, 0.55, z, 0.9, 1.1, 1.8, 0x1f7a4a, { target: 'programmes', surface: 'board' }); solid('wood', x, 1.15, z, 1.1, 0.08, 2.0, 0xe8e4da, { phys: false });
    for (let k = 0; k < 6; k++) solid('flat', x, 1.22, z - 0.75 + k * 0.3, 0.3, 0.04, 0.22, pick([0x1f7a4a, 0xf4f2ea, 0xc8202a]), { phys: false });
    for (const s of [-1, 1]) cyl('metal', x + 0.4, 1.4, z + s * 0.9, 0.03, 0.03, 1.6, 0x8a8c88, { phys: false, seg: 4 }); solid('flat', x + 0.1, 2.25, z, 1.3, 0.06, 2.2, 0xf4f2ea, { phys: false });
    sign('PROGRAMMES £3', x - 0.47, 0.6, z, 1.6, 0.4, -Math.PI / 2, '#1f7a4a', '#ffffff', 'bold 50px Arial');
    addTarget({ id: 'programmes', name: "Programme Seller's Stall", hint: "hit the programme seller's stall", points: 50, kind: 'hit', pos: V(x - 1.2, 0, z), ringR: 1.1, stand: V(x - 4.2, 0, z), aim: V(x, 0.6, z),
      lines: ["Programme! Programme! Get your... ball aff ma stall.", 'Collector\'s edition, noo wi\' a dent.', 'Sold oot. Well, knocked ower.'] }); }
  for (const [sh, name, hint, lines] of [[PUB, 'Terrace Bar Door', 'strike the corner pub door', ['Pre-match pint: served.', "The barman's no' impressed. The regulars are.", 'Door chapped. Kick-aff in ten.']],
    [CHIP, 'Golden Fry Door', 'hit the chippy door', ['Fish supper, salt and sauce!', "Chippy's shut till the final whistle.", 'Battered it.']], [NEWS, 'Albion News Door', 'hit the newsagent door', ['Hot off the press!', 'Papers, sweets... and a ball.', 'Stop press: door hit.']]]) {
    const [x, z] = sh.doorAt, [nx, nz] = sh.n; addTarget({ id: sh.door, name, hint, points: 75, kind: 'hit', pos: V(x + nx * 1.2, 0, z + nz * 1.2), ringR: 1.0, stand: V(x + nx * 5, 0, z + nz * 5), aim: V(x, 1.0, z), lines }); }
  { // tenement stair door with a fanlight (target) on Albion Road's north row
    const x = 2, z = APV - 0.02; solid('wood', x, 1.2, z - 0.06, 1.1, 2.4, 0.1, 0x2a2d31, { target: 'stairdoor', surface: 'board' }); quad('atlas', x, 1.2, z - 0.12, 1.1, 2.4, Math.PI, atlas.draw(128, 256, drawTargetDoor)); quad('glass', x, 2.7, z - 0.03, 1.1, 0.5, Math.PI, null, 0xd8c890);
    solid('stone', x, 0.05, z - 0.1, 1.6, 0.1, 0.6, 0xa8a49c, { phys: false });
    addTarget({ id: 'stairdoor', name: 'Stair Door', hint: 'hit the tenement stair door', points: 75, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 0.9, stand: V(x, 0, z - 5), aim: V(x, 1.0, z), lines: ["Buzz! Naebody's in - they're a' at the game.", 'Close door: chapped.', "The wifie on the second flair's no' happy."] }); }
  { // bus stop on Easter Road's east pavement (target: the flag)
    const x = EX + ERW + 0.9, z = -20; cyl('metal', x, 1.5, z, 0.05, 0.05, 3.0, 0x2a2d31, { seg: 6, phys: false }); solid('flat', x, 2.75, z, 0.06, 0.6, 0.6, 0xc8202a, { target: 'busstop', surface: 'metal' }); sign('BUS STOP', x - 0.04, 2.75, z, 0.55, 0.3, -Math.PI / 2, '#c8202a', '#ffffff', 'bold 40px Arial');
    boxBody(x, 1.5, z, 0.12, 3, 0.12, { surface: 'metal' });
    addTarget({ id: 'busstop', name: 'Bus Stop Flag', hint: 'ping the bus-stop flag', points: 75, kind: 'hit', pos: V(x - 1.2, 0, z), ringR: 0.9, stand: V(x - 5.5, 0, z), aim: V(x, 2.6, z), lines: ['Ding ding! Next stop, the ground.', 'Request stop: granted.', 'Flagged doon.'] }); }
  { // stewards' hut on the forecourt (target: the hatch board, facing back down Albion Road)
    const x = 29.5, z = -13, BL = 0xf4b400; solid('flat', x, 1.3, z, 2.4, 2.6, 2.4, 0xd8d8d4); solid('flat', x, 2.7, z, 2.7, 0.2, 2.7, 0x3a3e42, { phys: false });
    solid('wood', x - 1.25, 1.2, z, 0.08, 1.0, 1.4, BL, { target: 'stewards', surface: 'board' }); sign('STEWARDS', x - 1.3, 2.1, z, 1.6, 0.3, -Math.PI / 2, '#f4b400', '#111', 'bold 46px Arial');
    addTarget({ id: 'stewards', name: "Stewards' Hut", hint: "hit the stewards' hut hatch", points: 75, kind: 'hit', pos: V(x - 2.4, 0, z), ringR: 0.9, stand: V(x - 6, 0, z), aim: V(x - 1.25, 1.1, z), lines: ['Hi-vis, high score.', "The steward's radioin' it in.", 'Hatch hit. Nae re-entry.'] }); }
  { // junction sign so the turn is readable
    const x = EX + ERW + 0.8, z = APV + 0.6; cyl('metal', x, 1.3, z, 0.04, 0.04, 2.6, IRON, { seg: 6, phys: false }); sign('← ALBION ROAD · GROUND', x, 2.5, z - 0.03, 2.2, 0.4, Math.PI, '#1f7a4a', '#ffffff', 'bold 44px Arial'); }
  // street clutter: lamp posts on both streets, bins, a parked van on Albion Road, green and white bunting across Albion Road
  for (const s of [-1, 1]) for (let z = ZS + 5; z < ZN - 2; z += 13) if (s < 0 || Math.abs(z) > APV + 1) { const x = EX + s * (EPV - 0.6); cyl('metal', x, 3, z, 0.07, 0.1, 6, IRON, { seg: 6 }); solid('flat', x - s * 0.4, 5.9, z, 0.8, 0.08, 0.12, IRON, { phys: false }); solid('lamp', x - s * 0.8, 5.82, z, 0.35, 0.1, 0.2, 0xffffff, { phys: false }); }
  for (const s of [-1, 1]) for (let x = AX0 + 5; x < AE - 2; x += 11) { const z = s * (APV - 0.6); cyl('metal', x, 3, z, 0.07, 0.1, 6, IRON, { seg: 6 }); solid('flat', x, 5.9, z - s * 0.4, 0.12, 0.08, 0.8, IRON, { phys: false }); solid('lamp', x, 5.82, z - s * 0.8, 0.2, 0.1, 0.35, 0xffffff, { phys: false }); }
  for (const [x, z, c] of [[EX - EPV + 0.6, -10, 0x2a5a3a], [EX + EPV - 0.6, 20, 0x3a3e42], [9, APV - 0.6, 0x2a5a3a], [14, -APV + 0.6, 0x3a3e42]]) { solid('flat', x, 0.55, z, 0.7, 1.1, 0.7, c); solid('flat', x, 1.14, z, 0.74, 0.08, 0.74, new THREE.Color(c).multiplyScalar(0.7).getHex(), { phys: false }); }
  { const x = 8, z = -2.0; solid('flat', x, 1.15, z, 5.0, 1.9, 2.0, 0xf4f1ea); solid('flat', x, 0.45, z, 5.04, 0.3, 2.04, 0x2a2d31, { phys: false }); solid('glass', x - 2.3, 1.55, z, 0.5, 0.7, 1.8, 0xffffff, { phys: false, rz: -0.3 }); }
  for (let x = AX0 + 4; x < AE - 1; x += 6) { const pts = [V(x, 9.5, -APV), V(x + 0.5, 8.6, 0), V(x, 9.5, APV)]; B.add('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.015, 3, false), null, 0x2a2d31, {});
    for (let k = 1; k < 8; k++) { const t = k / 8, pz = -APV + t * APV * 2, py = 9.5 - Math.sin(Math.PI * t) * 0.9; quad('flat', x + 0.25 * Math.sin(Math.PI * t), py - 0.25, pz, 0.35, 0.45, Math.PI / 2, null, k % 2 ? 0x1f7a4a : 0xf4f2ea); } } // bunting
  // backdrop roofs behind the rows + a church spire so the skyline isn't empty
  for (let z = ZS + 6; z < ZN; z += 14) { const h = 15 + rand() * 6, x = EX - EPV - 16; solid('stone', x, h / 2, z, 10, h, 12, pick(SAND), { phys: false, tile: 3 }); B.add('roof', ROOF, M4(x, h, z, 10.3, 2.6, 12, 0, 0), 0x5c6168, {}); }
  for (const s of [-1, 1]) for (let x = AX0 + 4; x < TX; x += 13) { const h = 15 + rand() * 6, z = s * (FZ + 7); solid('stone', x, h / 2, z, 12, h, 10, pick(SAND), { phys: false, tile: 3 }); B.add('roof', ROOF, M4(x, h, z, 10.3, 2.6, 12, 0, Math.PI / 2), 0x5c6168, {}); }
  { const x = EX - 30, z = 30; solid('stone', x, 14, z, 6, 28, 6, SAND[3], { phys: false, tile: 3 }); B.add('roof', new THREE.ConeGeometry(4, 16, 8), M4(x, 36, z, 1, 1, 1), 0x5c6168, {}); }
  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[-23, 0, -28], [-26, 0, 12], [4, 0, 1], [28, 0, -9]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture()); materials.cpanel = tm(concretePanelTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  materials.interior = new THREE.MeshBasicMaterial({ vertexColors: true }); materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [-24, -36, 180, 6], junction: [-23, 0, 270, 8], albion: [2, 0, 270, 9], forecourt: [26, 0, 270, 12], gable: [30, 13, 90, 4], corner: [-24, -2, 225, 4] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  if (x > ER.AE) return x < ER.TX - 1.25 ? 'setts' : 'paving';
  if (Math.abs(x - ER.EX) < ER.ERW) return 'tarmac';
  if (x > ER.EX && Math.abs(z) < ER.ARW) return 'tarmac';
  return 'paving';
}
export default {
  id: 'easterroad', name: 'Easter Road', short: 'Easter Road', surfaceAt,
  sounds: { birds: [[-30, 10], [10, -10]], gulls: [[40, 0], [-30, 30], [0, -30]], far: [[-70, 0], [70, 0], [-24, 80], [-24, -80]], roadX: 60 },
  blurb: "Level 6: Easter Road. Match day: up Easter Road, left along Albion Road to the ground. 10 targets. NEW: the turnstile goal - kick it through the open turnstile.",
  intro: "Welcome tae Easter Road!<br><small>Match day. Up Easter Road, then left along Albion Road tae the ground. Ball's at your feet. Easy first one: the fanzine board, just ahead.</small>",
  build,
  tiers: { programmes: 'easy', fanzine: 'easy', pubdoor: 'easy', chippy: 'easy', newsagent: 'easy', stairdoor: 'easy', busstop: 'easy', stewards: 'easy', crossbar: 'tricky', turnstile: 'tricky' },
  spawn: [-24, 0.5, -36], spawnYaw: 180,
  ballHomes: () => [[-24, 0.4, -33.5], [-24, 0.4, 0], [4, 0.4, 0], [27, 0.4, 0]],
  bounds: { x: 38, zMin: -43, zMax: 43 },
  next: 'grassmarket',
};
