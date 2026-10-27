// Level 8: Stockbridge (v3.13). Raeburn Place's blonde-sandstone tenements and bright painted shopfronts (fictional names) run north
// to the Stock Brig over the Water of Leith; the old market gateway (Doric columns, carved lintel) opens off the left onto a riverside
// market court with yellow stalls. Over the bridge: the wee clock tower building on the corner, Circus Lane's cobbled mews curving off
// right, and St Stephen's tall tower closing the view at the end of St Stephen Street. North = +z, ground y = 0, river bed y = -3.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32 } from '../world.js';

export const SB = { RW: 5.5, F: 9, Z0: -66, RIV: [11.6, 22.4], END: 88, LANE: [44, 50] };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P_) {
  const rand = mulberry32(1824), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const flat = (key, x, y, z, w, d, color, tile = 0) => B.add(key, QUAD, M4(x, y, z, w, d, 1, -Math.PI / 2, 0), color, { tile });
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const { RW, F, Z0, RIV, END, LANE } = SB, TAR = 0x6e706e, SLAB = 0xc4c0b6, KERB = 0x9a9890, IRON = 0x2c3034;
  const SAND = [0xd8c8a4, 0xcfbe98, 0xdcccaa, 0xc6b48e, 0xd2c29e], GEO = [0xcdc3ae, 0xc4b8a0, 0xd6ccb6];
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.82 + rand() * 0.2; return c.setRGB(c.r * k, c.g * k, c.b * k).getHex(); };
  // side s = +1 left (x > 0, faces -x), -1 right (x < 0, faces +x). fx = frontage x; ry of a quad facing the street
  const FRY = (s) => s > 0 ? -Math.PI / 2 : Math.PI / 2;

  // ---------- ground: south street, river channel, bridge, north street, Circus Lane ----------
  boxBody(0, -1, (Z0 - 6 + RIV[0]) / 2, 140, 2, RIV[0] - Z0 + 6, { surface: 'tarmac' }); boxBody(0, -1, (RIV[1] + 120) / 2, 140, 2, 120 - RIV[1], { surface: 'tarmac' });
  boxBody(0, -3.5, 17, 140, 1, 12, { surface: 'grass' }); boxBody(0, -0.6, 17, 20, 1.2, RIV[1] - RIV[0] + 0.4, { surface: 'tarmac' }); // river bed + bridge deck
  for (const [z0, z1] of [[Z0 - 4, RIV[0]], [RIV[0], RIV[1]], [RIV[1], END]]) { const zc = (z0 + z1) / 2, L = z1 - z0; flat('tarmac', 0, 0.012, zc, 2 * RW, L, TAR, 4);
    for (const s of [-1, 1]) { flat('slab', s * (RW + 1.75), 0.022, zc, 3.5, L, SLAB, 1.8); solid('stone', s * RW, 0.06, zc, 0.3, 0.12, L, KERB, { phys: false }); }
    if (z0 < 0) for (const s of [-1, 1]) solid('flat', s * (RW - 0.25), 0.016, zc, 0.1, 0.01, L - 2, 0xe8c840, { phys: false }); } // double yellows
  for (let z = Z0; z < END - 4; z += 6) if (z < RIV[0] - 2 || z > RIV[1] + 2) solid('flat', 0, 0.016, z, 0.15, 0.01, 2.6, 0xe8e6de, { phys: false });
  flat('slab', -35, 0.03, (LANE[0] + LANE[1]) / 2, 52, LANE[1] - LANE[0], 0x7a746a, 0.9); // Circus Lane setts
  flat('slab', 0, 0.03, 0, 0.01, 0.01, SLAB); // (keeps the slab batch alive)
  for (let i = 0; i < 18; i++) { const x = (rand() - 0.5) * 2 * RW, z = Z0 + rand() * (END - Z0); if (z > RIV[0] - 1 && z < RIV[1] + 1) continue; quad('grime', x, 0.03, z, 1.5 + rand() * 3, 1 + rand() * 2, 0, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }

  // ---------- Raeburn Place: tenements with painted shopfronts ----------
  const winShop = atlas.draw(192, 128, (g, w, h) => { g.fillStyle = '#3a3026'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,240,200,0.4)'; g.fillRect(0, 0, w, 12); for (let r = 0; r < 3; r++) { g.fillStyle = '#6a5440'; g.fillRect(8, 44 + r * 28, w - 16, 4); for (let x = 12; x < w - 14; x += 10) { g.fillStyle = ['#d8c8a0', '#a8c070', '#e09060', '#f0e0c0', '#7090b0'][(x * 3 + r) % 5]; g.fillRect(x, 28 + r * 28, 8, 16); } } });
  const mural = atlas.draw(160, 128, (g, w, h) => { g.fillStyle = '#2e3236'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a4a22'; g.beginPath(); g.ellipse(80, 70, 34, 40, 0, 0, 7); g.fill(); g.fillStyle = '#6a3414'; g.beginPath(); g.ellipse(44, 84, 16, 36, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(116, 84, 16, 36, -0.3, 0, 7); g.fill();
    g.fillStyle = '#c88a5a'; g.beginPath(); g.ellipse(80, 92, 18, 14, 0, 0, 7); g.fill(); g.fillStyle = '#111'; for (const x of [66, 94]) { g.beginPath(); g.arc(x, 62, 5, 0, 7); g.fill(); } g.beginPath(); g.arc(80, 84, 6, 0, 7); g.fill(); g.fillStyle = '#e06a7a'; g.fillRect(74, 98, 12, 18); });
  const doors = {};
  function S0(name, col, door = null, fg = '#F6F0E0', sub = null) { return { name, col, door, fg, sub }; }
  function tenement(s, zc, w, sh, { storeys = 4, tone = pick(SAND), stair = false } = {}) {
    const fx = s * F, D = 11, H = 1 + storeys * 3.2, ry = FRY(s), bx = fx + s * D / 2;
    solid('stone', bx, H / 2, zc, D, H, w, tone, { tile: 3.2 + rand() }); B.add('roof', ROOF, M4(bx, H, zc, D + 0.3, 3.2, w + 0.04), 0x50555c, { tile: 2.2 });
    solid('stone', fx - s * 0.2, H - 0.25, zc, 0.4, 0.5, w + 0.1, 0xd8ccae, { phys: false }); solid('stone', fx - s * 0.15, 4.1, zc, 0.3, 0.28, w, 0xd8ccae, { phys: false });
    const nc = Math.max(2, Math.round(w / 3.3)); for (let k = 0; k < nc; k++) for (let j = 1; j < storeys; j++) quad('facade', fx - s * 0.01, 4.3 + (j - 0.5) * 3.2, zc - w / 2 + (k + 0.5) * w / nc, w / nc * 0.74, 3.0, ry, cellUV(j === storeys - 1 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit])), vt());
    for (const k of [-0.32, 0.32]) { solid('stone', bx, H + 2.3, zc + k * w, 3.2, 2.8, 1.1, tone, { phys: false, tile: 2.6 }); for (let m = -1; m <= 1; m++) cyl('flat', bx + m * 0.8, H + 4, zc + k * w, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); }
    quad('grime', fx - s * 0.03, H / 2, zc, w, H, ry, GRIME_UV[0], 0x8a7a64);
    if (sh) { solid('flat', fx - s * 0.06, 1.95, zc, 0.12, 3.9, w - 0.6, sh.col, { phys: false });
      if (sh.mural) quad('atlas', fx - s * 0.13, 1.8, zc + w * 0.18, w * 0.5, 2.6, ry, mural); else quad('atlasLit', fx - s * 0.13, 1.7, zc - (sh.door ? s * w * 0.1 : 0), w - (sh.door ? 3 : 1.6), 2.1, ry, winShop);
      quad('atlasLit', fx - s * 0.16, 3.4, zc, w - 1, 0.62, ry, atlas.fascia(sh.name, sh.sub, '#' + new THREE.Color(sh.col).getHexString(), sh.fg, (w - 1) / 0.62));
      if (sh.door) { const dz = zc + s * w * 0.33; solid('wood', fx - s * 0.2, 1.2, dz, 0.1, 2.4, 1.1, 0x1d1d1d, { target: sh.door, surface: 'board' }); quad('atlas', fx - s * 0.26, 1.2, dz, 1.1, 2.4, ry, atlas.draw(128, 256, drawTargetDoor)); doors[sh.door] = { s, x: fx, z: dz }; } }
    else for (let k = 0; k < 2; k++) quad('facade', fx - s * 0.01, 1.6, zc + (k - 0.5) * w / 2, 2.2, 3.0, ry, cellUV(k === (stair ? 1 : 0) ? FACADE.door : FACADE.sashA), vt()); }
  const LS = [null, S0('THE GREY DOG', 0x30343a), S0('PINE & PAPER', 0xd86a4a), S0('SUNFLOWER DELI', 0xe8b81e, 'deli', '#2a2418', 'CHEESE · BREAD · COFFEE'), S0('RAEBURN BOOKS', 0x2a4a3a), S0('THE RIVER CAFE', 0x5a7a8a)];
  LS[1].mural = true;
  for (let i = 0; i < 6; i++) tenement(1, Z0 + 2 + i * 10 + 5 - 2, 10, LS[i], { stair: i === 0 });
  const RS = [null, S0('COMELY BAKERY', 0x8a4a5a), S0('STOCKBRIDGE BARBERS', 0x24365a, 'barber', '#F6F0E0', 'GENTS · WALK-INS'), S0('THE WEE FLORIST', 0x4a7a3a), S0('SECOND CHANCES', 0x6a4a8a, null, '#F6F0E0', 'CHARITY SHOP'), S0('OLD & CURIOUS', 0x5a3a24), S0('RAEBURN NEWS', 0x9a2a2a)];
  const RWD = (RIV[0] - Z0) / 7; for (let i = 0; i < 7; i++) tenement(-1, Z0 + (i + 0.5) * RWD, RWD, RS[i]);
  for (const [id, name, hint, lines] of [['deli', 'Sunflower Deli Door', 'hit the yellow deli door', ['A wee wedge o\' cheddar for that.', 'Door chapped. Sourdough\'s oot the oven.', 'Hit! The deli queue applauds.']],
    ['barber', 'Barbers\' Door', 'hit the barbers\' door', ['Short back and sides, sharp strike.', 'Next, please!', 'Barber\'s pole is spinnin\'.']]]) {
    const d = doors[id]; tgt({ id, name, hint, points: 75, kind: 'hit', pos: V(d.x - d.s * 1.2, 0, d.z), ringR: 1.0, stand: V(d.x - d.s * 5, 0, d.z), aim: V(d.x, 1.0, d.z), lines }); }
  function tgt(o) { return addTarget(o); }
  { // the far (south) end: more tenements across, closing the view
    solid('stone', 0, 8, Z0 - 8, 40, 16, 6, 0xc8b892, { tile: 4 }); for (let k = -4; k <= 4; k++) for (let j = 0; j < 4; j++) quad('facade', k * 4.2, 1.8 + j * 3.4, Z0 - 4.98, 2.6, 3, 0, cellUV(j ? FACADE.sashA : FACADE.shopUpper), vt());
    boxBody(0, 3, Z0 - 4.5, 30, 6, 1, { playerOnly: true }); }

  // ---------- the market gateway (left, just before the river) and the market court with yellow stalls ----------
  { const z0 = Z0 + 62 - 2, z1 = RIV[0], gz = (z0 + z1) / 2, ST = 0xc8c0ac; // screen wall along the frontage with the arch
    for (const [a, b] of [[z0, gz - 2.4], [gz + 2.4, z1]]) solid('stone', F + 0.4, 2.2, (a + b) / 2, 0.8, 4.4, b - a, 0xb8ae98, { tile: 1.6 });
    for (const s of [-1, 1]) { cyl('stone', F - 0.3, 2.3, gz + s * 1.9, 0.36, 0.42, 4.6, ST, { seg: 10 }); solid('stone', F + 0.2, 2.3, gz + s * 2.15, 1.0, 4.6, 0.6, ST); }
    solid('stone', F + 0.1, 5.1, gz, 1.4, 1.1, 5.4, ST, { tile: 1 }); solid('stone', F + 0.1, 5.75, gz, 1.6, 0.2, 5.8, 0xd8d0be, { phys: false });
    B.add('roof', ROOF, M4(F + 0.1, 5.85, gz, 1.4, 1.0, 5.8), ST, {});
    quad('atlasLit', F - 0.62, 5.1, gz, 4.6, 0.7, -Math.PI / 2, atlas.sign('STOCKBRIDGE MARKET', '#c8c0ac', '#3a3428', 4.6 / 0.7, 'bold 40px Georgia'));
    solid('stone', F + 0.1, 4.4, gz, 0.8, 0.3, 3.6, ST, { phys: false }); // arch lintel
    { const lx = F - 0.7; solid('metal', lx + 0.3, 3.9, gz - 1.7, 0.6, 0.06, 0.06, IRON, { phys: false }); solid('lamp', lx, 3.6, gz - 1.7, 0.3, 0.45, 0.3, 0xffffff, { phys: false }); }
    // court walls (south, east) and floor
    solid('stone', F + 11, 1.6, z0 + 0.25, 22, 3.2, 0.5, 0xa89c84, { tile: 1.6 }); solid('stone', F + 22, 1.6, (z0 + z1) / 2, 0.5, 3.2, z1 - z0, 0xa89c84, { tile: 1.6 });
    flat('slab', F + 11, 0.025, (z0 + z1) / 2, 22, z1 - z0, 0xb0a894, 1.4);
    tgt({ id: 'marketgate', name: 'Market Gateway', hint: 'kick it clean through the old market gateway', points: 125, kind: 'zone', kickOnly: true, pos: V(F - 1.5, 0, gz), ringR: 1.0, stand: V(F - 6.5, 0, gz), aim: V(F + 1, 1.0, gz),
      zone: new THREE.Box3(V(F + 0.6, 0, gz - 1.5), V(F + 2.2, 3.6, gz + 1.5)), lines: ['Through the gate! The market\'s open.', 'Clean through the arch - a proper Doric strike.', 'Fresh in: one ba\', slightly used.'] });
    // stalls: yellow gazebos, trestles with produce, crates; a couple of trees
    const prod = atlas.draw(128, 64, (g, w, h) => { g.fillStyle = '#5a4430'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = ['#c84a2a', '#e8b830', '#6a9a3a', '#e8d8b0', '#8a3a6a'][i % 5]; g.beginPath(); g.arc(6 + (i % 10) * 12.4, 12 + Math.floor(i / 10) * 13, 5.5, 0, 7); g.fill(); } });
    for (const [x, z, st] of [[F + 6, gz + 3, true], [F + 13, gz - 3, false], [F + 18, gz + 4, false]]) {
      for (const a of [-1, 1]) for (const b of [-1, 1]) cyl('metal', x + a * 1.6, 1.2, z + b * 1.6, 0.03, 0.03, 2.4, 0xdddddd, { phys: false, seg: 4 });
      B.add('flat', new THREE.ConeGeometry(2.4, 1.0, 4, 1), M4(x, 2.9, z, 1, 1, 1, 0, Math.PI / 4), 0xf0c430, {}); solid('flat', x, 2.35, z, 3.3, 0.3, 3.3, 0xf0c430, { phys: false });
      solid('wood', x - 0.9, 0.45, z, 0.9, 0.9, 2.6, 0x8a6a48, { target: st ? 'stall' : null, surface: 'board' }); quad('atlas', x - 0.9, 0.95, z, 0.85, 2.5, 0, prod, 0xffffff, { rx: -Math.PI / 2 });
      if (st) { quad('atlasLit', x - 1.37, 0.5, z, 2.2, 0.5, -Math.PI / 2, atlas.sign('FRESH VEG', '#2e5a2e', '#f2ead0', 4.4, 'bold 40px Arial'));
        tgt({ id: 'stall', name: 'Veg Stall', hint: 'through the gate: hit the veg stall', points: 75, kind: 'hit', pos: V(x - 2.5, 0, z), ringR: 0.9, stand: V(x - 5.2, 0, z), aim: V(x - 0.9, 0.5, z), lines: ['Tatties everywhere!', 'Two for a pound - and a ba\'.', 'The stallholder\'s no\' amused.'] }); } }
    for (const [x, z] of [[F + 9, z0 + 2], [F + 20, z1 - 2]]) { cyl('wood', x, 2.5, z, 0.2, 0.3, 5, 0x4a3a2c, { seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(2.8, 0), M4(x, 6.4, z, 1, 0.85, 1), 0x4a7a36, {}); } }

  // ---------- the Water of Leith: channel walls, water, rocks, weir, trees; the Stock Brig ----------
  { const [za, zb] = RIV; flat('flat', 0, -2.65, 17, 140, zb - za, 0x4d5a48); flat('flat', 0, -2.9, 17, 140, zb - za, 0x6a6250);
    for (const z of [za, zb]) solid('stone', 0, -1.5, z, 140, 3, 0.6, 0x8a8270, { tile: 2 });
    for (let i = 0; i < 26; i++) { const x = (rand() - 0.5) * 120, z = za + 1 + rand() * (zb - za - 2); if (Math.abs(x) < 11) continue; B.add('stone', new THREE.IcosahedronGeometry(0.4 + rand() * 0.6, 0), M4(x, -2.7, z, 1, 0.5, 1, 0, rand() * 3), pick([0x6a6458, 0x7a7466, 0x58534a]), {}); }
    solid('flat', -30, -2.6, 17, 0.8, 0.2, zb - za - 0.8, 0xe8ece8, { phys: false }); // the weir
    // the bridge: deck sides (arched spandrel faces), parapets with coping, the arch underside
    for (const z of [za - 0.2, zb + 0.2]) { solid('stone', 0, -1.4, z, 20, 2.8, 0.6, 0x9a9282, { phys: false, tile: 2 }); }
    B.add('stone', new THREE.CylinderGeometry(5.2, 5.2, 1, 14, 1, true, Math.PI / 2, Math.PI), M4(0, -2.4, 17, 1, 11.4, 1, 0, 0, Math.PI / 2), 0x5a564c, {});
    for (const s of [-1, 1]) { solid('stone', s * 10.3, 0.55, 17, 0.6, 1.1, zb - za + 1.6, 0x9a9282, { tile: 1.6 }); solid('stone', s * 10.3, 1.15, 17, 0.8, 0.12, zb - za + 1.8, 0xb4ac9a, { phys: false }); boxBody(s * 10.3, 2, 17, 0.6, 4, zb - za + 1.6, { playerOnly: true }); }
    // river walls/railings along both banks either side of the bridge
    for (const s of [-1, 1]) for (const z of [za, zb]) { const xc = s * 40.5; if (s > 0 && z === za) continue; // (the market court wall is the south-left bank)
      solid('stone', xc, 0.45, z, 60, 0.9, 0.5, 0xa49a86, { tile: 1.6 }); for (let k = 0; k < 30; k++) cyl('metal', xc - 29 + k * 2, 1.4, z, 0.025, 0.025, 1.0, IRON, { phys: false, seg: 4 }); solid('metal', xc, 1.9, z, 60, 0.05, 0.05, IRON, { phys: false }); boxBody(xc, 2.5, z, 60, 5, 0.4, { playerOnly: true }); }
    solid('stone', F + 11, 0.45, za, 22.5, 0.9, 0.5, 0xa49a86, { tile: 1.6 }); boxBody(F + 11, 2.5, za, 22.5, 5, 0.4, { playerOnly: true });
    for (let k = 0; k < 11; k++) cyl('metal', F + 1 + k * 2, 1.4, za, 0.025, 0.025, 1.0, IRON, { phys: false, seg: 4 }); solid('metal', F + 11, 1.9, za, 22, 0.05, 0.05, IRON, { phys: false });
    flat('slab', -38, -1.2, za + 1.4, 50, 2.2, 0x8a8478); solid('stone', -38, -2.0, za + 1.4, 50, 1.6, 2.2, 0x7a7266, { phys: false }); // the riverside walkway, down on the right bank
    for (const [x, z] of [[-18, za + 3], [-46, zb - 2], [24, zb - 2], [40, za + 3], [-60, za + 4], [56, zb - 3]]) { cyl('wood', x, 0.5, z, 0.25, 0.35, 7, 0x4a3a2c, { phys: false, seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(3.4, 0), M4(x, 5.4, z, 1.1, 0.9, 1.1, 0, rand() * 3), pick([0x3e6a2e, 0x4a7a36, 0x557e36]), {}); } }

  // ---------- over the bridge: the clock tower building (left corner), the corner bar (right), St Stephen Street, Circus Lane ----------
  { const z0 = RIV[1] + 4, ST = 0xc8ba98, x0 = F; // clock building: two storeys, tower at the riverside corner
    solid('stone', x0 + 7, 4, z0 + 7, 14, 8, 14, ST, { tile: 2.6 }); B.add('roof', ROOF, M4(x0 + 7, 8, z0 + 7, 14.2, 2.6, 14.2), 0x50555c, {});
    for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) quad('facade', x0 - 0.01, 2 + j * 3.6, z0 + 4 + k * 3.6, 2.2, 3, -Math.PI / 2, cellUV(j ? FACADE.arch : FACADE.sashA), vt());
    solid('stone', x0 - 0.1, 8.2, z0 + 7, 0.4, 0.5, 14.2, 0xd8ccae, { phys: false });
    const tx = x0 + 1.9, tz = z0 + 1.9; solid('stone', tx, 4.75, tz, 3.8, 9.5, 3.8, ST, { tile: 2 }); solid('stone', tx, 9.7, tz, 4.2, 0.6, 4.2, 0xd8ccae, { phys: false });
    solid('stone', tx, 11.5, tz, 3.4, 3, 3.4, ST, { phys: false });
    { const lx = tx - 2.3; solid('metal', tx - 2.05, 4.3, tz, 0.5, 0.08, 0.08, IRON, { phys: false }); B.add('lamp', new THREE.SphereGeometry(0.32, 8, 6), M4(lx, 3.85, tz, 1, 1.25, 1), 0xffffff, {}); body(new CANNON.Sphere(0.42), lx, 3.85, tz, { target: 'towerlamp', surface: 'metal' }); } solid('stone', tx, 13.2, tz, 3.8, 0.4, 3.8, 0xd8ccae, { phys: false });
    const clock = atlas.draw(128, 128, (g, w, h) => { g.fillStyle = '#c8ba98'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f0e4'; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 4; g.stroke(); g.lineWidth = 3;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); g.lineTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.stroke(); }
      g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 26, 64 - 10); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 6, 64 - 42); g.stroke(); });
    quad('atlas', tx - 1.72, 11.5, tz, 2.6, 2.6, -Math.PI / 2, clock); quad('atlas', tx, 11.5, tz - 1.72, 2.6, 2.6, Math.PI, clock);
    for (const a of [-1, 1]) for (const b of [-1, 1]) cyl('stone', tx + a * 1.3, 14.3, tz + b * 1.3, 0.16, 0.16, 1.8, ST, { phys: false, seg: 6 });
    solid('stone', tx, 15.3, tz, 3.2, 0.3, 3.2, 0xd8ccae, { phys: false }); B.add('roof', new THREE.ConeGeometry(2.0, 3.2, 4), M4(tx, 17, tz, 1, 1, 1, 0, Math.PI / 4), 0x5a5e62, {}); cyl('metal', tx, 19.1, tz, 0.04, 0.04, 1.4, 0x2a2a2a, { phys: false, seg: 4 }); solid('metal', tx, 19.4, tz, 0.6, 0.05, 0.05, 0x2a2a2a, { phys: false });
    tgt({ id: 'towerlamp', name: 'Tower Lamp', hint: 'loft it onto the lamp on the clock tower', points: 125, kind: 'hit', pos: V(F - 3, 0, tz), ringR: 1.0, stand: V(F - 8, 0, tz), aim: V(tx - 2.3, 3.85, tz), lines: ['Bong! Right on the hour.', 'Lamp lit. Clock still right.', 'High ball! The tower felt that.'] });
    const dz = z0 + 11; solid('wood', x0 - 0.1, 1.3, dz, 0.12, 2.6, 1.3, 0x2a3a5a, { target: 'clockdoor', surface: 'board' }); quad('atlas', x0 - 0.17, 1.3, dz, 1.3, 2.6, -Math.PI / 2, atlas.draw(128, 256, drawTargetDoor));
    tgt({ id: 'clockdoor', name: 'Clock Tower Door', hint: 'hit the door under the clock tower building', points: 75, kind: 'hit', pos: V(x0 - 1.2, 0, dz), ringR: 1.0, stand: V(x0 - 5, 0, dz), aim: V(x0, 1.0, dz), lines: ['Chap chap! Naebody hame.', 'The door\'s older than yer granny.', 'In off the auld door.'] }); }
  { // right corner over the bridge: the corner bar in a four-storey tenement
    const z0 = RIV[1] + 1.6, w = LANE[0] - z0; tenement(-1, (z0 + LANE[0]) / 2, w, null, { tone: 0xbcae8c });
    const zb = z0 + 6; solid('flat', -F + 0.06, 1.95, zb, 0.12, 3.9, 9, 0x1e2a24, { phys: false }); quad('atlasLit', -F + 0.16, 3.4, zb, 8, 0.6, Math.PI / 2, atlas.fascia('THE DEAN TAVERN', 'ALES · WHISKY', '#1e2a24', '#E8C766', 8 / 0.6));
    for (const k of [-3, 3]) quad('atlasLit', -F + 0.13, 1.7, zb + k, 2.2, 2.0, Math.PI / 2, winShop);
    solid('wood', -F + 0.2, 1.2, zb, 0.1, 2.4, 1.1, 0x1d1d1d, { target: 'cornerbar', surface: 'board' }); quad('atlas', -F + 0.26, 1.2, zb, 1.1, 2.4, Math.PI / 2, atlas.draw(128, 256, drawTargetDoor));
    tgt({ id: 'cornerbar', name: 'Dean Tavern Door', hint: 'hit the corner bar door over the bridge', points: 75, kind: 'hit', pos: V(-F + 1.2, 0, zb), ringR: 1.0, stand: V(-F + 5, 0, zb), aim: V(-F, 1.0, zb), lines: ['Last orders at the bar!', 'A half and a ba\', please.', 'The regulars didnae even look up.'] }); }
  // St Stephen Street: Georgian terraces both sides
  for (let z = RIV[1] + 4 + 14 + 1; z + 11 <= END; z += 11) tenement(1, z + 5.5, 11, null, { tone: pick(GEO), stair: true });
  for (let z = LANE[1]; z + 11 <= END; z += 11) tenement(-1, z + 5.5, 11, null, { tone: pick(GEO), stair: true });
  { // St Stephen's: the tall tower closing the street, the church body behind, steps, a notice board
    const z = END + 1, ST = 0xc4b896; solid('stone', 0, 8, z + 12, 28, 16, 20, ST, { tile: 3 }); B.add('roof', ROOF, M4(0, 16, z + 12, 28.2, 4, 20.2), 0x50555c, {});
    solid('stone', 0, 11, z + 1.5, 8, 22, 6, ST, { tile: 3 }); solid('stone', 0, 22.4, z + 1.5, 8.6, 0.8, 6.6, 0xd8ccae, { phys: false });
    solid('stone', 0, 27, z + 1.5, 6, 9, 5, ST, { phys: false, tile: 2.4 }); solid('stone', 0, 31.8, z + 1.5, 6.6, 0.6, 5.6, 0xd8ccae, { phys: false });
    solid('stone', 0, 35.5, z + 1.5, 4.2, 7, 3.6, ST, { phys: false, tile: 2 }); B.add('roof', new THREE.ConeGeometry(2.6, 3, 4), M4(0, 40.5, z + 1.5, 1, 1, 1, 0, Math.PI / 4), ST, {});
    for (const s of [-1, 1]) for (const y of [24, 33]) B.add('stone', new THREE.ConeGeometry(0.4, 2.4, 4), M4(s * 2.8, y + 0.4, z - 0.6, 1, 1, 1), ST, {});
    quad('atlas', 0, 27.6, z - 1.02, 2.8, 2.8, Math.PI, clock2()); quad('facade', 0, 18, z - 1.52, 2.6, 5.5, Math.PI, cellUV(FACADE.arch), 0xe8e0d0); quad('facade', 0, 34.6, z - 0.32, 2, 3.6, Math.PI, cellUV(FACADE.arch), 0xc8c0b0);
    solid('wood', 0, 2.4, z - 1.52, 2.6, 4.8, 0.12, 0x3a2a1a, { phys: false }); for (let k = 0; k < 4; k++) solid('stone', 0, 0.12 + k * 0.24, z - 2.4 - k * 0.5 + 1.5, 12 - k, 0.24, 3 - k * 0.5, 0xb8b0a0, { phys: false });
    for (const s of [-1, 1]) cyl('wood', 3 + s * 0.75, 0.8, z - 3.2, 0.05, 0.05, 1.6, 0x3a2e24, { phys: false, seg: 4 });
    solid('wood', 3, 1.35, z - 3.2, 1.6, 1.0, 0.1, 0x1f2a44, { target: 'stephensboard', surface: 'board' });
    quad('atlasLit', 3, 1.35, z - 3.26, 1.5, 0.9, Math.PI, atlas.draw(160, 96, (g, w, h) => { g.fillStyle = '#1f2a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d8a0'; g.font = 'bold 15px Georgia'; g.textAlign = 'center'; g.fillText("ST STEPHEN'S", w / 2, 22); g.font = '13px Georgia'; g.fillText('Concert Friday 7pm', w / 2, 46); g.fillText('All Welcome', w / 2, 66); }));
    tgt({ id: 'stephensboard', name: "St Stephen's Board", hint: "hit St Stephen's notice board at the end of the street", points: 75, kind: 'hit', pos: V(3, 0, z - 4.4), ringR: 0.9, stand: V(3, 0, z - 8.5), aim: V(3, 1.3, z - 3.2), lines: ['Hallelujah!', 'Notice received, loud and clear.', 'The organist missed a note.'] });
    boxBody(0, 3, END - 1, 2 * F, 6, 1, { playerOnly: true }); }
  function clock2() { return atlas.draw(96, 96, (g, w, h) => { g.fillStyle = '#c4b896'; g.fillRect(0, 0, w, h); g.fillStyle = '#20242a'; g.beginPath(); g.arc(48, 48, 42, 0, 7); g.fill(); g.strokeStyle = '#d8b850'; g.lineWidth = 4; g.beginPath(); g.moveTo(48, 48); g.lineTo(48, 16); g.moveTo(48, 48); g.lineTo(70, 56); g.stroke(); }); }
  { // Circus Lane: cobbled mews curving off to the right, two-storey mews houses with painted doors, ivy and planters
    const [za, zb] = LANE, MW = [0xd8ccb4, 0xe0d6c0, 0xcfc2a6, 0xe6dccc], DC = [0x2a4a6a, 0x6a2a2a, 0x2a5a3a, 0x3a3a3a, 0x7a6a2a];
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const x = -F - 4.5 - i * 8.6, z = s > 0 ? zb + 4 : za - 4, fz = s > 0 ? zb : za, ry = s > 0 ? Math.PI : 0, tone = pick(MW);
      if (s < 0 && i < 2) continue; // (the corner tenement fills the first stretch on the south side)
      solid('stone', x, 3.2, z, 8.6, 6.4, 8, tone, { tile: 2.4 }); B.add('roof', ROOF, M4(x, 6.4, z, 8.62, 2.2, 8.2, 0, Math.PI / 2), 0x50555c, {});
      for (const k of [-2.2, 2.2]) quad('facade', x + k, 4.6, fz - s * 0.01, 2, 2.4, ry, cellUV(FACADE.sashB), vt());
      if (!(s > 0 && i === 2)) { solid('wood', x - 1.6, 1.3, fz - s * 0.04, 2.6, 2.6, 0.06, pick(DC), { phys: false }); quad('facade', x + 2.2, 1.4, fz - s * 0.01, 1.2, 2.6, ry, cellUV(FACADE.door), vt()); }
      quad('flat', x + (rand() - 0.5) * 4, 2.6, fz - s * 0.03, 2.4 + rand() * 2, 4.4, ry, null, pick([0x3a6a2a, 0x4a7a32, 0x2e5a26])); // ivy
      cyl('flat', x + 3.6, 0.35, fz - s * 0.5, 0.35, 0.3, 0.7, 0x6a5040, { phys: false, seg: 6 }); B.add('flat', new THREE.IcosahedronGeometry(0.45, 0), M4(x + 3.6, 0.9, fz - s * 0.5, 1, 1, 1), 0xb04a6a, {}); }
    { const x = -F - 4.5 - 2 * 8.6 - 1.6; solid('wood', x, 1.3, zb - 0.04, 2.6, 2.6, 0.06, 0x2a4a6a, { target: 'mewsdoor', surface: 'board' }); quad('atlas', x, 1.3, zb - 0.1, 2.6, 2.6, Math.PI, atlas.draw(128, 128, (g, w, h) => { g.fillStyle = '#2a4a6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a3048'; g.lineWidth = 3; for (let y = 10; y < h; y += 14) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); } g.fillStyle = '#ffd93d'; g.beginPath(); g.arc(64, 64, 16, 0, 7); g.fill(); }));
      tgt({ id: 'mewsdoor', name: 'Mews Garage Door', hint: 'up Circus Lane: hit the blue mews garage door', points: 75, kind: 'hit', pos: V(x, 0, zb - 1.3), ringR: 1.0, stand: V(x, 0, za + 1.0), aim: V(x, 1.2, zb), lines: ['Clang! Cobbles and a garage door.', 'Mews news: door dented.', 'The postie\'s seen it all before.'] }); }
    for (const s of [-1, 1]) boxBody(-36.3, 4, s > 0 ? zb + 0.3 : za - 0.3, 53.4, 8, 0.6, { playerOnly: true });
    solid('stone', -F - 4.5 - 6 * 8.6 + 2, 4, (za + zb) / 2, 4, 8, zb - za + 2, 0xd0c4aa, { tile: 2 }); // the lane curving away out of sight
    solid('stone', -35, 8, zb + 14, 56, 16, 12, 0x9a8c74, { phys: false, tile: 3.4 }); } // the terrace above, behind the mews
  // street furniture: pillar box (easy first), heritage lamps, bins, a bench, parked cars
  { const x = F - 1.2, z = Z0 + 12; cyl('metal', x, 0.75, z, 0.3, 0.3, 1.5, 0xc8202a, { phys: false, seg: 10 }); B.add('metal', new THREE.SphereGeometry(0.32, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, 1.5, z, 1, 1, 1), 0xc8202a, {}); body(new CANNON.Cylinder(0.32, 0.32, 1.6, 10), x, 0.8, z, { target: 'postbox', surface: 'metal' });
    tgt({ id: 'postbox', name: 'Pillar Box', hint: 'hit the red pillar box', points: 50, kind: 'hit', pos: V(x - 1.2, 0, z), ringR: 0.9, stand: V(x - 4.5, 0, z), aim: V(x, 0.8, z), lines: ['First class!', 'Posted. Nae stamp needed.', 'Signed for.'] }); }
  for (const s of [-1, 1]) for (let z = Z0 + 10; z < END - 4; z += 16) { if (z > RIV[0] - 1 && z < RIV[1] + 1) continue; const x = s * (RW + 0.6); cyl('metal', x, 2.2, z, 0.07, 0.11, 4.4, IRON, { seg: 6 }); solid('lamp', x, 4.6, z, 0.4, 0.5, 0.4, 0xffffff, { phys: false }); B.add('roof', new THREE.ConeGeometry(0.36, 0.35, 4), M4(x, 5.0, z, 1, 1, 1, 0, Math.PI / 4), IRON, {}); }
  for (const [x, z, c] of [[-4.4, Z0 + 8, 0x8a1e22], [-4.4, Z0 + 14, 0x2a3a4a], [-4.4, Z0 + 34, 0xc8c8c4], [-4.4, Z0 + 54, 0x1e1e22], [4.4, Z0 + 26, 0x3a4a3a], [4.4, RIV[1] + 30, 0x6a6a70]]) {
    solid('metal', x, 0.65, z, 1.8, 0.8, 4.2, c, { surface: 'metal' }); solid('glass', x, 1.3, z - 0.2, 1.6, 0.6, 2.2, 0x2a3036, { phys: false }); }
  for (const z of [Z0 + 16, Z0 + 46]) solid('flat', F - 0.7, 0.55, z, 0.7, 1.1, 0.7, 0x2a5a3a);
  // edges
  for (const [s, a, b] of [[1, Z0, Z0 + 60], [1, RIV[1], END], [-1, Z0, LANE[0]], [-1, LANE[1], END]]) boxBody(s * (F + 0.5), 3, (a + b) / 2, 1, 6, b - a, { playerOnly: true }); // gaps: the market gate, Circus Lane
  const groups = [V(-3, 0, Z0 + 14), V(F + 8, 0, 4), V(2, 0, RIV[1] + 8), V(-28, 0, (LANE[0] + LANE[1]) / 2)];
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P_, facadeTex, atlas.tex); materials.flat.side = THREE.DoubleSide;
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P_.shadows });
  const views = { spawn: [SB.SPAWN[0], SB.SPAWN[2], 180, 4, 0.5], gate: [2, 2, 270, 4, 0.5], bridge: [0, 6, 180, 6, 0.5], clock: [-3, 30, 210, 12, 0.5], stephens: [0, 52, 180, 8, 0.5], lane: [-8, 47, 90, 2, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);
SB.SPAWN = [1.5, 0.5, SB.Z0 + 4];

export function surfaceAt(x, z) {
  if (z > SB.RIV[0] && z < SB.RIV[1] && Math.abs(x) > 10.6) return 'grass';
  if (z > SB.LANE[0] && z < SB.LANE[1] && x < -SB.F) return 'paving';
  return Math.abs(x) < SB.RW ? 'tarmac' : 'paving';
}
export default {
  id: 'stockbridge', name: 'Stockbridge', short: 'Stockbridge', surfaceAt,
  sounds: { birds: [[20, 0], [-30, 17], [0, 17]], gulls: [[0, 40]], far: [[0, -70], [0, 90], [-60, 47]], roadX: 30 },
  blurb: 'Level 8: Stockbridge. Raeburn Place, the Stock Brig and the Water of Leith, the market gateway, the clock tower, Circus Lane and St Stephen\'s. 10 targets.',
  intro: "Welcome tae Stockbridge!<br><small>Painted shopfronts, the river under the brig, the old market gate and St Stephen's tower at the end. Easy first one: the pillar box, just ahead on the left.</small>",
  build,
  tiers: { postbox: 'easy', deli: 'easy', barber: 'easy', stall: 'easy', cornerbar: 'easy', clockdoor: 'easy', mewsdoor: 'easy', stephensboard: 'easy', marketgate: 'tricky', towerlamp: 'tricky' },
  spawn: SB.SPAWN, spawnYaw: 180,
  ballHomes: () => [[1.5, 0.4, SB.Z0 + 6], [0, 0.4, 0], [0, 0.4, SB.RIV[1] + 10]],
  bounds: { x: 72, zMin: SB.Z0 - 10, zMax: SB.END + 30 },
  next: 'princesstreet',
};
