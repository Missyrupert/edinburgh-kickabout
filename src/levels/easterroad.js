// Level 6: Easter Road (v3.5). A narrow sandstone tenement side street off Easter Road, with the stand of the (fictional)
// Lochend Rovers FC rising at the far end - the match-day walk to the ground. Corner pub, chippy, newsagent, a programme
// seller's stall, a fanzine board, turnstiles. All names fictional; no real club, crest or brand. Green and white kits are fine.
// NEW twist: the turnstile goal - kick it through the open turnstile gate (kick only, no walking it in). Plus a crossbar
// challenge on a goal painted on a tenement gable.
// North = +z (towards the stadium). Ground is y = 0.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, concretePanelTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const ER = { RW: 3.5, PV: 7, MAINZ0: -32, MAINZ1: -22, ROWEND: 26, TURN: 39.25, XW: 30 };
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
  const { RW, PV, MAINZ0: MZ0, MAINZ1: MZ1, ROWEND: RE, TURN: TZ, XW } = ER, ACC = 0x0F8A5F, IRON = 0x222428, CLUBG = 0x1f7a4a;
  const SAND = [0xd8cdb8, 0xcfc3ac, 0xdcd2be, 0xc8bca4, 0xd2c6b0, 0xbfb39c];
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * k, c.b * (k + (rand() - 0.5) * 0.05)).getHex(); };
  const flatG = (key, x0, x1, z0, z1, col, o = {}) => quad(key, (x0 + x1) / 2, o.y ?? 0.012, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, null, col, { rx: -Math.PI / 2, tile: o.tile || 0 });
  const pwall = (x, z, w, d, h = 4) => boxBody(x, h / 2, z, w, h, d, { playerOnly: true });

  // ---------- ground: tarmac roads, slab pavements, granite kerbs, setts in the forecourt ----------
  boxBody(0, -1, 4, 80, 2, 100, { surface: 'tarmac' });
  flatG('tarmac', -RW, RW, MZ1, RE, 0x7e807e, { tile: 4 }); flatG('tarmac', -XW, XW, MZ0 + 3, MZ1, 0x7e807e, { tile: 4 }); // side street + Easter Road
  for (const s of [-1, 1]) flatG('slab', s > 0 ? RW : -PV, s > 0 ? PV : -RW, MZ1, RE, 0xc4c0b6, { tile: 1.8, y: 0.02 });
  flatG('slab', -XW, XW, MZ0, MZ0 + 3, 0xc4c0b6, { tile: 1.8, y: 0.02 }); for (const s of [-1, 1]) flatG('slab', s > 0 ? PV : -XW, s > 0 ? XW : -PV, MZ1, MZ1 + 2.6, 0xc4c0b6, { tile: 1.8, y: 0.02 });
  flatG('cobble', -XW, XW, RE, TZ - 1.25, 0xb0aaa0, { tile: 1.4, y: 0.016 }); // forecourt setts
  for (const s of [-1, 1]) solid('stone', s * RW, 0.06, (MZ1 + 2.6 + RE) / 2, 0.28, 0.12, RE - MZ1 - 2.6, 0xa8a49c, { phys: false }); // granite kerbs
  solid('stone', 0, 0.06, MZ0 + 3, XW * 2, 0.12, 0.28, 0xa8a49c, { phys: false }); for (const s of [-1, 1]) solid('stone', s * (RW + XW) / 2, 0.06, MZ1 + 2.6, XW - RW, 0.12, 0.28, 0xa8a49c, { phys: false });
  for (let z = MZ1 + 4; z < RE - 2; z += 4.5) flatG('flat', -0.08, 0.08, z, z + 2.2, 0xe8e6de, { y: 0.024 }); // centre line
  for (const s of [-1, 1]) for (const dx of [0.3, 0.45]) flatG('flat', s * (RW - dx) - 0.05, s * (RW - dx) + 0.05, MZ1 + 3, RE - 1, 0xd8b23a, { y: 0.024 }); // double yellows (match days)
  for (let x = -XW + 2; x < XW - 2; x += 4.5) flatG('flat', x, x + 2.2, MZ0 + 7.4, MZ0 + 7.55, 0xe8e6de, { y: 0.024 });
  for (let i = 0; i < 40; i++) { const x = -XW + rand() * 2 * XW, z = MZ0 + rand() * (TZ - MZ0); if (Math.abs(x) > PV && z > MZ1 + 2.6 && z < RE) continue; quad('grime', x, 0.03, z, 1.5 + rand() * 2.5, 1.5 + rand() * 2, 0, GRIME_UV[rand() < 0.7 ? 0 : 1], 0xffffff, { rx: -Math.PI / 2 }); }

  // ---------- sandstone tenements: 4 storeys, sash windows, chimney stacks, shopfronts or stair doors at street level ----------
  // facade on a line (along z at x = c, or along x at z = c), facing (nx, nz); the block runs D metres back
  function tenement(alongZ, c, a0, a1, dir, floors, shops = [], D = 10) {
    const nx = alongZ ? dir : 0, nz = alongZ ? 0 : dir, ry = Math.atan2(nx, nz), len = a1 - a0, mid = (a0 + a1) / 2, h = 1 + floors * 3.2, tone = pick(SAND);
    const at = (u, off = 0) => alongZ ? [c + nx * off, u] : [u, c + nz * off];
    { const [bx, bz] = at(mid, -D / 2); solid('stone', bx, h / 2, bz, alongZ ? D : len, h, alongZ ? len : D, tone, { tile: 3.2 + rand() }); B.add('roof', ROOF, M4(bx, h, bz, D + 0.3, 3.2, len + 0.05, 0, alongZ ? 0 : Math.PI / 2), 0x5c6168, { tile: 2.2 }); }
    { const [cx, cz] = at(mid, 0.12); solid('stone', cx, 4.1, cz, alongZ ? 0.24 : len, 0.28, alongZ ? len : 0.24, 0xe2d6be, { phys: false }); const [ex, ez] = at(mid, 0.18); solid('stone', ex, h - 0.25, ez, alongZ ? 0.4 : len + 0.2, 0.5, alongZ ? len + 0.2 : 0.4, 0xe2d6be, { phys: false }); }
    const bays = Math.max(2, Math.round(len / 3));
    for (let i = 0; i < bays; i++) for (let j = 1; j < floors; j++) { const u = a0 + (i + 0.5) * len / bays, [qx, qz] = at(u + (rand() - 0.5) * 0.1, 0.01); quad('facade', qx, 4.3 + (j - 0.5) * 3.2, qz, len / bays * 0.82, 3.0, ry, cellUV(j === floors - 1 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit, FACADE.sashA])), vt()); }
    for (let u = a0 + 2.5; u < a1 - 1; u += 6) { const [sx, sz] = at(u, -D / 2); solid('stone', sx, h + 2.2, sz, alongZ ? 2.8 : 1.0, 2.6, alongZ ? 1.0 : 2.8, tone, { phys: false, tile: 2.6 }); for (let k = -1; k <= 1; k++) { const [px, pz] = alongZ ? [sx + k * 0.8, sz] : [sx, sz + k * 0.8]; cyl('flat', px, h + 3.7, pz, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); } }
    // street level: shops where named, otherwise stair doors with fanlights between plain ground-floor windows
    const n = Math.max(1, Math.round(len / 5)), sw = len / n;
    for (let i = 0; i < n; i++) { const u = a0 + (i + 0.5) * sw, shop = shops[i];
      if (shop) { const col = shop.col; const P2 = (off, du = 0) => at(u + du, off);
        { const [x, z] = P2(0.06); solid('wood', x, 1.9, z, alongZ ? 0.12 : sw - 0.5, 3.8, alongZ ? sw - 0.5 : 0.12, col, { phys: false }); }
        { const [x, z] = P2(0.13); B.add('interior', QUAD, M4(x, 1.7, z, sw - 1.4, 2.1, 1, 0, ry), shop.lit ?? 0xe8d8b0, {}); }
        { const [x, z] = P2(0.16); quad('atlasLit', x, 3.35, z, sw - 0.8, 0.62, ry, atlas.fascia(shop.name, shop.sub || null, '#' + new THREE.Color(col).getHexString(), shop.fg || '#F1E6C8', (sw - 0.8) / 0.62)); }
        for (let k = 0; k <= 1; k++) { const [x, z] = P2(0.0, (k - 0.5) * sw); solid('stone', x, 2.0, z, alongZ ? 0.36 : 0.5, 4.0, alongZ ? 0.5 : 0.36, 0xe2d6be, { phys: false }); }
        if (shop.door) { const [x, z] = P2(0.2, sw * 0.32); solid('wood', x, 1.2, z, alongZ ? 0.1 : 1.1, 2.4, alongZ ? 1.1 : 0.1, 0x1d1d1d, { target: shop.door, surface: 'board', phys: true }); const [x2, z2] = P2(0.26, sw * 0.32); quad('atlas', x2, 1.2, z2, 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); shop.doorAt = at(u + sw * 0.32, 0); } }
      else { const [x, z] = at(u, 0.01); quad('facade', x, 1.6, z, 2.2, 3.0, ry, cellUV(i % 2 ? FACADE.door : FACADE.sashA), vt()); } }
    { const [gx, gz] = at(mid, 0.03); quad('grime', gx, 1.0, gz, len, 2.0, ry, GRIME_UV[0]); }
  }
  // the side street (Albion-style): west and east rows, ending in gables at the forecourt
  tenement(true, -PV, MZ1, RE, 1, 4, [null, null, null, null, { name: 'ROVERS SUPPORTERS CLUB', sub: 'MEMBERS & GUESTS', col: 0x1f7a4a }], 12);
  tenement(true, PV, MZ1, RE, -1, 4, [null, null, null, null, null, null, null, null, { name: 'GREEN & WHITE SPORTS', sub: 'SCARVES · KITS · BOOTS', col: 0x1f7a4a }], 12);
  // Easter Road itself: the far (south) side with the chippy and the newsagent
  const CHIP = { name: 'THE GOLDEN FRY', sub: 'FISH · CHIPS · PIES', col: 0x2a4f8a, fg: '#F4D35E', door: 'chippy' }, NEWS = { name: 'ALBION NEWS', sub: 'PAPERS · SWEETS · LOTTO', col: 0x7a1f1f, door: 'newsagent' }, PUB = { name: 'THE TERRACE BAR', sub: 'LIVE FITBA · REAL ALES', col: 0x1f3d2c, fg: '#E8C766', door: 'pubdoor', lit: 0xf0d090 };
  tenement(false, MZ0, -XW, -12, 1, 4, [null, CHIP, null, null]);
  tenement(false, MZ0, -12, 12, 1, 4, [null, NEWS, null, { name: 'EASTER BAKES', sub: 'ROLLS · PIES · TEA', col: 0x6b4a2b }, null]);
  tenement(false, MZ0, 12, XW, 1, 4, [null, { name: 'LOCHEND LAUNDERETTE', col: 0x3a6a8a }, null]);
  // north side of Easter Road either side of the side-street mouth (fronts face south)
  tenement(false, MZ1, -XW, -PV, -1, 4, [null, { name: 'DOUGIE\'S BARBERS', col: 0x8a2a2a }, null, null, PUB]); // the corner pub
  tenement(false, MZ1, PV, XW, -1, 4, [null, { name: 'EASTER ROAD TAXIS', col: 0x2E2F2C, fg: '#F4D35E' }, null, null, null]);
  // the corner pub's door is on the west row (target)
  // ---------- forecourt ends: the row gables face the stadium; a goal is painted on the east gable (crossbar challenge) ----------
  for (const s of [-1, 1]) { const x0 = s * PV, x1 = s * (PV + 12), xc = (x0 + x1) / 2; solid('stone', xc, 7, RE + 0.01, 12, 14, 0.04, pick(SAND), { phys: false, tile: 3.2 }); // gable skins
    for (let j = 1; j < 4; j++) quad('facade', xc + s * 3, 4.3 + (j - 0.5) * 3.2, RE + 0.04, 1.6, 2.6, 0, cellUV(FACADE.small), vt()); }
  { const gx = PV + 6, gw = 5.0, gh = 2.0, z = RE + 0.05; // painted goal (white posts + bar on the stone, net lines)
    for (const s of [-1, 1]) quad('flat', gx + s * gw / 2, gh / 2, z, 0.14, gh, 0, null, 0xf4f2ea); quad('flat', gx, gh, z, gw + 0.14, 0.14, 0, null, 0xf4f2ea);
    for (let k = 1; k < 8; k++) quad('flat', gx - gw / 2 + k * gw / 8, gh / 2, z + 0.005, 0.03, gh, 0, null, 0xdedad0); for (let k = 1; k < 4; k++) quad('flat', gx, k * gh / 4, z + 0.005, gw, 0.03, 0, null, 0xdedad0);
    solid('flat', gx, gh, RE + 0.2, gw, 0.4, 0.4, 0xf4f2ea, { target: 'crossbar', surface: 'metal' }); // the crossbar stands proud of the wall (target)
    sign('CROSSBAR CHALLENGE', gx, gh + 0.7, z + 0.02, 3.4, 0.45, 0, '#1f7a4a', '#ffffff', 'bold 46px Arial');
    addTarget({ id: 'crossbar', name: 'Crossbar Challenge', hint: 'hit the crossbar of the goal painted on the gable', points: 150, kind: 'hit', pos: V(gx, 0, RE + 1.5), ringR: 1.2, stand: V(gx, 0, RE + 6.5), aim: V(gx, gh, RE),
      lines: ['DING! Crossbar challenge: nailed.', "Aff the bar! The whole street went 'OOOH'.", 'Woodwork. On purpose. Legend.'] }); }

  // ---------- the stadium: the back of the East Stand rising over the street, turnstile wall in front ----------
  { const z0 = TZ + 1.25, Z1 = 80, CL = 0xb8bcbe, CL2 = 0x9ea4a8;
    // turnstile wall along the forecourt with an open turnstile gate (the twist) and closed ones
    const gates = [-14, -8, 8, 14], open = -8, GW = 1.4, GH = 2.4;
    { let x = -XW; for (const gx of [...gates, XW + GW / 2]) { const xa = x, xb = Math.min(XW, gx - GW / 2); if (xb > xa) solid('cpanel', (xa + xb) / 2, 2.0, TZ, xb - xa, 4.0, 2.5, 0xc4c0b8, { tile: 1.6 }); x = gx + GW / 2; } }
    for (const gx of gates) { solid('cpanel', gx, (GH + 4.0) / 2, TZ, GW, 4.0 - GH, 2.5, 0xc4c0b8, { tile: 1.6 }); // lintel
      sign(gx === open ? 'TURNSTILE 7 · OPEN' : 'TURNSTILE ' + (gates.indexOf(gx) + 4), gx, GH + 0.45, TZ - 1.28, 1.6, 0.32, Math.PI, gx === open ? '#1f7a4a' : '#2E2F2C', '#ffffff', 'bold 40px Arial');
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; solid('metal', gx + Math.cos(a) * 0.3, 1.0 + Math.sin(a) * 0.3, TZ - 0.4, 0.6, 0.05, 0.05, 0x9a9ea2, { phys: false, rz: a }); } // turnstile arms (scenery)
      if (gx !== open) solid('metal', gx, GH / 2, TZ - 0.6, GW, GH, 0.08, 0x3a3e42, { surface: 'metal' }); // closed shutter
      else { boxBody(gx, 1.5, TZ - 0.9, GW, 3, 0.3, { playerOnly: true }); solid('flat', gx, 1.3, TZ + 2.6, GW + 0.4, 2.6, 0.2, 0x2a2d31); for (const s of [-1, 1]) solid('cpanel', gx + s * (GW / 2 + 0.15), 1.3, TZ + 1.9, 0.3, 2.6, 1.4, 0xc4c0b8); B.add('interior', QUAD, M4(gx, 1.2, TZ + 2.48, GW, 2.4, 1, 0, Math.PI), 0x1f4a32, {}); } }
    addTarget({ id: 'turnstile', name: 'Turnstile Goal', hint: 'NEW: kick it clean through the open turnstile (no walking it in)', points: 150, kind: 'zone', kickOnly: true, pos: V(open, 0, TZ - 3), ringR: 1.2, stand: V(open, 0, TZ - 6.5), aim: V(open, 0.6, TZ + 1.5),
      zone: new THREE.Box3(V(open - GW / 2, 0, TZ + 0.6), V(open + GW / 2, GH, TZ + 2.5)), lines: ["Through the turnstile! That's you in for free.", 'Clicked through. The steward says ticket next time.', "In! Best seat in the hoose."] });
    for (const s of [-1, 1]) sign('LOCHEND ROVERS FC', s * 20, 3.3, TZ - 1.28, 6, 0.6, Math.PI, '#1f7a4a', '#ffffff', 'bold 54px Arial');
    // the stand: lower concourse block, then the big raked back wall with a green band, glazed stair towers and the roof
    solid('cpanel', 0, 6, z0 + 8.3, 64, 12, 14 - 2.6, CL, { tile: 2.5 }); // (starts behind the turnstile cell)
    solid('cpanel', 0, 20, (z0 + 14 + Z1) / 2, 72, 40, Z1 - z0 - 14, CL2, { tile: 3, phys: false });
    solid('flat', 0, 31, z0 + 14 - 0.05, 72.2, 3.2, 0.1, CLUBG, { phys: false }); solid('flat', 0, 12.2, z0 + 1.0 - 0.05, 64.2, 0.6, 0.1, CLUBG, { phys: false });
    quad('atlasLit', 0, 25.5, z0 + 14 - 0.12, 26, 2.6, Math.PI, atlas.sign('LOCHEND ROVERS · EAST STAND', '#f4f6f4', '#1f7a4a', 10, 'bold 64px Arial', '#1f7a4a'));
    for (let x = -34; x <= 34; x += 3) solid('flat', x, 20, z0 + 14 - 0.06, 0.12, 40, 0.1, 0x8a9094, { phys: false }); // cladding ribs
    for (const x of [-26, 26]) { solid('glass', x, 17, z0 + 12.8, 6, 34, 2.4, 0x9fb4ba, { phys: false }); for (let y = 3; y < 34; y += 3.2) solid('flat', x, y, z0 + 11.55, 6.1, 0.18, 0.1, 0x6a7076, { phys: false }); } // glazed stair towers
    for (let x = -24; x <= 24; x += 6) solid('glass', x, 8, z0 - 0.04 + 1.3, 3.6, 1.4, 0.1, 0x55606a, { phys: false });
    solid('flat', 0, 41.2, z0 + 22, 76, 0.8, 22, 0x8a9094, { phys: false }); solid('flat', 0, 40.6, z0 + 11.6, 76, 2.4, 1.4, 0xe8ecec, { phys: false }); // roof + fascia over the back
    for (const x of [-30, 30]) { cyl('metal', x, 27, z0 + 30, 0.5, 0.8, 54, 0x9a9ea2, { phys: false, seg: 8 }); solid('flat', x, 55, z0 + 29, 6, 4, 0.8, 0xdfe4e6, { phys: false }); B.add('lamp', BOX, M4(x, 55, z0 + 28.55, 5.4, 3.4, 0.1), 0xffffff, {}); } // floodlight masts
    boxBody(0, 15, z0 + 16, 80, 30, 6); }

  // ---------- match-day touches ----------
  { // programme seller's stall at the mouth of the side street (easy first target, straight ahead of the spawn)
    const x = 1.6, z = MZ1 + 2.2; solid('wood', x, 0.55, z, 1.8, 1.1, 0.9, 0x1f7a4a, { target: 'programmes', surface: 'board' }); solid('wood', x, 1.15, z, 2.0, 0.08, 1.1, 0xe8e4da, { phys: false });
    for (let k = 0; k < 6; k++) solid('flat', x - 0.75 + k * 0.3, 1.22, z, 0.22, 0.04, 0.3, pick([0x1f7a4a, 0xf4f2ea, 0xc8202a]), { phys: false });
    for (const s of [-1, 1]) cyl('metal', x + s * 0.9, 1.4, z + 0.4, 0.03, 0.03, 1.6, 0x8a8c88, { phys: false, seg: 4 }); solid('flat', x, 2.25, z + 0.1, 2.2, 0.06, 1.3, 0xf4f2ea, { phys: false });
    sign('PROGRAMMES £3', x, 0.6, z - 0.47, 1.6, 0.4, Math.PI, '#1f7a4a', '#ffffff', 'bold 50px Arial');
    addTarget({ id: 'programmes', name: "Programme Seller's Stall", hint: "hit the programme seller's stall", points: 50, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 1.1, stand: V(x, 0, z - 4.2), aim: V(x, 0.6, z),
      lines: ["Programme! Programme! Get your... ball aff ma stall.", 'Collector\'s edition, noo wi\' a dent.', 'Sold oot. Well, knocked ower.'] }); }
  { // fanzine A-board (topples)
    const ax = -5.4, az = -4, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.12, 0, 0), 0x1f7a4a); add(new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(-0.2).setPosition(-0.12, 0, 0), 0x1f7a4a);
    add(new THREE.BoxGeometry(0.01, 0.6, 0.5), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.155, 0.05, 0), 0xf4f2ea); add(new THREE.BoxGeometry(0.012, 0.12, 0.44), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.165, 0.25, 0), 0x1f7a4a);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 0.5, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.12, 0.47, 0.31)) }); b.position.set(ax, 0.48, az); b.userData = { target: 'fanzine', surface: 'board' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'fanzine', name: 'Fanzine Board', hint: 'knock over the fanzine board', points: 50, kind: 'topple', body: b, pos: V(ax, 0, az), stand: V(ax + 4.5, 0, az), aim: V(ax, 0.5, az), lines: ['Hold the back page!', '"FANZINE OOT NOO" - and so is the board.', 'Read all aboot it: ball wins.'] }); }
  // shop + pub + stair door targets (built into the frontages above)
  for (const [sh, dz, name, hint, lines] of [[PUB, -1, 'Terrace Bar Door', 'strike the corner pub door', ['Pre-match pint: served.', "The barman's no' impressed. The regulars are.", 'Door chapped. Kick-aff in ten.']],
    [CHIP, 1, 'Golden Fry Door', 'hit the chippy door', ['Fish supper, salt and sauce!', "Chippy's shut till the final whistle.", 'Battered it.']], [NEWS, 1, 'Albion News Door', 'hit the newsagent door', ['Hot off the press!', 'Papers, sweets... and a ball.', 'Stop press: door hit.']]]) {
    const [x, z] = sh.doorAt; addTarget({ id: sh.door, name, hint, points: 75, kind: 'hit', pos: V(x, 0, z + dz * 1.2), ringR: 1.0, stand: V(x, 0, z + dz * 5), aim: V(x, 1.0, z), lines }); }
  { // tenement stair door with a fanlight (target) on the east row
    const z = 4, x = PV - 0.02; solid('wood', x - 0.06, 1.2, z, 0.1, 2.4, 1.1, 0x2a2d31, { target: 'stairdoor', surface: 'board' }); quad('atlas', x - 0.12, 1.2, z, 1.1, 2.4, -Math.PI / 2, atlas.draw(128, 256, drawTargetDoor)); quad('glass', x - 0.03, 2.7, z, 1.1, 0.5, -Math.PI / 2, null, 0xd8c890);
    solid('stone', x - 0.1, 0.05, z, 0.6, 0.1, 1.6, 0xa8a49c, { phys: false });
    addTarget({ id: 'stairdoor', name: 'Stair Door', hint: 'hit the tenement stair door', points: 75, kind: 'hit', pos: V(x - 1.2, 0, z), ringR: 0.9, stand: V(x - 5, 0, z), aim: V(x, 1.0, z), lines: ["Buzz! Naebody's in - they're a' at the game.", 'Close door: chapped.', "The wifie on the second flair's no' happy."] }); }
  { // bus stop on Easter Road (target: the flag sign)
    const x = -20, z = MZ1 - 1.0; cyl('metal', x, 1.5, z, 0.05, 0.05, 3.0, 0x2a2d31, { seg: 6, phys: false }); solid('flat', x, 2.75, z, 0.6, 0.6, 0.06, 0xc8202a, { target: 'busstop', surface: 'metal' }); sign('BUS STOP', x, 2.75, z - 0.04, 0.55, 0.3, Math.PI, '#c8202a', '#ffffff', 'bold 40px Arial');
    boxBody(x, 1.5, z, 0.12, 3, 0.12, { surface: 'metal' });
    addTarget({ id: 'busstop', name: 'Bus Stop Flag', hint: 'ping the bus-stop flag', points: 75, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 0.9, stand: V(x, 0, z - 5.5), aim: V(x, 2.6, z), lines: ['Ding ding! Next stop, the ground.', 'Request stop: granted.', 'Flagged doon.'] }); }
  { // stewards' hut on the forecourt (target: the hatch board)
    const x = 22, z = RE + 7, BL = 0xf4b400; solid('flat', x, 1.3, z, 2.4, 2.6, 2.4, 0xd8d8d4); solid('flat', x, 2.7, z, 2.7, 0.2, 2.7, 0x3a3e42, { phys: false });
    solid('wood', x - 1.25, 1.2, z, 0.08, 1.0, 1.4, BL, { target: 'stewards', surface: 'board' }); sign('STEWARDS', x - 1.3, 2.1, z, 1.6, 0.3, -Math.PI / 2, '#f4b400', '#111', 'bold 46px Arial');
    addTarget({ id: 'stewards', name: "Stewards' Hut", hint: "hit the stewards' hut hatch", points: 75, kind: 'hit', pos: V(x - 2.4, 0, z), ringR: 0.9, stand: V(x - 6, 0, z), aim: V(x - 1.25, 1.1, z), lines: ['Hi-vis, high score.', "The steward's radioin' it in.", 'Hatch hit. Nae re-entry.'] }); }
  // street clutter: bollards, bins, lamp posts, a parked van, bunting of green and white scarves between windows
  for (const s of [-1, 1]) for (let z = MZ1 + 6; z < RE - 2; z += 11) { cyl('metal', s * (PV - 0.6), 3, z, 0.07, 0.1, 6, IRON, { seg: 6 }); solid('flat', s * (PV - 1.0), 5.9, z, 0.8, 0.08, 0.12, IRON, { phys: false }); solid('lamp', s * (PV - 1.4), 5.82, z, 0.35, 0.1, 0.2, 0xffffff, { phys: false }); }
  for (const [x, z, c] of [[-PV + 0.6, 12, 0x2a5a3a], [PV - 0.6, -8, 0x3a3e42], [-PV + 0.6, 19, 0x3a3e42]]) { solid('flat', x, 0.55, z, 0.7, 1.1, 0.7, c); solid('flat', x, 1.14, z, 0.74, 0.08, 0.74, new THREE.Color(c).multiplyScalar(0.7).getHex(), { phys: false }); }
  { const x = -2.0, z = 14; solid('flat', x, 1.15, z, 2.0, 1.9, 5.0, 0xf4f1ea); solid('flat', x, 0.45, z, 2.04, 0.3, 5.04, 0x2a2d31, { phys: false }); solid('glass', x, 1.55, z - 2.3, 1.8, 0.7, 0.5, 0xffffff, { phys: false, rx: 0.3 }); }
  for (let z = MZ1 + 4; z < RE - 1; z += 6) { const pts = [V(-PV, 9.5, z), V(0, 8.6, z + 0.5), V(PV, 9.5, z)]; B.add('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.015, 3, false), null, 0x2a2d31, {});
    for (let k = 1; k < 8; k++) { const t = k / 8, px = -PV + t * PV * 2, py = 9.5 - Math.sin(Math.PI * t) * 0.9; quad('flat', px, py - 0.25, z + 0.25 * Math.sin(Math.PI * t), 0.35, 0.45, 0, null, k % 2 ? 0x1f7a4a : 0xf4f2ea); } } // bunting
  // world edges: player and ball kept in by the frontages; close the street ends
  for (const s of [-1, 1]) { boxBody(s * (XW + 0.5), 4, (MZ0 + TZ) / 2, 1, 8, TZ - MZ0 + 4); solid('stone', s * (XW + 0.3), 4, (MZ0 + MZ1) / 2 + 1.5, 0.6, 8, MZ1 - MZ0 + 3, pick(SAND), { phys: false, tile: 3 }); solid('stone', s * (XW + 0.3), 3, (RE + TZ) / 2, 0.6, 6, TZ - RE, 0xb0aaa0, { phys: false, tile: 2 }); }
  // backdrop beyond the side rows: more roofs + a church spire so the sky line isn't empty
  for (const s of [-1, 1]) for (let z = -20; z < 30; z += 12) { const h = 15 + rand() * 6, x = s * (PV + 22 + rand() * 4); solid('stone', x, h / 2, z, 10, h, 11, pick(SAND), { phys: false, tile: 3 }); B.add('roof', ROOF, M4(x, h, z, 10.3, 2.6, 11, 0, 0), 0x5c6168, {}); }
  { const x = -24, z = -52; solid('stone', x, 14, z, 6, 28, 6, SAND[3], { phys: false, tile: 3 }); B.add('roof', new THREE.ConeGeometry(4, 16, 8), M4(x, 36, z, 1, 1, 1), 0x5c6168, {}); }

  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[-3, 0, -26], [2, 0, 6], [-10, 0, 31], [12, 0, 33]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture()); materials.cpanel = tm(concretePanelTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  materials.interior = new THREE.MeshBasicMaterial({ vertexColors: true }); materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [0, -27, 180, 6], street: [0, -10, 180, 10], forecourt: [0, 30, 180, 12], gable: [12, 34, 0, 4], corner: [0, -27, 200, 4], main: [-10, -26, 90, 4] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  if (z >= ER.ROWEND) return z < ER.TURN - 1.25 ? 'setts' : 'paving';
  if (z < ER.MAINZ0 + 3) return 'paving';
  if (z < ER.MAINZ1) return 'tarmac';
  if (Math.abs(x) < ER.RW) return 'tarmac';
  return 'paving';
}
export default {
  id: 'easterroad', name: 'Easter Road', short: 'Easter Road', surfaceAt,
  sounds: { birds: [[-12, 10], [12, -10]], gulls: [[0, 60], [-30, 20], [30, -20]], far: [[-60, 0], [60, 0], [0, 80], [0, -70]], roadX: 40 },
  blurb: "Level 6: Easter Road. Match day: up the side street to the ground. 10 targets. NEW: the turnstile goal - kick it through the open turnstile.",
  intro: "Welcome tae Easter Road!<br><small>Match day. The stand's at the top o' the street. Ball's at your feet. Easy first one: the programme stall, just ahead.</small>",
  build,
  tiers: { programmes: 'easy', fanzine: 'easy', pubdoor: 'easy', chippy: 'easy', newsagent: 'easy', stairdoor: 'easy', busstop: 'easy', stewards: 'easy', crossbar: 'tricky', turnstile: 'tricky' },
  spawn: [0, 0.5, -27], spawnYaw: 180,
  ballHomes: () => [[0, 0.4, -24.5], [0, 0.4, 2], [0, 0.4, 30]],
  bounds: { x: 30, zMin: -31, zMax: 38 },
  next: 'grassmarket',
};
