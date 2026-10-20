import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from './batch.js';
import { buildCastle } from './castle.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, pbrMaps } from './textures.js';

// Layout (metres). Lower street (Grassmarket-style) runs along +Z, z -50..30.
// At z=30 the street BENDS right by BEND.yaw and climbs (Victoria-Street-style) 3.6 m over 20 m
// to an upper terrace. North-section coordinates are "local": origin at the bend pivot, local +z uphill.
export const PAVE = 0.08;
export const RAMP = { len: 20, rise: 3.6 };
export const BEND = { pivotZ: 30, yaw: 0.32 };
export const NORTH = new THREE.Matrix4().makeTranslation(0, 0, BEND.pivotZ).multiply(new THREE.Matrix4().makeRotationY(BEND.yaw));
export const northToWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(NORTH);
export const rampHeight = (zl) => RAMP.rise * THREE.MathUtils.clamp(zl / RAMP.len, 0, 1);

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildWorld(scene, world, mats, P) {
  const rand = mulberry32(1707); // deterministic layout (tests + screenshots)
  const B = new Batcher(), atlas = new SignAtlas(), facadeTex = facadeAtlas();
  const targets = [], dynamics = [];
  const ID = new THREE.Matrix4();
  let FR = ID, FYAW = 0; // current section frame
  const inNorth = (fn) => { FR = NORTH; FYAW = BEND.yaw; fn(); FR = ID; FYAW = 0; };
  const W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(FR);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {};
  const CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(x, y, z), q, V(sx, sy, sz)); };

  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, mass = 0 } = {}) {
    const b = new CANNON.Body({ mass, material, shape });
    const p = W(x, y, z); b.position.set(p.x, p.y, p.z);
    eul.set(rx, ry + FYAW, rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
    if (target) b.userData = { target };
    world.addBody(b); return b;
  }
  const boxBody = (x, y, z, w, h, d, o = {}) => body(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), x, y, z, o);
  // visual + optional physics box. key = material bucket.
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, grime = 0, target = null, material } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile, grime, frame: FR });
    return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, material }) : null;
  }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1), color, { frame: FR });
    return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target }) : null;
  }
  function quad(key, x, y, z, w, h, ry, uvRect, color = 0xffffff, { rx = 0, grime = 0 } = {}) {
    B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, frame: FR });
  }
  const sign = (text, x, y, z, w, h, ry, bg, fg, font, border) => quad('atlas', x, y, z, w, h, ry, atlas.sign(text, bg, fg, w / h, font, border));
  const plaque = (text, x, y, z, w, ry) => sign(text, x, y, z, w, 0.36, ry, '#f4f1ea', '#111', 'bold 60px Arial, sans-serif', '#111');

  // ---------- tenements ----------
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const STYLES = {
    classic: { upper: [FACADE.sashA, FACADE.sashA, FACADE.sashA, FACADE.lit, FACADE.flowers, FACADE.sashB], top: [FACADE.small, FACADE.small, FACADE.smallLit], ground: [FACADE.rustic, FACADE.door, FACADE.rustic], tint: [0xf2e6d2, 0xe9dcc4, 0xfff4e0] },
    grand: { upper: [FACADE.sashB, FACADE.pediment, FACADE.sashB, FACADE.triple, FACADE.lit], top: [FACADE.sashA, FACADE.small], ground: [FACADE.arch, FACADE.doorGreen, FACADE.rustic], tint: [0xfaf0dc, 0xefe2c8] },
    sooty: { upper: [FACADE.sashA, FACADE.sashA, FACADE.sashB, FACADE.sashA, FACADE.blind, FACADE.lit], top: [FACADE.small], ground: [FACADE.door, FACADE.rustic], tint: [0x9a8e7c, 0xa79a86] },
    harled: { upper: [FACADE.small, FACADE.sashA, FACADE.smallLit], top: [FACADE.small], ground: [FACADE.doorRed, FACADE.plain], tint: [0xffffff], harled: true },
  };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  function facadeFace(cx, cz, nx, nz, L, h, base, st, tint, floorH, groundSkip) {
    const nb = Math.max(1, Math.round(L / 3.3)), bw = L / nb, nf = Math.max(1, Math.round(h / floorH)), fh = h / nf;
    const ax = -nz, az = nx, ry = Math.atan2(nx, nz);
    const rowStyle = []; for (let j = 0; j < nf; j++) rowStyle.push(j === 0 ? null : j === nf - 1 ? pick(st.top) : pick(st.upper));
    for (let i = 0; i < nb; i++) for (let j = 0; j < nf; j++) {
      const s = (i + 0.5) * bw - L / 2, x = cx + ax * s, z = cz + az * s, y = base + (j + 0.5) * fh;
      let c = j === 0 ? (groundSkip && groundSkip(x, z) ? FACADE.plain : pick(st.ground)) : rand() < 0.75 ? rowStyle[j] : pick(st.upper);
      if (st.harled && rand() < 0.2) c = FACADE.plain;
      const shade = 0.9 + rand() * 0.12;
      const col = new THREE.Color(tint).multiplyScalar(shade);
      quad('facade', x, y, z, bw, fh, ry, cellUV(c), col, { grime: st.name === 'harled' ? 0.15 : 0.32 });
    }
  }
  // building footprint x0..x1, z0..z1 (section-local). street: +1 if street is at +x side (west row), -1 for east row.
  function tenement(x0, x1, z0, z1, h, style, { base = 0, roof = 'pitch', street = 1, floorH = 3.2 + rand() * 0.5, groundSkip = null, chimneys = true } = {}) {
    const st = { ...STYLES[style], name: style }, tint = pick(st.tint), w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = base + h;
    boxBody(cx, base + h / 2, cz, w, h, d);
    const fx = street > 0 ? x1 : x0;
    facadeFace(fx, cz, street, 0, d, h, base, st, tint, floorH, groundSkip); // street front
    facadeFace(street > 0 ? x0 : x1, cz, -street, 0, d, h, base, st, tint, floorH); // back
    facadeFace(cx, z0, 0, -1, w, h, base, st, tint, floorH); facadeFace(cx, z1, 0, 1, w, h, base, st, tint, floorH);
    // cornice + string course, gutter, drainpipe on the street front
    const sx = fx + street * 0.12;
    solid('stone', sx, top - 0.25, cz, 0.3, 0.35, d, 0xe6d6b8, { phys: false, tile: 2.5 });
    solid('stone', fx + street * 0.06, base + floorH, cz, 0.14, 0.2, d, 0xd8c7a6, { phys: false, tile: 2.5 });
    solid('metal', fx + street * 0.3, top + 0.02, cz, 0.16, 0.14, d, 0x22252a, { phys: false });
    const dpz = z0 + 0.25 + (rand() < 0.5 ? 0 : d - 0.5);
    cyl('metal', fx + street * 0.18, base + h / 2, dpz, 0.055, 0.055, h, 0x25282d, { phys: false, seg: 6 });
    // roof
    if (roof === 'pitch') {
      const rh = Math.min(4.5, w * 0.48);
      B.add('roof', ROOF, M4(cx, top, cz, w + 0.4, rh, d + 0.05), 0xc8ccd4, { tile: 2.2, frame: FR });
      if (rand() < 0.6) { const dz = z0 + d * (0.3 + rand() * 0.4); // dormer
        solid('stone', fx - street * 1.1, top + 0.9, dz, 1.4, 1.8, 1.8, 0xe2d2b4, { phys: false, tile: 2 });
        quad('facade', fx - street * 0.39, top + 0.9, dz, 1.2, 1.4, Math.atan2(street, 0), cellUV(FACADE.small), 0xffffff);
        B.add('roof', ROOF, M4(fx - street * 1.1, top + 1.8, dz, 1.6, 0.8, 2.0, 0, Math.PI / 2), 0xc8ccd4, { tile: 2.2, frame: FR }); }
    } else { // gable facing the street, crow-stepped
      const rh = Math.min(6, d * 0.55);
      B.add('roof', ROOF, M4(cx, top, cz, d, rh, w, 0, Math.PI / 2), 0xc8ccd4, { tile: 2.2, frame: FR });
      const n = 6;
      for (let k = 0; k < n; k++) { const ww = d * (1 - k / n) + 0.25, hh = rh / n;
        solid('stone', fx - street * 0.2, top + (k + 0.5) * hh, cz, 0.45, hh, ww, 0xe8d8ba, { phys: false, tile: 2 });
        solid('stone', fx - street * 0.2, top + (k + 1) * hh + 0.05, cz - ww / 2 + 0.15, 0.5, 0.1, 0.4, 0xd9c6a4, { phys: false });
        solid('stone', fx - street * 0.2, top + (k + 1) * hh + 0.05, cz + ww / 2 - 0.15, 0.5, 0.1, 0.4, 0xd9c6a4, { phys: false }); }
      quad('facade', fx + street * 0.03, top + rh * 0.3, cz, 1.3, 1.5, Math.atan2(street, 0), cellUV(FACADE.small), 0xffffff);
    }
    // chimney stacks on the party walls
    if (chimneys) for (const zz of [z0 + 0.6, z1 - 0.6]) { if (rand() < 0.25) continue;
      const ch = 1.8 + rand() * 1.4, xx = cx + (rand() - 0.5) * w * 0.3;
      solid('stone', xx, top + (ch + 1.5) / 2, zz, 2.4, ch + 1.5, 0.9, 0xb5a58a, { phys: false, tile: 2, grime: 0 });
      for (let k = -0.75; k <= 0.76; k += 0.5) cyl('flat', xx + k, top + ch + 1.75, zz, 0.12, 0.15, 0.5, 0xa65a3a, { phys: false, seg: 6 });
    }
  }

  // ---------- ground ----------
  const ground = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
  B.add('paving', QUAD, M4(0, -0.01, 0, 300, 300, 1, -Math.PI / 2), 0x9d968b, { tile: 2.4 });
  B.add('cobble', QUAD, M4(0, 0.005, -10, 9.1, 80, 1, -Math.PI / 2), 0xc6c4be, { tile: 1.8 }); // v2.5 granite-grey setts
  for (const s of [-1, 1]) {
    B.add('paving', QUAD, M4(s * 5.85, PAVE, -10, 2.3, 80, 1, -Math.PI / 2), 0xd9cfbd, { tile: 1.5 }); // flagstones
    solid('stone', s * 4.6, PAVE / 2, -10, 0.3, PAVE + 0.02, 80, 0xa49c90, { phys: false, tile: 1 }); // kerbstones
    const pv = new CANNON.Body({ mass: 0, material: mats.kerb, shape: new CANNON.Box(new CANNON.Vec3(1.125, 0.55, 40)) });
    pv.position.set(s * 5.875, PAVE - 0.55, -10); world.addBody(pv);
    const th = s * Math.atan2(PAVE, 0.3), kb = new CANNON.Body({ mass: 0, material: mats.kerb, shape: new CANNON.Box(new CANNON.Vec3(0.17, 0.05, 40)) });
    kb.quaternion.setFromEuler(0, 0, th); kb.position.set(s * 4.6 + Math.sin(th) * 0.05, PAVE / 2 - Math.cos(th) * 0.05, -10); world.addBody(kb);
  }
  // north section: slope + terrace (cobbled)
  inNorth(() => {
    const L = Math.hypot(RAMP.len, RAMP.rise), a = Math.atan2(RAMP.rise, RAMP.len);
    const rc = [0, RAMP.rise / 2 - 0.75 * Math.cos(a), RAMP.len / 2 + 0.75 * Math.sin(a)];
    boxBody(rc[0], rc[1], rc[2], 14, 1.5, L, { rx: -a });
    B.add('cobble', QUAD, M4(0, RAMP.rise / 2 + 0.005, RAMP.len / 2, 14, L, 1, -Math.PI / 2 - a), 0xd8d2c8, { tile: 1.8, frame: FR });
    solid('stone', 0, RAMP.rise / 2, 28, 14, RAMP.rise, 16, 0x9c8a72, { tile: 2.5 });
    B.add('cobble', QUAD, M4(0, RAMP.rise + 0.006, 28, 14, 16, 1, -Math.PI / 2), 0xd8d2c8, { tile: 1.8, frame: FR });
  });

  // ---------- buildings ----------
  const shopAt = (list) => (x, z) => list.some(([a, b]) => z > a && z < b);
  const westShops = [[-46, -40], [-30.5, -25], [-22, -14], [6, 14]], eastShops = [[-49, -43], [-32, -26], [1, 9], [12, 18]];
  // west row (street at +x side)
  tenement(-14, -7, -50, -39, 15, 'classic', { groundSkip: shopAt(westShops) });
  tenement(-14, -6.8, -39, -31, 19.5, 'grand', { roof: 'gable', groundSkip: shopAt(westShops) });
  tenement(-14, -7, -31, -24, 10.5, 'harled', { floorH: 3.4, groundSkip: shopAt(westShops) });
  tenement(-14, -7, -24, -10, 16, 'classic', { groundSkip: shopAt(westShops) });
  tenement(-14, -7, -8.5, 4, 17.5, 'grand', {});
  tenement(-14, -6.75, 4, 17, 13.5, 'classic', { roof: 'gable', groundSkip: shopAt(westShops) });
  tenement(-14, -7, 17, 28, 18, 'sooty', {});
  tenement(-15, -7.05, 28, 35, 23, 'grand', { roof: 'gable' }); // landmark corner at the bend
  // east row (street at -x side)
  tenement(7, 14, -50, -42, 13, 'classic', { street: -1, groundSkip: shopAt(eastShops) });
  tenement(6.8, 14, -42, -36, 20.5, 'grand', { street: -1, roof: 'gable' });
  tenement(6.75, 14, -36, -24, 15, 'sooty', { street: -1, groundSkip: shopAt(eastShops) });
  tenement(7, 14, -24, -12, 17, 'classic', { street: -1 });
  tenement(7, 14, -12, 0, 11.5, 'harled', { street: -1, floorH: 3.5 });
  tenement(7, 14, 0, 10, 16, 'classic', { street: -1, groundSkip: shopAt(eastShops) });
  tenement(7, 14, 10, 20, 19, 'grand', { street: -1, roof: 'gable', groundSkip: shopAt(eastShops) });
  tenement(7, 14, 20, 30, 14, 'classic', { street: -1 });
  // north section (Victoria Street side) in local coords
  inNorth(() => {
    tenement(-14, -7, 0, 10, 15, 'classic', { groundSkip: () => true });
    tenement(-14, -7, 10, 20, 21, 'grand', { roof: 'gable', groundSkip: () => true });
    tenement(-14, -7, 20, 28, 18, 'sooty', {});
    tenement(-14, -7, 28, 36, 20, 'classic', {});
    tenement(7, 14, 0, 10, 17, 'grand', { street: -1, groundSkip: () => true });
    tenement(7, 14, 10, 20, 13, 'harled', { street: -1, groundSkip: () => true });
    tenement(7, 14, 20, 28, 19, 'classic', { street: -1, roof: 'gable' });
    tenement(7, 14, 28, 36, 16, 'sooty', { street: -1 });
  });

  // ---------- Kicker's Close: a pend through the west row into a back court ----------
  solid('stone', -10.5, 9.85, -9.25, 7, 13.3, 1.5, 0xd5c3a3, { tile: 2.5, grime: 0 });
  quad('facade', -6.99, 6, -9.25, 1.5, 3.2, Math.PI / 2, cellUV(FACADE.small), 0xf0e4cc);
  quad('facade', -6.99, 9.6, -9.25, 1.5, 3.2, Math.PI / 2, cellUV(FACADE.small), 0xf0e4cc);
  for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8, r = 0.78; // stone arch voussoirs
    solid('stone', -6.9, 2.45 + Math.sin(a) * r, -9.25 + Math.cos(a) * r, 0.3, 0.34, 0.24, k === 4 ? 0xf2e3c4 : 0xd9c8a6, { phys: false, rx: -(a - Math.PI / 2) }); }
  solid('stone', -6.9, 3.35, -9.25, 0.3, 0.3, 2.2, 0xe5d5b6, { phys: false });
  plaque("KICKER'S CLOSE", -6.73, 3.75, -9.25, 2.0, Math.PI / 2);
  sign('ANNO 1687', -6.73, 1.85, -10.3, 0.55, 0.16, Math.PI / 2, '#d9c8a6', '#4a3a20', 'bold 60px Georgia', '#d9c8a6');
  B.add('lamp', BOX, M4(-10.5, 2.7, -9.25, 0.18, 0.25, 0.18), 0xffffff, {});
  B.add('cobble', QUAD, M4(-10.5, 0.006, -9.25, 7, 1.5, 1, -Math.PI / 2), 0x9a948a, { tile: 1.2 });
  // back court
  solid('stone', -24.5, 2, -9, 1, 4, 19, 0xcbb898, { tile: 2.5, grime: 0.3 });
  solid('stone', -19, 2, -18.5, 10, 4, 1, 0xcbb898, { tile: 2.5, grime: 0.3 });
  solid('stone', -19, 2, 0.5, 10, 4, 1, 0xcbb898, { tile: 2.5, grime: 0.3 });
  cyl('wood', -22.5, 1.2, -2.5, 0.12, 0.16, 2.4, 0x6b4a2b, { seg: 6 });
  B.add('flat', new THREE.IcosahedronGeometry(1.3, 0), M4(-22.5, 3.1, -2.5, 1, 1.2, 1), 0x4f6b3a, {});
  for (const z of [-15, -12.5]) { cyl('metal', -24, 1.6, z, 0.03, 0.03, 3.2, 0x333333, { phys: false, seg: 4 }); }
  solid('flat', -24, 2.9, -13.75, 0.02, 0.02, 2.5, 0xdddddd, { phys: false });
  [[-0.5, 0xe8e2d0], [0.3, 0x9cb7d8], [1.0, 0xd65f5f]].forEach(([dz, c]) => solid('flat', -24, 2.55, -13.75 + dz, 0.02, 0.6, 0.45, c, { phys: false })); // washing line

  // ---------- shopfronts (painted timber, gold lettering) ----------
  const shops = [
    ['W', -46, -40, 'THE LAST DRAP', '#1d3b2a', 0, 7, 'pub'], ['W', -30.5, -25, 'FLEMING & DAUGHTER', '#5b1b2a', 0, 7, 'iron'],
    ['W', -22, -14, 'THE BOW BARBER', '#1e2c4f', 0, 7, 'barber'], ['W', 6, 14, 'BOOKS & BAWBEES', '#3a2a1a', 0, 6.75, 'books'],
    ['E', -49, -43, 'THE WEST PORT FISH BAR', '#0f3d5c', 0, 7, 'cafe'], ['E', -32, -26, 'THE CORN EXCHANGE CAFE', '#C77B2E', 0, 6.75, 'cafe'],
    ['E', 1, 9, "MACKAY'S BAKERY", '#2f4a2a', 0, 7, 'bakery'], ['E', 12, 18, 'THE HALF MOON', '#5b1b2a', 0, 7, 'pub'],
  ];
  const northShops = [ // Victoria Street: famously colourful
    ['W', 1.5, 5.5, 'PAPER & PRESS', '#3b2350'], ['W', 6, 9.5, 'BOW CHEESE CO.', '#b8322a'], ['W', 11, 15, 'CANDLEMAKER', '#1d5c3a'], ['W', 15.5, 19, 'THE MAP ROOM', '#d9a520'],
    ['E', 1, 5, 'BRUSH & BROGUE', '#1f4f8f'], ['E', 5.5, 9.5, 'OLD TOWN RECORDS', '#8a2a5a'], ['E', 11, 14.5, 'HOOK & LINE', '#2a6f6f'], ['E', 15, 19, 'PURE DEAD BRILLIANT', '#c4572a'],
  ];
  // v2.5: shop-window displays drawn once per kind into the sign atlas and reused
  const dispCache = {};
  const DISP = { pub: ['#3a2416', '#c88a3a', '#e8c070'], iron: ['#3c3f42', '#8a8f94', '#c9a46a'], barber: ['#e8e4dc', '#b02a2a', '#2a4ab0'], books: ['#3a2a1a', '#7a3a2a', '#c9a46a'], cafe: ['#efe3c8', '#C77B2E', '#7a4a2a'], bakery: ['#f2e6cc', '#c88a3a', '#e8d2a0'], shop: ['#e8e2d4', '#2E9C8F', '#9A4E3C'] };
  const display = (kind) => (dispCache[kind] ||= atlas.draw(256, 192, (g, w, h) => { const [bg, a, b2] = DISP[kind] || DISP.shop;
    g.fillStyle = bg; g.fillRect(0, 0, w, h); const lit = g.createRadialGradient(w / 2, h * 0.3, 10, w / 2, h * 0.3, w * 0.7); lit.addColorStop(0, 'rgba(255,230,170,.45)'); lit.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = lit; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(8, 40 + r * 50, w - 16, 4); for (let i = 0; i < 9; i++) { g.fillStyle = (i + r) % 3 ? a : b2; const hh = 14 + ((i * 7 + r * 3) % 4) * 6; g.fillRect(14 + i * 26, 40 + r * 50 - hh, 18, hh); } }
    if (kind === 'barber') for (let y = 0; y < h; y += 16) { g.fillStyle = (y / 16) % 2 ? '#b02a2a' : '#fff'; g.fillRect(w - 22, y, 14, 8); }
    const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2E2F2C'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }));
  const hangingBasket = (x, y, z) => { solid('metal', x, y + 0.35, z, 0.02, 0.5, 0.02, 0x1c1f22, { phys: false }); B.add('flat', new THREE.IcosahedronGeometry(0.3, 0), M4(x, y, z, 1, 0.75, 1), 0x4a7a3a, { frame: FR });
    for (let k = 0; k < 5; k++) B.add('flat', BOX, M4(x + Math.cos(k * 1.3) * 0.26, y + 0.05 + (k % 2) * 0.08, z + Math.sin(k * 1.3) * 0.26, 0.1, 0.1, 0.1), [0xc62d4a, 0xf2c94c, 0xe86fb0, 0xffffff, 0x8a4ac6][k], { frame: FR }); };
  function shopfront(side, z0, z1, name, col, yb = 0, fronts = 7, kind = 'shop') {
    const s = side === 'W' ? -1 : 1, x = s * (fronts - 0.06), len = z1 - z0, zc = (z0 + z1) / 2, c = new THREE.Color(col);
    solid('wood', x, yb + 1.55, zc, 0.12, 3.1 + (yb ? 0.8 : 0), len, c, { phys: false, tile: 1.2 });
    solid('glass', x - s * 0.04, yb + 1.55, zc - len * 0.12, 0.08, 1.7, len * 0.55, 0xffffff, { phys: false });
    solid('wood', x - s * 0.08, yb + 0.35, zc, 0.06, 0.12, len - 0.2, c.clone().multiplyScalar(0.7), { phys: false });
    solid('wood', x - s * 0.1, yb + 2.85, zc, 0.12, 0.7, len + 0.1, c.clone().multiplyScalar(0.8), { phys: false });
    { const sw = Math.min(len - 0.3, 5.5); quad('atlas', x - s * 0.17, yb + 2.85, zc, sw, 0.6, -s * Math.PI / 2, atlas.fascia(name, null, col, '#f1d98a', sw / 0.6)); } // v2.0 painted fascia
    quad('atlas', x - s * 0.09, yb + 1.55, zc - len * 0.12, len * 0.53, 1.6, -s * Math.PI / 2, display(kind)); // v2.5 lit window display
    if (kind === 'pub' || kind === 'cafe' || kind === 'bakery') solid('flat', x - s * 0.55, yb + 2.42, zc, 1.0, 0.04, len - 0.4, new THREE.Color(col).lerp(new THREE.Color(0xefe3c8), 0.25), { phys: false, rz: s * 0.28 }); // canvas awning
    if (kind === 'pub') { solid('metal', x - s * 0.4, yb + 3.55, z0 + 0.4, 0.7, 0.04, 0.04, 0x1c1f22, { phys: false }); hangingBasket(x - s * 0.7, yb + 3.05, z0 + 0.4); }
  }
  for (const sp of shops) shopfront(...sp);
  // ---------- v2.5 clutter (small props: no colliders; barrels/memorial: simple colliders, off the main lines) ----------
  for (const [x, z] of [[-6.55, -40.6], [-6.55, -39.9], [6.5, 12.6]]) { cyl('wood', x, PAVE + 0.45, z, 0.3, 0.27, 0.9, 0x6b4a2b, { seg: 10 }); for (const y of [0.15, 0.75]) cyl('metal', x, PAVE + y, z, 0.305, 0.305, 0.05, 0x2a2b29, { phys: false, seg: 10 }); } // pub barrels
  const aboard = (x, z, s, txt, bg) => { solid('wood', x, PAVE + 0.45, z, 0.06, 0.9, 0.55, 0x2E2F2C, { phys: false, rz: s * 0.12 }); quad('atlas', x - s * 0.04, PAVE + 0.5, z, 0.48, 0.6, -s * Math.PI / 2, atlas.fascia(txt, null, bg, '#EFE3C8', 0.8)); };
  aboard(-6.45, -42.6, -1, 'LIVE MUSIC', '#1d3b2a'); aboard(6.45, -27.5, 1, 'SOUP & A ROLL', '#C77B2E'); aboard(6.45, 3, 1, 'FRESH BREAD', '#2f4a2a');
  for (const z of [-34, -32.6]) { for (const dz of [-0.3, 0.3]) cyl('metal', 6.75, PAVE + 0.4, z + dz, 0.025, 0.025, 0.8, 0x2a2b29, { phys: false, seg: 5 }); solid('metal', 6.75, PAVE + 0.8, z, 0.05, 0.05, 0.65, 0x2a2b29, { phys: false }); } // Sheffield bike stands
  for (const z of [-36, 2]) { solid('wood', -6.45, PAVE + 0.45, z, 0.45, 0.06, 1.6, 0x7a5a3a, { phys: false }); solid('wood', -6.6, PAVE + 0.75, z, 0.06, 0.5, 1.6, 0x7a5a3a, { phys: false }); for (const dz of [-0.7, 0.7]) solid('metal', -6.45, PAVE + 0.22, z + dz, 0.4, 0.44, 0.05, 0x1c1f22, { phys: false }); } // benches against the wall
  // Covenanters' memorial-style enclosure (generic): low circular wall, railings and a central plaque stone
  { const mx = 2.6, mz = 25.6, R = 1.35; cyl('stone', mx, 0.3, mz, R, R + 0.05, 0.6, 0xc9b896, { seg: 18 }); cyl('cobble', mx, 0.61, mz, R - 0.15, R - 0.15, 0.02, 0x8a8478, { phys: false, seg: 18 });
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; cyl('metal', mx + Math.cos(a) * (R - 0.05), 0.95, mz + Math.sin(a) * (R - 0.05), 0.014, 0.014, 0.7, 0x1c1f22, { phys: false, seg: 4 }); }
    solid('stone', mx, 0.95, mz, 0.5, 0.7, 0.18, 0xd8c7a6, { phys: false }); quad('atlas', mx, 1.05, mz - 0.1, 0.4, 0.3, Math.PI, atlas.sign('IN MEMORY', '#d8c7a6', '#4a3a20', 0.4 / 0.3, 'bold 40px Georgia', '#d8c7a6')); }
  inNorth(() => { for (const [sd, z0, z1, n, c] of northShops) shopfront(sd, z0, z1, n, c, rampHeight((z0 + z1) / 2) - 0.4); });

  // ---------- signs, plaques & humour ----------
  plaque('GRASSMARKET', -6.97, 3.7, -42, 2.4, Math.PI / 2);
  plaque('GRASSMARKET', 6.72, 3.7, -30, 2.4, -Math.PI / 2);
  sign('CITY OF EDINBURGH COUNCIL', 6.72, 3.38, -30, 2.0, 0.14, -Math.PI / 2, '#f4f1ea', '#666', 'bold 50px Arial', '#f4f1ea');
  sign("NAE BA' GAMES", -6.97, 2.4, -34.5, 1.3, 0.42, Math.PI / 2, '#f4f1ea', '#b01818', 'bold 70px Arial', '#b01818');
  sign('(by order)', -6.97, 2.12, -34.5, 0.8, 0.12, Math.PI / 2, '#f4f1ea', '#444', 'italic 50px Georgia', '#f4f1ea');
  inNorth(() => {
    plaque('VICTORIA STREET', 6.97 * -1 + 0.03, 4.6, 2.5, 2.8, Math.PI / 2);
    sign('PLEASE DINNAE FEED THE GULLS', 6.95, RAMP.rise + 2.3, 31, 2.2, 0.3, -Math.PI / 2, '#f4f1ea', '#1d3b6b', 'bold 50px Arial', '#1d3b6b');
  });
  // fingerpost at the bend
  cyl('metal', 5.6, 1.6, 27.5, 0.06, 0.07, 3.2, 0x1c1f22, { seg: 6 });
  sign('CASTLE  >', 5.05, 2.9, 27.5, 1.1, 0.24, 0, '#1d3b2a', '#f4f1ea', 'bold 60px Arial');
  sign('CASTLE  >', 5.05, 2.9, 27.49, 1.1, 0.24, Math.PI, '#1d3b2a', '#f4f1ea', 'bold 60px Arial');

  // ---------- street furniture ----------
  const IRON = 0x1c1f22;
  function lamppost(x, z, base = PAVE, target = null) {
    const b = cyl('metal', x, base + 2.1, z, 0.07, 0.11, 4.2, IRON, { seg: 8, target });
    cyl('metal', x, base + 0.25, z, 0.16, 0.18, 0.5, IRON, { phys: false, seg: 8 });
    cyl('lamp', x, base + 4.4, z, 0.22, 0.12, 0.45, 0xffffff, { phys: false, seg: 6 });
    cyl('metal', x, base + 4.7, z, 0.02, 0.26, 0.2, IRON, { phys: false, seg: 6 });
    return b;
  }
  for (let z = -44; z <= 26; z += 14) { lamppost(-4.85, z); if (z + 7 !== 5 && z + 7 < 28) lamppost(4.85, z + 7); }
  inNorth(() => { for (const zl of [4, 14]) for (const s of [-1, 1]) { // wall-bracket lamps
    const y = rampHeight(zl) + 4; solid('metal', s * 6.4, y, zl, 1.2, 0.06, 0.06, IRON, { phys: false }); cyl('lamp', s * 5.85, y - 0.25, zl, 0.18, 0.1, 0.4, 0xffffff, { phys: false, seg: 6 }); } });
  function bollard(x, z, y = PAVE) { cyl('metal', x, y + 0.45, z, 0.1, 0.13, 0.9, IRON, { seg: 8 }); cyl('flat', x, y + 0.95, z, 0.13, 0.13, 0.1, 0xd4af37, { phys: false, seg: 8 }); }
  for (const x of [-6.3, -5.4]) bollard(x, 28.4);
  for (const z of [-11, -7.5]) bollard(-6.3, z);
  // Edinburgh railings: black bars with spearhead finials on a stone plinth
  function railings(x0, x1, z, y) {
    for (let x = x0 + 0.1; x < x1; x += 0.16) { cyl('metal', x, y + 0.9, z, 0.016, 0.016, 1.0, IRON, { phys: false, seg: 4 }); cyl('metal', x, y + 1.45, z, 0.0, 0.035, 0.12, IRON, { phys: false, seg: 4 }); }
    solid('metal', (x0 + x1) / 2, y + 1.32, z, x1 - x0, 0.05, 0.05, IRON, { phys: false });
    solid('metal', (x0 + x1) / 2, y + 0.55, z, x1 - x0, 0.04, 0.04, IRON, { phys: false });
    solid('stone', (x0 + x1) / 2, y + 0.2, z, x1 - x0, 0.4, 0.4, 0xc9b896, { tile: 2 });
  }
  railings(-7, 7, -50.2, 0); boxBody(0, 6, -50.6, 14, 12, 0.4);
  inNorth(() => { railings(-7, 7, 36.2, RAMP.rise); boxBody(0, 9, 36.6, 14, 12, 0.4); });
  // wheelie bins: black (general) and green (recycling). Solid: the ball bounces off them.
  function wheelie(x, z, col, ry = 0, y = PAVE) {
    solid('flat', x, y + 0.5, z, 0.6, 0.95, 0.7, col, { ry });
    solid('flat', x, y + 1.0, z, 0.66, 0.06, 0.76, new THREE.Color(col).multiplyScalar(0.8), { phys: false, ry });
  }
  wheelie(-6.4, -26, 0x1d1f1f); wheelie(-6.4, -25.2, 0x2e5a34); wheelie(6.35, -13, 0x1d1f1f); wheelie(6.35, 9.6, 0x2e5a34); wheelie(-6.4, 20, 0x1d1f1f);
  inNorth(() => { wheelie(-6.2, 24, 0x1d1f1f, 0, RAMP.rise); wheelie(-6.2, 24.8, 0x2e5a34, 0, RAMP.rise); });

  // ---------- skyline: Castle on its rock, Old Town roofs, a spire ----------
  const CX = 22, CZ = 215;
  buildCastle(B, CX, CZ, mulberry32(1544));
  B.add('flat', new THREE.ConeGeometry(4, 40, 6), M4(-70, 30, 150, 1, 1, 1), 0x9a9080, {});
  for (let i = 0; i < 130; i++) {
    const x = (rand() - 0.5) * 240, z = 80 + rand() * 110, h = 6 + rand() * 6 + Math.abs(x) * 0.06, w = 8 + rand() * 10, d = 6 + rand() * 8;
    if (Math.abs(x - CX) < 40 && z > 160) continue;
    const c = new THREE.Color().setHSL(0.08, 0.25, 0.3 + rand() * 0.15);
    if (z + d / 2 > 172 && x > CX - 100 && x < CX + 130) continue; // keep clear of the rock's foot (rand() already consumed: layout after this is unchanged)
    B.add('flat', BOX, M4(x, h / 2 - 4, z, w, h, d), c, {});
    B.add('flat', ROOF, M4(x, h - 4, z, w, 2.5, d), 0x4a4d55, {});
  }

  // dark liner inside open-topped bins/skips so the opening reads (visual only)
  function dark(x, y0, z, w, d, h, th) {
    const k = 0x161a17, e = th / 2 + 0.006, iw = w - th - 0.012, id = d - th - 0.012;
    solid('flat', x, y0 + 0.006, z, iw, 0.01, id, k, { phys: false });
    solid('flat', x - w / 2 + e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false }); solid('flat', x + w / 2 - e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false });
    solid('flat', x, y0 + h / 2, z - d / 2 + e, iw, h - 0.03, 0.006, k, { phys: false }); solid('flat', x, y0 + h / 2, z + d / 2 - e, iw, h - 0.03, 0.006, k, { phys: false });
  }
  // ---------- targets ----------
  const ringGeo = new THREE.RingGeometry(1, 1.1, 32);
  function addTarget(t) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r);
    m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m;
    if (t.zone) { t.zoneInv = FR.clone().invert(); }
    t.done = false; targets.push(t); return t;
  }
  // 1. Communal bin (get it in)
  {
    const x = 5.6, z = -22, w = 1.5, d = 1.0, h = 1.15, y = PAVE, th = 0.06, c = 0x3f5a3f;
    solid('flat', x, y + 0.05, z, w, 0.1, d, c);
    solid('flat', x - w / 2, y + h / 2, z, th, h, d, c); solid('flat', x + w / 2, y + h / 2, z, th, h, d, c);
    solid('flat', x, y + h / 2, z - d / 2, w, h, th, c); solid('flat', x, y + h / 2, z + d / 2, w, h, th, c);
    solid('flat', x + 0.15, y + h + 0.45, z + d / 2 + 0.05, w, 0.9, 0.05, 0x2f4a2f, { phys: false, rx: -0.3 });
    sign('GENERAL WASTE', x - w / 2 - 0.04, y + 0.75, z, 0.9, 0.18, -Math.PI / 2, '#2f4a2f', '#fff', 'bold 60px Arial');
    dark(x, y + 0.1, z, w, d, h - 0.1, th);
    addTarget({ id: 'bin', name: 'Communal Bin', hint: 'get it IN the bin', points: 150, kind: 'zone', openTop: true, pos: V(x, y, z), ringR: 1.3, stand: V(-0.5, 0, z), aim: V(x, y + 0.6, z),
      zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)),
      lines: ['Straight in the bucket! The cooncil thanks you.', 'Recycling? Close enough.', 'Bin there, done that.'] });
  }
  // 2. Bench
  {
    const x = -5.9, z = -18, c = 0x8a6a48;
    solid('wood', x, PAVE + 0.45, z, 0.5, 0.08, 1.9, c, { target: 'bench', tile: 1 }); solid('wood', x - 0.25, PAVE + 0.8, z, 0.08, 0.6, 1.9, c, { target: 'bench', tile: 1 });
    for (const dz of [-0.8, 0.8]) solid('metal', x, PAVE + 0.22, z + dz, 0.45, 0.44, 0.08, IRON, { target: 'bench' });
    boxBody(x - 0.05, PAVE + 0.5, z, 0.6, 0.9, 1.9, { target: 'bench' });
    sign('In memory of Jimmy, who loved this street', x + 0.04, PAVE + 0.95, z, 1.2, 0.12, Math.PI / 2, '#d4af37', '#3a2a10', 'bold 40px Georgia');
    addTarget({ id: 'bench', name: 'Memorial Bench', hint: 'hit the bench', points: 50, kind: 'hit', pos: V(x, PAVE, z), ringR: 1.2, stand: V(-2.6, 0, z), aim: V(x, 0.4, z),
      lines: ["Jimmy would've been proud.", 'Thunk! Best seat in the Grassmarket.', 'That bench has seen worse.'] });
  }
  // 3. Traffic cone (knock it over) - dynamic, one merged mesh
  {
    const x = 1.2, z = -11, parts = [];
    const add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.ConeGeometry(0.2, 0.7, 12), new THREE.Matrix4(), 0xff6a00);
    add(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 12), new THREE.Matrix4().makeTranslation(0, 0.05, 0), 0xffffff);
    add(new THREE.BoxGeometry(0.45, 0.04, 0.45), new THREE.Matrix4().makeTranslation(0, -0.33, 0), 0x222222);
    const geo = mergeSimple(parts);
    const b = new CANNON.Body({ mass: 0.6, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.35, 0.16)) }); // box hull: cannon convex-vs-sphere is mushy
    b.position.set(x, 0.36, z); b.userData = { target: 'cone' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'cone', name: 'Traffic Cone', hint: 'knock it over', points: 75, kind: 'topple', body: b, pos: V(x, 0, z), stand: V(x, 0, z - 3.6), aim: V(x, 0.3, z),
      lines: ['Cone down! Somewhere in Glasgow, a statue weeps.', 'Health and safety has left the chat.', 'That cone had it coming.'] });
  }
  // 4. Lamppost with a blue ribbon
  {
    lamppost(4.85, -5, PAVE, 'lamp');
    solid('flat', 4.85, 2.4, -5.15, 0.03, 0.6, 0.25, 0x1e4fa8, { phys: false });
    addTarget({ id: 'lamp', name: 'Lamppost (blue ribbon)', hint: 'ping the post', points: 100, kind: 'hit', pos: V(4.85, PAVE, -5), ringR: 0.8, stand: V(1.6, 0, -5), aim: V(4.85, 0.6, -5),
      lines: ['PING! Off the post!', 'Clang! The whole street heard that.', 'Woodwork! ...well, ironwork.'] });
  }
  // 5. Close passage (kick it through)
  addTarget({ id: 'close', name: "Kicker's Close", hint: 'kick it through the close', points: 125, kind: 'zone', pos: V(-7.5, 0, -9.25), ringR: 0.7, stand: V(-2.5, 0, -9.25), aim: V(-12, 0.3, -9.25),
    zone: new THREE.Box3(V(-13.5, 0, -10), V(-9, 3, -8.5)), minSpeed: 1,
    lines: ['Threaded the needle! Right through the close.', 'Through the pend like a ghost on a tour.', 'Sneaky. Very Old Town.'] });
  // 6. Wee dug statue in the back court
  {
    const x = -20, z = -12, dog = 0x3d3a33;
    solid('stone', x, 0.6, z, 1.2, 1.2, 1.2, 0x9c8a72, { target: 'dug', tile: 1.5 });
    solid('metal', x, 1.5, z, 0.35, 0.3, 0.75, dog, { phys: false }); solid('metal', x, 1.75, z - 0.42, 0.28, 0.28, 0.3, dog, { phys: false });
    for (const [dx, dz] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]]) solid('metal', x + dx, 1.28, z + dz, 0.08, 0.18, 0.08, dog, { phys: false });
    boxBody(x, 1.0, z, 1.24, 2.0, 1.24, { target: 'dug' });
    sign('A FAITHFUL WEE DUG', x + 0.61, 0.8, z, 1.0, 0.16, Math.PI / 2, '#d4af37', '#3a2a10', 'bold 44px Georgia');
    addTarget({ id: 'dug', name: 'Wee Dug Statue', hint: 'hit the statue (find the back court)', points: 125, kind: 'hit', pos: V(x, 0, z), ringR: 1.4, stand: V(-16.5, 0, z), aim: V(x, 0.5, z),
      lines: ['Sorry, pal! Rub his nose for luck.', "Bobby's cousin did not appreciate that.", 'Good boy. Didnae even flinch.'] });
  }
  // 7. Bakery door (marked)
  {
    solid('wood', 6.84, PAVE + 1.1, 5, 0.1, 2.2, 1.1, 0x8e1c1c, { target: 'door' });
    quad('atlas', 6.785, PAVE + 1.1, 5, 1.1, 2.2, -Math.PI / 2, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'door', name: 'Bakery Door', hint: 'strike the marked door', points: 75, kind: 'hit', pos: V(6.3, PAVE, 5), ringR: 0.9, stand: V(2.4, 0, 5), aim: V(6.8, 0.6, 5),
      lines: ["Knock knock! 'We're SHUT, son.'", 'Mrs Mackay is coming oot. Run.', 'One steak bake, special delivery.'] });
  }
  // 8. Pillar box
  {
    cyl('flat', -5.5, PAVE + 0.75, 12, 0.3, 0.3, 1.5, 0xc8102e, { seg: 14, target: 'post' });
    cyl('flat', -5.5, PAVE + 1.55, 12, 0.34, 0.34, 0.12, 0xc8102e, { phys: false, seg: 14 });
    solid('flat', -5.22, PAVE + 1.15, 12, 0.08, 0.06, 0.3, 0x1a1a1a, { phys: false });
    addTarget({ id: 'post', name: 'Pillar Box', hint: 'hit the postbox', points: 75, kind: 'hit', pos: V(-5.5, PAVE, 12), ringR: 0.8, stand: V(-5.5, PAVE, 9.4), aim: V(-5.5, 0.6, 12),
      lines: ['First class!', 'Signed for. Delivered.', "Royal Mail: 'Is this a parcel?'"] });
  }
  // 9. Busker's open guitar case (roll it in)
  {
    const x = -1.8, z = 22, cm = 0x222222;
    solid('flat', x, 0.03, z, 1.3, 0.04, 0.6, 0x7a1030, { phys: false });
    solid('flat', x, 0.06, z - 0.32, 1.3, 0.12, 0.04, cm); solid('flat', x, 0.06, z + 0.32, 1.3, 0.12, 0.04, cm); solid('flat', x - 0.65, 0.15, z, 0.04, 0.3, 0.6, cm); // taller back lip so it stays in
    solid('flat', x, 0.25, z + 0.55, 1.3, 0.5, 0.04, cm, { phys: false, rx: 0.4 });
    quad('atlas', x, 0.06, z, 0.8, 0.14, 0, atlas.sign('TIPS WELCOME', '#7a1030', '#f1d98a', 0.8 / 0.14), 0xffffff, { rx: -Math.PI / 2 });
    addTarget({ id: 'case', name: "Busker's Case", hint: 'roll it into the case (open end faces the bakery side)', points: 100, kind: 'zone', pos: V(x, 0, z), ringR: 1.0, stand: V(2.2, 0, z), aim: V(x, 0.1, z),
      zone: new THREE.Box3(V(x - 0.62, 0, z - 0.3), V(x + 0.65, 0.4, z + 0.3)), maxSpeed: 6,
      lines: ["Busker: 'Cheers pal, but I wanted a fiver.'", 'Into the case! Encore!', "That's mair than he made all day."] });
  }
  // 10 + 11 on the terrace (north section)
  inNorth(() => {
    const y = RAMP.rise;
    { const x = 5.2, z = 26, pb = 0x123a7a;
      solid('flat', x, y + 1.3, z, 1.3, 2.6, 1.3, pb, { target: 'tardis' });
      solid('flat', x, y + 2.75, z, 1.1, 0.3, 1.1, pb, { phys: false });
      sign('POLICE BOX', x - 0.66, y + 2.35, z, 1.1, 0.2, -Math.PI / 2, '#111', '#fff', 'bold 60px Arial');
      for (const k of [-0.3, 0.3]) solid('glass', x - 0.66, y + 1.8, z + k, 0.02, 0.4, 0.4, 0xffffff, { phys: false });
      addTarget({ id: 'tardis', name: 'Police Box', hint: 'hit the police box', points: 75, kind: 'hit', pos: W(x - 0.9, y, z), ringR: 1.0, stand: W(1.6, y, z), aim: W(x - 0.6, y + 0.6, z),
        lines: ["It's bigger on the inside, but you hit the outside.", 'Polis! ...no, it\'s empty. Phew.', 'Exterminate! Wait, wrong show.'] }); }
    { const x = -4.2, z = 31, w = 2.6, d = 1.6, h = 0.9, th = 0.08, sm = 0xe0a400;
      solid('flat', x, y + 0.05, z, w, 0.1, d, sm);
      solid('flat', x - w / 2, y + h / 2, z, th, h, d, sm); solid('flat', x + w / 2, y + h / 2, z, th, h, d, sm);
      solid('flat', x, y + h / 2, z - d / 2, w, h, th, sm); solid('flat', x, y + h / 2, z + d / 2, w, h, th, sm);
      solid('flat', x + 0.4, y + 0.25, z + 0.2, 0.8, 0.3, 0.5, 0x6b5a45, { phys: false });
      dark(x, y + 0.1, z, w, d, h - 0.1, th);
      addTarget({ id: 'skip', name: "Builders' Skip", hint: 'chip it into the skip', points: 150, kind: 'zone', openTop: true, pos: W(x, y, z), ringR: 1.8, stand: W(x, y, z - 6), aim: W(x, y + 0.5, z),
        zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)),
        lines: ['In the skip! Tidy.', "Builder: 'Oi! That's ma lunch in there!'", 'Chipped in like a pro.'] }); }
    // decorative bench facing the Castle view
    solid('wood', 0, y + 0.45, 34.6, 1.9, 0.08, 0.5, 0x8a6a48, { tile: 1 }); solid('metal', 0, y + 0.22, 34.6, 1.7, 0.44, 0.3, IRON);
  });

  // ---------- pigeons (2 instanced meshes, 20 birds) ----------
  const groups = [[-1, 0, -26], [3, 0, 8], [-3, 0, 16], [-18, 0, -5]].map((p) => V(...p));
  inNorth(() => groups.push(W(1, RAMP.rise, 30)));
  const pig = { list: [], body: null, head: null };
  const N = groups.length * 4;
  pig.body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, N);
  pig.head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, N);
  groups.forEach((c, gi) => { for (let i = 0; i < 4; i++) {
    const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2);
    pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });

  // ---------- materials + build ----------
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead;
  scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  const batches = B.build(scene, materials, { shadows: P.shadows });

  const tz = northToWorld(0, 0, 24);
  const views = { spawn: [0, -36, 180, -12], midstreet: [0, 0, 180, -5], terrace: [tz.x, tz.z, 180 + BEND.yaw * 180 / Math.PI, 6, RAMP.rise + 0.9] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}

export function mergeSimple(parts) {
  const g = new THREE.BufferGeometry(); const keys = ['position', 'normal', 'uv', 'color'];
  for (const k of keys) { const arrs = parts.map((p) => p.attributes[k].array); const n = arrs.reduce((a, b) => a + b.length, 0); const out = new Float32Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } g.setAttribute(k, new THREE.BufferAttribute(out, parts[0].attributes[k].itemSize)); }
  return g;
}

export function hazed(m, k) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth * ${k.toFixed(2)} );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`); };
  m.customProgramCacheKey = () => 'hazed' + k; return m;
}
// One material per bucket, shared by everything. Lambert on low/medium, PBR on high.
export function makeMaterials(P, facadeTex, atlasTex) {
  const mk = (params) => {
    const p = { vertexColors: true, ...params };
    if (!P.pbr) { delete p.roughness; delete p.metalness; delete p.roughnessMap; delete p.envMapIntensity; return new THREE.MeshLambertMaterial(p); }
    return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...p });
  };
  return {
    flat: mk({}),
    metal: mk({ metalness: 0.65, roughness: 0.4 }),
    glass: mk({ color: P.pbr ? 0x2b3a48 : 0x41505c, emissive: 0x2e2616, roughness: 0.12, metalness: 0.3 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
    facade: mk({ map: facadeTex, roughness: 0.9 }),
    stone: mk({ ...pbrMaps('sandstone') }),
    roof: mk({ ...pbrMaps('slate', { normal: false }) }),
    cobble: mk({ ...pbrMaps('cobble') }),
    paving: mk({ ...pbrMaps('paving') }),
    wood: mk({ ...pbrMaps('wood', { normal: false }) }),
    atlas: mk({ map: atlasTex, roughness: 0.7 }),
    // distant castle: lighter, partial haze (fog distance scaled) so it reads as far away but stays legible
    castleRock: hazed(mk({ side: THREE.DoubleSide }), 0.5),
    castleStone: hazed(mk({ ...pbrMaps('sandstone', { normal: false }) }), 0.5),
    pigeon: new THREE.MeshLambertMaterial({ color: 0x6f7480 }),
    pigeonHead: new THREE.MeshLambertMaterial({ color: 0x4b5f6a }),
  };
}
