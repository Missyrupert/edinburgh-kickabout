// v2.6 The Grassmarket, reworked for realism: a broad, flat, cobbled market square (long axis east-west) in the
// hollow below and south of the Castle. North = +z (the Castle), east = -x (Victoria Street / West Bow corner).
// Square setts z -15.5..15.5, edge roads to |z| 19.5, flagstone pavements to the terrace fronts at |z| = 22.
// Everything static is merged per material (Batcher). New procedural drawings go into the shared sign atlas.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { buildCastle } from '../castle.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, tarmacTexture } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const GM = { X: 64, SQ: 15.5, ROAD: 19.5, FRONT: 22, DEPTH: 12 };

export function buildSquare(scene, world, mats, P) {
  const rand = mulberry32(1477), pick = (a) => a[Math.floor(rand() * a.length)];
  const B = new Batcher(), atlas = new SignAtlas(), facadeTex = facadeAtlas();
  const targets = [], dynamics = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {}, CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(x, y, z), q, V(sx, sy, sz)); };
  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, surface = null } = {}) {
    const b = new CANNON.Body({ mass: 0, material, shape }); b.position.set(x, y, z); eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
    if (target || surface) b.userData = { target, surface }; world.addBody(b); return b; }
  const boxBody = (x, y, z, w, h, d, o = {}) => body(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), x, y, z, o);
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, grime = 0, target = null, surface = null } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile, grime }); return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, surface }) : null; }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1), color, {}); return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface }) : null; }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, grime = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, tile });
  const sign = (text, x, y, z, w, h, ry, bg, fg, font, border) => quad('atlas', x, y, z, w, h, ry, atlas.sign(text, bg, fg, w / h, font, border));
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const IRON = 0x1c1f22, X = GM.X, F = GM.FRONT;

  // ---------- ground ----------
  const ground = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
  B.add('paving', QUAD, M4(0, -0.01, 0, 400, 400, 1, -Math.PI / 2), 0x8f8a80, { tile: 2.4 });
  B.add('cobble', QUAD, M4(0, 0.006, 0, 2 * X, 2 * GM.SQ, 1, -Math.PI / 2), 0xb4b2ac, { tile: 1.6 }); // granite setts square
  for (const s of [-1, 1]) {
    B.add('tarmac', QUAD, M4(0, 0.007, s * (GM.SQ + GM.ROAD) / 2, 2 * X, GM.ROAD - GM.SQ, 1, -Math.PI / 2), 0x8a8c88, { tile: 4 }); // edge road
    for (const dz of [0.25, 0.42]) B.add('flat', QUAD, M4(0, 0.009, s * (GM.ROAD - dz), 2 * X - 4, 0.09, 1, -Math.PI / 2), 0xe8c43a, {}); // double yellow lines
    B.add('paving', QUAD, M4(0, 0.008, s * (GM.ROAD + F) / 2, 2 * X, F - GM.ROAD, 1, -Math.PI / 2), 0xd2c8b6, { tile: 1.4 }); // flagstones
    solid('stone', 0, 0.03, s * GM.ROAD, 2 * X, 0.06, 0.25, 0x9c968c, { phys: false, tile: 1 }); // kerbstones (flush: no lip)
  }

  // ---------- tenement terraces ----------
  const TINT = [0xc4b49a, 0xaca290, 0x9d978a, 0xb8a68c, 0xdcd6c8, 0xa89c88, 0x8f897e]; // honey, brown, grey sandstone, cream harl
  const UPPER = [FACADE.sashA, FACADE.sashA, FACADE.sashB, FACADE.sashA, FACADE.triple, FACADE.lit, FACADE.flowers, FACADE.pediment];
  function facadeFace(cx, cz, ry, L, nf, fh, base, tint, skipGround) { // ry: facing direction (0 = +z)
    const nb = Math.max(1, Math.round(L / 3.4)), bw = L / nb, ax = Math.cos(ry), az = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
    for (let i = 0; i < nb; i++) for (let j = skipGround ? 1 : 0; j < nf; j++) {
      const s = (i + 0.5) * bw - L / 2, c = j === 0 ? pick([FACADE.rustic, FACADE.door, FACADE.plain]) : j === nf - 1 ? pick([FACADE.small, FACADE.small, FACADE.smallLit]) : pick(UPPER);
      quad('facade', cx + ax * s + nx * 0.01, base + (j + 0.5) * fh, cz + az * s + nz * 0.01, bw, fh, ry, cellUV(c), new THREE.Color(tint).multiplyScalar(0.9 + rand() * 0.12), { grime: 0.3 });
    }
  }
  const DISP = { pub: ['#3a2416', '#c88a3a', '#e8c070'], iron: ['#3c3f42', '#8a8f94', '#c9a46a'], barber: ['#e8e4dc', '#b02a2a', '#2a4ab0'], books: ['#3a2a1a', '#7a3a2a', '#c9a46a'], cafe: ['#efe3c8', '#C77B2E', '#7a4a2a'], bakery: ['#f2e6cc', '#c88a3a', '#e8d2a0'], shop: ['#e8e2d4', '#2E9C8F', '#9A4E3C'] };
  const dispCache = {}, display = (kind) => (dispCache[kind] ||= atlas.draw(256, 192, (g, w, h) => { const [bg, a, b2] = DISP[kind] || DISP.shop;
    g.fillStyle = bg; g.fillRect(0, 0, w, h); const lit = g.createRadialGradient(w / 2, h * 0.3, 10, w / 2, h * 0.3, w * 0.7); lit.addColorStop(0, 'rgba(255,230,170,.45)'); lit.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = lit; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(8, 40 + r * 50, w - 16, 4); for (let i = 0; i < 9; i++) { g.fillStyle = (i + r) % 3 ? a : b2; const hh = 14 + ((i * 7 + r * 3) % 4) * 6; g.fillRect(14 + i * 26, 40 + r * 50 - hh, 18, hh); } }
    if (kind === 'barber') for (let y = 0; y < h; y += 16) { g.fillStyle = (y / 16) % 2 ? '#b02a2a' : '#fff'; g.fillRect(w - 22, y, 14, 8); }
    g.strokeStyle = '#e8e4da'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h * 0.35); g.lineTo(w, h * 0.35); g.stroke(); // astragals
    g.strokeStyle = '#2E2F2C'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }));
  // ground-floor shop / pub / cafe: painted timber front, fascia, lit display, door, optional awning
  function shopfront(x0, x1, s, name, col, kind, awning) { // s = +1 north terrace (faces -z), -1 south (faces +z)
    const z = s * F, ry = s > 0 ? Math.PI : 0, len = x1 - x0, xc = (x0 + x1) / 2, n = -s;
    solid('wood', xc, 1.7, z + n * 0.08, len - 0.3, 3.4, 0.16, new THREE.Color(col), { phys: false, tile: 1.2 });
    quad('atlas', xc, 3.0, z + n * 0.17, len - 0.6, 0.62, ry, atlas.fascia(name, null, col, '#f1d98a', (len - 0.6) / 0.62));
    quad('atlas', xc - (len * 0.12) * (s > 0 ? -1 : 1), 1.55, z + n * 0.17, len * 0.55, 1.9, ry, display(kind));
    quad('flat', xc + (len * 0.36) * (s > 0 ? -1 : 1), 1.2, z + n * 0.17, 1.0, 2.3, ry, null, new THREE.Color(col).multiplyScalar(0.55));
    if (awning) solid('flat', xc, 2.55, z + n * 0.75, len - 0.5, 0.05, 1.4, awning, { phys: false, rx: s * 0.3 });
  }
  const NAMES = [['THE LAST DRAP', '#1d3b2a', 'pub', 0xa82a24], ['FLEMING & DAUGHTER', '#5b1b2a', 'iron'], ['THE BOW BARBER', '#1e2c4f', 'barber'], ['BOOKS & BAWBEES', '#2f4a2a', 'books'],
    ['THE WEST PORT FISH BAR', '#0f3d5c', 'cafe', 0xa82a24], ['THE CORN EXCHANGE CAFE', '#C77B2E', 'cafe', 0xc8b89a], ["MACKAY'S BAKERY", '#2f4a2a', 'bakery', 0x2f5a3a], ['THE HALF MOON', '#5b1b2a', 'pub', 0xa82a24],
    ['PAPER & PRESS', '#3b2350', 'shop'], ['CANDLEMAKER', '#1d5c3a', 'shop'], ['THE MAP ROOM', '#2f4a2a', 'books'], ['HOOK & LINE', '#2a6f6f', 'shop']];
  let shopI = 0;
  // one tenement unit along a terrace. gable: 'crow' | 'dutch' | 'plain' (dormers)
  function unit(x0, x1, s, { floors = 4 + (rand() < 0.4 ? 1 : 0), gable = pick(['crow', 'dutch', 'plain', 'plain']), shop = true, gap = null } = {}) {
    const len = x1 - x0, xc = (x0 + x1) / 2, D = GM.DEPTH, z0 = s * F, zc = s * (F + D / 2), fh = 3.3, h = floors * fh + 0.6, tint = pick(TINT), ry = s > 0 ? Math.PI : 0, n = -s;
    if (gap) { // a pend (close) through the building: two side blocks + the block above the arch
      const [g0, g1] = gap; solid('stone', (x0 + g0) / 2, h / 2, zc, g0 - x0, h, D, tint, { phys: false, tile: 3 }); boxBody((x0 + g0) / 2, h / 2, zc, g0 - x0, h, D);
      solid('stone', (g1 + x1) / 2, h / 2, zc, x1 - g1, h, D, tint, { phys: false, tile: 3 }); boxBody((g1 + x1) / 2, h / 2, zc, x1 - g1, h, D);
      solid('stone', (g0 + g1) / 2, (h + 3.2) / 2, zc, g1 - g0, h - 3.2, D, tint, { phys: false, tile: 3 }); boxBody((g0 + g1) / 2, (h + 3.2) / 2, zc, g1 - g0, h - 3.2, D);
      solid('stone', (g0 + g1) / 2, 0.003, zc, g1 - g0, 0.006, D, 0x6a6660, { phys: false }); // dark passage floor
    } else { solid('stone', xc, h / 2, zc, len, h, D, tint, { phys: false, tile: 3 }); boxBody(xc, h / 2, zc, len, h, D); }
    facadeFace(xc, z0 + n * 0.0, ry, len, floors, fh, 0.6, tint, shop || !!gap);
    if (gap) for (const [a, b] of [[x0, gap[0]], [gap[1], x1]]) facadeFace((a + b) / 2, z0, ry, b - a, 1, fh + 0.6, 0, tint, false); // ground floor either side of the pend
    solid('stone', xc, 0.3, z0 + n * 0.05, len, 0.6, 0.12, new THREE.Color(tint).multiplyScalar(0.8), { phys: false }); // plinth
    solid('stone', xc, h - 0.15, z0 + n * 0.15, len + 0.05, 0.35, 0.3, new THREE.Color(tint).multiplyScalar(1.05), { phys: false }); // cornice
    solid('stone', xc, 0.6 + fh, z0 + n * 0.06, len, 0.18, 0.12, new THREE.Color(tint).multiplyScalar(0.95), { phys: false }); // string course
    if (shop && !gap) { const nm = NAMES[shopI++ % NAMES.length]; shopfront(x0 + 0.2, x1 - 0.2, s, nm[0], nm[1], nm[2], nm[3]); }
    // roof, ridge along x
    const rh = 4.2; B.add('roof', ROOF, M4(xc, h, zc, D + 0.4, rh, len + 0.1, 0, Math.PI / 2), 0xb9bdc4, { tile: 2.2 });
    if (gable !== 'plain') { // street-facing gable, rising from the front wall
      const gw = Math.min(len * 0.55, 7), gh = 6, N = 7;
      for (let k = 0; k < N; k++) { const t = (k + 0.5) / N, ww = gable === 'crow' ? gw * (1 - Math.floor(k * 4 / N) / 4) : gw * Math.cos(t * Math.PI / 2 * 0.92) + 0.6;
        solid('stone', xc, h + (k + 0.5) * gh / N, z0 + n * -0.2, ww, gh / N + 0.01, 0.5, tint, { phys: false, tile: 3 }); }
      if (gable === 'dutch') solid('stone', xc, h + gh + 0.25, z0 + n * -0.2, 1.4, 0.5, 0.55, new THREE.Color(tint).multiplyScalar(1.05), { phys: false }); // curved gable cap
      quad('facade', xc, h + gh * 0.35, z0 + n * 0.06, 1.6, 2.2, ry, cellUV(FACADE.small), tint);
      B.add('roof', ROOF, M4(xc, h + 0.1, z0 + s * 2.5, gw - 0.3, gh - 0.4, 5, 0, 0), 0xb9bdc4, { tile: 2.2 }); // cross roof behind the gable
    } else for (let k = 0; k < Math.max(1, Math.floor(len / 5)); k++) { const dx = x0 + (k + 0.5) * len / Math.max(1, Math.floor(len / 5)); // gabled dormers
      solid('stone', dx, h + 1.0, z0 + s * 1.2, 1.5, 2.0, 1.6, tint, { phys: false, tile: 3 }); quad('facade', dx, h + 0.95, z0 + s * 0.39, 1.2, 1.5, ry, cellUV(FACADE.small), 0xffffff);
      B.add('roof', ROOF, M4(dx, h + 2.0, z0 + s * 1.2, 1.8, 0.9, 1.9, 0, 0), 0xb9bdc4, { tile: 2.2 }); }
    // chimney stack + pots on the party wall
    if (rand() < 0.85) { const cx = rand() < 0.5 ? x0 + 0.5 : x1 - 0.5, ch = 2.2 + rand() * 1.4; solid('stone', cx, h + rh * 0.5 + ch / 2, zc, 1.0, ch + rh, 3.2, tint, { phys: false, tile: 3 });
      for (let k = -1.2; k <= 1.21; k += 0.6) cyl('flat', cx, h + rh * 0.5 + ch + 0.25, zc + k, 0.13, 0.16, 0.5, pick([0xa65a3a, 0x8a4a32, 0xb87050]), { phys: false, seg: 6 }); }
    cyl('metal', x0 + 0.3, h / 2, z0 + n * 0.15, 0.055, 0.055, h, 0x25282d, { phys: false, seg: 6 }); // drainpipe
    return h;
  }
  // north terrace (x -50..64; the NE corner opens to Victoria Street) and south terrace (x -64..64, a close at x 30)
  const cuts = (a, b, seed) => { const out = []; let x = a; while (x < b - 6) { const w = Math.min(b - x, 8 + Math.floor(rand() * 6)); out.push([x, b - x - w < 6 ? b : x + w]); x = out[out.length - 1][1]; } return out; };
  for (const [a, b] of cuts(-50, 64)) unit(a, b, 1);
  for (const [a, b] of cuts(-64, 24)) unit(a, b, -1);
  unit(24, 36, -1, { gap: [29.2, 30.8], gable: 'crow', shop: false }); // Kicker's Close runs through here
  for (const [a, b] of cuts(36, 64)) unit(a, b, -1);
  // end terraces (west end x > 64, east end x < -64) - simple, facing into the square
  for (const s of [-1, 1]) { const x = s * (X + 6); solid('stone', x, 9, 0, 12, 18, 2 * F + 2 * GM.DEPTH, s > 0 ? 0xc9b28c : 0xb3a184, { tile: 3 });
    for (let k = -4; k <= 4; k++) facadeFace(s * X + -s * 0.01, k * 5.4, s > 0 ? -Math.PI / 2 : Math.PI / 2, 5.4, 5, 3.3, 0.6, s > 0 ? 0xc9b28c : 0xb3a184, false); }
  // Kicker's Close: arch dressing, plaque, and the back court behind the south terrace
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; solid('stone', 30 + Math.cos(a) * 0.8, 2.45 + Math.sin(a) * 0.8, -F + 0.1, 0.24, 0.34, 0.3, k === 4 ? 0xf2e3c4 : 0xd9c8a6, { phys: false, rz: a - Math.PI / 2 }); }
  sign("KICKER'S CLOSE", 30, 3.6, -F + 0.2, 2.0, 0.36, 0, '#f4f1ea', '#111', 'bold 60px Arial', '#111');
  B.add('lamp', BOX, M4(30, 2.9, -F - 6, 0.18, 0.25, 0.18), 0xffffff, {});
  const BC = { x0: 18, x1: 42, z0: -F - GM.DEPTH, z1: -F - GM.DEPTH - 14 };
  for (const [x, z, w, d] of [[BC.x0, (BC.z0 + BC.z1) / 2, 1, 14], [BC.x1, (BC.z0 + BC.z1) / 2, 1, 14], [30, BC.z1, 25, 1]]) solid('stone', x, 2, z, w, 4, d, 0xcbb898, { tile: 2.5, grime: 0.3 });
  cyl('wood', 22.5, 1.2, -41, 0.12, 0.16, 2.4, 0x6b4a2b, { seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(1.3, 0), M4(22.5, 3.1, -41, 1, 1.2, 1), 0x4f6b3a, {});

  // ---------- Victoria Street / West Bow vista from the north-east corner ----------
  const VS = { cx: -87, cz: F, R: 30 }, vsAt = (a, r) => [VS.cx + r * Math.cos(a), VS.cz + r * Math.sin(a)];
  const VCOL = ['#efe3c8', '#e8692a', '#1f4fb8', '#d8668a', '#c22a2a', '#2E9C8F', '#f2c94c', '#1f4fb8'];
  const vsDraw = {}, vsFront = (col) => (vsDraw[col] ||= atlas.draw(160, 192, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h * 0.5, w, 4);
    for (const x of [0.12, 0.58]) { g.fillStyle = '#f4f1ea'; g.fillRect(w * x, h * 0.08, w * 0.3, h * 0.32); g.fillStyle = '#3a4a5a'; g.fillRect(w * x + 5, h * 0.08 + 5, w * 0.3 - 10, h * 0.32 - 10); g.fillStyle = '#f4f1ea'; g.fillRect(w * x, h * 0.24, w * 0.3, 3); g.fillRect(w * (x + 0.15) - 1, h * 0.08, 3, h * 0.32);
      g.fillStyle = '#4a7a3a'; g.fillRect(w * x - 2, h * 0.4, w * 0.3 + 4, 8); g.fillStyle = '#c62d4a'; for (let i = 0; i < 4; i++) g.fillRect(w * x + i * 12, h * 0.38, 6, 6); }
    g.fillStyle = '#2E2F2C'; g.fillRect(w * 0.05, h * 0.52, w * 0.9, h * 0.1); g.fillStyle = '#e8e2d4'; g.fillRect(w * 0.08, h * 0.65, w * 0.55, h * 0.3); g.fillStyle = 'rgba(255,220,150,.4)'; g.fillRect(w * 0.08, h * 0.65, w * 0.55, h * 0.3);
    g.fillStyle = '#f4f1ea'; g.fillRect(w * 0.7, h * 0.65, w * 0.2, h * 0.35); g.fillStyle = '#c22a2a'; g.fillRect(w * 0.72, h * 0.67, w * 0.16, h * 0.33); }));
  const SEG = 12, A1 = 1.25, RISE = 9;
  for (let i = 0; i < SEG; i++) { const a0 = i / SEG * A1, a1 = (i + 1) / SEG * A1, am = (a0 + a1) / 2, t = (i + 0.5) / SEG, y = RISE * Math.pow(t, 1.2), [x, z] = vsAt(am, VS.R), len = VS.R * (a1 - a0) + 0.2, ry = -am; // street heading ~ +z turning to -x
    const slope = Math.atan2(RISE * 1.2 * Math.pow(t, 0.2) / SEG, len);
    B.add('cobble', QUAD, M4(x, y + 0.02, z, 8.5, len, 1, -Math.PI / 2 - slope, ry), 0xa8a6a0, { tile: 1.6 });
    if (i < 2) { boxBody(x, y - 0.5, z, 8.5, 1, len, { rx: -slope, ry }); } else B.add('stone', BOX, M4(x, y / 2 - 0.3, z, 8.5, y, len, 0, ry), 0x8a8478, { tile: 3 });
    // outer side (west / left looking up): the colourful two-storey shop terrace with a balustraded walkway on top
    const [ox, oz] = vsAt(am, VS.R + 5.6), col = VCOL[i % VCOL.length];
    solid('flat', ox, y + 3.5, oz, 3.0, 7, len, new THREE.Color(col), { phys: false, ry: ry });
    quad('atlas', ...[vsAt(am, VS.R + 4.08)[0]], y + 3.5, vsAt(am, VS.R + 4.08)[1], len - 0.1, 7, ry - Math.PI / 2, vsFront(col));
    for (let k = 0; k < 5; k++) { const [bx, bz] = vsAt(am + (k / 5 - 0.4) * (a1 - a0), VS.R + 4.3); solid('stone', bx, y + 7.45, bz, 0.12, 0.8, 0.12, 0xe8e2d4, { phys: false }); }
    solid('stone', ox - 1.4 * Math.cos(am), y + 7.9, oz - 1.4 * Math.sin(am), 0.2, 0.12, len, 0xe8e2d4, { phys: false, ry: ry }); // balustrade rail
    // tall dark tenements behind and above (6-7 storeys) on both sides
    const [tx, tz] = vsAt(am, VS.R + 12), th = 20 + (i % 3) * 3;
    solid('stone', tx, y + 7 + th / 2, tz, 10, th, len + 0.4, 0x7e766a, { phys: false, ry: ry, tile: 3 });
    for (let j = 0; j < 6; j++) quad('facade', ...[vsAt(am, VS.R + 6.95)[0]], y + 8.6 + j * 3.2, vsAt(am, VS.R + 6.95)[1], len, 3.2, ry - Math.PI / 2, cellUV(j === 5 ? FACADE.small : FACADE.sashA), 0x8a8274);
    if (i % 3 === 1) B.add('roof', ROOF, M4(tx, y + 7 + th, tz, 6, 5, 4, 0, ry + Math.PI / 2), 0x6e727a, {}); // gables against the sky
    const [ix, iz] = vsAt(am, VS.R - 9), ih = 16 + (i % 2) * 4; // inner side
    solid('stone', ix, y + ih / 2, iz, 9, ih, len + 0.3, 0x8a8274, { phys: false, ry: ry, tile: 3 });
    for (let j = 0; j < 5; j++) quad('facade', ...[vsAt(am, VS.R - 4.45)[0]], y + 1.6 + j * 3.2, vsAt(am, VS.R - 4.45)[1], len, 3.2, ry + Math.PI / 2, cellUV(j === 0 ? FACADE.rustic : FACADE.sashA), 0x9a9080);
  }
  { const [sx, sz] = vsAt(A1 * 0.9, VS.R + 14); B.add('stone', BOX, M4(sx, 34, sz, 4, 14, 4), 0x6e665c, {}); B.add('flat', new THREE.ConeGeometry(2.4, 14, 8), M4(sx, 48, sz, 1, 1, 1), 0x5c564e, {}); } // spire above the street
  boxBody(VS.cx + VS.R * Math.cos(0.24), 5, VS.cz + VS.R * Math.sin(0.24), 12, 10, 0.5, { ry: -0.24 }); // the climb is walkable only a short way
  sign('VICTORIA STREET', -55.2, 3.6, F - 0.2, 2.6, 0.36, Math.PI / 2, '#f4f1ea', '#111', 'bold 60px Arial', '#111');

  // ---------- the Castle on its crag, behind and above the north terrace ----------
  buildCastle(B, 4, 128, mulberry32(1544), 34);
  for (let i = 0; i < 70; i++) { // Old Town roofs climbing towards the rock between the terrace and the crag
    const x = -60 + rand() * 130, z = F + GM.DEPTH + 2 + rand() * 50, base = (z - F - 14) * 0.35, h = 16 + rand() * 8, w = 7 + rand() * 8, d = 6 + rand() * 6;
    B.add('stone', BOX, M4(x, base + h / 2, z, w, h, d), new THREE.Color().setHSL(0.09, 0.18, 0.42 + rand() * 0.14), { tile: 4 });
    B.add('roof', ROOF, M4(x, base + h, z, w, 2.6, d), 0x6e727a, {});
  }
  for (let i = 0; i < 40; i++) { const x = -70 + rand() * 140, z = -F - GM.DEPTH - 16 - rand() * 40, h = 14 + rand() * 6; if (x > 14 && x < 46 && z > -50) continue; // roofs to the south (behind the back court)
    B.add('stone', BOX, M4(x, h / 2, z, 9, h, 8), new THREE.Color().setHSL(0.09, 0.15, 0.45 + rand() * 0.1), { tile: 4 }); B.add('roof', ROOF, M4(x, h, z, 9, 2.5, 8), 0x6e727a, {}); }

  // ---------- square furniture ----------
  function lamppost(x, z, target = null) {
    const b = cyl('metal', x, 2.1, z, 0.07, 0.11, 4.2, IRON, { seg: 8, target });
    cyl('metal', x, 0.25, z, 0.16, 0.18, 0.5, IRON, { phys: false, seg: 8 }); cyl('lamp', x, 4.4, z, 0.22, 0.12, 0.45, 0xffffff, { phys: false, seg: 6 }); cyl('metal', x, 4.7, z, 0.02, 0.26, 0.2, IRON, { phys: false, seg: 6 });
    return b; }
  for (let x = -56; x <= 56; x += 14) for (const s of [-1, 1]) if (!(s < 0 && Math.abs(x - 28) < 2)) lamppost(x, s * 20.9);
  for (let x = -57; x <= 57; x += 6) for (const s of [-1, 1]) { cyl('metal', x, 0.45, s * 15.75, 0.11, 0.13, 0.9, IRON, { seg: 8 }); cyl('flat', x, 0.93, s * 15.75, 0.12, 0.12, 0.08, 0xc9a43a, { phys: false, seg: 8 }); } // bollards
  function tree(x, z) { cyl('wood', x, 1.6, z, 0.16, 0.22, 3.2, 0x5a4330, { seg: 7 }); for (const [dx, dy, dz, r] of [[0, 4.4, 0, 1.9], [0.9, 3.8, 0.4, 1.3], [-0.8, 3.9, -0.5, 1.4]]) B.add('flat', new THREE.IcosahedronGeometry(r, 0), M4(x + dx, dy, z + dz, 1, 0.85, 1), pick([0x4f6b3a, 0x5a7a40, 0x46602f]), {});
    solid('metal', x, 0.02, z, 1.4, 0.04, 1.4, 0x2a2b29, { phys: false }); }
  for (const [x, z] of [[-42, -11], [-46, 10], [45, -11], [54, 9], [12, 12]]) tree(x, z);
  function cafe(x, z, w, d, col) { // railed seating enclosure: simple colliders on the rails, tables/chairs/parasols visual only
    for (const [cx, cz, ww, dd] of [[x, z - d / 2, w, 0.08], [x, z + d / 2, w, 0.08], [x - w / 2, z, 0.08, d], [x + w / 2, z, 0.08, d]]) {
      solid('metal', cx, 0.9, cz, ww, 0.05, dd, 0x1f3a2a, { phys: false }); solid('metal', cx, 0.15, cz, ww, 0.05, dd, 0x1f3a2a, { phys: false });
      const n = Math.round(Math.max(ww, dd) / 0.25); for (let k = 0; k <= n; k++) { const f = k / n - 0.5; solid('metal', cx + (ww > dd ? f * ww : 0), 0.52, cz + (dd > ww ? f * dd : 0), 0.025, 0.75, 0.025, 0x1f3a2a, { phys: false }); }
      boxBody(cx, 0.5, cz, ww, 1.0, dd, { surface: 'metal' }); }
    for (let i = 0; i < Math.floor(w / 2.4); i++) for (let j = 0; j < Math.floor(d / 2.4); j++) { const tx = x - w / 2 + 1.2 + i * 2.4, tz = z - d / 2 + 1.2 + j * 2.4;
      cyl('metal', tx, 0.38, tz, 0.04, 0.04, 0.75, 0x333333, { phys: false, seg: 5 }); cyl('flat', tx, 0.76, tz, 0.38, 0.38, 0.03, 0xe8e2d4, { phys: false, seg: 10 });
      for (const [dx, dz] of [[-0.55, 0], [0.55, 0]]) solid('wood', tx + dx, 0.45, tz + dz, 0.4, 0.05, 0.4, 0x6b4a2b, { phys: false });
      cyl('flat', tx, 1.6, tz, 0.02, 0.02, 1.7, 0xdddddd, { phys: false, seg: 4 }); B.add('flat', new THREE.ConeGeometry(1.1, 0.5, 8), M4(tx, 2.4, tz, 1, 1, 1), col, {}); }
  }
  cafe(25, -6, 7.2, 4.8, 0xc8b89a); cafe(-15, 9, 7.2, 4.8, 0xa82a24); cafe(40, 8, 4.8, 4.8, 0xefe3c8);
  { const x = -47, z = 20.6; solid('flat', x, 1.25, z, 1.0, 2.5, 1.0, 0xc8102e, { surface: 'glass' }); solid('flat', x, 2.6, z, 1.1, 0.2, 1.1, 0xc8102e, { phys: false }); // red phone box
    for (const s of [-1, 1]) quad('glass', x, 1.5, z + s * 0.51, 0.7, 1.4, s > 0 ? 0 : Math.PI, null, 0xffffff); sign('TELEPHONE', x, 2.35, z - 0.52, 0.8, 0.14, Math.PI, '#111', '#fff', 'bold 50px Arial'); }
  { const mx = -50, mz = -2, R = 2.0; cyl('stone', mx, 0.3, mz, R, R + 0.05, 0.6, 0xc9b896, { seg: 20 }); cyl('cobble', mx, 0.61, mz, R - 0.15, R - 0.15, 0.02, 0x8a8478, { phys: false, seg: 20 }); // Covenanters'-style memorial
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; cyl('metal', mx + Math.cos(a) * (R - 0.05), 0.95, mz + Math.sin(a) * (R - 0.05), 0.014, 0.014, 0.7, IRON, { phys: false, seg: 4 }); }
    solid('stone', mx, 1.0, mz, 0.7, 0.8, 0.2, 0xd8c7a6, { phys: false }); quad('atlas', mx, 1.1, mz + 0.11, 0.55, 0.35, 0, atlas.sign('IN MEMORY', '#d8c7a6', '#4a3a20', 0.55 / 0.35, 'bold 40px Georgia', '#d8c7a6')); }
  { const x = 30, z = 17.6; solid('flat', x, 1.6, z, 11, 2.9, 2.5, 0x8a1c2a, { surface: 'metal' }); solid('flat', x, 2.2, z, 11.05, 0.9, 2.55, 0xefe9de, { phys: false }); // parked bus
    solid('glass', x, 2.25, z - 1.28, 10.4, 0.8, 0.02, 0xffffff, { phys: false }); for (const dx of [-3.8, 3.6]) for (const s of [-1, 1]) cyl('flat', x + dx, 0.45, z + s * 1.2, 0.45, 0.45, 0.3, 0x1a1a1a, { phys: false, seg: 10 }); }
  for (const [x, col] of [[-36, 0x2a4a6a], [55, 0xb8b8b4]]) { const z = -17.6; solid('flat', x, 0.65, z, 4.2, 0.8, 1.8, col, { surface: 'metal' }); solid('glass', x + 0.2, 1.3, z, 2.2, 0.55, 1.6, 0xffffff, { phys: false }); for (const dx of [-1.3, 1.3]) for (const s of [-1, 1]) cyl('flat', x + dx, 0.32, z + s * 0.85, 0.32, 0.32, 0.2, 0x1a1a1a, { phys: false, seg: 10 }); } // parked cars
  const aboard = (x, z, s, txt, bg) => { solid('wood', x, 0.45, z, 0.55, 0.9, 0.06, 0x2E2F2C, { phys: false, rx: s * 0.12 }); quad('atlas', x, 0.5, z - s * 0.04, 0.48, 0.6, s > 0 ? Math.PI : 0, atlas.fascia(txt, null, bg, '#EFE3C8', 0.8)); };
  aboard(-30, 20.2, 1, 'LIVE MUSIC', '#1d3b2a'); aboard(20, -20.2, -1, 'SOUP & A ROLL', '#C77B2E'); aboard(4, 20.2, 1, 'FRESH BREAD', '#2f4a2a'); aboard(-55, -20.2, -1, 'OPEN', '#a82a24');
  for (const [x, z] of [[-41.6, 21.3], [-41, 21.3]]) { cyl('wood', x, 0.45, z, 0.3, 0.27, 0.9, 0x6b4a2b, { seg: 10 }); cyl('metal', x, 0.75, z, 0.305, 0.305, 0.05, 0x2a2b29, { phys: false, seg: 10 }); } // pub barrels
  for (const x of [-4, -2.8]) { for (const dx of [-0.3, 0.3]) cyl('metal', x + dx, 0.4, -20.9, 0.025, 0.025, 0.8, 0x2a2b29, { phys: false, seg: 5 }); solid('metal', x, 0.8, -20.9, 0.65, 0.05, 0.05, 0x2a2b29, { phys: false }); } // bike stands
  sign('GRASSMARKET', -20, 4.2, F - 0.18, 2.4, 0.36, Math.PI, '#f4f1ea', '#111', 'bold 60px Arial', '#111');
  // invisible boundary (complete box) - the terraces are solid too
  for (const [x, z, w, d] of [[0, -F - GM.DEPTH - 15, 160, 1], [15, F + 1, 130, 1], [X + 1, 0, 1, 120], [-X - 1, 0, 1, 120]]) boxBody(x, 6, z, w, 12, d);
  boxBody(-51.3, 6, F + 4, 1, 12, 8); boxBody(-62.5, 6, F + 4, 1, 12, 8); // Victoria Street: walk a few metres up, then the stop below

  // ---------- targets (same IDs as before, relocated) ----------
  function dark(x, y0, z, w, d, h, th) { const k = 0x161a17, e = th / 2 + 0.006, iw = w - th - 0.012, id = d - th - 0.012;
    solid('flat', x, y0 + 0.006, z, iw, 0.01, id, k, { phys: false }); solid('flat', x - w / 2 + e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false }); solid('flat', x + w / 2 - e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false });
    solid('flat', x, y0 + h / 2, z - d / 2 + e, iw, h - 0.03, 0.006, k, { phys: false }); solid('flat', x, y0 + h / 2, z + d / 2 - e, iw, h - 0.03, 0.006, k, { phys: false }); }
  const ringGeo = new THREE.RingGeometry(1, 1.1, 32);
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m;
    if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  { // 1. Communal bin on the south pavement (opening faces the square)
    const x = 10, z = -20.4, w = 1.5, d = 1.0, h = 1.15, y = 0, th = 0.06, c = 0x3f5a3f;
    solid('flat', x, y + 0.05, z, w, 0.1, d, c); solid('flat', x - w / 2, y + h / 2, z, th, h, d, c); solid('flat', x + w / 2, y + h / 2, z, th, h, d, c);
    solid('flat', x, y + h / 2, z - d / 2, w, h, th, c); solid('flat', x, y + h / 2, z + d / 2, w, h, th, c);
    solid('flat', x, y + h + 0.45, z - d / 2 - 0.12, w, 0.9, 0.05, 0x2f4a2f, { phys: false, rx: 0.3 }); sign('GENERAL WASTE', x, y + 0.75, z + d / 2 + 0.04, 0.9, 0.18, 0, '#2f4a2f', '#fff', 'bold 60px Arial');
    dark(x, y + 0.1, z, w, d, h - 0.1, th);
    addTarget({ id: 'bin', name: 'Communal Bin', hint: 'get it IN the bin', points: 150, kind: 'zone', openTop: true, pos: V(x, y, z), ringR: 1.3, stand: V(x, 0, z + 6.1), aim: V(x, y + 0.6, z),
      zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)), lines: ['Straight in the bucket! The cooncil thanks you.', 'Recycling? Close enough.', 'Bin there, done that.'] }); }
  { // 2. Memorial bench against the south terrace
    const x = -10, z = -21.2, c = 0x8a6a48;
    solid('wood', x, 0.45, z, 1.9, 0.08, 0.5, c, { target: 'bench', tile: 1 }); solid('wood', x, 0.8, z - 0.25, 1.9, 0.6, 0.08, c, { target: 'bench', tile: 1 });
    for (const dx of [-0.8, 0.8]) solid('metal', x + dx, 0.22, z, 0.08, 0.44, 0.45, IRON, { target: 'bench' }); boxBody(x, 0.5, z - 0.05, 1.9, 0.9, 0.6, { target: 'bench' });
    sign('In memory of Jimmy, who loved this square', x, 0.95, z - 0.2, 1.2, 0.12, 0, '#d4af37', '#3a2a10', 'bold 40px Georgia');
    addTarget({ id: 'bench', name: 'Memorial Bench', hint: 'hit the bench', points: 50, kind: 'hit', pos: V(x, 0, z), ringR: 1.2, stand: V(x, 0, z + 3.3), aim: V(x, 0.4, z), lines: ["Jimmy would've been proud.", 'Thunk! Best seat in the Grassmarket.', 'That bench has seen worse.'] }); }
  { // 3. Traffic cone
    const x = 6, z = -2, parts = [];
    const add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.ConeGeometry(0.2, 0.7, 12), new THREE.Matrix4(), 0xff6a00); add(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 12), new THREE.Matrix4().makeTranslation(0, 0.05, 0), 0xffffff); add(new THREE.BoxGeometry(0.45, 0.04, 0.45), new THREE.Matrix4().makeTranslation(0, -0.33, 0), 0x222222);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 0.6, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.35, 0.16)) }); b.position.set(x, 0.36, z); b.userData = { target: 'cone' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'cone', name: 'Traffic Cone', hint: 'knock it over', points: 75, kind: 'topple', body: b, pos: V(x, 0, z), stand: V(x, 0, z - 3.6), aim: V(x, 0.3, z), lines: ['Cone down! Somewhere in Glasgow, a statue weeps.', 'Health and safety has left the chat.', 'That cone had it coming.'] }); }
  { // 4. Lamppost with a blue ribbon (north pavement)
    const x = 18, z = 20.6; lamppost(x, z, 'lamp'); solid('flat', x, 2.4, z - 0.12, 0.25, 0.6, 0.03, 0x1e4fa8, { phys: false });
    addTarget({ id: 'lamp', name: 'Lamppost (blue ribbon)', hint: 'ping the post', points: 100, kind: 'hit', pos: V(x, 0, z), ringR: 0.8, stand: V(x, 0, z - 3.6), aim: V(x, 0.6, z), lines: ['PING! Off the post!', 'Clang! The whole square heard that.', 'Woodwork! ...well, ironwork.'] }); }
  // 5. Kicker's Close (kick it through the pend in the south terrace)
  addTarget({ id: 'close', name: "Kicker's Close", hint: 'kick it through the close', points: 125, kind: 'zone', pos: V(30, 0, -F + 0.6), ringR: 0.7, stand: V(30, 0, -F + 5.6), aim: V(30, 0.3, -F - 6),
    zone: new THREE.Box3(V(29.2, 0, -F - 9), V(30.8, 3, -F - 4)), minSpeed: 1, lines: ['Threaded the needle! Right through the close.', 'Through the pend like a ghost on a tour.', 'Sneaky. Very Old Town.'] });
  { // 6. Wee dug statue in the back court
    const x = 30, z = -42, dog = 0x3d3a33;
    solid('stone', x, 0.6, z, 1.2, 1.2, 1.2, 0x9c8a72, { target: 'dug', tile: 1.5 }); solid('metal', x, 1.5, z, 0.75, 0.3, 0.35, dog, { phys: false }); solid('metal', x + 0.42, 1.75, z, 0.3, 0.28, 0.28, dog, { phys: false });
    for (const [dx, dz] of [[-0.25, -0.12], [-0.25, 0.12], [0.25, -0.12], [0.25, 0.12]]) solid('metal', x + dx, 1.28, z + dz, 0.08, 0.18, 0.08, dog, { phys: false });
    boxBody(x, 1.0, z, 1.24, 2.0, 1.24, { target: 'dug' }); sign('A FAITHFUL WEE DUG', x, 0.8, z + 0.61, 1.0, 0.16, 0, '#d4af37', '#3a2a10', 'bold 44px Georgia');
    addTarget({ id: 'dug', name: 'Wee Dug Statue', hint: 'hit the statue (through the close, in the back court)', points: 125, kind: 'hit', pos: V(x, 0, z), ringR: 1.4, stand: V(x, 0, z + 3.5), aim: V(x, 0.5, z), lines: ['Sorry, pal! Rub his nose for luck.', "Bobby's cousin did not appreciate that.", 'Good boy. Didnae even flinch.'] }); }
  { // 7. Bakery door (marked) in the north terrace
    const x = 12, z = F; solid('wood', x, 1.1, z - 0.24, 1.1, 2.2, 0.1, 0x8e1c1c, { target: 'door' }); quad('atlas', x, 1.1, z - 0.3, 1.1, 2.2, Math.PI, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'door', name: 'Bakery Door', hint: 'strike the marked door', points: 75, kind: 'hit', pos: V(x, 0, z - 0.8), ringR: 0.9, stand: V(x, 0, z - 4.7), aim: V(x, 0.6, z - 0.3), lines: ["Knock knock! 'We're SHUT, son.'", 'Mrs Mackay is coming oot. Run.', 'One steak bake, special delivery.'] }); }
  { // 8. Pillar box (north pavement)
    const x = -20, z = 20.8; cyl('flat', x, 0.75, z, 0.3, 0.3, 1.5, 0xc8102e, { seg: 14, target: 'post' }); cyl('flat', x, 1.55, z, 0.34, 0.34, 0.12, 0xc8102e, { phys: false, seg: 14 }); solid('flat', x, 1.15, z - 0.28, 0.3, 0.06, 0.08, 0x1a1a1a, { phys: false });
    addTarget({ id: 'post', name: 'Pillar Box', hint: 'hit the postbox', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 0.8, stand: V(x, 0, z - 2.6), aim: V(x, 0.6, z), lines: ['First class!', 'Signed for. Delivered.', "Royal Mail: 'Is this a parcel?'"] }); }
  { // 9. Busker's open guitar case (roll it in from the +x side)
    const x = -2, z = 6, cm = 0x222222;
    solid('flat', x, 0.03, z, 1.3, 0.04, 0.6, 0x7a1030, { phys: false }); solid('flat', x, 0.06, z - 0.32, 1.3, 0.12, 0.04, cm); solid('flat', x, 0.06, z + 0.32, 1.3, 0.12, 0.04, cm); solid('flat', x - 0.65, 0.15, z, 0.04, 0.3, 0.6, cm);
    solid('flat', x, 0.25, z + 0.55, 1.3, 0.5, 0.04, cm, { phys: false, rx: 0.4 }); quad('atlas', x, 0.06, z, 0.8, 0.14, 0, atlas.sign('TIPS WELCOME', '#7a1030', '#f1d98a', 0.8 / 0.14), 0xffffff, { rx: -Math.PI / 2 });
    addTarget({ id: 'case', name: "Busker's Case", hint: 'roll it into the case (open end faces the cafe)', points: 100, kind: 'zone', pos: V(x, 0, z), ringR: 1.0, stand: V(x + 4, 0, z), aim: V(x, 0.1, z),
      zone: new THREE.Box3(V(x - 0.62, 0, z - 0.3), V(x + 0.65, 0.4, z + 0.3)), maxSpeed: 6, lines: ["Busker: 'Cheers pal, but I wanted a fiver.'", 'Into the case! Encore!', "That's mair than he made all day."] }); }
  { // 10. Police box in the square
    const x = -30, z = -8, pb = 0x123a7a; solid('flat', x, 1.3, z, 1.3, 2.6, 1.3, pb, { target: 'tardis' }); solid('flat', x, 2.75, z, 1.1, 0.3, 1.1, pb, { phys: false });
    sign('POLICE BOX', x + 0.66, 2.35, z, 1.1, 0.2, Math.PI / 2, '#111', '#fff', 'bold 60px Arial'); for (const k of [-0.3, 0.3]) solid('glass', x + 0.66, 1.8, z + k, 0.02, 0.4, 0.4, 0xffffff, { phys: false });
    addTarget({ id: 'tardis', name: 'Police Box', hint: 'hit the police box', points: 75, kind: 'hit', pos: V(x + 0.9, 0, z), ringR: 1.0, stand: V(x + 3.6, 0, z), aim: V(x + 0.6, 0.6, z), lines: ["It's bigger on the inside, but you hit the outside.", 'Polis! ...no, it\'s empty. Phew.', 'Exterminate! Wait, wrong show.'] }); }
  { // 11. Builders' skip on the south edge road
    const x = 40, z = -17.4, w = 2.6, d = 1.6, h = 0.9, th = 0.08, sm = 0xe0a400, y = 0;
    solid('flat', x, y + 0.05, z, w, 0.1, d, sm); solid('flat', x - w / 2, y + h / 2, z, th, h, d, sm); solid('flat', x + w / 2, y + h / 2, z, th, h, d, sm); solid('flat', x, y + h / 2, z - d / 2, w, h, th, sm); solid('flat', x, y + h / 2, z + d / 2, w, h, th, sm);
    solid('flat', x + 0.4, y + 0.25, z - 0.2, 0.8, 0.3, 0.5, 0x6b5a45, { phys: false }); dark(x, y + 0.1, z, w, d, h - 0.1, th);
    addTarget({ id: 'skip', name: "Builders' Skip", hint: 'chip it into the skip', points: 150, kind: 'zone', openTop: true, pos: V(x, y, z), ringR: 1.8, stand: V(x, y, z + 6), aim: V(x, y + 0.5, z),
      zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)), lines: ['In the skip! Tidy.', "Builder: 'Oi! That's ma lunch in there!'", 'Chipped in like a pro.'] }); }

  // ---------- pigeons ----------
  const groups = [[3, 0, -5], [-25, 0, 2], [35, 0, 13], [30, 0, -38], [-40, 0, -4]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });

  // ---------- materials + build ----------
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  { const m = materials.flat.clone(); m.map = tarmacTexture(); materials.tarmac = m; }
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [0, -10, 180, -4], midstreet: [0, 0, 180, 4], terrace: [-50, 10, 140, 6], castle: [-5, -14, 180, 18] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
