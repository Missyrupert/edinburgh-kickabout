// Level 10: The Royal Mile (v3.8). The High Street canyon: tall rubble and ashlar tenements (6 storeys, crow-step and dormer roofs),
// granite setts, closes and pends, fictional shops (a tartan weaver, a fudge kitchen, a whisky merchant - shopfronts, no caricatures),
// the crown spire of the (fictional) High Kirk of St Aidan, a mercat-cross-style drum and column, a heart set in the setts and a
// street performers' pitch. NEW twist: down the close - kick it through the narrow pend and it runs down Fiddler's Close to the bottom.
// The street runs along x (west = -x, towards the Castle; east = +x). North frontage at z = +FR, south at z = -FR.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32 } from '../world.js';

export const RM = { FR: 8, PEND: [19.1, 20.9], KIRK: [0, 38], SPAWN: [-50, 0.5, 1], SPAWNYAW: -90, CLOSE_DROP: 2.4 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P_) {
  const rand = mulberry32(1513), pick = (a) => a[Math.floor(rand() * a.length)];
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
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1), color, {}); return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface }) : null; }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, grime = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, tile });
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.8 + rand() * 0.2; return c.setRGB(c.r * k, c.g * k, c.b * k).getHex(); };
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const { FR, PEND } = RM, ACC = 0x7A3B5E, IRON = 0x34373c, D = 10;
  const ASHLAR = [0xd2c8b4, 0xc8bea8, 0xdcd2bc, 0xc0b6a0], RUBBLE = [0xc4b8a0, 0xbaae96, 0xccc0a8];
  const hex = (c) => '#' + new THREE.Color(c).getHexString();

  // ---------- ground: granite setts street, flagstone pavements, the close ----------
  boxBody(0, -1, -11, 140, 2, 38, { surface: 'setts' }); // z -30..8
  B.add('cobble', QUAD, M4(0, 0.006, 0, 140, 12.4, 1, -Math.PI / 2), 0xa8a6a0, { tile: 1.4 });
  for (const s of [-1, 1]) B.add('paving', QUAD, M4(0, 0.03, s * 7, 140, 2, 1, -Math.PI / 2), 0xbcb6aa, { tile: 1.6 });
  B.add('cobble', QUAD, M4(19, 0.007, -10.5, 40, 5, 1, -Math.PI / 2), 0x9c9a94, { tile: 1.4 }); // the kirk forecourt
  for (const s of [-1, 1]) solid('stone', 0, 0.06, s * 6.05, 140, 0.12, 0.25, 0x8e8c86, { phys: false });
  for (let i = 0; i < 40; i++) { const x = -65 + rand() * 130, z = -6 + rand() * 12, w = 1.5 + rand() * 3; quad('grime', x, 0.012, z, w, w * (0.6 + rand() * 0.5), rand() * 3, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }

  // ---------- tenements: tall rubble / ashlar lands, narrow windows, dormers, chimney stacks, soot ----------
  const doors = {};
  const shopDraw = { // window displays (drawn: cloth, fudge slabs, bottles, books) - shopfronts, not caricatures
    tartan: (g, w, h) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); for (let k = 0; k < 3; k++) { const x0 = 12 + k * 60; g.fillStyle = ['#2f4a7a', '#7a2a2a', '#2e5a3a'][k]; g.fillRect(x0, 20, 50, h - 30); g.globalAlpha = 0.55; for (let s = 0; s < 50; s += 12) { g.fillStyle = ['#e8d68a', '#1b1b1b', '#c8c8c8'][(s / 12 + k) % 3]; g.fillRect(x0 + s, 20, 3, h - 30); g.fillRect(x0, 24 + s * 1.6, 50, 3); } g.globalAlpha = 1; } },
    fudge: (g, w, h) => { g.fillStyle = '#3a2a20'; g.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) { g.fillStyle = '#8a6a4a'; g.fillRect(8, 44 + r * 28, w - 16, 4); for (let x = 14; x < w - 24; x += 22) { g.fillStyle = ['#c89a5a', '#a87444', '#e2c48c', '#7a4e30'][(x / 22 + r) % 4 | 0]; g.fillRect(x, 28 + r * 28, 18, 14); } } },
    whisky: (g, w, h) => { g.fillStyle = '#1e2420'; g.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) { g.fillStyle = '#5a4a38'; g.fillRect(6, 50 + r * 28, w - 12, 3); for (let x = 12; x < w - 12; x += 12) { g.fillStyle = ['#b8742a', '#d89a3a', '#8a5a22', '#c8b070'][(x / 12 + r) % 4 | 0]; g.fillRect(x, 30 + r * 28, 7, 20); g.fillRect(x + 2, 24 + r * 28, 3, 6); } } },
    books: (g, w, h) => { g.fillStyle = '#3a3028'; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) { g.fillStyle = '#6a5440'; g.fillRect(6, 40 + r * 22, w - 12, 4); for (let x = 10; x < w - 12; x += 7) { g.fillStyle = ['#7a2a2a', '#2a4a6a', '#c8b070', '#2e5a3a', '#e8e0d0'][(x + r * 3) % 5]; g.fillRect(x, 28 + r * 22, 5, 12); } } },
  };
  const winShop = {}; for (const k in shopDraw) winShop[k] = atlas.draw(192, 128, shopDraw[k]);
  const S0 = (name, col, draw, door = null, sub = null, fg = '#F1E3B8') => ({ name, col, draw, door, sub, fg });
  // north side (s = +1) and south side (s = -1) frontages: [x0, x1, storeys, shop]
  const NORTH = [[-64, -52, 6, S0('CANONGATE CASHMERE', 0x2e3e5a, 'tartan')], [-52, -42, 5, null], [-42, -29, 6, S0('THE TABLET TIN', 0x6a3a22, 'fudge', 'fudgedoor', 'MADE IN THE SHOP')], [-29, -19, 7, null],
    [-19, -8, 6, S0('CLOSE CORNER CAFE', 0x2e4a3a, 'books', null, 'SOUP · SCONES · COFFEE')], [-8, 2, 6, S0('LAWNMARKET SPIRITS', 0x1f3a2c, 'whisky', 'whiskydoor', 'WHISKY MERCHANTS')], [2, 12, 5, null], [12, PEND[0], 6, null],
    [PEND[1], 30, 6, null], [30, 40, 6, S0('HIGH STREET BOOKS', 0x5a2a2a, 'books')], [40, 52, 7, null], [52, 64, 6, S0('TOLBOOTH TEAROOM', ACC, 'fudge')]];
  const SOUTH = [[-64, -50, 6, S0('HEATHER & STONE', 0x3a3a4a, 'books', null, 'SILVER · GIFTS')], [-50, -38, 6, null], [-38, -26, 5, S0('ROYAL MILE GIFTS', 0x2a4a6a, 'tartan')], [-26, -14, 6, S0('THE TARTAN LOOM', 0x5a1f2a, 'tartan', null, 'WEAVERS SINCE 1902')], [-14, -2, 7, null],
    [40, 52, 6, S0('SCRIBBLERS STATIONERS', 0x2e3e3a, 'books')], [52, 64, 6, null]];
  function land(x0, x1, n, s, shop) {
    const w = x1 - x0, xc = (x0 + x1) / 2, H = 1.4 + n * 3, ry = s > 0 ? Math.PI : 0, rub = rand() < 0.45, tone = rub ? pick(RUBBLE) : pick(ASHLAR), key = rub ? 'castleStone' : 'stone';
    const Fz = (off) => s * (FR - off);
    solid(key, xc, H / 2, s * (FR + D / 2), w, H, D, tone, { tile: rub ? 3 : 3.4 });
    B.add('roof', ROOF, M4(xc, H, s * (FR + D / 2), D + 0.3, 3.6, w + 0.05, 0, Math.PI / 2), 0x4a4e54, { tile: 2.2 });
    if (rand() < 0.6) for (const e of [x0 + 0.4, x1 - 0.4]) for (let k = 0; k < 4; k++) solid(key, e, H + 0.45 + k * 0.85, s * (FR + 1 + k * 1.1), 0.8, 0.9, 1.2, tone, { phys: false }); // crow-stepped gable hints
    for (const fx of [x0 + w * 0.25, x0 + w * 0.75]) { solid(key, fx, H + 2.6, s * (FR + D / 2), 1.0, 3.2, 2.6, tone, { phys: false }); for (let m = -1; m <= 1; m++) cyl('flat', fx, H + 4.4, s * (FR + D / 2) + m * 0.7, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); }
    if (rand() < 0.7) { const dx = x0 + w * (0.3 + rand() * 0.4); solid('stone', dx, H + 1.0, s * (FR + 1.6), 1.6, 1.8, 1.6, tone, { phys: false }); quad('facade', dx, H + 1.0, Fz(-0.81), 1.0, 1.3, ry, cellUV(FACADE.small), vt()); }
    const cols = Math.max(2, Math.round(w / 2.6));
    for (let k = 0; k < cols; k++) for (let j = 1; j < n; j++) { const x = x0 + (k + 0.5) * w / cols; quad('facade', x, 1.4 + (j + 0.5) * 3, Fz(0.01), Math.min(1.5, w / cols * 0.6), 2.4, ry, cellUV(pick([FACADE.small, FACADE.sashA, FACADE.sashB, FACADE.smallLit])), vt()); }
    for (let j = 1; j < n; j += 2) solid(key, xc, 1.4 + j * 3, Fz(0.08), w, 0.16, 0.2, tone, { phys: false }); // string courses
    quad('grime', xc, H * 0.55, Fz(0.03), w, H * 1.05, ry, GRIME_UV[0], rub ? 0x6a604e : 0x7a6e5a); quad('grime', xc, H - 1.5, Fz(0.04), w, 3, ry, GRIME_UV[1], 0x5a5040);
    if (shop) { solid('wood', xc, 1.9, Fz(0.06), w - 0.8, 3.6, 0.12, shop.col, { phys: false });
      const dx = shop.door ? xc + w * 0.3 : null;
      quad('atlasLit', shop.door ? xc - w * 0.12 : xc, 1.7, Fz(0.13), shop.door ? w - 4.2 : w - 2.2, 2.0, ry, winShop[shop.draw]);
      quad('atlasLit', xc, 3.3, Fz(0.16), w - 1.2, 0.6, ry, atlas.fascia(shop.name, shop.sub, hex(shop.col), shop.fg, (w - 1.2) / 0.6));
      if (shop.door) { solid('wood', dx, 1.2, Fz(0.2), 1.1, 2.4, 0.1, 0x1d1d1d, { target: shop.door, surface: 'board' }); quad('atlas', dx, 1.2, Fz(0.26), 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); doors[shop.door] = { x: dx, z: Fz(0), s }; } }
    else for (let k = 0; k < Math.max(1, Math.round(w / 4)); k++) { const x = x0 + (k + 0.5) * w / Math.max(1, Math.round(w / 4)); quad('facade', x, 1.5, Fz(0.01), 1.6, 2.6, ry, cellUV(k % 2 ? FACADE.door : FACADE.sashA), vt()); }
  }
  for (const [x0, x1, n, shop] of NORTH) land(x0, x1, n, 1, shop);
  for (const [x0, x1, n, shop] of SOUTH) land(x0, x1, n, -1, shop);
  // the street carries on beyond both ends (hazy), the Hub-style spire up at the Castlehill end
  for (const [x, z, h] of [[-78, 10, 22], [-80, -12, 20], [78, 9, 20], [80, -10, 22]]) solid('stone', x, h / 2, z, 16, h, 12, pick(ASHLAR), { phys: false, tile: 3.4 });
  { const x = -92, z = -2; solid('stone', x, 14, z, 7, 28, 7, 0x8a8070, { phys: false, tile: 3 }); B.add('stone', new THREE.ConeGeometry(3.4, 34, 8), M4(x, 45, z, 1, 1, 1), 0x8a8070, { tile: 3 }); for (const a of [-1, 1]) for (const b of [-1, 1]) B.add('stone', new THREE.ConeGeometry(0.5, 6, 4), M4(x + a * 3.2, 31, z + b * 3.2, 1, 1, 1), 0x8a8070, {}); }
  for (const x of [-62, 62]) boxBody(x, 3, 0, 1, 6, 16, { playerOnly: true });

  // ---------- the pend and Fiddler's Close (NEW twist: down the close) ----------
  { const [p0, p1] = PEND, pc = (p0 + p1) / 2, pw = p1 - p0, H = 1.4 + 6 * 3, al = Math.atan(RM.CLOSE_DROP / 16), L = Math.hypot(16, RM.CLOSE_DROP);
    solid('castleStone', pc, (3.2 + H) / 2, FR + D / 2, pw + 0.02, H - 3.2, D, 0x948a76, { tile: 3 }); // the land over the pend
    quad('atlasLit', pc, 3.75, FR - 0.03, 2.4, 0.42, Math.PI, atlas.sign("FIDDLER'S CLOSE", '#1c1c1c', '#e8e0c8', 2.4 / 0.42, 'bold 40px Georgia'));
    for (const s of [-1, 1]) solid('stone', pc + s * (pw / 2 + 0.12), 1.6, FR - 0.05, 0.24, 3.2, 0.2, 0xc4b89c, { phys: false }); solid('stone', pc, 3.25, FR - 0.05, pw + 0.48, 0.3, 0.2, 0xc4b89c, { phys: false }); // dressed surround
    boxBody(pc, -1, 10, pw + 1, 2, 4, { surface: 'setts' }); // pend floor z 8..12
    B.add('cobble', QUAD, M4(pc, 0.006, 10, pw, 4, 1, -Math.PI / 2), 0x9a9890, { tile: 1.4 });
    body(new CANNON.Box(new CANNON.Vec3(pw / 2 + 0.5, 0.5, L / 2)), pc, -RM.CLOSE_DROP / 2 - 0.5 / Math.cos(al), 20, { rx: al, surface: 'setts' }); // the ramp, falling to the north
    B.add('cobble', QUAD, M4(pc, -RM.CLOSE_DROP / 2 + 0.01, 20, pw, L, 1, -Math.PI / 2 + al), 0x8e8c86, { tile: 1.4 });
    for (let k = 0; k < 8; k++) { const z = 12.5 + k * 2, y = -(z - 12) * RM.CLOSE_DROP / 16; solid('stone', pc, y + 0.02, z, pw, 0.04, 0.12, 0x7a786e, { phys: false }); } // worn step edges
    boxBody(pc, -RM.CLOSE_DROP - 0.5, 31, pw + 1, 1, 6, { surface: 'setts' }); B.add('cobble', QUAD, M4(pc, -RM.CLOSE_DROP + 0.01, 30.5, pw, 5, 1, -Math.PI / 2), 0x8a8880, { tile: 1.4 });
    for (const s of [-1, 1]) { solid('castleStone', pc + s * (pw / 2 + 0.5), 4, 25.5, 1, 14, 15, 0x7e7464, { tile: 3 }); }
    solid('castleStone', pc, 4, 34, pw + 2, 14, 2, 0x7e7464, { tile: 3 }); // the close bottom wall (a door to the next street)
    solid('wood', pc, -RM.CLOSE_DROP + 1.2, 32.94, 1.2, 2.4, 0.1, 0x3a2a20, { phys: false }); cyl('lamp', pc + 0.75, -RM.CLOSE_DROP + 2.8, 32.8, 0.12, 0.12, 0.36, 0xffffff, { phys: false, seg: 6 });
    for (let k = 0; k < 6; k++) { const z = 13 + k * 2.6, y = -(z - 12) * RM.CLOSE_DROP / 16; cyl('metal', pc, y + 0.5, z, 0.025, 0.025, 1.0, IRON, { phys: false, seg: 4 }); } solid('metal', pc, -RM.CLOSE_DROP / 2 + 1.0, 20, 0.05, 0.05, L, IRON, { phys: false, rx: al }); // central handrail
    const zb = new THREE.Box3(V(p0, -RM.CLOSE_DROP - 0.1, 27.5), V(p1, -RM.CLOSE_DROP + 1.6, 33));
    addTarget({ id: 'closedown', name: "Doon Fiddler's Close", hint: "NEW: kick it through the narrow pend - it runs doon the close tae the bottom", points: 150, kind: 'zone', kickOnly: true, pos: V(pc, 0, 4), ringR: 1.0, stand: V(pc, 0, -1.5), aim: V(pc, 0.4, 14), zone: zb,
      lines: ["Doon the close an' oot the ither end!", "Through the pend - a needle an' thread job.", 'The close echoes: GOAL... goal... goal.'] }); }

  // ---------- the High Kirk of St Aidan (fictional) and its crown spire ----------
  { const [k0, k1] = RM.KIRK, KC = 0xb0a894, zf = -12.5, zb = -27, kc = (k0 + k1) / 2;
    solid('castleStone', kc, 7, (zf + zb) / 2, k1 - k0, 14, zb - zf < 0 ? zf - zb : zb - zf, KC, { tile: 3.2 }); B.add('roof', ROOF, M4(kc, 14, (zf + zb) / 2, zf - zb + 0.4, 4.4, k1 - k0 + 0.3, 0, Math.PI / 2), 0x55585c, { tile: 2.2 });
    for (let x = k0 + 2; x < k1 - 1; x += 4) { solid('castleStone', x, 5, zf + 0.4, 0.9, 10, 0.8, KC, { phys: false }); B.add('stone', new THREE.ConeGeometry(0.45, 2.2, 4), M4(x, 15.2, zf + 0.4, 1, 1, 1), KC, {}); }
    for (let x = k0 + 4; x < k1 - 2; x += 4) { if (Math.abs(x - 28) < 1.5) continue; quad('flat', x, 7.2, zf + 0.02, 1.6, 6, 0, null, 0x2a3440); B.add('flat', new THREE.ConeGeometry(0.8, 1.4, 3), M4(x, 10.9, zf + 0.03, 1, 1, 0.05), 0x2a3440, {}); solid('stone', x, 7.2, zf + 0.05, 0.12, 6, 0.06, 0xb0a894, { phys: false }); }
    // west door: a pointed arch with a hit-board door (target)
    solid('castleStone', 28, 2.2, zf + 0.3, 3.2, 4.4, 0.8, 0x7a7262, { phys: false }); B.add('stone', new THREE.ConeGeometry(1.6, 1.8, 3), M4(28, 5.2, zf + 0.72, 1, 1, 0.1), 0x7a7262, {});
    solid('wood', 28, 1.4, zf + 0.75, 1.8, 2.8, 0.12, 0x3a2418, { target: 'kirkdoor', surface: 'board' }); quad('atlas', 28, 1.4, zf + 0.82, 1.8, 2.8, 0, atlas.draw(128, 256, drawTargetDoor));
    quad('atlasLit', 33, 1.5, zf + 0.03, 1.6, 1.0, 0, atlas.draw(160, 100, (g, w, h) => { g.fillStyle = '#2a2a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d8a0'; g.textAlign = 'center'; g.font = 'bold 14px Georgia'; g.fillText('HIGH KIRK OF ST AIDAN', w / 2, 24); g.font = '12px Georgia'; g.fillText('Open daily · All welcome', w / 2, 50); g.fillText('Concerts Thursdays', w / 2, 72); }));
    addTarget({ id: 'kirkdoor', name: 'Kirk Door', hint: 'hit the west door of the High Kirk', points: 75, kind: 'hit', pos: V(28, 0, -10.5), ringR: 1.0, stand: V(28, 0, -5), aim: V(28, 1.2, zf + 0.75), lines: ['The bells answered!', 'Sanctuary! (For the ba\'.)', 'The verger tutted, then smiled.'] });
    // the crown spire on the central tower
    const tx = 19, tz = -19.5, T = 6.4, TH = 26;
    solid('castleStone', tx, TH / 2, tz, T, TH, T, KC, { tile: 3 }); solid('stone', tx, TH + 0.4, tz, T + 0.6, 0.8, T + 0.6, 0x7a7262, { phys: false });
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const cx = tx + a * T / 2, cz = tz + b * T / 2; B.add('stone', new THREE.ConeGeometry(0.5, 3.4, 4), M4(cx, TH + 2.5, cz, 1, 1, 1), KC, {});
      const from = V(cx, TH + 0.8, cz), to = V(tx, TH + 7.2, tz), d = to.clone().sub(from), len = d.length(), mid = from.clone().add(to).multiplyScalar(0.5); // flying ribs to the crown
      B.add('stone', BOX, new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(0.4, len, 0.4)), KC, {});
      for (const f of [0.35, 0.65]) { const p = from.clone().lerp(to, f); B.add('stone', new THREE.ConeGeometry(0.22, 1.2, 4), M4(p.x, p.y + 0.6, p.z, 1, 1, 1), KC, {}); } }
    for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const from = V(tx + a * T / 2, TH + 0.8, tz + b * T / 2), to = V(tx, TH + 7.2, tz), d = to.clone().sub(from), len = d.length(), mid = from.clone().add(to).multiplyScalar(0.5);
      B.add('stone', BOX, new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(0.32, len, 0.32)), KC, {}); }
    cyl('stone', tx, TH + 8.2, tz, 0.7, 0.9, 2.2, KC, { phys: false, seg: 8 }); B.add('stone', new THREE.ConeGeometry(0.8, 4.6, 8), M4(tx, TH + 11.6, tz, 1, 1, 1), KC, {}); cyl('metal', tx, TH + 14.4, tz, 0.04, 0.04, 1.2, 0xc8a040, { phys: false, seg: 4 });
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) quad('facade', tx, 10 + j * 5, tz + s * (T / 2 + 0.01), 1.2, 2.6, s > 0 ? 0 : Math.PI, cellUV(FACADE.small));
  }
  // the heart in the setts (a heart picked out in red and grey setts) - zone target
  { quad('atlas', 9, 0.045, -7.6, 2.2, 2.2, 0, atlas.draw(160, 160, (g, w, h) => { g.fillStyle = '#9a9890'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const x = (i + 0.5) / 16 * 2 - 1, y = -((j + 0.5) / 16 * 2 - 1) * 1.1 + 0.25, r = (x * x + y * y - 0.45) ** 3 - x * x * y ** 3; g.fillStyle = r < 0 ? ((i + j) % 2 ? '#a8443a' : '#8a3a32') : ((i + j) % 3 ? '#8e8c86' : '#a6a49e'); g.fillRect(i * 10 + 1, j * 10 + 1, 8, 8); } }), 0xffffff, { rx: -Math.PI / 2 });
    addTarget({ id: 'heart', name: 'Heart in the Setts', hint: 'roll it ower the heart in the setts', points: 75, kind: 'zone', kickOnly: true, pos: V(9, 0, -4.5), ringR: 0.9, stand: V(9, 0, -2.4), aim: V(9, 0.2, -7.6), zone: new THREE.Box3(V(8.1, -0.1, -8.5), V(9.9, 0.7, -6.7)),
      lines: ["Ye're meant tae spit on it, no' kick it!", 'Heart o\' the toon - bang on.', 'Lucky heart. Lucky ba\'.'] }); }

  // ---------- the mercat cross (octagonal drum, column, gilded finial) ----------
  { const x = 46, z = -3.2; cyl('stone', x, 1.3, z, 1.9, 1.9, 2.6, 0xd0c4aa, { seg: 8 }); solid('stone', x, 2.7, z, 4.0, 0.2, 4.0, 0xa89c84, { phys: false, ry: Math.PI / 8 });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; quad('facade', x + Math.sin(a) * 1.92, 1.6, z + Math.cos(a) * 1.92, 0.7, 1.1, a, cellUV(FACADE.arch), 0xc8bca0); }
    cyl('stone', x, 5.2, z, 0.26, 0.3, 5.0, 0xb4a88e, { seg: 8, target: 'mercat', surface: 'stone' }); cyl('stone', x, 7.9, z, 0.5, 0.36, 0.4, 0xb4a88e, { phys: false, seg: 8 });
    B.add('metal', new THREE.IcosahedronGeometry(0.42, 0), M4(x, 8.5, z, 1, 1.3, 1), 0xd8b048, {});
    addTarget({ id: 'mercat', name: 'Mercat Cross', hint: 'chip it up tae the column on the mercat cross', points: 100, kind: 'hit', pos: V(x, 0, 2.2), ringR: 1.0, stand: V(x, 0, 4.5), aim: V(x, 4.2, z), lines: ['Hear ye, hear ye: a cracker o\' a strike!', 'Proclaimed fae the mercat cross: GOAL.', 'The heralds wid be proud.'] }); }

  // ---------- the street performers' pitch (easy first): chalk circle, a hat, an open case ----------
  { const x = -43, z = -1.8;
    quad('atlas', x, 0.018, z, 4.2, 4.2, 0, atlas.draw(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#9a9890'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2f0e8'; g.lineWidth = 4; g.setLineDash([10, 6]); g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = '#f2f0e8'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('SHOW AT 2 & 4', w / 2, 22); }), 0xffffff, { rx: -Math.PI / 2 });
    cyl('flat', x, 0.09, z, 0.36, 0.3, 0.18, 0x2a2a30, { phys: false, seg: 12 }); cyl('flat', x, 0.2, z, 0.2, 0.2, 0.2, 0x2a2a30, { phys: false, seg: 10 }); // a hat, upturned
    solid('wood', x + 1.1, 0.06, z + 0.6, 1.0, 0.12, 0.4, 0x6a3a22, { phys: false }); solid('flat', x + 1.1, 0.13, z + 0.6, 0.9, 0.04, 0.32, 0x7a2a3a, { phys: false });
    solid('wood', x - 1.6, 0.4, z - 1.4, 0.9, 0.8, 0.6, 0x5a4030, { phys: false }); cyl('flat', x - 1.6, 1.1, z - 1.4, 0.06, 0.08, 0.6, 0xeae6da, { phys: false, seg: 6 }); // a performer's box + juggling club
    addTarget({ id: 'busker', name: "Performer's Pitch", hint: "roll it intae the performers' chalk circle", points: 50, kind: 'zone', kickOnly: true, pos: V(x - 3.2, 0, z), ringR: 0.8, stand: V(x - 5, 0, z), aim: V(x, 0.2, z), zone: new THREE.Box3(V(x - 1.3, -0.1, z - 1.3), V(x + 1.3, 0.9, z + 1.3)),
      lines: ["The crowd goes 'oooh'!", 'Best act on the Mile the day.', 'Hat\'s oot - a round o\' applause!'] }); }

  // ---------- hanging tartan-weaver sign (bracket sign over the south pavement) ----------
  { const x = -20, z = -FR + 1.3, y = 3.4;
    solid('metal', x, y + 0.6, -FR + 0.7, 0.06, 0.06, 1.5, IRON, { phys: false }); solid('wood', x, y, z, 0.12, 0.8, 1.3, 0x5a1f2a, { target: 'tartansign', surface: 'board' });
    for (const r of [Math.PI / 2, -Math.PI / 2]) quad('atlasLit', x + (r > 0 ? 0.07 : -0.07), y, z, 1.24, 0.74, r, atlas.draw(128, 88, (g, w, h) => { g.fillStyle = '#5a1f2a'; g.fillRect(0, 0, w, h); g.globalAlpha = 0.5; for (let s = 0; s < w; s += 16) { g.fillStyle = s % 32 ? '#1f3a2a' : '#e8d68a'; g.fillRect(s, 0, 5, h); g.fillRect(0, s * 0.7, w, 4); } g.globalAlpha = 1; g.fillStyle = '#f1e3b8'; g.font = 'bold 18px Georgia'; g.textAlign = 'center'; g.fillText('THE LOOM', w / 2, h / 2 + 6); }));
    addTarget({ id: 'tartansign', name: 'Weaver\'s Hanging Sign', hint: 'hit the hanging sign ower the pavement', points: 100, kind: 'hit', pos: V(x - 3, 0, z), ringR: 0.9, stand: V(x - 5.5, 0, z + 0.4), aim: V(x, y, z), lines: ['Swingin\'!', 'Sign\'s still birlin\'.', 'Woven intae Mile legend.'] }); }

  // ---------- a window box on a first-floor sill (hard) ----------
  { const x = 35, y = 3.95; solid('wood', x, y, FR - 0.3, 2.4, 0.5, 0.6, 0x3a5a2a, { target: 'windowbox', surface: 'board' }); for (let k = 0; k < 6; k++) B.add('flat', new THREE.IcosahedronGeometry(0.16, 0), M4(x - 0.62 + k * 0.25, y + 0.26, FR - 0.25, 1, 1, 1), pick([0xc8304a, 0xe8c040, 0xd85a8a, 0x3a7a2a]), {});
    addTarget({ id: 'windowbox', name: 'First-Floor Window Box', hint: 'chip it intae the window box on the first flair', points: 150, kind: 'hit', pos: V(x, 0, 4.0), ringR: 0.9, stand: V(x, 0, -0.5), aim: V(x, y, FR - 0.3), lines: ['The geraniums have been visited.', 'A wifie leaned oot: "That\'s ma box!"', 'Floral tribute, delivered.'] }); }

  // ---------- an A-board for the walking tour (east end) ----------
  { const x = 55, z = 3.2; for (const s of [-1, 1]) solid('wood', x, 0.55, z + s * 0.2, 0.9, 1.1, 0.05, 0x1f2f4a, { phys: false, rx: s * 0.18 });
    body(new CANNON.Box(new CANNON.Vec3(0.45, 0.55, 0.22)), x, 0.55, z, { target: 'tourboard', surface: 'board' });
    for (const s of [-1, 1]) quad('atlasLit', x, 0.62, z + s * 0.32, 0.8, 0.9, s > 0 ? 0 : Math.PI, atlas.draw(96, 108, (g, w, h) => { g.fillStyle = '#1f2f4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f1e3b8'; g.textAlign = 'center'; g.font = 'bold 13px Georgia'; g.fillText('OLD TOWN', w / 2, 22); g.fillText('WALKS', w / 2, 40); g.font = '11px Georgia'; g.fillText('Closes & Ghosts', w / 2, 66); g.fillText('Daily 7pm', w / 2, 84); }), 0xffffff, { rx: s * 0.18 });
    addTarget({ id: 'tourboard', name: 'Tour A-Board', hint: 'hit the walking-tour A-board', points: 50, kind: 'hit', pos: V(x - 3, 0, z), ringR: 0.9, stand: V(x - 6, 0, z), aim: V(x, 0.6, z), lines: ['Tour starts noo - follow that ba\'!', 'Ghosts: rattled.', 'Booked on.'] }); }

  // the fudge and whisky doors (north side, face -z)
  for (const [id, name, hint, lines, pts] of [['fudgedoor', 'Tablet Tin Door', 'hit the Tablet Tin door', ['Sweet strike!', 'Tablet for the winner.', 'Melted their hearts.'], 50], ['whiskydoor', 'Whisky Merchant Door', 'hit the whisky merchant\'s door', ['Neat!', 'Aged twelve seconds in the air.', 'A dram fine kick.'], 75]]) {
    const d = doors[id]; addTarget({ id, name, hint, points: pts, kind: 'hit', pos: V(d.x, 0, FR - 1.3), ringR: 1.0, stand: V(d.x - 2, 0, FR - 6.2), aim: V(d.x, 1.0, FR - 0.2), lines }); }

  // ---------- street furniture: heritage lamps, bollards, bins ----------
  for (let x = -56; x <= 58; x += 14) for (const s of [-1, 1]) { if (s < 0 && x > 0 && x < 40) continue; if (s > 0 && (Math.abs(x - 20) < 2 || Math.abs(x) < 2)) continue; const z = s * 6.6;
    cyl('metal', x, 2.2, z, 0.07, 0.11, 4.4, IRON, { seg: 6 }); solid('lamp', x, 4.6, z, 0.36, 0.5, 0.36, 0xffffff, { phys: false }); B.add('metal', new THREE.ConeGeometry(0.32, 0.3, 4), M4(x, 5.0, z, 1, 1, 1, 0, Math.PI / 4), IRON, {}); }
  for (let x = 2; x < 38; x += 3.2) if (Math.abs(x - 28) > 2.2 && Math.abs(x - 9) > 2) cyl('metal', x, 0.45, -8.2, 0.1, 0.11, 0.9, IRON, { seg: 6 });
  for (const x of [-30, 44]) solid('flat', x, 0.55, -6.6, 0.6, 1.1, 0.6, 0x2a2a2a, {});

  const groups = [V(-30, 0, 3), V(10, 0, -9), V(50, 0, 1)];
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P_, facadeTex, atlas.tex); materials.flat.side = THREE.DoubleSide;
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P_.shadows });
  const views = { spawn: [-50, 1, -90, 4, 0.5], kirk: [4, 3, -35, 16, 0.5], close: [20, -2, 180, 2, 0.5], east: [30, 0, -90, 6, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) { return Math.abs(z) > 6.1 && Math.abs(z) < RM.FR && !(z < 0 && x > 0 && x < 38) ? 'paving' : 'setts'; }
export default {
  id: 'royalmile', name: 'The Royal Mile', short: 'Royal Mile', surfaceAt,
  sounds: { birds: [[-30, 0], [30, -10]], gulls: [[0, 20], [-40, -20]], far: [[-70, 0], [70, 0], [0, 30], [0, -40]], roadX: 80 },
  blurb: "Level 10: The Royal Mile. Setts, closes and the crown spire. 10 targets. NEW: doon the close - kick it through the pend.",
  intro: "Welcome tae the Royal Mile!<br><small>Tall lands, setts underfoot, the crown spire up ahead. Easy first one: roll it intae the performers' chalk circle.</small>",
  build,
  tiers: { busker: 'easy', fudgedoor: 'easy', tourboard: 'easy', whiskydoor: 'easy', kirkdoor: 'easy', heart: 'tricky', mercat: 'tricky', tartansign: 'tricky', closedown: 'tricky', windowbox: 'tricky' },
  spawn: RM.SPAWN, spawnYaw: RM.SPAWNYAW,
  ballHomes: () => [[-48, 0.4, 1.5], [0, 0.4, 0], [40, 0.4, 2]],
  bounds: { x: 62, zMin: -30, zMax: 36 },
  next: 'esplanade',
};
