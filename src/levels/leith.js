// Level 5: Leith (v3.1). The Shore: dressed-sandstone tenements and recessed timber shopfronts between stone pilasters
// along the Water of Leith, a navy-fronted pub (fictional "The Anchor on the Shore"), a granary-style corner frontage
// (fictional "The Malt Loft"), the rubble-stone Timber Bush warehouse with its steel fire stair, a humped stone footbridge,
// quayside bollards and a blue police-box coffee stall on the setts.
// North = +z. The river runs along x between low quay walls topped with railings. A ball that does get into the river is
// LOST FOR GOOD (main.js: LEVEL.sea.lostForGood): it floats off downstream and you're handed a fresh ball.
// Signature football: the humped bridge (run it up the ramp onto the deck) and quay parapets/bollards as rebound boards.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, gasBrickTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const LT = { RS: 4, RN: 14, WATER: -0.85, FRONT: -12, NFRONT: 22, BX: 4 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1329), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const RS = LT.RS, RN = LT.RN, WY = LT.WATER, F = LT.FRONT, NF = LT.NFRONT, IRON = 0x1e2124, ACC = 0x6B3F73;
  const vt = (base = 0xf0e6d4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * (k + (rand() - 0.5) * 0.04), c.b * (k + (rand() - 0.5) * 0.06)).getHex(); }; // v3.1.1: per-window tint jitter (less obvious repetition)
  const GRANITE = [0x9d9b97, 0x8f8d89, 0xa9a7a1, 0x96938c]; // grey granite coping
  const SAND = [0xcfccc4, 0xc4c0b6, 0xcac6bc, 0xbdb8ad, 0xd6d2c8, 0xb8b3a8]; // dressed sandstone, grey-buff

  // ---------- land, river, quay walls ----------
  boxBody(0, -2, (-30 + RS) / 2, 100, 4, RS + 30, { surface: 'setts' }); // the Shore (south bank)
  boxBody(0, -2, (RN + 32) / 2, 100, 4, 32 - RN, { surface: 'setts' }); // north bank
  B.add('flat', QUAD, M4(0, WY, (RS + RN) / 2, 260, RN - RS, 1, -Math.PI / 2), 0x3f4e48, {}); // the Water of Leith (dark, peaty)
  for (let i = 0; i < 40; i++) { const x = -110 + rand() * 220, z = RS + 0.6 + rand() * (RN - RS - 1.2); B.add('flat', QUAD, M4(x, WY + 0.01, z, 1.5 + rand() * 4, 0.08, 1, -Math.PI / 2, rand() * 0.2), 0x6e7f78, {}); }
  for (let i = 0; i < 26; i++) { const x0 = -110 + i * 8.5 + rand() * 2; B.add('flat', QUAD, M4(x0, WY + 0.006, RN - 1.4 - rand() * 0.8, 5 + rand() * 4, 1.4 + rand() * 1.6, 1, -Math.PI / 2), pick([0x6b6450, 0x5e5848, 0x726a55]), {}); } // v3.1.1: soft reflection of the sandstone frontage
  for (let i = 0; i < 60; i++) { const x = -110 + rand() * 220, z = RS + 0.4 + rand() * (RN - RS - 0.8); B.add('flat', QUAD, M4(x, WY + 0.012, z, 0.6 + rand() * 2.2, 0.05, 1, -Math.PI / 2, (rand() - 0.5) * 0.15), pick([0x8a9a93, 0x56665f, 0x9aa8a0]), {}); } // ripple glints
  B.add('cobble', QUAD, M4(0, 0.005, (F + RS) / 2 + 1.2, 100, RS - F - 2.4, 1, -Math.PI / 2), 0xb4ada2, { tile: 1.4 }); // quayside setts
  B.add('slab', QUAD, M4(0, 0.007, F + 1.2, 100, 2.4, 1, -Math.PI / 2), 0xffffff, { tile: 1.8 }); // pavement at the frontages
  B.add('cobble', QUAD, M4(0, 0.005, (RN + NF) / 2, 100, NF - RN, 1, -Math.PI / 2), 0xb4ada2, { tile: 1.4 });
  for (const zf of [RS, RN]) { const s = zf === RS ? 1 : -1; // stone quay walls down to the water, a low parapet with coping, iron railings
    solid('stone', 0, WY / 2 - 0.2, zf + s * 0.3, 260, -WY + 0.4, 0.6, 0x8d8679, { phys: false, tile: 1.5 });
    for (const [x0, x1] of zf === RS ? [[-60, LT.BX - 1.7], [LT.BX + 1.7, 60]] : [[-60, LT.BX - 1.7], [LT.BX + 1.7, 60]]) { const xc = (x0 + x1) / 2, w = x1 - x0;
      solid('stone', xc, 0.24, zf - s * 0.25, w, 0.48, 0.45, 0xc9c1ae, { tile: 1.5 });
      // v3.3: granite coping in jointed blocks (after AG's Commercial Wharf photo) ...
      { const nb = Math.round(w / 1.25); for (let i = 0; i < nb; i++) solid('stone', x0 + (i + 0.5) * w / nb, 0.54, zf - s * 0.25, w / nb - 0.04, 0.13, 0.62, pick(GRANITE), { phys: false }); }
      // ... and black posts with drooping chains instead of the railing (the player-only wall below is unchanged)
      const n = Math.round(w / 2.2); for (let i = 0; i <= n; i++) { const px = x0 + w * i / n; cyl('metal', px, 1.0, zf - s * 0.25, 0.06, 0.06, 0.82, IRON, { phys: false, seg: 4 });
        if (i < n) { const ax = px, bx = x0 + w * (i + 1) / n, pts = []; for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push(V(ax + (bx - ax) * t, 1.28 - Math.sin(Math.PI * t) * 0.32, zf - s * 0.25)); }
          B.add('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.025, 3, false), null, 0x26292c, {}); } }
      boxBody(xc, 1.6, zf - s * 0.25, w, 3, 0.45, { playerOnly: true }); } }
  for (const [x, z, w, d] of [[0, -27, 100, 1], [44.5, 0, 1, 70], [-44.5, 0, 1, 70]]) boxBody(x, 4, z, w, 8, d); // land boundary

  // ---------- the humped stone footbridge (signature: run it up the ramp, onto the deck) ----------
  { const x = LT.BX, W = 3.0, H = 1.2, zA = RS - 4, zB = RS + 1.5, zC = RN - 1.5, zD = RN + 4, TONE = 0xc6b89c;
    const ramp = (z0, z1, up) => { const L = Math.hypot(z1 - z0, H), th = Math.atan2(H, z1 - z0) * (up ? 1 : -1);
      body(new CANNON.Box(new CANNON.Vec3(W / 2, 0.15, L / 2)), x, H / 2 - 0.15, (z0 + z1) / 2, { rx: -th, surface: 'setts' }); B.add('cobble', BOX, M4(x, H / 2 - 0.15, (z0 + z1) / 2, W, 0.3, L, -th), 0xb8b0a2, { tile: 1.3 });
      for (const s of [-1, 1]) B.add('stone', BOX, M4(x + s * (W / 2 + 0.15), H / 2 + 0.3, (z0 + z1) / 2, 0.3, 0.9, L, -th), TONE, { tile: 1.5 }); };
    ramp(zA, zB, true); ramp(zC, zD, false);
    solid('cobble', x, H - 0.15, (zB + zC) / 2, W, 0.3, zC - zB, 0xb8b0a2, { surface: 'setts', tile: 1.3 });
    for (const s of [-1, 1]) { solid('stone', x + s * (W / 2 + 0.15), H + 0.45, (zB + zC) / 2, 0.3, 0.9, zC - zB, TONE, { tile: 1.5 }); solid('stone', x + s * (W / 2 + 0.15), H + 0.94, (zB + zC) / 2, 0.42, 0.1, zC - zB, 0xd8d0be, { phys: false }); }
    for (const s of [-1, 1]) for (const sg of [-1, 1]) body(new CANNON.Box(new CANNON.Vec3(0.15, 0.45, Math.hypot(4, 1.2) / 2)), x + s * (W / 2 + 0.15), H / 2 + 0.3, sg < 0 ? (zA + zB) / 2 : (zC + zD) / 2, { rx: sg < 0 ? -Math.atan2(H, zB - zA) : Math.atan2(H, zD - zC) });
    // the arch (both faces): stone spandrels with a dark barrel underneath
    for (const fx of [x - W / 2 - 0.31, x + W / 2 + 0.31]) { solid('stone', fx, (WY + H) / 2, (RS + RN) / 2, 0.02, H - WY, RN - RS, TONE, { phys: false, tile: 1.5 });
      B.add('flat', new THREE.CircleGeometry(3.6, 16, 0, Math.PI), M4(fx + (fx < x ? -0.02 : 0.02), WY - 1.2, (RS + RN) / 2, 1, 1, 1, 0, fx < x ? -Math.PI / 2 : Math.PI / 2), 0x23282a, {}); }
    // lamp on the bridge (target)
    const lx = x + W / 2 + 0.55, lz = RS - 0.8; // v3.1: lamp on the quay at the bridge end (a miss doesn't feed the river) cyl('metal', lx, 0 + 2.4, lz, 0.08, 0.1, 3.0, IRON, { seg: 6, target: 'bridgelamp' }); solid('glass', lx, 0 + 4.1, lz, 0.45, 0.6, 0.45, 0xffffff, { phys: false }); B.add('lamp', BOX, M4(lx, 0 + 4.1, lz, 0.3, 0.45, 0.3), 0xffffff, {}); B.add('flat', ROOF, M4(lx, 0 + 4.4, lz, 0.6, 0.3, 0.6), IRON, {});
    boxBody(lx, 1.9, lz, 0.25, 1.9, 0.25, { target: 'bridgelamp', surface: 'metal' });
    cyl('flat', lx, 0 + 1.6, lz, 0.16, 0.16, 0.25, 0xf7c325, { phys: false, seg: 8 });
    addTarget({ id: 'bridgelamp', name: 'Bridge Lamp', hint: 'ping the lamp post at the bridge end', points: 100, kind: 'hit', pos: V(lx, 0, lz), ringR: 0.8, stand: V(lx + 0.3, 0, lz - 6.5), aim: V(lx, 0 + 1.6, lz), lines: ['DING! Lamplighter says ta.', "Lit it up. That's the Shore's brightest moment since 1820.", 'Clanged the lamp. The bridge is pure buzzin\'.'] });
    addTarget({ id: 'bridgetop', name: 'Up on the Bridge', hint: 'kick it up the bridge ramp so it stops on the deck', points: 100, kind: 'zone', kickOnly: true, pos: V(x, 0, RS - 2), ringR: 1.2, stand: V(x, 0, RS - 9), aim: V(x, 0.4, (RS + RN) / 2),
      zone: new THREE.Box3(V(x - W / 2, H - 0.05, zB), V(x + W / 2, H + 1.0, zC)), lines: ['Up and ower! Well, up.', 'King o\' the bridge.', 'That ball\'s got a better view than you.'] });
    sign('SHORE BRIDGE', x - W / 2 - 0.33, H + 0.55, RS + 0.3, 1.6, 0.3, -Math.PI / 2, '#2a2d31', '#f1d98a', 'bold 48px Georgia'); }

  // ---------- The Shore frontage: dressed sandstone tenements, recessed timber shopfronts between stone pilasters ----------
  function tenement(x0, x1, floors, tone, shop) { const xc = (x0 + x1) / 2, w = x1 - x0, D = 11, h = 1 + floors * 3.3, bays = Math.max(2, Math.round(w / 3));
    solid('stone', xc, h / 2, F - D / 2, w, h, D, tone, { tile: 3.4 + rand() * 1.2 });
    solid('stone', xc, 4.15, F + 0.12, w, 0.3, 0.24, 0xe2d6be, { phys: false }); solid('stone', xc, h - 0.25, F + 0.2, w + 0.2, 0.5, 0.4, 0xe2d6be, { phys: false }); // cornice over the shops + eaves cornice
    for (let i = 0; i < bays; i++) for (let j = 1; j < floors; j++) { const bx = x0 + (i + 0.5) * w / bays; quad('facade', bx + (rand() - 0.5) * 0.12, 4.3 + (j - 0.5) * 3.3 + (rand() - 0.5) * 0.08, F + 0.01, w / bays * (0.8 + rand() * 0.08), 3.1, 0, cellUV(j === floors - 1 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit, FACADE.sashA])), vt()); }
    B.add('roof', ROOF, M4(xc, h, F - D / 2, D + 0.3, 3.0, w + 0.05, 0, Math.PI / 2), 0x5c6168, { tile: 2.2 });
    for (let x = x0 + 2; x < x1 - 1; x += 6) { solid('stone', x, h + 2.2, F - D / 2, 1.0, 2.6, 2.8, tone, { phys: false, tile: 2.6 }); for (let k = -1; k <= 1; k++) cyl('flat', x, h + 3.7, F - D / 2 + k * 0.8, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); }
    if (shop !== false) { // ground floor: stone pilasters, recessed timber shopfronts with stallrisers, fascias
      const n = Math.max(1, Math.round(w / 5)), sw = w / n;
      for (let i = 0; i <= n; i++) solid('stone', x0 + i * sw, 2.0, F + 0.18, 0.55, 4.0, 0.36, 0xe2d6be, { tile: 1.5 });
      for (let i = 0; i < n; i++) { const sx = x0 + (i + 0.5) * sw, col = shop?.col || pick([0x2f4a3a, 0x5a2a2a, 0x1f3a5f, 0x3a3a3a, 0x6b4a2b]);
        solid('wood', sx, 0.35, F - 0.25, sw - 0.6, 0.7, 0.12, col, { phys: false }); quad('glass', sx, 1.9, F - 0.26, sw - 0.9, 2.3, 0, null, 0xffffff);
        for (let k = 1; k < 3; k++) solid('wood', sx - (sw - 0.6) / 2 + k * (sw - 0.6) / 3, 1.9, F - 0.22, 0.08, 2.4, 0.08, col, { phys: false });
        solid('wood', sx, 3.45, F + 0.04, sw - 0.55, 0.6, 0.12, col, { phys: false });
        if (shop?.names?.[i]) quad('atlas', sx, 3.45, F + 0.11, sw - 0.75, 0.48, 0, atlas.fascia(shop.names[i], null, '#' + new THREE.Color(col).getHexString(), '#EFE3C8', (sw - 0.75) / 0.48)); }
      quad('grime', xc, 1.2, F + 0.37, w, 2.4, 0, GRIME_UV[0]); } }
  tenement(-26, -12, 4, SAND[1], { names: ['LEITH LENS CO.', 'HADDOCK & HERBS', 'SHORE BOOKS'] });
  tenement(-12, 11, 4, SAND[0], false); // the pub building (front added below)
  tenement(11, 25, 5, SAND[2], false); // the corner granary (front added below)
  tenement(31, 44, 4, SAND[3], { names: ['THE NORTHERN LIGHT', 'PORT O\' LEITH DELI'] });
  // the pub: deep navy timber frontage across the ground floor, gold lettering, ship's wheel sign (target), tables
  { const x0 = -11.6, x1 = 10.6, NAVY = 0x3a5a86, xc = (x0 + x1) / 2;
    solid('flat', xc, 1.95, F + 0.2, x1 - x0, 3.9, 0.35, NAVY, { phys: false });
    for (let k = 0; k < 4; k++) { const wx = x0 + 2.6 + k * 5.6; if (k === 1) continue; quad('glass', wx, 2.0, F + 0.39, 3.6, 2.3, 0, null, 0xfff1d0); for (let m = 1; m < 4; m++) solid('wood', wx - 1.8 + m * 0.9, 2.0, F + 0.41, 0.06, 2.3, 0.04, 0xefe3c8, { phys: false }); solid('wood', wx, 0.55, F + 0.39, 3.8, 0.9, 0.06, 0x7a1f1f, { phys: false }); }
    quad('atlas', xc, 3.55, F + 0.39, 9, 0.62, 0, atlas.fascia('THE ANCHOR ON THE SHORE', 'ALES · WHISKY · FISH SUPPERS', '#26395c', '#E8C766', 9 / 0.62));
    const dx = x0 + 2.6 + 5.6; solid('wood', dx, 1.25, F + 0.42, 1.4, 2.5, 0.1, 0x101627, { target: 'pubdoor', surface: 'board' }); quad('atlas', dx, 1.25, F + 0.48, 1.4, 2.5, 0, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'pubdoor', name: 'The Anchor\'s Door', hint: 'strike the marked pub door', points: 75, kind: 'hit', pos: V(dx, 0, F + 1.4), ringR: 1.0, stand: V(dx, 0, F + 6), aim: V(dx, 1.0, F), lines: ['Last orders! Well, first orders.', "The landlord's no' impressed. The regulars are.", 'Door chapped. Pint poured. Ball not served.'] });
    // ship's wheel sign hanging off a bracket (target)
    const sx = x1 - 1.2, sy = 3.2, sz = F + 0.9; solid('metal', sx, sy + 0.75, F + 0.5, 0.06, 0.06, 1.0, IRON, { phys: false });
    B.add('flat', new THREE.TorusGeometry(0.45, 0.06, 6, 16), M4(sx, sy, sz, 1, 1, 1, 0, Math.PI / 2), 0xe8c766, {}); for (let k = 0; k < 4; k++) solid('flat', sx, sy, sz, 0.05, 1.2, 0.05, 0xe8c766, { phys: false, rx: k * Math.PI / 4 });
    cyl('flat', sx, sy, sz, 0.18, 0.18, 0.1, 0x1b2440, { seg: 10, rz: Math.PI / 2, target: 'shipwheel', surface: 'board', phys: false }); boxBody(sx, sy, sz, 0.15, 1.0, 1.0, { target: 'shipwheel', surface: 'board' });
    addTarget({ id: 'shipwheel', name: "Ship's Wheel Sign", hint: 'chip the hanging ship\'s-wheel sign', points: 125, kind: 'hit', pos: V(sx, 0, sz + 0.4), ringR: 0.9, stand: V(sx, 0, sz + 6.5), aim: V(sx, sy, sz), lines: ['Hard a-starboard! Sign spinning.', "Steered that one right in, Captain.", 'Wheel spun. Ship sailed. Ball returned.'] });
    for (const tx of [-8, -2, 5]) { solid('wood', tx, 0.75, F + 2.6, 1.8, 0.08, 0.8, 0x6b4a2b); for (const s of [-1, 1]) solid('wood', tx, 0.45, F + 2.6 + s * 0.75, 1.8, 0.06, 0.3, 0x6b4a2b, { phys: false }); }
    // chalk A-board (topples)
    const ax = -5, az = F + 1.9, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.BoxGeometry(0.6, 0.95, 0.06), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0, 0.12), 0x2a2d31); add(new THREE.BoxGeometry(0.6, 0.95, 0.06), new THREE.Matrix4().makeRotationX(-0.2).setPosition(0, 0, -0.12), 0x2a2d31); add(new THREE.BoxGeometry(0.5, 0.6, 0.01), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.05, 0.16), 0xe8e4da);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 1.5, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.47, 0.2)) }); b.position.set(ax, 0.48, az); b.userData = { target: 'aboard', surface: 'board' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'aboard', name: 'Chalk A-Board', hint: 'knock the pub A-board over', points: 50, kind: 'topple', body: b, pos: V(ax, 0, az), stand: V(ax, 0, az + 4.5), aim: V(ax, 0.5, az), lines: ['"Today\'s special: flat A-board."', 'Board doon. The chalk\'s smudged. Chef\'s fumin\'.', 'Specials: cancelled.'] }); }
  // the corner granary frontage: rounded-ish corner, big arched windows on the ground floor, gold lettering
  { const x0 = 11.4, x1 = 24.6, z = F, TAN = 0x6b4a2b;
    for (let k = 0; k < 3; k++) { const wx = x0 + 2.2 + k * 4.4; quad('facade', wx, 2.0, z + 0.02, 3.6, 3.6, 0, cellUV(FACADE.arch), 0xf3d9b8); solid('glass', wx, 1.75, z + 0.05, 1.9, 2.6, 0.04, 0x9fb4ba, { phys: false }); solid('wood', wx, 1.75, z + 0.08, 0.07, 2.6, 0.04, 0x3b2a1c, { phys: false }); solid('wood', wx, 2.2, z + 0.08, 1.9, 0.07, 0.04, 0x3b2a1c, { phys: false }); solid('stone', wx + 2.2, 2.0, z + 0.18, 0.55, 4.0, 0.36, 0xe2d6be, { phys: false }); }
    solid('stone', x0, 2.0, z + 0.18, 0.55, 4.0, 0.36, 0xe2d6be, { phys: false });
    quad('atlas', (x0 + x1) / 2, 4.6, z + 0.3, 8, 0.8, 0, atlas.fascia('THE MALT LOFT', null, '#C8B898', '#2E2F2C', 10));
    // the corner (chamfered) with the target door, onto the lane at x = 25..31
    solid('stone', x1 + 0.6, 9, z - 0.6, 1.8, 18, 1.8, SAND[2], { phys: false, ry: Math.PI / 4, tile: 2.6 });
    solid('wood', x1 + 0.95, 1.3, z + 0.35, 1.3, 2.6, 0.1, TAN, { ry: -Math.PI / 4, target: 'maltloft', surface: 'board' }); quad('atlas', x1 + 1.0, 1.3, z + 0.42, 1.3, 2.6, -Math.PI / 4, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'maltloft', name: 'Malt Loft Corner Door', hint: 'hit the door on the corner', points: 75, kind: 'hit', pos: V(x1 + 1.6, 0, z + 1.0), ringR: 1.0, stand: V(x1 + 4.2, 0, z + 3.6), aim: V(x1 + 0.95, 1.0, z + 0.35), lines: ['Corner shot! The bar staff gave it a 7.', 'Malted. Loft-ed. Done.', 'Grain store, ball store. Same thing.'] });
    for (const fx of [x0 + 1, x0 + 3.5]) { cyl('metal', fx, 4.2, z + 0.5, 0.03, 0.03, 2.4, 0xdcdcdc, { phys: false, seg: 4, rz: 0.7 }); solid('flat', fx + 0.6, 4.6, z + 0.5, 0.9, 0.55, 0.02, pick([0x1f3a8f, 0xc8202a, 0xf4f1ea]), { phys: false }); } } // flags
  // the lane east of the corner + a planter and the far east block
  // half-barrel planter on the quay (zone)
  { const x = 16, z = -2.5, R = 0.62, h = 0.6; cyl('wood', x, 0.05, z, R, R, 0.1, 0x5a3a22, { seg: 14 });
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; solid('wood', x + Math.cos(a) * R, h / 2, z + Math.sin(a) * R, 0.06, h, 0.3, 0x7a5a3a, { ry: -a }); }
    for (const y of [0.15, 0.48]) B.add('flat', new THREE.TorusGeometry(R + 0.03, 0.025, 4, 18), M4(x, y, z, 1, 1, 1, Math.PI / 2), IRON, {});
    for (let i = 0; i < 7; i++) B.add('flat', new THREE.IcosahedronGeometry(0.16, 0), M4(x + (rand() - 0.5) * 0.7, h - 0.05, z + (rand() - 0.5) * 0.7, 1, 0.7, 1), pick([0x5f7a3a, 0xc8204a, 0x6f8a42]), {});
    addTarget({ id: 'barrel', name: 'The Half-Barrel', hint: 'chip it into the half-barrel planter', points: 150, kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 1.0, stand: V(x + 4.5, 0, z), aim: V(x, 0.5, z),
      zone: new THREE.Box3(V(x - R - 0.25, 0.1, z - R - 0.25), V(x + R + 0.25, h + 0.5, z + R + 0.25)), lines: ['In the barrel! Whisky-aged fitba\'.', 'Barrel o\' laughs.', 'The geraniums didnae see that coming.'] }); }

  // ---------- blue police-box coffee stall on the quayside setts (the easy first target) ----------
  { const x = 14, z = 1.2, BL = 0x1d3a72;
    solid('flat', x, 1.35, z, 1.3, 2.7, 1.3, BL, { target: 'policebox', surface: 'board' }); solid('flat', x, 2.85, z, 1.45, 0.3, 1.45, BL, { phys: false }); B.add('flat', ROOF, M4(x, 3.0, z, 1.2, 0.35, 1.2), BL, {});
    cyl('glass', x, 3.45, z, 0.12, 0.12, 0.3, 0xffffff, { phys: false, seg: 6 });
    for (const [ry, ox, oz] of [[0, 0, 0.66], [Math.PI, 0, -0.66], [Math.PI / 2, 0.66, 0], [-Math.PI / 2, -0.66, 0]]) { sign('COFFEE · TEA · PIECES', x + ox * 1.12, 2.82, z + oz * 1.12, 1.2, 0.2, ry, '#111', '#fff', 'bold 40px Arial');
      for (let k = 0; k < 2; k++) for (let m = 0; m < 3; m++) quad('flat', x + ox * 1.01 + (ry % Math.PI ? 0 : (k - 0.5) * 0.5), 1.0 + m * 0.6, z + oz * 1.01 + (ry % Math.PI ? (k - 0.5) * 0.5 : 0), 0.42, 0.48, ry, null, 0x16305e); }
    quad('glass', x + 0.25, 2.3, z + 0.68, 0.4, 0.4, 0, null, 0xffffff);
    solid('flat', x - 1.3, 0.4, z, 0.6, 0.8, 0.6, 0x2a2d31, { phys: false }); solid('flat', x + 1.25, 0.45, z + 0.3, 0.6, 0.9, 0.6, 0x5a3a22, { phys: false }); // cups bin + stool
    addTarget({ id: 'policebox', name: 'Blue Box Coffee', hint: 'hit the blue police-box coffee stall', points: 50, kind: 'hit', pos: V(x, 0, z), ringR: 1.3, stand: V(x + 4.5, 0, z - 1.8), aim: V(x, 1.3, z), lines: ['Flat white, flat ball.', "Naw, it's just a coffee stall.", 'Order up! One oat-milk volley.'] }); }
  // bollards along the quay (one is a target)
  for (const x of [-34, -24, -16, 22, 30, 38]) { cyl('metal', x, 0.38, RS - 1.1, 0.22, 0.26, 0.76, IRON, { seg: 10 }); cyl('metal', x, 0.78, RS - 1.1, 0.3, 0.3, 0.08, IRON, { phys: false, seg: 10 }); }
  { const x = -6, z = RS - 1.1; cyl('metal', x, 0.38, z, 0.22, 0.26, 0.76, IRON, { seg: 10, target: 'bollard' }); cyl('metal', x, 0.78, z, 0.3, 0.3, 0.08, IRON, { phys: false, seg: 10 }); cyl('flat', x, 0.5, z, 0.23, 0.23, 0.12, 0xf7c325, { phys: false, seg: 10 });
    addTarget({ id: 'bollard', name: 'Quayside Bollard', hint: 'hit the banded bollard (the parapet saves a miss)', points: 75, kind: 'hit', pos: V(x, 0, z - 0.6), ringR: 0.8, stand: V(x, 0, z - 5), aim: V(x, 0.4, z), lines: ['Tied up! Bollard bagged.', 'CLANG. Heard at the Kirkgate.', 'Moored. Ye could tie a tall ship tae that shot.'] }); }

  // ---------- the Timber Bush: rubble-stone warehouse with an external steel stair (landing = target) ----------
  { const x0 = -44, x1 = -26, h = 12.5, xc = (x0 + x1) / 2, D = 12, RUB = 0xb8ad98;
    solid('castleStone', xc, h / 2, F - D / 2, x1 - x0, h, D, RUB, { tile: 3 });
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) quad('facade', x0 + 2 + i * 3.5, 1.9 + j * 3, F + 0.01, 1.4, 1.9, 0, cellUV(j === 0 && i === 2 ? FACADE.arch : FACADE.small), 0xe8e0d0);
    B.add('roof', ROOF, M4(xc, h, F - D / 2, D + 0.3, 3.4, x1 - x0, 0, Math.PI / 2), 0x5c6168, { tile: 2.2 });
    const N = 8, rise = 0.33, tread = 0.32, deep = 1.3, xs = x1 - 1.2, LH = N * rise, lx1 = xs - N * tread, lx0 = lx1 - 2.0, zc = F + deep / 2;
    for (let k = 0; k < N; k++) { solid('metal', xs - (k + 0.5) * tread, (k + 1) * rise - 0.03, zc, tread, 0.06, deep, 0x3a3e42, { surface: 'metal' }); }
    { const run = N * tread, L = Math.hypot(run, LH), th = Math.atan2(LH, run); body(new CANNON.Box(new CANNON.Vec3(L / 2, 0.05, deep / 2 - 0.05)), xs - run / 2, LH / 2 - 0.02, zc, { rz: -th, surface: 'metal' });
      for (const zz of [F + 0.05, F + deep]) solid('metal', xs - run / 2, LH / 2 - 0.15, zz, L, 0.25, 0.04, 0x3a3e42, { phys: false, rz: -th }); }
    solid('metal', (lx0 + lx1) / 2, LH - 0.03, zc, lx1 - lx0, 0.06, deep, 0x3a3e42, { surface: 'metal' });
    for (const lx of [lx0, lx1]) cyl('metal', lx, LH / 2, F + deep - 0.05, 0.05, 0.05, LH, 0x3a3e42, { phys: false, seg: 5 });
    for (let k = 0; k <= N; k++) cyl('metal', xs - k * tread, k * rise + 0.5, F + deep - 0.03, 0.02, 0.02, 1.0, 0x3a3e42, { phys: false, seg: 4 });
    solid('metal', (lx0 + lx1) / 2, LH + 1.0, F + deep - 0.03, lx1 - lx0, 0.04, 0.04, 0x3a3e42, { phys: false });
    quad('facade', (lx0 + lx1) / 2, LH + 1.1, F + 0.02, 1.1, 2.1, 0, cellUV(FACADE.doorGreen), 0xffffff);
    sign('TIMBER BUSH', xc, 9.0, F + 0.04, 3.2, 0.5, 0, '#e8e0d0', '#2E2F2C', 'bold 56px Georgia');
    addTarget({ id: 'timberbush', name: 'Timber Bush Landing', hint: 'run it up the steel stair onto the landing (or chip it)', points: 150, kind: 'zone', openTop: true, pos: V((lx0 + lx1) / 2, 0, F + deep + 1.2), ringR: 1.1, stand: V(xs + 4.5, 0, zc + 0.1), aim: V((lx0 + lx1) / 2, LH + 0.3, zc),
      zone: new THREE.Box3(V(lx0 - 0.3, LH + 0.02, F - 0.05), V(lx1 + 0.3, LH + 1.1, F + deep + 0.4)), lines: ['Up the Timber Bush stair! The joiners would be proud.', 'Landed on the landing. Tidy.', 'Fire escape? Ball escape.'] }); }

  // ---------- north bank (across the river): tall Shore frontages, the river's signature view ----------
  for (const [x0, x1, fl, tone, roof, kind] of [[-44, -30, 5, SAND[4], 0x5c6168], [-30, -16, 5, 0xb89a8c, 0x6e737a, 'brick'], [-16, -2, 5, SAND[0], 0x5c6168], [-2, 12, 6, SAND[2], 0x5c6168], [12, 26, 6, 0xeeeeea, 0, 'modern'], [26, 44, 5, SAND[1], 0x5c6168]]) { const xc = (x0 + x1) / 2, w = x1 - x0, h = 1 + fl * 3.3, D = 10;
    if (kind === 'modern') { // v3.3: the white rounded-corner modern block on the far bank (AG's river-channel photo), ribbon glazing
      solid('flat', xc + 2, h / 2, NF + D / 2, w - 4, h, D, tone, { phys: false }); cyl('flat', x0 + 4.5, h / 2 + 0.5, NF + 4.5, 4.5, 4.5, h + 1, tone, { phys: false, seg: 16 });
      for (let j = 0; j < fl; j++) { const y = 2.0 + j * 3.3; solid('glass', xc + 2, y, NF - 0.03, w - 4.4, 1.5, 0.04, 0xd8e6ec, { phys: false }); cyl('glass', x0 + 4.5, y, NF + 4.5, 4.53, 4.53, 1.5, 0xd8e6ec, { phys: false, seg: 16 });
        for (let k = 0; k < 6; k++) solid('flat', x0 + 4.4 + k * (w - 4.4) / 6, y, NF - 0.06, 0.12, 1.5, 0.04, 0xd8d8d4, { phys: false }); }
      solid('flat', xc + 2, h + 0.3, NF + D / 2, w - 3.6, 0.6, D + 0.3, 0xd8d8d4, { phys: false }); cyl('flat', x0 + 4.5, h + 1.2, NF + 4.5, 4.7, 4.7, 0.4, 0xd8d8d4, { phys: false, seg: 16 }); continue; }
    if (kind === 'brick') { // v3.3: a red-brick apartment block with a gabled roof and plain windows
      solid('brick', xc, h / 2, NF + D / 2, w, h, D, tone, { tile: 2.4, phys: false }); B.add('roof', ROOF, M4(xc, h, NF + D / 2, D + 0.3, 3.6, w, 0, Math.PI / 2), roof, { tile: 2.2 });
      for (let i = 0; i < 5; i++) for (let j = 0; j < fl; j++) quad('facade', x0 + (i + 0.5) * w / 5, 1.9 + j * 3.3, NF - 0.01, 2.0, 2.6, Math.PI, cellUV(j === 0 && i === 2 ? FACADE.door : FACADE.small), 0xf4efe6);
      for (const gx of [x0 + 3, x1 - 3]) { solid('brick', gx, h + 1.6, NF + 0.5, 3, 3.2, 1, tone, { phys: false, tile: 2.4 }); B.add('roof', ROOF, M4(gx, h + 3.2, NF + 0.5, 3.3, 1.5, 1.4), roof, {}); } continue; }
    solid('stone', xc, h / 2, NF + D / 2, w, h, D, tone, { tile: 2.6, phys: false }); B.add('roof', ROOF, M4(xc, h, NF + D / 2, D + 0.3, 3, w, 0, Math.PI / 2), roof, { tile: 2.2 });
    const bays = Math.round(w / 3); for (let i = 0; i < bays; i++) for (let j = 0; j < fl; j++) quad('facade', x0 + (i + 0.5) * w / bays, 1.9 + j * 3.3, NF - 0.01, w / bays * 0.85, 3.1, Math.PI, cellUV(j === 0 ? pick([FACADE.shopUpper, FACADE.door, FACADE.sashA]) : pick([FACADE.sashA, FACADE.sashB, FACADE.lit, FACADE.triple])), vt());
    if (roof === 0xb5523b) for (let x = x0 + 3; x < x1 - 2; x += 5) { solid('stone', x, h + 1.6, NF + 0.6, 2.2, 2.0, 1.2, tone, { phys: false }); B.add('roof', ROOF, M4(x, h + 2.6, NF + 0.6, 2.4, 1.1, 1.4), roof, {}); } } // dormers on the red-roofed ones
  boxBody(0, 4, NF + 5, 100, 8, 10); // north frontage body
  // v3.1.1: seal the north horizon - a taller back row of tenements/warehouses, side wings and trees (scenery only)
  for (let x = -96; x < 96; x += 12 + rand() * 6) { const w = 10 + rand() * 6, h = 20 + rand() * 12, z0 = NF + 12 + rand() * 6, tone = pick(SAND), xc = x + w / 2;
    solid('stone', xc, h / 2, z0 + 6, w, h, 12, tone, { tile: 3 + rand(), phys: false }); B.add('roof', ROOF, M4(xc, h, z0 + 6, 12.3, 2.6, w, 0, Math.PI / 2), pick([0x5c6168, 0x5c6168, 0xb5523b]), { tile: 2.2 });
    const bays = Math.round(w / 3); for (let i = 0; i < bays; i++) for (let j = 2; j < Math.floor(h / 3.3); j++) quad('facade', x + (i + 0.5) * w / bays, 1.9 + j * 3.3, z0 - 0.01, w / bays * 0.8, 3.0, Math.PI, cellUV(pick([FACADE.sashA, FACADE.sashB, FACADE.small, FACADE.lit])), vt(0xd8cfbf));
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) for (let j = 2; j < Math.floor(h / 3.3); j++) quad('facade', xc + sx * (w / 2 + 0.01), 1.9 + j * 3.3, z0 + 1.5 + i * 3, 2.4, 3.0, sx * Math.PI / 2, cellUV(pick([FACADE.sashA, FACADE.small, FACADE.sashB])), vt(0xd8cfbf)); // v3.3: no more bare side walls
    for (let k = 0; k < 2; k++) cyl('flat', xc - w / 4 + k * w / 2, h + 1.6, z0 + 6, 0.5, 0.55, 2.2, tone, { phys: false, seg: 6 }); }
  { const x = 8, z = NF + 26; solid('stone', x, 16, z, 5, 32, 5, SAND[3], { phys: false, tile: 3 }); B.add('roof', new THREE.ConeGeometry(3.4, 14, 8), M4(x, 39, z, 1, 1, 1), 0x5c6168, {}); } // a church spire over the far-bank roofs
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const x = sx * (50 + k * 12), h = 16 + rand() * 8; solid('stone', x, h / 2, NF + 6 + k * 3, 11, h, 14, pick(SAND), { tile: 3, phys: false }); B.add('roof', ROOF, M4(x, h, NF + 6 + k * 3, 14.3, 2.6, 11, 0, Math.PI / 2), 0x5c6168, { tile: 2.2 });
    for (let i = 0; i < 3; i++) for (let j = 0; j < Math.floor(h / 3.3); j++) { quad('facade', x - 5.5 + (i + 0.5) * 11 / 3, 1.9 + j * 3.3, NF - 1.01 + k * 3, 3.0, 3.0, Math.PI, cellUV(pick([FACADE.sashA, FACADE.sashB, FACADE.lit])), vt()); // v3.3: river-facing + inner faces get windows
      quad('facade', x - sx * 5.51, 1.9 + j * 3.3, NF + 6 + k * 3 + (i - 1) * 4, 3.0, 3.0, -sx * Math.PI / 2, cellUV(pick([FACADE.sashA, FACADE.small])), vt()); } }
  for (let i = 0; i < 16; i++) { const x = -90 + rand() * 180, z = NF + 10.5 + rand() * 1.5, s2 = 0.8 + rand() * 0.6; cyl('wood', x, 2.5 * s2, z, 0.2, 0.28, 5 * s2, 0x4a3a2a, { phys: false, seg: 5 }); B.add('flat', new THREE.IcosahedronGeometry(2.8, 1), M4(x, 6.2 * s2, z, s2, s2 * 0.95, s2), pick([0x4f6a32, 0x5f7a3a, 0x46602c]), {}); }
  // v3.3: riverside trees on both banks - weeping willows trailing over the water and round-headed limes/sycamores (AG's river-channel photo)
  const WILLOW = new THREE.CylinderGeometry(2.3, 3.3, 4.6, 12, 2, true).toNonIndexed(); { const wp = WILLOW.attributes.position, wr = mulberry32(77), J = {}; for (let i = 0; i < wp.count; i++) { const kx = wp.getX(i).toFixed(2) + ',' + wp.getY(i).toFixed(2) + ',' + wp.getZ(i).toFixed(2), j = (J[kx] ||= [0.75 + wr() * 0.5, wr()]); const y = wp.getY(i); wp.setXYZ(i, wp.getX(i) * j[0], y < -2 ? y - j[1] * 1.6 : y, wp.getZ(i) * j[0]); } WILLOW.computeVertexNormals(); } // ragged trailing curtain
  const WCROWN = new THREE.IcosahedronGeometry(2.5, 0), RCROWN = new THREE.IcosahedronGeometry(2.4, 1);
  const willow = (x, z, sc = 1, phys = false) => { cyl('wood', x, 2.0 * sc, z, 0.2 * sc, 0.3 * sc, 4.0 * sc, 0x4a3a2a, { seg: 5, phys }); B.add('flat', WCROWN, M4(x, 5.6 * sc, z, sc, 0.7 * sc, sc), pick([0x6f7f36, 0x667834, 0x7a8a3e]), {});
    B.add('flat', WILLOW, M4(x, 3.6 * sc, z, sc, sc, sc, 0, rand() * 6), pick([0x6a7a34, 0x5f7230, 0x74863a]), {}); };
  const roundTree = (x, z, sc = 1, phys = false) => { cyl('wood', x, 2.2 * sc, z, 0.16 * sc, 0.22 * sc, 4.4 * sc, 0x4a3a2a, { seg: 5, phys }); B.add('flat', RCROWN, M4(x, 5.6 * sc, z, sc, 1.1 * sc, sc), pick([0x4f6a32, 0x5f7a3a, 0x46602c]), {}); };
  for (let i = 0; i < 9; i++) { const x = -40 + i * 10 + rand() * 3; (i % 2 ? roundTree : willow)(x, RN + 1.6, 0.9 + rand() * 0.25, true); } // far-bank quayside trees
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const x = sx * (50 + i * 11 + rand() * 3); for (const zb of [RS - 1.5, RN + 1.6]) (rand() < 0.6 ? willow : roundTree)(x, zb, 1 + rand() * 0.3); } // both banks, beyond the play area, closing the river vista
  for (const x of [-41.5, 41.5]) willow(x, RS - 1.6, 0.95, true); // two willows on the Shore side, at the ends of the quay
  // moored boats and a pontoon in the river
  { // v3.1.1: proper moored boats - pointed hull (extruded plan), rubbing strake, cabin with windows, mast
    const plan = (L, Wd) => { const sh = new THREE.Shape(); sh.moveTo(-L / 2, -Wd / 2 + 0.25); sh.quadraticCurveTo(-L / 2, -Wd / 2, -L / 2 + 0.4, -Wd / 2); sh.lineTo(L / 2 - 1.6, -Wd / 2); sh.quadraticCurveTo(L / 2 - 0.3, -Wd / 2 + 0.1, L / 2, 0); sh.quadraticCurveTo(L / 2 - 0.3, Wd / 2 - 0.1, L / 2 - 1.6, Wd / 2); sh.lineTo(-L / 2 + 0.4, Wd / 2); sh.quadraticCurveTo(-L / 2, Wd / 2, -L / 2, Wd / 2 - 0.25); sh.closePath(); return sh; };
    for (const [x, z, L, Wd, hull, strake, cab] of [[-30, RN - 2.1, 7, 2.3, 0x1f3a5f, 0xc8402e, 0xefe6d2], [24, RN - 2.0, 6, 2.1, 0x2f5a3c, 0xefe6d2, 0xe8d9b0], [-8, RN - 1.7, 4.2, 1.6, 0x8a2a2a, 0xefe6d2, null]]) {
      const hg = new THREE.ExtrudeGeometry(plan(L, Wd), { depth: 0.8, bevelEnabled: false, curveSegments: 5 }); hg.rotateX(-Math.PI / 2);
      B.add('flat', hg, M4(x, WY - 0.25, z, 1, 1, 1), hull, {});
      const sg = new THREE.ExtrudeGeometry(plan(L + 0.12, Wd + 0.12), { depth: 0.12, bevelEnabled: false, curveSegments: 5 }); sg.rotateX(-Math.PI / 2);
      B.add('flat', sg, M4(x, WY + 0.47, z, 1, 1, 1), strake, {});
      solid('wood', x, WY + 0.56, z, L - 0.6, 0.04, Wd - 0.3, 0x8a6a46, { phys: false }); // deck
      if (cab) { solid('flat', x - L * 0.12, WY + 1.05, z, L * 0.36, 0.95, Wd * 0.66, cab, { phys: false }); solid('flat', x - L * 0.12, WY + 1.56, z, L * 0.4, 0.08, Wd * 0.72, hull, { phys: false });
        for (const s2 of [-1, 1]) solid('glass', x - L * 0.12, WY + 1.2, z + s2 * Wd * 0.335, L * 0.28, 0.3, 0.02, 0x2a3640, { phys: false });
        solid('glass', x - L * 0.12 + L * 0.181, WY + 1.2, z, 0.02, 0.3, Wd * 0.5, 0x2a3640, { phys: false });
        cyl('flat', x - L * 0.12, WY + 2.6, z, 0.04, 0.05, 2.2, 0xd8d4c8, { phys: false, seg: 5 }); }
      else for (const k of [-1, 1]) solid('wood', x + k * 0.6, WY + 0.75, z, 0.25, 0.08, Wd - 0.4, 0x8a6a46, { phys: false }); } }
  // lamps along the Shore
  for (const x of [-36, -20, -2, 22, 36]) { cyl('metal', x, 2.8, F + 2.3, 0.07, 0.1, 5.6, IRON, { seg: 6 }); solid('flat', x, 5.5, F + 2.0, 0.08, 0.08, 0.7, IRON, { phys: false }); solid('glass', x, 5.25, F + 1.7, 0.4, 0.55, 0.4, 0xffffff, { phys: false }); B.add('lamp', BOX, M4(x, 5.25, F + 1.7, 0.26, 0.4, 0.26), 0xffffff, {}); }
  // far ends: the road bridge to the east and trees/buildings west (closes both river vistas)
  solid('stone', 52, 1.0, (RS + RN) / 2, 8, 3.6, RN - RS + 20, 0xc6b89c, { phys: false, tile: 1.5 }); B.add('flat', new THREE.CircleGeometry(3.4, 14, 0, Math.PI), M4(47.98, -1.6, (RS + RN) / 2, 1, 1, 1, 0, -Math.PI / 2), 0x23282a, {});
  for (let i = 0; i < 4; i++) { const x = 56 + i * 9, z = -6 + i * 4; solid('stone', x, 8, z, 8, 16, 10, pick(SAND), { phys: false, tile: 3 }); B.add('roof', ROOF, M4(x, 16, z, 10.3, 2.4, 8.2, 0, Math.PI / 2), 0x5c6168, {});
    for (let a = 0; a < 2; a++) for (let j = 0; j < 4; j++) { quad('facade', x - 4.01, 2.2 + j * 3.6, z - 2.5 + a * 5, 3.2, 3.2, -Math.PI / 2, cellUV(pick([FACADE.sashA, FACADE.sashB, FACADE.lit])), vt()); quad('facade', x - 2 + a * 4, 2.2 + j * 3.6, z + 5.01, 3.2, 3.2, 0, cellUV(pick([FACADE.sashA, FACADE.small])), vt()); } } // v3.3: windows on the end blocks
  { solid('stone', -62, 0.6, (RS + RN) / 2, 5, 1.4, RN - RS + 16, 0xc6b89c, { phys: false, tile: 1.5 }); B.add('flat', new THREE.CircleGeometry(4.2, 14, 0, Math.PI), M4(-59.48, -2.4, (RS + RN) / 2, 1, 1, 1, 0, Math.PI / 2), 0x23282a, {}); solid('stone', -62, 1.55, (RS + RN) / 2, 5.2, 0.5, RN - RS + 16, 0xa8a090, { phys: false }); // v3.3: a low road bridge closes the west vista (as AG's river photo)
    for (let i = 0; i < 5; i++) { const x = -74 - i * 10, z = -14 + i * 9, h = 12 + rand() * 10, tone = i % 2 ? 0xb89a8c : pick(SAND); solid(i % 2 ? 'brick' : 'stone', x, h / 2, z, 9, h, 12, tone, { phys: false, tile: 2.6 }); B.add('roof', ROOF, M4(x, h, z, 12.3, 2.4, 9.2, 0, Math.PI / 2), 0x5c6168, {});
      for (let a = 0; a < 3; a++) for (let j = 0; j < Math.floor(h / 3.4); j++) quad('facade', x + 4.51, 2.0 + j * 3.4, z - 4 + a * 4, 3.0, 3.0, Math.PI / 2, cellUV(pick([FACADE.sashA, FACADE.small, FACADE.lit])), vt()); } }
  for (let i = 0; i < 6; i++) { const x = -52 - i * 6, z = (RS + RN) / 2 + (rand() - 0.5) * 18; cyl('wood', x, 2, z, 0.25, 0.3, 4, 0x4a3a2a, { phys: false, seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(3, 1), M4(x, 6, z, 1, 0.9, 1), pick([0x4f6a32, 0x5f7a3a]), {}); }
  for (let i = 0; i < 25; i++) { const x = -42 + rand() * 84, z = F + 2.5 + rand() * (RS - F - 4); B.add('grime', QUAD, M4(x, 0.012, z, 1.5 + rand() * 2.5, 1.5 + rand() * 2, 1, -Math.PI / 2, rand() * 3), 0xffffff, { uvRect: GRIME_UV[rand() < 0.7 ? 0 : 1] }); }

  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[-10, 0, -4], [20, 0, -6], [-28, 0, 0], [0, 0, 18]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  { const m = materials.flat.clone(); m.map = slabTexture(); materials.slab = m; } { const m = materials.flat.clone(); m.map = gasBrickTexture(); materials.brick = m; }
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [26, -4, 112, 4] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  if (z > LT.RS && z < LT.RN) return Math.abs(x - LT.BX) < 1.6 ? 'setts' : 'water';
  if (z < LT.FRONT + 2.4) return 'paving';
  return 'setts';
}
export default {
  id: 'leith', name: 'The Shore, Leith', short: 'Leith', surfaceAt,
  sounds: { harbour: true, birds: [[-30, -20], [20, -20]], gulls: [[0, 20], [-30, 10], [30, 10]], boats: [[-30, 12], [24, 12]], water: [[-20, 6], [10, 6], [30, 6]], far: [[-40, -30], [40, -30], [0, 40]], roadX: 60 },
  blurb: 'Level 5: The Shore, Leith. 10 targets along the Water of Leith: the blue coffee box, the pub, the Malt Loft, the bridge and the Timber Bush. The river keeps whit it gets - mind the railings.',
  intro: "Welcome tae Leith!<br><small>The Shore and the Water o' Leith. Ball's at your feet. Easy first one: the blue police-box coffee stall, just ahead.</small>",
  build,
  tiers: { policebox: 'easy', pubdoor: 'easy', aboard: 'easy', maltloft: 'easy', bollard: 'easy', bridgetop: 'easy', shipwheel: 'tricky', bridgelamp: 'tricky', barrel: 'tricky', timberbush: 'tricky' },
  spawn: [26, 0.5, -4], spawnYaw: 112,
  ballHomes: () => [[23.6, 0.4, -3.0], [-2, 0.4, -4], [-20, 0.4, -4]],
  bounds: { x: 44, zMin: -26, zMax: RNX() },
  sea: { y: -1.35, water: -0.85, lostForGood: true, drift: [1, 0], lines: ["That's away doon the Water of Leith. Nae chance you're diving in after it.", "Gone. The river's got it now - it'll be in Fife by teatime.", "Plop. That ball's emigrated. Here's a new one, try no' tae lose it."] },
  next: 'easterroad',
};
function RNX() { return LT.RN + 6; }
