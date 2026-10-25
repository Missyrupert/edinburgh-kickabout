// Level 8: London Road (v3.7). The sweeping curve of four-storey blonde sandstone tenements (soot patina, canted bays, high
// chimneys, ground-floor shops with fictional names) along a wide asphalt road with flagstone pavements and granite kerbs; London
// Road Gardens' sloping lawn and trees on the inside of the curve with the terrace above; the kirk spire at the Easter Road
// junction. NEW twist: the brae goal - kick it UP the gardens' slope into a wee goal (too soft and it rolls back down).
// Geometry is polar: the road is an arc of radius R about C = (0, CZ); north (+z) is the outside of the curve.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const LR = { R: 100, CZ: -100, RW: 7, PW: 4, TH0: -0.5, TH1: 0.5, GT: -0.02, R2: 55, SLOPE: 0.16, GOALA: 0.06, GOALR: 76, BENCHA: -0.15 };
{ const a = LR.TH0 + 0.09, r = LR.R + LR.RW + 2; LR.SPAWN = [Math.sin(a) * r, 0.5, LR.CZ + Math.cos(a) * r]; LR.SPAWNYAW = Math.atan2(-Math.cos(a), Math.sin(a)) * 180 / Math.PI; }
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P_) {
  const rand = mulberry32(1903), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const { R, CZ, RW, PW, TH0, TH1, GT, R2 } = LR, ACC = 0x5B6C8F, IRON = 0x3c4048, TAR = 0x6e706e, SLAB = 0xc4c0b6, KERB = 0x9a9890;
  const R1 = R - RW - PW, RF = R + RW + PW, SL = LR.SLOPE; // inner wall radius, frontage radius, garden slope
  const SAND = [0xd8c8a4, 0xcfbe98, 0xdcccaa, 0xc6b48e, 0xd2c29e, 0xbcaa86]; // blonde sandstone
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.82 + rand() * 0.2; return c.setRGB(c.r * k, c.g * k, c.b * k).getHex(); };
  const P = (th, r, y = 0) => V(Math.sin(th) * r, y, CZ + Math.cos(th) * r); // polar -> world (C = (0, CZ))
  const RY = (th) => th + Math.PI; // ry of something facing the curve's centre (towards the road from the north side)
  const gh = (r) => Math.max(0, (R1 - r) * SL); // garden lawn height at radius r
  // curved ground ribbon (planar world UVs via tile), r0..r1 between th0..th1, height fn
  function ribbon(key, r0, r1, th0, th1, color, { y = 0.01, h = null, n = 48, nr = 1, tile = 4 } = {}) {
    const pos = [], nor = [], uv = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < nr; j++) { const a0 = th0 + (th1 - th0) * i / n, a1 = th0 + (th1 - th0) * (i + 1) / n, q0 = r0 + (r1 - r0) * j / nr, q1 = r0 + (r1 - r0) * (j + 1) / nr;
      const v = (a, q) => { const p = P(a, q); return [p.x, (h ? h(q) : 0) + y, p.z]; };
      for (const p of [v(a0, q0), v(a0, q1), v(a1, q1), v(a0, q0), v(a1, q1), v(a1, q0)]) { pos.push(...p); nor.push(0, 1, 0); uv.push(0, 0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (h) g.computeVertexNormals(); // (winding may face down; DoubleSide-safe colours)
    B.add(key, g, null, color, { tile }); }
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  // helper: a target in polar terms; stand is 'back' metres from the target, along the given outward/inward/tangent direction
  const tgt = (o) => addTarget(o);

  // ---------- ground: wide asphalt curve, flagstone pavements, granite kerbs ----------
  boxBody(0, -1, -30, 160, 2, 120, { surface: 'tarmac' });
  ribbon('tarmac', R - RW, R + RW, TH0 - 0.1, TH1 + 0.15, TAR, { tile: 4 });
  ribbon('slab', R + RW, RF, TH0 - 0.1, TH1 + 0.15, SLAB, { tile: 1.8, y: 0.02 }); ribbon('slab', R1, R - RW, TH0 - 0.1, TH1 + 0.15, SLAB, { tile: 1.8, y: 0.02 });
  for (const r of [R - RW, R + RW]) for (let i = 0; i < 40; i++) { const a = TH0 - 0.1 + (TH1 - TH0 + 0.25) * (i + 0.5) / 40, p = P(a, r); solid('stone', p.x, 0.06, p.z, (TH1 - TH0 + 0.25) / 40 * r + 0.02, 0.12, 0.3, KERB, { phys: false, ry: a }); }
  for (let i = 0; i < 60; i++) { if (i % 2) continue; const a = TH0 - 0.1 + (TH1 - TH0 + 0.25) * i / 60; for (const r of [R]) { const p = P(a, r); solid('flat', p.x, 0.015, p.z, 0.15, 0.01, 2.4, 0xe8e6de, { phys: false, ry: a + Math.PI / 2 - Math.PI / 2 + Math.PI / 2 }); } } // centre line dashes
  for (let i = 0; i < 24; i++) { const a = TH0 + rand() * (TH1 - TH0), r = R - RW + rand() * 2 * RW, p = P(a, r); quad('grime', p.x, 0.03, p.z, 1.5 + rand() * 3, 1 + rand() * 2, 0, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }

  // ---------- the sweeping blonde sandstone tenement curve (north side): 4 storeys, canted bays, chimneys, soot, shops ----------
  const SEGS = 11, DA = (TH1 - TH0) / SEGS, D = 10, H = 1 + 4 * 3.2;
  const shopsAt = { 0: [S0('THE LODGE BAR', 0x1f3d2c, 'pubdoor', '#E8C766', 'LOUNGE · BAR')], 2: [S0('LONDON ROAD NEWS', 0x7a1f1f, 'newsagent'), null], 3: [null, S0('ABBEYHILL PHARMACY', 0x2a6a5a)], 4: [S0('GREEN LEAF GROCER', 0x3a6a2a), null],
    5: [S0('THE CURVE CAFE', 0x6b4a2b, 'cafe', '#F1E6C8', 'BREAKFASTS · COFFEE'), null], 6: [null, null], 7: [S0('MEADOWBANK CYCLES', 0x2a4f8a), S0('CALTON BOOKS', 0x2E2F2C)], 8: [null, S0('HILLSIDE LAUNDRETTE', 0x3a6a8a)], 9: [S0('SPIRE BARBERS', ACC), null], 10: [S0('JUNCTION GROCERY', 0x8a3a2a), null] };
  function S0(name, col, door = null, fg = '#F1E6C8', sub = null) { return { name, col, door, fg, sub }; }
  const doors = {};
  const winShop = atlas.draw(192, 128, (g, w, h) => { g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(0, 0, w, 14); for (let r = 0; r < 4; r++) { g.fillStyle = '#7a6248'; g.fillRect(6, 40 + r * 22, w - 12, 4); for (let x = 10; x < w - 12; x += 8) { g.fillStyle = ['#c8202a', '#f4d35e', '#1f7a4a', '#2a4f8a', '#efe3c8'][(x + r) % 5]; g.fillRect(x, 28 + r * 22, 6, 12); } } });
  for (let s = 0; s < SEGS; s++) { const a = TH0 + (s + 0.5) * DA, w = 2 * RF * Math.sin(DA / 2) + 0.15, ry = RY(a), tone = pick(SAND);
    const F = (u, off, y = 0) => { const p = P(a, RF - off, y); return V(p.x + Math.cos(a) * u, y, p.z - Math.sin(a) * u); }; // u along the tangent, off towards the road
    { const c = F(0, -D / 2, H / 2); solid('stone', c.x, H / 2, c.z, w, H, D, tone, { ry, tile: 3.2 + rand() }); B.add('roof', ROOF, M4(c.x, H, c.z, w + 0.05, 3.4, D + 0.3, 0, ry + Math.PI / 2), 0x4c5158, { tile: 2.2 }); }
    { const c = F(0, 0.15); solid('stone', c.x, H - 0.25, c.z, w + 0.1, 0.5, 0.4, 0xd6c8a8, { phys: false, ry }); solid('stone', c.x, 4.1, c.z, w, 0.28, 0.3, 0xd6c8a8, { phys: false, ry }); }
    for (let k = -1; k <= 1; k++) for (let j = 1; j < 4; j++) { const c = F(k * w / 3, 0.01); quad('facade', c.x, 4.3 + (j - 0.5) * 3.2, c.z, w / 3 * 0.78, 3.0, ry, cellUV(j === 3 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit])), vt()); }
    { const c = F(-w / 3, 0.45); solid('stone', c.x, 4.2 + 4.8, c.z, 2.6, 9.6, 0.9, tone, { phys: false, ry, tile: 2.6 }); for (let j = 1; j < 4; j++) { const q = F(-w / 3, 0.91); quad('facade', q.x, 4.3 + (j - 0.5) * 3.2, q.z, 2.0, 2.8, ry, cellUV(FACADE.sashA), vt()); } } // canted bay
    for (const k of [-0.3, 0.3]) { const c = F(k * w, -D / 2); solid('stone', c.x, H + 2.4, c.z, 1.1, 3.0, 3.2, tone, { phys: false, ry, tile: 2.6 }); for (let m = -1; m <= 1; m++) { const q = F(k * w, -D / 2 + m * 0.8); cyl('flat', q.x, H + 4.1, q.z, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); } } // chimney stacks
    { const c = F(0, 0.03); quad('grime', c.x, 7, c.z, w, 14, ry, GRIME_UV[0], 0x8a7a64); quad('grime', c.x, H - 2, c.z, w, 3, ry, GRIME_UV[1], 0x6a5e4c); } // soot patina
    // ground floor: two bays (shop or stair door / window)
    const sl = shopsAt[s] || [null, null], half = w / 2;
    for (let b = 0; b < 2; b++) { const u = (b - 0.5) * half, sh = sl.length === 1 ? (b === 0 ? sl[0] : null) : sl[b], sw = sl.length === 1 && b === 0 ? half * 1.0 : half;
      if (sh) { const c0 = F(u, 0.06); solid('wood', c0.x, 1.9, c0.z, sw - 0.5, 3.8, 0.12, sh.col, { phys: false, ry });
        { const c = F(u - (sh.door ? sw * 0.12 : 0), 0.13); quad('atlasLit', c.x, 1.7, c.z, sw - (sh.door ? 2.6 : 1.4), 2.1, ry, winShop); }
        { const c = F(u, 0.16); quad('atlasLit', c.x, 3.35, c.z, sw - 0.8, 0.62, ry, atlas.fascia(sh.name, sh.sub, '#' + new THREE.Color(sh.col).getHexString(), sh.fg, (sw - 0.8) / 0.62)); }
        if (sh.door) { const c = F(u + sw * 0.32, 0.2); solid('wood', c.x, 1.2, c.z, 1.1, 2.4, 0.1, 0x1d1d1d, { target: sh.door, surface: 'board', ry }); const q = F(u + sw * 0.32, 0.26); quad('atlas', q.x, 1.2, q.z, 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); doors[sh.door] = { a, u: u + sw * 0.32, F }; } }
      else { const c = F(u, 0.01); quad('facade', c.x, 1.6, c.z, 2.2, 3.0, ry, cellUV(b ? FACADE.door : FACADE.sashA), vt()); } } }
  // the shop door targets (pub at the west end, newsagent, cafe)
  for (const [id, name, hint, lines] of [['pubdoor', 'Lodge Bar Door', 'strike the pub door', ['A pint o\' heavy and a ba\' please.', 'Door chapped. Last orders!', 'In off the door. Barry wid be proud.']],
    ['newsagent', 'London Road News Door', 'hit the newsagent door', ['Stop press: door hit.', 'Papers, rolls, and a ba\'.', 'The Daily Blether'+"'"+'ll cover it.']], ['cafe', 'Curve Cafe Door', 'hit the cafe door', ['Flat white, hard strike.', 'Rolls and sausage: earned.', 'Coffee\'s on the hoose.']]]) {
    const d = doors[id], c = d.F(d.u, 0), s = d.F(d.u, 5), p = d.F(d.u, 1.2); tgt({ id, name, hint, points: 75, kind: 'hit', pos: p, ringR: 1.0, stand: s, aim: V(c.x, 1.0, c.z), lines }); }
  { // tenement stair door with a fanlight (target) in segment 6
    const a = TH0 + 6.5 * DA, F = (u, off) => { const p = P(a, RF - off); return V(p.x + Math.cos(a) * u, 0, p.z - Math.sin(a) * u); }, ry = RY(a), c = F(0, 0.06);
    solid('wood', c.x, 1.2, c.z, 1.1, 2.4, 0.1, 0x2a2d31, { target: 'stairdoor', surface: 'board', ry }); const q = F(0, 0.12); quad('atlas', q.x, 1.2, q.z, 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); const g = F(0, 0.03); quad('glass', g.x, 2.7, g.z, 1.1, 0.5, ry, null, 0xd8c890);
    const s = F(0, 5), p = F(0, 1.2); tgt({ id: 'stairdoor', name: 'Stair Door', hint: 'hit the tenement stair door', points: 75, kind: 'hit', pos: p, ringR: 0.9, stand: s, aim: V(c.x, 1.0, c.z), lines: ["Buzz! Naebody's in.", 'Close door: chapped.', "The wifie on the third flair's at the windae."] }); }

  // ---------- London Road Gardens (south side): low wall + railings, a gate, the sloping lawn with trees, the terrace above ----------
  { const gate = [GT - 0.016, GT + 0.016]; // a ~2.8 m gate gap
    for (let i = 0; i < 44; i++) { const a0 = TH0 - 0.1 + (TH1 - TH0 + 0.25) * i / 44, a1 = a0 + (TH1 - TH0 + 0.25) / 44; if (a1 > gate[0] && a0 < gate[1]) continue; const a = (a0 + a1) / 2, p = P(a, R1 - 0.2), w = R1 * (a1 - a0) + 0.04;
      solid('stone', p.x, 0.45, p.z, w, 0.9, 0.5, 0xbcae90, { ry: a + Math.PI / 2 - Math.PI / 2, tile: 1.6 }); solid('stone', p.x, 0.94, p.z, w, 0.08, 0.6, 0xd2c6aa, { phys: false, ry: a });
      for (let k = 0; k < 3; k++) { const q = P(a0 + (a1 - a0) * (k + 0.5) / 3, R1 - 0.2); cyl('metal', q.x, 1.45, q.z, 0.02, 0.02, 1.0, IRON, { phys: false, seg: 4 }); } solid('metal', p.x, 1.92, p.z, w, 0.04, 0.04, IRON, { phys: false, ry: a }); boxBody(p.x, 1.4, p.z, w, 1.0, 0.3, { ry: a, playerOnly: true }); }
    for (const s of [-1, 1]) { const p = P(GT + s * 0.019, R1 - 0.2); solid('stone', p.x, 0.8, p.z, 0.6, 1.6, 0.6, 0xd2c6aa, { ry: GT }); B.add('flat', new THREE.SphereGeometry(0.22, 8, 6), M4(p.x, 1.75, p.z, 1, 1, 1), 0xd2c6aa, {}); } }
  // lawn: curved, rising away from the road; physics = tilted boxes per sector
  const GA = [TH0 + 0.08, TH1 - 0.1];
  ribbon('flat', R2, R1 - 0.4, GA[0], GA[1], 0x5f8a3e, { h: gh, n: 24, nr: 8, y: 0.02, tile: 0 });
  for (let i = 0; i < 30; i++) { const a = GA[0] + rand() * (GA[1] - GA[0]), r = R2 + 2 + rand() * (R1 - R2 - 4), p = P(a, r); B.add('flat', QUAD, M4(p.x, gh(r) + 0.04, p.z, 2 + rand() * 3, 1.5 + rand() * 2, 1, -Math.PI / 2 + SL * 0, a), pick([0x6a9446, 0x557e36, 0x72984c]), {}); } // lawn mottling
  ribbon('slab', R1 - 18, R1 - 16.4, GA[0], GA[1], 0xc8bca0, { h: gh, n: 24, y: 0.05, tile: 1.6 }); // a path across the lawn
  { const n = 12, al = Math.atan(SL), T = 1; for (let i = 0; i < n; i++) { const a = GA[0] + (GA[1] - GA[0]) * (i + 0.5) / n, w = (GA[1] - GA[0]) / n * R1 + 0.4, rm = (R1 + R2) / 2, L = (R1 - R2) / Math.cos(al) + 0.5, p = P(a, rm);
      body(new CANNON.Box(new CANNON.Vec3(w / 2, T / 2, L / 2)), p.x, gh(rm) - T / 2 / Math.cos(al), p.z, { rx: al, ry: a, surface: 'grass' }); } }
  for (const s of [0, 1]) { const a = GA[s] + (s ? 0.004 : -0.004); for (let r = R2; r < R1; r += 2.2) { const p = P(a, r); B.add('flat', new THREE.SphereGeometry(0.9, 6, 4), M4(p.x, gh(r) + 0.7, p.z, 1, 1, 1), 0x3e6a2e, {}); } const p0 = P(a, (R1 + R2) / 2); boxBody(p0.x, 3, p0.z, 1.2, 10, R1 - R2, { ry: a, playerOnly: true }); } // hedges closing the sides
  for (let i = 0; i < 22; i++) { const a = GA[0] + 0.01 + rand() * (GA[1] - GA[0] - 0.02), r = R2 + 3 + rand() * (R1 - R2 - 9), p = P(a, r), y = gh(r), h = 5 + rand() * 4; if (Math.abs(a - LR.GOALA) < 0.04 && r > 70 && r < 82) continue; if (Math.abs(a - GT) < 0.03) continue;
    cyl('wood', p.x, y + h / 2, p.z, 0.18, 0.28, h, 0x4a3a2c, { seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(2.6 + rand(), 0), M4(p.x, y + h + 1.2, p.z, 1, 0.85, 1, 0, rand() * 3), pick([0x3e6a2e, 0x4a7a36, 0x355e28]), {}); }
  // the terrace above the gardens (neoclassical, long, pale)
  { const n = 10; for (let i = 0; i < n; i++) { const a = GA[0] - 0.04 + (GA[1] - GA[0] + 0.08) * (i + 0.5) / n, w = (GA[1] - GA[0] + 0.08) / n * (R2 - 6) + 0.2, p = P(a, R2 - 11), y0 = gh(R2), ry = a; // faces the road (outward)
      solid('stone', p.x, y0 + 7, p.z, w, 14, 10, 0xd8ccb0, { ry, tile: 3 }); const f = P(a, R2 - 5.98); for (let k = -1; k <= 1; k++) for (let j = 0; j < 4; j++) quad('facade', f.x + Math.cos(a) * k * w / 3, y0 + 1.6 + j * 3.2, f.z - Math.sin(a) * k * w / 3, w / 3 * 0.7, 2.8, ry, cellUV(j ? FACADE.sashA : FACADE.door), vt(0xf0ece4));
      if (i % 3 === 1) for (let k = -2; k <= 2; k++) cyl('stone', f.x + Math.cos(a) * k * 1.4 + Math.sin(a) * 0.5, y0 + 6.5, f.z - Math.sin(a) * k * 1.4 + Math.cos(a) * 0.5, 0.3, 0.32, 6.4, 0xe4dac4, { phys: false, seg: 8 }); } } // columns
  boxBody(P(0, R2 - 2).x, 3 + gh(R2), P(0, R2 - 2).z, 80, 8, 1, { playerOnly: true });

  // ---------- the church spire at the Easter Road junction (east end) and the road beyond ----------
  { const a = TH1 + 0.1, p = P(a, R + RW + 9), ry = RY(a), SC = 0x9c8e74;
    solid('stone', p.x, 7, p.z, 12, 14, 22, SC, { ry, tile: 3 }); B.add('roof', ROOF, M4(p.x, 14, p.z, 12.3, 5, 22, 0, ry), 0x4c5158, {});
    const t = P(a - 0.07, R + RW + 4); solid('stone', t.x, 11, t.z, 5, 22, 5, SC, { ry, tile: 3 }); cyl('stone', t.x, 22.6, t.z, 2.8, 2.8, 1.2, 0xa89a80, { phys: false, seg: 8 });
    B.add('stone', new THREE.ConeGeometry(2.6, 22, 8), M4(t.x, 34.2, t.z, 1, 1, 1), SC, { tile: 3 }); for (const s of [-1, 1]) for (const q of [-1, 1]) B.add('stone', new THREE.ConeGeometry(0.35, 3, 4), M4(t.x + s * 2.2, 24.6, t.z + q * 2.2, 1, 1, 1), SC, {});
    quad('atlas', t.x - Math.sin(a) * 2.52, 18, t.z - Math.cos(a) * 2.52, 1.6, 3.6, ry, cellUV(FACADE.small)); // belfry opening
    const nb = P(TH1 + 0.02, R + RW + 1.4), nry = RY(TH1 + 0.02); for (const s of [-1, 1]) cyl('wood', nb.x + Math.cos(TH1) * s * 0.7, 0.8, nb.z - Math.sin(TH1) * s * 0.7, 0.05, 0.05, 1.6, 0x3a2e24, { phys: false, seg: 4 });
    solid('wood', nb.x, 1.35, nb.z, 1.6, 1.0, 0.1, 0x1f2a44, { target: 'churchboard', surface: 'board', ry: nry });
    quad('atlasLit', nb.x - Math.sin(TH1 + 0.02) * 0.06, 1.35, nb.z - Math.cos(TH1 + 0.02) * 0.06, 1.5, 0.9, nry, atlas.draw(160, 96, (g, w, h) => { g.fillStyle = '#1f2a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d8a0'; g.font = 'bold 16px Georgia'; g.textAlign = 'center'; g.fillText('LONDON ROAD KIRK', w / 2, 22); g.font = '13px Georgia'; g.fillText('Sunday Service 11am', w / 2, 46); g.fillText('All Welcome', w / 2, 66); }));
    const s = P(TH1 + 0.02, R + RW - 3.6); tgt({ id: 'churchboard', name: 'Kirk Notice Board', hint: 'hit the kirk notice board by the junction', points: 75, kind: 'hit', pos: P(TH1 + 0.02, R + RW + 0.2), ringR: 0.9, stand: s, aim: V(nb.x, 1.3, nb.z), lines: ['Hallelujah!', 'The minister felt that.', 'Notice: ball received.'] }); }
  // more tenements beyond both ends (hazy continuation) + Easter Road heading off north at the junction
  for (const [a, r] of [[TH0 - 0.16, RF + 6], [TH1 + 0.3, RF + 4], [TH0 - 0.28, R - 30]]) { const p = P(a, r); solid('stone', p.x, 7, p.z, 24, 14, 12, pick(SAND), { phys: false, ry: RY(a), tile: 3.4 }); }

  // ---------- street furniture: bus shelter (easy first), postbox, lamps, bins, a gate sign ----------
  { const a = TH0 + 0.14, r = R + RW + 0.9, ry = RY(a), p = P(a, r), tx = Math.cos(a), tz = -Math.sin(a), nx = -Math.sin(a), nz = -Math.cos(a); // shelter: back panel on the building side, roof
    const at = (u, off, y) => V(p.x + tx * u - nx * off, y, p.z + tz * u - nz * off);
    { const c = at(0, 1.2, 1.2); solid('glass', c.x, 1.25, c.z, 3.2, 2.1, 0.06, 0xcfe0e6, { ry, target: 'shelter', surface: 'metal' }); }
    for (const u of [-1.6, 1.6]) { const c = at(u, 0.6, 0); solid('metal', c.x, 1.2, c.z, 0.08, 2.4, 1.4, 0x3a3e42, { ry }); }
    { const c = at(0, 0.6, 0); solid('metal', c.x, 2.45, c.z, 3.4, 0.1, 1.6, 0x3a3e42, { phys: false, ry }); const s2 = at(1.75, 0.0, 0); quad('atlasLit', s2.x, 2.0, s2.z, 1.0, 0.5, ry + Math.PI / 2, atlas.sign('BUS', ACC.toString(16).padStart(6, '0').replace(/^/, '#'), '#ffffff', 2, 'bold 60px Arial')); }
    const tp = at(-4.5, 1.2, 0), sp = at(-4.5 + 0.0, 1.2, 0), tc = at(0, 1.2, 0); // stand back along the pavement? no: stand out on the road side facing the panel
    const st = V(tc.x + nx * 4.5, 0, tc.z + nz * 4.5), ps = V(tc.x + nx * 1.4, 0, tc.z + nz * 1.4);
    tgt({ id: 'shelter', name: 'Bus Shelter', hint: 'hit the bus shelter panel', points: 50, kind: 'hit', pos: ps, ringR: 1.1, stand: st, aim: V(tc.x, 1.1, tc.z), lines: ['Next bus: 2 minutes. Ball: immediate.', 'Shelter shook. The 26 driver waved.', 'Glass is tougher than it looks!'] }); }
  { const a = TH0 + 0.29, p = P(a, R + RW + 1.0); cyl('metal', p.x, 0.75, p.z, 0.3, 0.3, 1.5, 0xc8202a, { phys: false, seg: 10 }); B.add('metal', new THREE.SphereGeometry(0.32, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M4(p.x, 1.5, p.z, 1, 1, 1), 0xc8202a, {}); body(new CANNON.Cylinder(0.32, 0.32, 1.6, 10), p.x, 0.8, p.z, { target: 'postbox', surface: 'metal' });
    const s = P(a, R + RW - 3.6); tgt({ id: 'postbox', name: 'Pillar Box', hint: 'hit the red pillar box', points: 50, kind: 'hit', pos: P(a, R + RW - 0.3), ringR: 0.9, stand: s, aim: V(p.x, 0.8, p.z), lines: ['First class!', 'Posted. Nae stamp needed.', 'Signed for.'] }); }
  { // gardens gate sign (on the wall beside the gate)
    const a = GT - 0.03, p = P(a, R1 + 0.1), ry = RY(a) + Math.PI; solid('wood', p.x, 0.5, p.z, 1.8, 0.6, 0.08, 0x2e4a2e, { target: 'gatesign', surface: 'board', ry: a });
    const q = P(a, R1 + 0.16); quad('atlasLit', q.x, 0.5, q.z, 1.7, 0.5, a, atlas.sign('LONDON ROAD GARDENS', '#2e4a2e', '#f2ead0', 1.7 / 0.5, 'bold 40px Georgia'));
    const s = P(a, R1 + 4.5); tgt({ id: 'gatesign', name: 'Gardens Sign', hint: 'hit the London Road Gardens sign', points: 75, kind: 'hit', pos: P(a, R1 + 1.4), ringR: 0.9, stand: s, aim: V(p.x, 0.5, p.z), lines: ['Keep aff the grass! (Too late.)', 'Gardens open dawn till dusk. Ball open always.', 'Sign signed.'] }); }
  for (const a of [-0.43, -0.31, -0.15, 0.05, 0.2, 0.36]) { for (const [r, d] of [[R + RW + 0.6, -1], [R - RW - 0.6, 1]]) { if (d > 0 && Math.abs(a - GT) < 0.04) continue; const p = P(a, r), ap = P(a, r - d * 1.0); cyl('metal', p.x, 4, p.z, 0.08, 0.12, 8, IRON, { seg: 6 }); solid('flat', ap.x, 7.9, ap.z, 0.14, 0.1, 2.0, IRON, { phys: false, ry: a }); const lp = P(a, r - d * 1.8); solid('lamp', lp.x, 7.82, lp.z, 0.24, 0.1, 0.5, 0xffffff, { phys: false, ry: a }); } }
  for (const a of [TH0 + 0.2, TH0 + 0.62]) { const p = P(a, R + RW + 0.7); solid('flat', p.x, 0.55, p.z, 0.7, 1.1, 0.7, 0x2a5a3a, { ry: a }); }

  // ---------- NEW twist: the brae goal - a wee goal up the gardens' slope (kick it uphill; too soft and it rolls back down) ----------
  { const a = LR.GOALA, r = LR.GOALR, p = P(a, r), y = gh(r), gw = 2.4, gh2 = 1.2, ry = RY(a) + Math.PI; // posts across the slope, mouth facing down the brae (the road)
    const T = (u) => V(p.x + Math.cos(a) * u, 0, p.z - Math.sin(a) * u);
    for (const s of [-1, 1]) { const q = T(s * gw / 2); cyl('metal', q.x, y + gh2 / 2, q.z, 0.06, 0.06, gh2 + 0.3, 0xf4f4f0, { seg: 6 }); }
    { solid('metal', p.x, y + gh2, p.z, gw + 0.12, 0.1, 0.1, 0xf4f4f0, { ry: a }); } // crossbar
    const back = P(a, r - 1.4); for (const s of [-1, 1]) { const q = V(back.x + Math.cos(a) * s * gw / 2, 0, back.z - Math.sin(a) * s * gw / 2); cyl('metal', q.x, gh(r - 1.4) + 0.35, q.z, 0.03, 0.03, 0.7, 0xdcdcd8, { phys: false, seg: 4 }); }
    const nn = new THREE.PlaneGeometry(gw, 1.6, 6, 4); B.add('metal', nn, M4((p.x + back.x) / 2, (y + gh(r - 1.4)) / 2 + 0.5, (p.z + back.z) / 2, 1, 1, 1, -0.9, a), 0xe8e8e4, {}); // net (scenery)
    body(new CANNON.Box(new CANNON.Vec3(gw / 2, 0.6, 0.05)), back.x, gh(r - 1.4) + 0.6, back.z, { ry: a }); // backstop: the net catches it
    sign('BRAE GOAL', p.x, y + gh2 + 0.45, p.z, 1.6, 0.34, a, '#5B6C8F', '#ffffff', 'bold 44px Arial');
    const zc = P(a, r - 0.7), st = P(a, r + 6.5);
    tgt({ id: 'braegoal', name: 'Brae Goal', hint: 'NEW: kick it up the gardens\' slope into the wee goal (too soft and it rolls back)', points: 150, kind: 'zone', kickOnly: true, pos: P(a, r + 3), ringR: 1.1, stand: V(st.x, gh(r + 6.5), st.z), aim: V(p.x, y + 0.5, p.z),
      zone: new THREE.Box3(V(zc.x - gw / 2, y - 0.3, zc.z - 0.55), V(zc.x + gw / 2, y + gh2 + 0.1, zc.z + 0.55)), lines: ['Up the brae and in! Legs like a hill runner.', 'Uphill goal: worth double in Leith money.', 'In! The pigeons on the terrace applaud.'] }); }
  { // a bench up the slope (chip it uphill)
    const a = LR.BENCHA, r = 70, p = P(a, r), y = gh(r); for (const s of [-1, 1]) solid('metal', p.x + Math.cos(a) * s * 0.85, y + 0.42, p.z - Math.sin(a) * s * 0.85, 0.08, 0.84, 0.6, IRON, { phys: false, ry: a });
    for (let k = 0; k < 3; k++) { const q = P(a, r + 0.18 - k * 0.16); solid('wood', q.x, y + 0.45, q.z, 1.8, 0.05, 0.12, 0x8a6a48, { phys: false, ry: a }); } const bk = P(a, r - 0.26); solid('wood', bk.x, y + 0.8, bk.z, 1.8, 0.4, 0.05, 0x8a6a48, { phys: false, ry: a });
    body(new CANNON.Box(new CANNON.Vec3(0.9, 0.45, 0.3)), p.x, y + 0.45, p.z, { ry: a, target: 'bench', surface: 'board' });
    const st = P(a, r + 5.5); tgt({ id: 'bench', name: 'Gardens Bench', hint: 'hit the bench up the slope', points: 75, kind: 'hit', pos: P(a, r + 1.5), ringR: 0.9, stand: V(st.x, gh(r + 5.5), st.z), aim: V(p.x, y + 0.5, p.z), lines: ['A seat wi\' a view - and a dent.', 'Bench: benched.', 'Dedicated tae a great strike.'] }); }

  // ---------- edges ----------
  for (const a of [TH0 - 0.04, TH1 + 0.13]) { const p = P(a, (R1 + RF) / 2); boxBody(p.x, 3, p.z, 1, 6, RF - R1 + 2, { ry: a, playerOnly: true }); }

  const groups = [[P(TH0 + 0.2, R + RW + 2).x, 0, P(TH0 + 0.2, R + RW + 2).z], [P(0.05, R - RW - 2).x, 0, P(0.05, R - RW - 2).z], [P(-0.1, 72).x, gh(72), P(-0.1, 72).z], [P(TH1, R).x, 0, P(TH1, R).z]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P_, facadeTex, atlas.tex); materials.flat.side = THREE.DoubleSide;
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P_.shadows; scene.add(d.mesh); }
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P_.shadows });
  const sp = LR.SPAWN, views = { spawn: [sp[0], sp[2], LR.SPAWNYAW, 4, 0.5], curve: [P(0, R + 2).x, P(0, R + 2).z, 270, 6, 0.5], gardens: [P(GT, R - 3).x, P(GT, R - 3).z, 0, 12, 0.5], spire: [P(TH1 - 0.15, R).x, P(TH1 - 0.15, R).z, 240, 10, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  const r = Math.hypot(x, z - LR.CZ), a = Math.atan2(x, z - LR.CZ);
  if (r > LR.R + LR.RW) return 'paving';
  if (r > LR.R - LR.RW) return 'tarmac';
  if (r > LR.R - LR.RW - LR.PW) return 'paving';
  return a > LR.TH0 + 0.08 && a < LR.TH1 - 0.1 ? 'grass' : 'paving';
}
export default {
  id: 'londonroad', name: 'London Road', short: 'London Road', surfaceAt,
  sounds: { birds: [[-10, -30], [10, -40], [0, -20]], gulls: [[0, 20], [-40, 0]], far: [[-70, -10], [70, -10], [0, 30], [0, -70]], roadX: 30 },
  blurb: "Level 8: London Road. The big sandstone curve and the Gardens. 10 targets. NEW: the brae goal - kick it up the slope.",
  intro: "Welcome tae London Road!<br><small>The big curve o' tenements, the Gardens up the brae, the kirk spire at the end. Easy first one: the bus shelter, just ahead.</small>",
  build,
  tiers: { shelter: 'easy', postbox: 'easy', pubdoor: 'easy', newsagent: 'easy', cafe: 'easy', stairdoor: 'easy', gatesign: 'easy', churchboard: 'easy', bench: 'tricky', braegoal: 'tricky' },
  spawn: LR.SPAWN, spawnYaw: LR.SPAWNYAW,
  ballHomes: () => { const a = LR.TH0 + 0.11, r = LR.R + LR.RW + 2; return [[Math.sin(a) * r, 0.4, LR.CZ + Math.cos(a) * r], [0, 0.4, -2], [Math.sin(0.3) * 100, 0.4, LR.CZ + Math.cos(0.3) * 100]]; },
  bounds: { x: 58, zMin: -48, zMax: 14 },
  next: 'grassmarket',
};
