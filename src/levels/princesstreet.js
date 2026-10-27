// Level 9: Princes Street (v3.14). The long north-side frontage of shops (all names fictional: a big food-and-clothing store, a
// chemist, a red-sandstone department store with Dutch gables, a grand hotel with its clock tower at the east end), the tram tracks
// and overhead wires down the middle, a tram stop and a waiting tram (fictional livery). On the south side the balustrade drops to
// the gardens: the castle on its rock above the west gardens, the Ross Fountain below it, the floral clock and the classical gallery
// at the Mound, and the dark Gothic monument on the east terrace. North = +z (walking east), the shops are on the left (+x).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32 } from '../world.js';

export const PS = { RW: 7, F: 12, Z0: -80, Z1: 100, GX: -11, GATE: -40, STOP: -20, TRAM: 60, FOUNT: -30 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P_) {
  const rand = mulberry32(1847), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const tgt = (o) => addTarget(o);
  const { RW, F, Z0, Z1, GX } = PS, TAR = 0x6a6c6a, SLAB = 0xc8c4ba, KERB = 0x9a9890, IRON = 0x24282c, GY = -8;
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.82 + rand() * 0.2; return c.setRGB(c.r * k, c.g * k, c.b * k).getHex(); };
  const NRY = -Math.PI / 2; // north-side facades face -x (the street)
  const L = Z1 - Z0, ZC = (Z0 + Z1) / 2;
  // ---------- ground: the street, tram tracks, pavements; the gardens below to the south (x < GX), two street-level terraces ----------
  boxBody(14, -1, ZC, 2 * (14 - GX) + 4, 2, L + 20, { surface: 'tarmac' }); boxBody(-90, GY - 1, ZC, 2 * (90 + GX), 2, L + 60, { surface: 'grass' });
  const TERR = [[6, 22, -40], [36, 64, -38]]; for (const [a, b, xw] of TERR) boxBody((GX + xw) / 2, -1, (a + b) / 2, GX - xw, 2, b - a, { surface: 'paving' });
  flat('tarmac', 0, 0.012, ZC, 2 * RW, L, TAR, 4); flat('slab', (RW + F) / 2, 0.022, ZC, F - RW, L, SLAB, 1.8); flat('slab', (GX - RW) / 2, 0.022, ZC, -GX - RW, L, SLAB, 1.8);
  for (const s of [-1, 1]) solid('stone', s * RW, 0.06, ZC, 0.3, 0.12, L, KERB, { phys: false });
  for (const x of [-2.2, 2.2]) { flat('flat', x, 0.016, ZC, 2.4, L, 0x7a7670); for (const d of [-0.72, 0.72]) solid('metal', x + d, 0.025, ZC, 0.09, 0.03, L, 0x9a9ca0, { phys: false }); }
  for (let z = Z0 + 4; z < Z1; z += 30) for (const x of [-RW + 0.3, RW - 0.3]) solid('flat', x, 0.016, z, 0.12, 0.01, 22, 0xe8e6de, { phys: false });
  for (let i = 0; i < 16; i++) quad('grime', (rand() - 0.5) * 2 * RW, 0.03, Z0 + rand() * L, 1.5 + rand() * 3, 1 + rand() * 2, 0, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 });
  for (const [a, b, xw] of TERR) flat('slab', (GX + xw) / 2, 0.02, (a + b) / 2, GX - xw, b - a, 0xbcb6a8, 1.6);
  // overhead line poles (centre) and wires
  for (let z = Z0 + 8; z < Z1; z += 24) { cyl('metal', 0, 4, z, 0.13, 0.16, 8, 0x5a5e62, { seg: 6 }); solid('metal', 0, 7.4, z, 6.4, 0.1, 0.1, 0x5a5e62, { phys: false }); }
  for (const x of [-2.2, 2.2]) solid('metal', x, 7.3, ZC, 0.03, 0.03, L, 0x333333, { phys: false });

  // ---------- north side: the shops (all fictional names) ----------
  const winShop = atlas.draw(192, 128, (g, w, h) => { g.fillStyle = '#2e2a26'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,245,220,0.45)'; g.fillRect(0, 0, w, 14); for (let k = 0; k < 6; k++) { g.fillStyle = ['#d8d0c0', '#8a3a3a', '#3a5a8a', '#e8e0d0', '#4a6a4a', '#c8a060'][k]; g.fillRect(14 + k * 29, 40 + (k % 2) * 10, 20, 70 - (k % 2) * 10); } });
  const doors = {};
  // block(z0, z1, h, tone, opts): one building on the north side; style = 'georgian' | 'victorian' | 'modern' | 'dept' | 'hotel'
  function block(z0, z1, h, tone, { style = 'victorian', shop = null, sub = null, col = 0x333333, fg = '#F6F0E0', door = null } = {}) {
    const w = z1 - z0, zc = (z0 + z1) / 2, D = 16, bx = F + D / 2, nc = Math.max(2, Math.round(w / 3.4)), storeys = Math.floor((h - 4.5) / 3.4);
    const key = style === 'modern' ? 'flat' : 'stone'; solid(key, bx, h / 2, zc, D, h, w, tone, style === 'modern' ? {} : { tile: 3.2 });
    if (style === 'modern') { for (let j = 0; j < storeys; j++) { quad('flat', F - 0.02, 5.6 + j * 3.4, zc, w - 0.6, 1.6, NRY, null, 0x8a9aa4); } solid('flat', F - 0.1, h - 0.3, zc, 0.3, 0.6, w, 0xd8d4cc, { phys: false }); }
    else { for (let k = 0; k < nc; k++) for (let j = 0; j < storeys; j++) quad('facade', F - 0.01, 6.2 + j * 3.4, z0 + (k + 0.5) * w / nc, w / nc * 0.66, 2.9, NRY, cellUV(style === 'dept' ? (j % 2 ? FACADE.arch : FACADE.triple) : j === storeys - 1 ? FACADE.small : pick([FACADE.sashA, FACADE.sashB, FACADE.lit])), vt());
      solid('stone', F - 0.25, h - 0.3, zc, 0.5, 0.6, w + 0.1, 0xd8ccae, { phys: false }); solid('stone', F - 0.2, 4.7, zc, 0.4, 0.3, w, 0xd8ccae, { phys: false });
      if (style === 'georgian' || style === 'victorian') B.add('roof', ROOF, M4(bx, h, zc, D + 0.2, 3.4, w + 0.04), 0x4e535a, { tile: 2.2 });
      for (const k of [-0.3, 0.3]) if (style !== 'dept') { solid('stone', bx + 2, h + 2.4, zc + k * w, 3, 2.8, 1.1, tone, { phys: false }); } }
    if (style === 'dept') { const g = Math.max(2, Math.round(w / 9)); for (let i = 0; i < g; i++) { const z = z0 + (i + 0.5) * w / g; B.add('roof', ROOF, M4(F + 1.5, h, z, w / g - 0.6, 6, 3, 0, Math.PI / 2), tone, { tile: 2 }); B.add('stone', new THREE.ConeGeometry(0.35, 3.2, 4), M4(F + 0.4, h + 1.6, z - w / g / 2 + 0.4, 1, 1, 1), tone, {}); } B.add('roof', ROOF, M4(bx + 2, h, zc, D - 3, 4, w), 0x4e535a, {}); }
    if (shop) { solid('flat', F - 0.06, 2.3, zc, 0.12, 4.6, w - 0.4, col, { phys: false }); quad('atlasLit', F - 0.13, 2.0, zc - (door ? 1.4 : 0), w - (door ? 4.4 : 1.6), 2.6, NRY, winShop);
      quad('atlasLit', F - 0.16, 4.1, zc, Math.min(w - 1, 12), 0.7, NRY, atlas.fascia(shop, sub, '#' + new THREE.Color(col).getHexString(), fg, Math.min(w - 1, 12) / 0.7));
      if (door) { const dz = zc + w / 2 - 1.6; solid('wood', F - 0.2, 1.3, dz, 0.1, 2.6, 1.6, 0x1d1d1d, { target: door, surface: 'board' }); quad('atlas', F - 0.26, 1.3, dz, 1.6, 2.6, NRY, atlas.draw(128, 256, drawTargetDoor)); doors[door] = dz; } }
    else for (let k = 0; k < nc; k++) quad('facade', F - 0.01, 2.2, z0 + (k + 0.5) * w / nc, w / nc * 0.7, 3.4, NRY, cellUV(k % 3 === 1 ? FACADE.door : FACADE.shopUpper), vt()); }
  block(Z0 - 10, Z0 + 14, 18, 0xcfc3a6, { style: 'georgian', shop: 'WEST END BOOKS', col: 0x2a3a4a });
  block(Z0 + 14, Z0 + 34, 17, 0xd2ccc0, { style: 'modern', shop: 'MORAY & STUART', sub: 'FOOD · CLOTHING · HOME', col: 0x1e3a2a, fg: '#E8D8A0', door: 'storedoor' });
  block(Z0 + 34, Z0 + 46, 19, 0xc8ba98, { style: 'victorian', shop: "BAILLIE'S CHEMIST", sub: 'PHARMACY · BEAUTY', col: 0x1f3c78, door: 'chemistdoor' });
  block(Z0 + 46, Z0 + 62, 20, 0xbfb092, { style: 'victorian', shop: 'NORTH STAR SHOES', col: 0x5a2a2a });
  block(Z0 + 62, Z0 + 76, 16, 0xd8d0c0, { style: 'modern', shop: 'CASTLE VIEW CAFE', col: 0x6a4a2a });
  // (Hanover Street gap at Z0+76..Z0+84)
  block(Z0 + 84, Z0 + 100, 19, 0xc4b494, { style: 'georgian', shop: 'HIGHLAND OUTDOOR', col: 0x2a4a3a });
  block(Z0 + 100, Z0 + 130, 24, 0xa86e56, { style: 'dept', shop: "MACRAE'S", sub: 'EST. 1838 · DEPARTMENT STORE', col: 0x3a1e1a, fg: '#E8C766', door: 'deptdoor' });
  // (St David Street gap at Z0+130..Z0+138)
  block(Z0 + 138, Z0 + 152, 18, 0xc8bca2, { style: 'victorian', shop: 'FORTH BANK', col: 0x2a2a3a });
  for (const [z0, z1] of [[Z0 + 76, Z0 + 84], [Z0 + 130, Z0 + 138]]) { solid('stone', F + 40, 10, (z0 + z1) / 2, 4, 20, z1 - z0 + 2, 0xc8bca2, { phys: false, tile: 3 }); flat('tarmac', F + 20, 0.01, (z0 + z1) / 2, 40, z1 - z0, TAR, 4); boxBody(F + 3, 3, (z0 + z1) / 2, 1, 6, z1 - z0, { playerOnly: true }); }
  // the grand hotel at the east end (fictional name): dark sandstone, seven storeys, the clock tower on the corner
  { const z0 = Z0 + 152, z1 = Z1 + 6, zc = (z0 + z1) / 2, w = z1 - z0, h = 26, ST = 0x8e7e66, bx = F + 9; solid('stone', bx, h / 2, zc, 18, h, w, ST, { tile: 3.6 });
    for (let k = 0; k < 8; k++) for (let j = 0; j < 6; j++) quad('facade', F - 0.01, 5.8 + j * 3.4, z0 + (k + 0.5) * w / 8, 2.2, 2.9, NRY, cellUV(j === 5 ? FACADE.small : j % 2 ? FACADE.sashA : FACADE.arch), vt());
    for (let k = 0; k < 4; k++) B.add('roof', ROOF, M4(F + 1.5, h, z0 + (k + 0.5) * w / 4, w / 4 - 1, 4, 3, 0, Math.PI / 2), ST, {}); B.add('roof', ROOF, M4(bx + 2, h, zc, 14, 5, w), 0x4e535a, {});
    const tz = z1 - 5, tx = F + 5; solid('stone', tx, 19, tz, 9, 38, 9, ST, { tile: 3 }); solid('stone', tx, 38.5, tz, 10, 1, 10, 0xa8987e, { phys: false });
    const clk = atlas.draw(128, 128, (g, w2, h2) => { g.fillStyle = '#8e7e66'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#f4f0e4'; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 22); g.moveTo(64, 64); g.lineTo(92, 74); g.stroke(); });
    quad('atlas', tx - 4.52, 34, tz, 5, 5, NRY, clk); quad('atlas', tx, 34, tz - 4.52, 5, 5, Math.PI, clk);
    solid('stone', tx, 41.5, tz, 7, 5, 7, ST, { phys: false }); B.add('roof', new THREE.SphereGeometry(4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(tx, 44, tz, 1, 1.3, 1), 0x4e535a, {});
    for (const a of [-1, 1]) for (const b of [-1, 1]) B.add('stone', new THREE.ConeGeometry(0.6, 4, 6), M4(tx + a * 4.2, 41, tz + b * 4.2, 1, 1, 1), ST, {});
    cyl('metal', tx, 52, tz, 0.08, 0.08, 6, 0xdddddd, { phys: false, seg: 4 }); quad('flat', tx, 54, tz + 1, 2, 1.2, NRY, null, 0x1f5aa8);
    solid('flat', F - 1.4, 3.6, zc - 6, 2.8, 0.25, 6, 0x2a2a2a, { phys: false }); for (const s of [-1, 1]) cyl('metal', F - 2.7, 1.8, zc - 6 + s * 2.8, 0.05, 0.05, 3.6, 0xc8a040, { phys: false, seg: 6 });
    quad('atlasLit', F - 2.82, 3.6, zc - 6, 5.6, 0.25, NRY, atlas.sign('THE GRAND NORTH HOTEL', '#2a2a2a', '#E8C766', 22, 'bold 30px Georgia'));
    solid('wood', F - 0.6, 1.0, zc - 2, 0.1, 1.6, 1.0, 0x1e2a3a, { target: 'hotelboard', surface: 'board' });
    quad('atlasLit', F - 0.66, 1.0, zc - 2, 0.94, 1.5, NRY, atlas.draw(96, 160, (g, w2, h2) => { g.fillStyle = '#1e2a3a'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#E8C766'; g.font = 'bold 13px Georgia'; g.textAlign = 'center'; g.fillText('AFTERNOON', w2 / 2, 40); g.fillText('TEA', w2 / 2, 58); g.font = '11px Georgia'; g.fillText('served daily', w2 / 2, 84); g.fillText('3pm - 5pm', w2 / 2, 102); }));
    tgt({ id: 'hotelboard', name: 'Hotel Tea Board', hint: 'hit the afternoon tea board outside the grand hotel', points: 75, kind: 'hit', pos: V(F - 2, 0, zc - 2), ringR: 0.9, stand: V(F - 5, 0, zc - 2), aim: V(F - 0.6, 1.0, zc - 2), lines: ['Tea and scones for the striker.', 'The doorman tipped his hat.', 'A strike fit for the ballroom.'] });
    boxBody(0, 3, Z1 + 2, 2 * F, 6, 1, { playerOnly: true }); solid('stone', 0, 6, Z1 + 30, 30, 12, 6, 0x8a7e6e, { phys: false, tile: 3 }); }
  for (const [id, name, hint, lines] of [['storedoor', 'Moray & Stuart Door', 'hit the big store door', ['Food hall\'s that way.', 'Not just any door - a Moray & Stuart door.', 'Door hit. Percy\'s impressed.']],
    ['chemistdoor', "Baillie's Door", "hit the chemist's door", ['Plasters, aisle three.', 'Prescription: more of that.', 'The chemist\'s seen worse.']],
    ['deptdoor', "Macrae's Door", "hit Macrae's grand door", ['Ground floor: perfume and penalties.', 'The Christmas windows rattled.', 'Macrae\'s since 1838. Never seen a strike like that.']]]) {
    const dz = doors[id]; tgt({ id, name, hint, points: 75, kind: 'hit', pos: V(F - 1.2, 0, dz), ringR: 1.0, stand: V(F - 5, 0, dz), aim: V(F, 1.0, dz), lines }); }

  // ---------- south side: the balustrade, the gardens below, the castle on its rock, the Ross Fountain, the floral clock, the gallery, the monument ----------
  const isTerr = (z) => TERR.some(([a, b]) => z > a && z < b);
  for (let z = Z0 - 6; z < Z1 + 4; z += 4) { if (isTerr(z + 2) || (z + 2 > PS.GATE - 2 && z + 2 < PS.GATE + 2)) continue; solid('stone', GX - 0.2, 0.5, z + 2, 0.5, 1.0, 4, 0xbcb09a, { tile: 1.4 }); for (let k = 0; k < 4; k++) cyl('metal', GX - 0.2, 1.5, z + 0.5 + k, 0.025, 0.025, 1.0, IRON, { phys: false, seg: 4 }); solid('metal', GX - 0.2, 2.0, z + 2, 0.05, 0.05, 4, IRON, { phys: false }); boxBody(GX - 0.2, 3, z + 2, 0.4, 6, 4, { playerOnly: true }); }
  // terraces' outer edges (player walls + railings)
  for (const [a, b, xw] of TERR) { for (const z of [a, b]) { solid('stone', (GX + xw) / 2, 0.45, z, GX - xw, 0.9, 0.5, 0xbcb09a, { tile: 1.4 }); boxBody((GX + xw) / 2, 3, z, GX - xw, 6, 0.4, { playerOnly: true }); } solid('stone', xw, 0.45, (a + b) / 2, 0.5, 0.9, b - a, 0xbcb09a, { tile: 1.4 }); boxBody(xw, 3, (a + b) / 2, 0.4, 6, b - a, { playerOnly: true }); }
  // gardens: lawn, paths, trees down below; the bank up to the street
  flat('flat', -90, GY + 0.02, ZC, 160, L + 60, 0x5a8a3a); flat('slab', -50, GY + 0.04, ZC, 3, L + 40, 0xb8ae98, 1.6); flat('slab', -100, GY + 0.04, ZC, 3, L + 40, 0xb8ae98, 1.6);
  B.add('flat', BOX, M4(GX - 4, GY / 2, ZC, 11.3, 0.3, L + 30, 0, 0, 0.785), 0x4e7a32, {}); // the bank
  for (let i = 0; i < 34; i++) { const x = -20 - rand() * 110, z = Z0 - 20 + rand() * (L + 40); if (TERR.some(([a, b, xw]) => z > a - 3 && z < b + 3 && x > xw - 4)) continue; if (Math.hypot(x + 60, z - PS.FOUNT) < 12) continue; const h = 5 + rand() * 5;
    cyl('wood', x, GY + h / 2, z, 0.2, 0.32, h, 0x4a3a2c, { phys: false, seg: 5 }); B.add('flat', new THREE.IcosahedronGeometry(3 + rand() * 1.5, 0), M4(x, GY + h + 1.8, z, 1, 0.85, 1, 0, rand() * 3), pick([0x3e6a2e, 0x4a7a36, 0x355e28, 0x5a8a3e]), {}); }
  { // the Ross Fountain (references allow it): basin, tiered cast-iron column, figures, a top statue
    const x = -60, z = PS.FOUNT, y = GY; cyl('stone', x, y + 0.4, z, 5, 5.2, 0.8, 0xb8a890, { phys: false, seg: 14 }); flat('flat', x, y + 0.75, z, 9, 9, 0x6a8a9a);
    cyl('flat', x, y + 1.6, z, 1.2, 2.2, 1.8, 0x3e7a6a, { phys: false, seg: 10 }); cyl('flat', x, y + 2.6, z, 2.8, 2.4, 0.4, 0x3e7a6a, { phys: false, seg: 12 }); cyl('flat', x, y + 4, z, 0.6, 0.9, 2.8, 0x3e7a6a, { phys: false, seg: 8 });
    cyl('flat', x, y + 5.5, z, 1.6, 1.3, 0.3, 0xc8a040, { phys: false, seg: 10 }); cyl('flat', x, y + 6.6, z, 0.35, 0.5, 2.0, 0x3e7a6a, { phys: false, seg: 8 }); B.add('flat', new THREE.ConeGeometry(0.45, 1.6, 6), M4(x, y + 8.4, z, 1, 1, 1), 0xc8a040, {});
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; cyl('flat', x + Math.cos(a) * 1.7, y + 3.4, z + Math.sin(a) * 1.7, 0.25, 0.35, 1.4, 0xc8a040, { phys: false, seg: 6 }); } }
  { // the castle on its rock, high above the west gardens
    const x = -150, z = Z0 + 40; B.add('stone', new THREE.CylinderGeometry(30, 52, 44, 9, 1), M4(x, GY + 22, z, 1, 1, 1.4), 0x5a5448, { tile: 4 }); B.add('flat', new THREE.IcosahedronGeometry(18, 0), M4(x + 26, GY + 6, z - 10, 1.2, 0.6, 1.8), 0x4a7a36, {});
    for (const [dx, dz, w, h, d] of [[0, -18, 26, 12, 14], [6, 6, 14, 18, 12], [-6, 22, 20, 10, 16], [8, -34, 10, 8, 10]]) { solid('stone', x + dx, GY + 44 + h / 2, z + dz, w, h, d, 0x8a8070, { phys: false, tile: 3 }); B.add('roof', ROOF, M4(x + dx, GY + 44 + h, z + dz, w, 3, d), 0x4e535a, {});
      for (let k = 0; k < 4; k++) quad('facade', x + dx + w / 2 + 0.02, GY + 44 + h / 2, z + dz - d / 2 + (k + 0.5) * d / 4, d / 4 * 0.6, 2.6, Math.PI / 2, cellUV(FACADE.small), 0xc8c0b0); }
    solid('stone', x + 22, GY + 41, z, 4, 8, 90, 0x7a7262, { phys: false, tile: 3 }); }
  { // the gallery (a classical temple front) at the Mound, behind the floral clock terrace
    const x0 = -42, z0 = 4, z1 = 24, zc = (z0 + z1) / 2, CS = 0xd2c4a2; solid('stone', x0 - 12, 9, zc, 24, 14, z1 - z0, CS, { phys: false, tile: 3 }); solid('stone', x0 + 1, 0.9, zc, 3, 1.8, z1 - z0 + 2, CS, { phys: false });
    for (let k = 0; k < 8; k++) cyl('stone', x0 + 1.4, 7.2, z0 + 1.2 + k * (z1 - z0 - 2.4) / 7, 0.62, 0.7, 10.8, CS, { phys: false, seg: 10 });
    solid('stone', x0 + 1, 13.4, zc, 3.4, 1.6, z1 - z0 + 1, CS, { phys: false }); B.add('roof', ROOF, M4(x0 + 0.6, 14.2, zc, z1 - z0 + 1, 3.6, 0.8, 0, Math.PI / 2), CS, {}); B.add('roof', ROOF, M4(x0 - 12, 16, zc, 24, 3, z1 - z0), CS, {});
    B.add('stone', new THREE.IcosahedronGeometry(1.2, 0), M4(x0 + 0.8, 18.3, zc, 1, 1.1, 1), 0xa8987a, {}); for (const z of [z0, z1]) B.add('stone', new THREE.IcosahedronGeometry(0.9, 0), M4(x0 + 0.8, 15.4, z, 1, 1, 1), 0xa8987a, {}); }
  { // the floral clock on the terrace by the Mound (chip it into the bed)
    const x = -26, z = 14, R0 = 4; B.add('flat', new THREE.CylinderGeometry(R0, R0 + 0.4, 0.5, 18, 1), M4(x, 0.25, z, 1, 1, 1, 0, 0, -0.18), 0x4a2a2e, {});
    const fc = atlas.draw(128, 128, (g, w, h) => { g.fillStyle = '#d83a6a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a8a3a'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill(); g.fillStyle = '#e8e0c0'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(64 + Math.sin(a) * 40, 64 - Math.cos(a) * 40, 5, 0, 7); g.fill(); } g.fillStyle = '#c84a8a'; g.beginPath(); g.arc(64, 64, 18, 0, 7); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 24); g.moveTo(64, 64); g.lineTo(96, 54); g.stroke(); });
    quad('atlas', x, 0.52, z, 2 * R0, 2 * R0, Math.PI / 2, fc, 0xffffff, { rx: -Math.PI / 2 + 0.18 }); body(new CANNON.Cylinder(R0, R0, 0.5, 14), x, 0.25, z, { surface: 'grass' });
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; cyl('metal', x + Math.cos(a) * (R0 + 0.7), 0.3, z + Math.sin(a) * (R0 + 0.7), 0.02, 0.02, 0.6, IRON, { phys: false, seg: 4 }); }
    tgt({ id: 'floralclock', name: 'Floral Clock', hint: 'chip it onto the floral clock', points: 125, kind: 'zone', kickOnly: true, pos: V(GX - 3, 0, z), ringR: 1.0, stand: V(GX - 4, 0, z), aim: V(x, 0.6, z),
      zone: new THREE.Box3(V(x - R0 + 0.3, 0, z - R0 + 0.3), V(x + R0 - 0.3, 2.2, z + R0 - 0.3)), lines: ['Right on the hour - and in bloom.', 'The gardeners are spitting feathers.', 'Petals everywhere. Lovely.'] }); }
  { // the gardens gate (cast-iron, stone piers) and steps down: kick it through
    const z = PS.GATE, x = GX - 0.2; for (const s of [-1, 1]) { solid('stone', x, 1.4, z + s * 1.9, 0.9, 2.8, 0.9, 0x8a8478, { tile: 1 }); B.add('stone', new THREE.SphereGeometry(0.4, 8, 5), M4(x, 3.0, z + s * 1.9, 1, 1, 1), 0x8a8478, {}); }
    for (let k = 0; k < 8; k++) cyl('metal', x - 0.6, 1.3, z - 1.3 + k * 0.37, 0.025, 0.025, 2.6, IRON, { phys: false, seg: 4 }); B.add('metal', new THREE.TorusGeometry(1.4, 0.04, 4, 10, Math.PI), M4(x - 0.6, 2.2, z, 1, 0.4, 1, 0, Math.PI / 2), IRON, {});
    solid('metal', x - 0.6, 2.62, z, 0.05, 0.05, 2.9, IRON, { phys: false }); // the gate stands open, swung back
    boxBody(x - 2.5, -0.5, z, 5, 1, 3, { surface: 'paving' }); flat('slab', x - 2.5, 0.02, z, 5, 3, 0xa8a090, 1); for (let k = 0; k < 6; k++) solid('stone', x - 5.3 - k * 0.6, -0.8 - k * 1.1, z, 0.6, 1.1, 3, 0xa8a090, { phys: false });
    for (const s of [-1, 1]) boxBody(x - 2.5, 2, z + s * 1.6, 5, 4, 0.2, { playerOnly: true }); boxBody(x - 5.2, 2, z, 0.2, 4, 3, { playerOnly: true });
    tgt({ id: 'gardengate', name: 'Gardens Gate', hint: 'kick it through the open gardens gate', points: 125, kind: 'zone', kickOnly: true, pos: V(x + 2, 0, z), ringR: 1.0, stand: V(x + 6, 0, z), aim: V(x - 2, 0.8, z),
      zone: new THREE.Box3(V(x - 4.8, -0.2, z - 1.3), V(x - 1.0, 2.6, z + 1.3)), lines: ['Through the gate and doon the steps!', 'Gardens open. Ball in.', 'Park keeper\'s face: priceless.'] }); }
  { // the monument: a dark Gothic spire on the east terrace; the seated statue under the arches; the info board
    const x = -26, z = 50, MS = 0x4c483f; for (const a of [-1, 1]) for (const b of [-1, 1]) solid('stone', x + a * 3.6, 7, z + b * 3.6, 2.4, 14, 2.4, MS, { tile: 2 });
    solid('stone', x, 14.5, z, 10, 1.2, 10, MS, { phys: false }); cyl('flat', x, 1.6, z, 0.9, 1.1, 3.2, 0xe8e4dc, { phys: false, seg: 8 });
    for (const [y0, h, w] of [[15, 10, 7.4], [25, 8, 5.6], [33, 7, 4.2]]) { solid('stone', x, y0 + h / 2, z, w, h, w, MS, { phys: false, tile: 2 }); for (const a of [-1, 1]) for (const b of [-1, 1]) B.add('stone', new THREE.ConeGeometry(0.5, 4 + h * 0.3, 4), M4(x + a * w / 2, y0 + h + 1.6, z + b * w / 2, 1, 1, 1), MS, {});
      for (const [dx, dz, ry] of [[-w / 2 - 0.02, 0, NRY], [0, -w / 2 - 0.02, Math.PI]]) quad('facade', x + dx, y0 + h / 2, z + dz, w * 0.4, h * 0.6, ry, cellUV(FACADE.arch), 0x6a665c); }
    B.add('stone', new THREE.ConeGeometry(2.1, 12, 4), M4(x, 46, z, 1, 1, 1, 0, Math.PI / 4), MS, {}); B.add('flat', new THREE.TorusGeometry(2.6, 0.12, 4, 12), M4(x, 1.0, z, 1.4, 1.4, 1, Math.PI / 2), 0xc84a6a, {});
    const bx = GX - 4, bz = z - 7; for (const s of [-1, 1]) cyl('wood', bx, 0.6, bz + s * 0.7, 0.05, 0.05, 1.2, 0x3a2e24, { phys: false, seg: 4 }); solid('wood', bx, 1.1, bz, 0.1, 0.9, 1.6, 0x2a3a2a, { target: 'scottboard', surface: 'board' });
    quad('atlasLit', bx + 0.06, 1.1, bz, 1.5, 0.84, Math.PI / 2, atlas.draw(160, 96, (g, w, h) => { g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e0c0'; g.font = 'bold 15px Georgia'; g.textAlign = 'center'; g.fillText('THE MONUMENT', w / 2, 24); g.font = '12px Georgia'; g.fillText('287 steps to the top', w / 2, 48); g.fillText('Open daily', w / 2, 68); }));
    tgt({ id: 'scottboard', name: 'Monument Board', hint: 'hit the info board by the monument', points: 75, kind: 'hit', pos: V(bx + 1.2, 0, bz), ringR: 0.9, stand: V(bx + 5, 0, bz), aim: V(bx, 1.1, bz), lines: ['287 steps - or one good strike.', 'The statue didnae flinch.', 'Board hit. Very Gothic.'] }); }
  // ---------- trams: a stop with a shelter (south kerb) and a tram waiting (fictional livery) ----------
  { const z = PS.STOP; flat('slab', GX + 2, 0.06, z, 4, 30, 0xb8b4aa, 1.2); solid('stone', GX + 2.2, 0.1, z, 3.6, 0.2, 30, 0xb8b4aa, { phys: false });
    solid('glass', GX + 0.8, 1.35, z, 0.08, 2.2, 3.6, 0xcfe0e6, { target: 'tramstop', surface: 'metal' }); solid('metal', GX + 1.5, 2.55, z, 1.8, 0.1, 4, 0x3a3e42, { phys: false }); for (const s of [-1, 1]) solid('metal', GX + 1.5, 1.25, z + s * 1.9, 1.4, 2.5, 0.06, 0x3a3e42);
    quad('atlasLit', GX + 2.4, 2.9, z + 3, 1.6, 0.5, Math.PI / 2, atlas.sign('CITY TRAMS', '#7a1a2a', '#ffffff', 3.2, 'bold 40px Arial')); cyl('metal', GX + 2.4, 1.6, z + 3, 0.05, 0.05, 3.2, 0x55585c, { phys: false, seg: 4 });
    tgt({ id: 'tramstop', name: 'Tram Shelter', hint: 'hit the tram stop shelter', points: 50, kind: 'hit', pos: V(GX + 2.5, 0, z), ringR: 1.0, stand: V(GX + 5.4, 0, z), aim: V(GX + 0.8, 1.2, z), lines: ['Next tram: 3 minutes.', 'Shelter rattled. Tram bell rang.', 'Mind the gap!'] }); }
  { const z = PS.TRAM, x = 2.2, Lt = 34; solid('metal', x, 1.95, z, 2.65, 3.0, Lt, 0xf2f2f0, { target: 'tram', surface: 'metal' }); solid('metal', x, 0.8, z, 2.67, 0.7, Lt + 0.02, 0xb0182a, { phys: false });
    for (const s of [-1, 1]) quad('flat', x + s * 1.34, 2.4, z, Lt - 2, 1.1, s > 0 ? Math.PI / 2 : -Math.PI / 2, null, 0x2a3238); solid('metal', x, 3.6, z, 1, 0.3, 6, 0x3a3a3a, { phys: false }); solid('metal', x, 3.0, z + Lt / 2 + 0.2, 2.5, 1.2, 0.4, 0x2a3238, { phys: false });
    for (let k = 0; k < 4; k++) solid('metal', x, 0.6, z - Lt / 2 + 1 + k * 0.01, 2.69, 0.3, 0.3, 0xb0182a, { phys: false });
    tgt({ id: 'tram', name: 'The Tram', hint: 'hit the waiting tram', points: 50, kind: 'hit', pos: V(-1.2, 0, z - 6), ringR: 1.0, stand: V(-4, 0, z - 6), aim: V(x, 1.4, z - 6), lines: ['Ding ding! Tram\'s no\' moving.', 'Tram hit. Driver\'s seen it all.', 'Next stop: the back o\' the net.'] }); }
  { const x = F - 1.2, z = Z0 + 6; cyl('metal', x, 0.75, z, 0.3, 0.3, 1.5, 0xc8202a, { phys: false, seg: 10 }); B.add('metal', new THREE.SphereGeometry(0.32, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, 1.5, z, 1, 1, 1), 0xc8202a, {}); body(new CANNON.Cylinder(0.32, 0.32, 1.6, 10), x, 0.8, z, { target: 'postbox', surface: 'metal' });
    tgt({ id: 'postbox', name: 'Pillar Box', hint: 'hit the red pillar box', points: 50, kind: 'hit', pos: V(x - 1.2, 0, z), ringR: 0.9, stand: V(x - 4.5, 0, z), aim: V(x, 0.8, z), lines: ['First class!', 'Posted. Nae stamp needed.', 'Signed for.'] }); }
  // lamps along the north kerb, benches and bins on the gardens side
  for (let z = Z0 + 14; z < Z1; z += 20) { cyl('metal', RW + 0.6, 4.5, z, 0.07, 0.1, 9, 0x4a4e52, { seg: 6 }); solid('lamp', RW + 0.1, 8.9, z, 1.2, 0.12, 0.5, 0xffffff, { phys: false }); }
  for (const z of [Z0 + 30, Z0 + 92, Z0 + 140]) { solid('wood', GX + 0.8, 0.45, z, 0.6, 0.12, 1.8, 0x7a5a3a, { phys: false }); solid('metal', GX + 0.8, 0.22, z, 0.5, 0.44, 1.6, IRON, { phys: false }); }
  // edges
  boxBody(F + 0.5, 3, ZC, 1, 6, L + 20, { playerOnly: true }); boxBody(0, 3, Z0 - 4, 2 * F, 6, 1, { playerOnly: true }); solid('stone', 0, 9, Z0 - 40, 50, 18, 6, 0xbcb092, { phys: false, tile: 3 });
  const groups = [V(-6, 0, Z0 + 12), V(-30, 0, 44), V(-24, 0, 10), V(8, 0, Z0 + 120)];
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P_, facadeTex, atlas.tex); materials.flat.side = THREE.DoubleSide;
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P_.shadows });
  const views = { spawn: [PS.SPAWN[0], PS.SPAWN[2], 180, 4, 0.5], castle: [-9, -60, 95, 6, 0.5], monument: [-8, 30, 138, 14, 0.5], hotel: [0, 40, 180, 6, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);
PS.SPAWN = [-3, 0.5, PS.Z0 + 2];

export function surfaceAt(x, z) {
  if (x < PS.GX - 1) return (z > 6 && z < 22) || (z > 36 && z < 64) ? 'paving' : 'grass';
  return Math.abs(x) < PS.RW ? 'tarmac' : 'paving';
}
export default {
  id: 'princesstreet', name: 'Princes Street', short: 'Princes St', surfaceAt,
  sounds: { birds: [[-30, -30], [-30, 50], [-60, 0]], gulls: [[0, 60], [-80, -20]], far: [[0, -90], [0, 110], [-100, 0], [40, 40]], roadX: 30 },
  blurb: 'Level 9: Princes Street. The shops on one side, the gardens, the castle and the monument on the other, trams down the middle. 10 targets.',
  intro: "Welcome tae Princes Street!<br><small>Shops on the left, the gardens and the castle on the right, the trams doon the middle. Easy first one: the pillar box, just ahead on the left.</small>",
  build,
  tiers: { postbox: 'easy', storedoor: 'easy', chemistdoor: 'easy', tramstop: 'easy', deptdoor: 'easy', tram: 'easy', scottboard: 'easy', hotelboard: 'easy', gardengate: 'tricky', floralclock: 'tricky' },
  spawn: PS.SPAWN, spawnYaw: 180,
  ballHomes: () => [[-3, 0.4, PS.Z0 + 4], [-3, 0.4, 0], [-3, 0.4, 70]],
  bounds: { x: 175, zMin: PS.Z0 - 12, zMax: PS.Z1 + 12 },
  next: 'grassmarket',
};
