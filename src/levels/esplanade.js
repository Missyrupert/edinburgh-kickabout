// Level 11 (the finale): the Castle Esplanade (v3.9). The broad parade ground in front of the Castle: the gatehouse (statue niches,
// crenellations) over the dry ditch, the Half Moon Battery and palace block on the rock above, parapet walls, the tattoo-stand
// scaffolding along both sides, memorials, and the view back down Castlehill (setts, tall lands, the Hub-style spire).
// NEW twist: the Crowning Stone - a crown on a plinth that only counts once every other target is bagged; crowning it finishes the game.
// x: west (-) towards the Castle, east (+) down Castlehill.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, GRIME_UV, tarmacTexture } from '../textures.js';
import { makeMaterials, mulberry32 } from '../world.js';

export const ES = { DITCH: -46, GATE: -54, SZ: 22, SPAWN: [40, 0.5, 0], SPAWNYAW: 90 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P_) {
  const rand = mulberry32(1640), pick = (a) => a[Math.floor(rand() * a.length)];
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
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, target = null, surface = null } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile }); return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, surface }) : null; }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null, rx = 0, rz = 0 } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1, rx, 0, rz), color, {}); return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface, rx, rz }) : null; }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, tile });
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.8 + rand() * 0.2; return c.setRGB(c.r * k, c.g * k, c.b * k).getHex(); };
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const { DITCH, GATE, SZ } = ES, ACC = 0xC9A227, IRON = 0x34373c, SAND = [0xc8b088, 0xbca47e, 0xd0b890, 0xb09872], SEAT = 0x2a4a8a, TAR = 0x77787a;

  // ---------- ground: the parade ground (tarmac), setts at the bridge and down Castlehill ----------
  boxBody(10, -1, 0, 150, 2, 80, { surface: 'tarmac' });
  B.add('tarmac', QUAD, M4(0, 0.006, 0, 2 * 46, 2 * SZ, 1, -Math.PI / 2), 0xb4b4b0, { tile: 4 });
  for (let i = 0; i < 50; i++) { const x = -44 + rand() * 88, z = -20 + rand() * 40, w = 2 + rand() * 4; quad('grime', x, 0.012, z, w, w * 0.7, rand() * 3, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }
  for (let x = -40; x <= 40; x += 8) solid('flat', x, 0.008, 0, 0.12, 0.01, 1.6, 0xd8d6cc, { phys: false }); // faint parade markings
  B.add('cobble', QUAD, M4(70, 0.006, 0, 50, 14, 1, -Math.PI / 2), 0xa8a6a0, { tile: 1.4 }); // Castlehill setts
  B.add('cobble', QUAD, M4(-50, 0.008, 0, 10, 6, 1, -Math.PI / 2), 0x9a9890, { tile: 1.4 }); // the bridge over the ditch

  // ---------- the dry ditch, the bridge parapets, the gatehouse ----------
  for (const s of [-1, 1]) { const z0 = s * 3.2, z1 = s * SZ; solid('castleStone', DITCH, 0.55, (z0 + z1) / 2, 1.0, 1.1, Math.abs(z1 - z0), 0xa8946e, { tile: 2.4 }); boxBody(DITCH, 2, (z0 + z1) / 2, 1.0, 3, Math.abs(z1 - z0), { playerOnly: true });
    B.add('flat', QUAD, M4(DITCH - 4, 0.02, (z0 + z1) / 2, 7, Math.abs(z1 - z0), 1, -Math.PI / 2), 0x2e2a24, {}); // the ditch, in shadow
    solid('castleStone', -50, 0.6, s * 3.2, 8, 1.2, 0.6, 0xa8946e, { tile: 2.4 }); } // bridge parapets
  boxBody(-50, 2, 0, 1, 4, 6.4, { playerOnly: true }); // the gate's closed today (players)
  { const x = GATE, W = 26, H = 13, GC = 0xbca47e;
    solid('castleStone', x - 3, H / 2, 0, 6, H, W, GC, { tile: 3 });
    for (let z = -W / 2 + 0.7; z < W / 2; z += 1.6) solid('castleStone', x - 0.3, H + 0.6, z, 1.2, 1.2, 0.8, GC, { phys: false }); // crenellations
    for (const s of [-1, 1]) { solid('castleStone', x - 3, H / 2 + 1.5, s * (W / 2 + 1.5), 7, H + 3, 3.4, GC, { tile: 3 }); for (let k = 0; k < 2; k++) solid('castleStone', x - 0.2, H + 3.6, s * (W / 2 + 0.6 + k * 1.6), 1.0, 1.2, 0.8, GC, { phys: false }); } // corner turrets
    B.add('flat', QUAD, M4(x + 0.02, 2.8, 0, 3.6, 5.6, 1, 0, Math.PI / 2), 0x1a1612, {}); B.add('flat', new THREE.CircleGeometry(1.8, 16, 0, Math.PI), M4(x + 0.02, 5.6, 0, 1, 1, 1, 0, Math.PI / 2), 0x1a1612, {}); // the archway
    for (const s of [-1, 1]) { solid('stone', x + 0.05, 2.2, s * 2.3, 0.3, 4.4, 0.5, 0xd0bc94, { phys: false }); } solid('stone', x + 0.05, 7.6, 0, 0.3, 0.4, 5.2, 0xd0bc94, { phys: false });
    quad('atlas', x + 0.06, 9.6, 0, 2.6, 2.2, Math.PI / 2, atlas.draw(120, 100, (g, w, h) => { g.fillStyle = '#8a7656'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a4a34'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#6a5a40'; g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(w - 28, 34); g.lineTo(w - 34, 72); g.lineTo(w / 2, 88); g.lineTo(34, 72); g.lineTo(28, 34); g.closePath(); g.fill(); }), 0xffffff); // a carved stone panel (plain)
    // statue niches either side of the arch: the niche statue on the north side is a target
    for (const s of [-1, 1]) { const z = s * 5.4; B.add('flat', QUAD, M4(x + 0.03, 4.2, z, 1.6, 3.4, 1, 0, Math.PI / 2), 0x3a3024, {}); solid('stone', x + 0.4, 2.4, z, 0.9, 0.3, 1.8, 0xd0bc94, { phys: false });
      cyl('metal', x + 0.4, 3.6, z, 0.28, 0.34, 2.1, 0x4a4434, { phys: false, seg: 8 }); B.add('metal', new THREE.SphereGeometry(0.24, 8, 6), M4(x + 0.4, 4.9, z, 1, 1, 1), 0x4a4434, {}); }
    boxBody(x + 0.4, 3.8, 5.4, 0.8, 3.2, 1.6, { target: 'niche', surface: 'metal' });
    addTarget({ id: 'niche', name: 'Gatehouse Statue', hint: 'land one on the statue in the gatehouse niche, ower the ditch', points: 150, kind: 'hit', pos: V(-40, 0, 5.4), ringR: 1.0, stand: V(-36, 0, 5.4), aim: V(x + 0.4, 4.0, 5.4), lines: ['A champion\'s salute fae the niche!', 'Bronze, bruised.', 'Ower the ditch an\' bang on.'] });
    // sentry box by the bridge
    { const bx = -43.5, bz = -4.6; solid('wood', bx, 1.3, bz, 1.1, 2.6, 1.1, 0x2a3e2e, { target: 'sentry', surface: 'board' }); B.add('roof', ROOF, M4(bx, 2.6, bz, 1.3, 0.7, 1.3, 0, 0), 0x2a3e2e, {}); quad('flat', bx + 0.56, 1.4, bz, 0.7, 1.8, Math.PI / 2, null, 0x161a16);
      addTarget({ id: 'sentry', name: 'Sentry Box', hint: 'hit the sentry box by the bridge', points: 75, kind: 'hit', pos: V(bx + 3, 0, bz), ringR: 0.9, stand: V(bx + 6.5, 0, bz - 1.2), aim: V(bx + 0.5, 1.3, bz), lines: ['Halt! Who goes there? ...A ba\'.', 'The sentry didnae flinch.', 'Box ticked.'] }); } }
  // ---------- the castle above: rock, the Half Moon Battery drum, the palace block, the barracks ----------
  { const X = -76; B.add('castleRock', new THREE.IcosahedronGeometry(1, 1), M4(X - 12, -1, 0, 22, 13, 36), 0x5a5048, {});
    cyl('castleStone', X - 2, 14, 10, 12, 13, 20, 0xb8a07a, { phys: false, seg: 20 }); for (let i = 0; i < 18; i++) { const a = Math.PI / 2 + (i / 17 - 0.5) * 2.4; solid('castleStone', X - 2 + Math.sin(a) * 11.8, 24.6, 10 + Math.cos(a) * 11.8, 1.0, 1.2, 1.2, 0xb8a07a, { phys: false, ry: a }); }
    solid('castleStone', X - 6, 24, -10, 14, 32, 20, 0xc4ae86, { phys: false, tile: 3 }); B.add('roof', ROOF, M4(X - 6, 40, -10, 14.4, 5, 20.4, 0, 0), 0x55585c, {});
    for (let j = 0; j < 4; j++) for (let k = -2; k <= 2; k++) quad('facade', X + 1.02, 14 + j * 5, -10 + k * 3.6, 1.2, 2.4, Math.PI / 2, cellUV(FACADE.small), vt());
    for (const zz of [-17, -3]) { cyl('castleStone', X + 0.6, 42, zz, 1.0, 1.0, 4, 0xc4ae86, { phys: false, seg: 8 }); B.add('roof', new THREE.ConeGeometry(1.2, 2.4, 8), M4(X + 0.6, 45.2, zz, 1, 1, 1), 0x55585c, {}); }
    solid('castleStone', X - 10, 18, 26, 30, 18, 12, 0xb09872, { phys: false, tile: 3 }); // the walls running north
    cyl('metal', X - 6, 46, -10, 0.06, 0.06, 8, IRON, { phys: false, seg: 4 }); quad('flat', X - 6, 48.6, -9.1, 1.8, 1.1, 0, null, 0x2a4a8a); }

  // ---------- the tattoo stands: stepped blue seating on scaffolding along both sides ----------
  for (const s of [-1, 1]) { const zf = s * SZ, rows = 14, X0 = -38, X1 = 38, L = X1 - X0, xc = (X0 + X1) / 2;
    solid('flat', xc, 0.6, zf, L, 1.2, 0.3, 0x1f2a3a); // front hoarding
    quad('atlasLit', -24, 0.62, zf - s * 0.16, 10, 0.9, s > 0 ? Math.PI : 0, atlas.sign('ESPLANADE NIGHTS · SUMMER', '#1f2a3a', '#e8c766', 10 / 0.9, 'bold 44px Arial'));
    quad('atlasLit', 24, 0.62, zf - s * 0.16, 10, 0.9, s > 0 ? Math.PI : 0, atlas.sign('PIPES · DRUMS · DANCE', '#1f2a3a', '#e8c766', 10 / 0.9, 'bold 44px Arial'));
    for (let k = 0; k < rows; k++) { const z = zf + s * (0.55 + k * 0.85), y = 1.2 + k * 0.5; solid('flat', xc, y - 0.04, z, L, 0.08, 0.85, 0x6c7076, { phys: false }); solid('flat', xc, y + 0.2, z + s * 0.2, L, 0.4, 0.4, SEAT, { phys: false }); }
    { const al = Math.atan(0.5 / 0.85), Ld = rows * 0.85 / Math.cos(al), zc = zf + s * (rows * 0.85 / 2 + 0.15), yc = 1.2 + (rows - 1) * 0.25; body(new CANNON.Box(new CANNON.Vec3(L / 2, 0.3, Ld / 2)), xc, yc, zc, { rx: -s * al, surface: 'board' }); } // seats (one slope)
    boxBody(xc, 0.6, zf, L, 1.2, 0.3, { surface: 'board' });
    const zb = zf + s * (rows * 0.85 + 0.6), top = 1.2 + rows * 0.5 + 1.6;
    for (let x = X0; x <= X1 + 0.1; x += 3.8) { cyl('metal', x, top / 2, zb, 0.05, 0.05, top, 0x9aa0a8, { phys: false, seg: 4 }); cyl('metal', x, 0.6, zf + s * 0.25, 0.05, 0.05, 1.2, 0x9aa0a8, { phys: false, seg: 4 });
      if (x < X1) { const from = V(x, 0.3, zb), to = V(x + 3.8, top - 0.3, zb), d = to.clone().sub(from); B.add('metal', BOX, new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()), V(0.06, d.length(), 0.06)), 0x9aa0a8, {}); } }
    for (const y of [2, top / 2, top - 0.2]) solid('metal', xc, y, zb, L, 0.08, 0.08, 0x9aa0a8, { phys: false });
    solid('flat', xc, top - 0.6, zb + s * 0.05, L, 1.2, 0.05, 0x1f2a3a, { phys: false }); boxBody(xc, top / 2, zb, L, top, 0.4, { playerOnly: true });
    for (const xe of [X0 - 0.5, X1 + 0.5]) { solid('flat', xe, top / 2, (zf + zb) / 2, 0.1, top, Math.abs(zb - zf), 0x1f2a3a, { phys: false }); boxBody(xe, top / 2, (zf + zb) / 2, 0.4, top, Math.abs(zb - zf)); } }
  // banner on a scaffold over the north stand (hard, high)
  { const x = -14, z = SZ - 0.1, y = 4.2; for (const d of [-1.4, 1.4]) cyl('metal', x + d, 2.6, z + 0.2, 0.05, 0.05, 5.2, 0x9aa0a8, { phys: false, seg: 4 });
    solid('flat', x, y, z, 2.8, 1.2, 0.08, 0x8a1f2a, { target: 'banner', surface: 'board' }); quad('atlasLit', x, y, z - 0.05, 2.7, 1.1, Math.PI, atlas.sign('WELCOME', '#8a1f2a', '#f2e6c0', 2.7 / 1.1, 'bold 60px Georgia'));
    addTarget({ id: 'banner', name: 'Stand Banner', hint: 'hit the high banner on the north stand', points: 100, kind: 'hit', pos: V(x, 0, SZ - 4), ringR: 1.0, stand: V(x, 0, SZ - 7.5), aim: V(x, y, z), lines: ['The crowd\'s on its feet!', 'Banner day.', 'Welcomed!'] }); }
  // front-row zone in the south stand (kick it intae the seats)
  addTarget({ id: 'seats', name: 'Seat in the Stand', hint: 'kick it up intae the south stand - land it in the seats', points: 100, kind: 'zone', kickOnly: true, pos: V(4, 0, -SZ + 5), ringR: 1.0, stand: V(4, 0, -SZ + 9), aim: V(4, 2.4, -SZ - 1.6),
    zone: new THREE.Box3(V(-0.5, 1.4, -SZ - 4.2), V(8.5, 4.8, -SZ - 0.4)), lines: ['Intae the stand! Somebody keep that.', 'Row C, seat 12. Sold out.', 'The stand roars.'] });

  // ---------- parade-ground pieces: the info board (easy first), a cannon, a memorial, a statue, a pipe-band drum ----------
  { const x = 31, z = -4.2; for (const d of [-0.8, 0.8]) cyl('metal', x, 0.4, z + d, 0.05, 0.05, 0.8, IRON, { phys: false, seg: 4 });
    solid('wood', x, 0.85, z, 0.1, 1.2, 1.8, 0x1f2a3a, { target: 'infoboard', surface: 'board' }); quad('atlasLit', x + 0.06, 0.85, z, 1.7, 1.0, Math.PI / 2, atlas.draw(170, 100, (g, w, h) => { g.fillStyle = '#1f2a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c766'; g.textAlign = 'center'; g.font = 'bold 16px Georgia'; g.fillText('THE ESPLANADE', w / 2, 24); g.fillStyle = '#e8e0c8'; g.font = '12px Georgia'; g.fillText('Parade ground since 1753', w / 2, 50); g.fillText('Please keep off the stands', w / 2, 70); }));
    addTarget({ id: 'infoboard', name: 'Esplanade Board', hint: 'hit the information board', points: 50, kind: 'hit', pos: V(x + 2, 0, z), ringR: 0.9, stand: V(x + 5, 0, z), aim: V(x, 0.85, z), lines: ['Informed!', 'Read that.', 'Board meeting: adjourned.'] }); }
  { const x = -28, z = -12; cyl('metal', x, 0.9, z - 0.2, 0.2, 0.26, 2.6, 0x1c1e20, { phys: false, seg: 10, rx: Math.PI / 2 - 0.08 }); body(new CANNON.Cylinder(0.24, 0.28, 2.6, 8), x, 0.9, z - 0.2, { rx: Math.PI / 2 - 0.08, target: 'cannon', surface: 'metal' });
    for (const s of [-1, 1]) { cyl('metal', x + s * 0.5, 0.5, z + 0.3, 0.5, 0.5, 0.1, 0x1c1e20, { phys: false, seg: 12, rz: Math.PI / 2 }); } solid('wood', x, 0.45, z + 0.4, 0.8, 0.3, 1.6, 0x2a2420, { phys: false });
    addTarget({ id: 'cannon', name: 'Old Cannon', hint: 'hit the auld cannon', points: 75, kind: 'hit', pos: V(x, 0, z + 3), ringR: 0.9, stand: V(x, 0, z + 6), aim: V(x, 0.9, z), lines: ['BOOM. (Metaphorically.)', 'The one o\'clock gun\'s jealous.', 'Fire in the hole!'] }); }
  { const x = 8, z = -15; solid('castleStone', x, 0.6, z, 2.4, 1.2, 2.4, 0xa89474, {}); solid('stone', x, 3.6, z, 1.1, 5, 1.1, 0xb8a888, { target: 'memorial', surface: 'stone' }); B.add('stone', new THREE.ConeGeometry(0.8, 1.4, 4), M4(x, 6.8, z, 1, 1, 1, 0, Math.PI / 4), 0xb8a888, {});
    quad('atlas', x, 2.2, z + 0.56, 0.9, 0.7, 0, atlas.draw(90, 70, (g, w, h) => { g.fillStyle = '#9a8a6a'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a3020'; g.font = 'bold 11px Georgia'; g.textAlign = 'center'; g.fillText('IN MEMORY', w / 2, 28); g.font = '10px Georgia'; g.fillText('of the regiment', w / 2, 48); }));
    addTarget({ id: 'memorial', name: 'Memorial Obelisk', hint: 'hit the memorial obelisk (respectfully)', points: 75, kind: 'hit', pos: V(x, 0, z + 4), ringR: 0.9, stand: V(x, 0, z + 7.5), aim: V(x, 2.6, z), lines: ['Respect.', 'A quiet clip. Well played.', 'Remembered.'] }); }
  { const x = -6, z = 15.5; solid('castleStone', x, 1.2, z, 1.8, 2.4, 1.8, 0xa89474, {}); cyl('metal', x, 3.4, z, 0.3, 0.38, 2.0, 0x4a4434, { seg: 8, target: 'statue' }); B.add('metal', new THREE.SphereGeometry(0.26, 8, 6), M4(x, 4.7, z, 1, 1, 1), 0x4a4434, {});
    addTarget({ id: 'statue', name: 'Statue on the Plinth', hint: 'chip it up tae the statue on its plinth', points: 100, kind: 'hit', pos: V(x, 0, z - 4), ringR: 0.9, stand: V(x, 0, z - 7.5), aim: V(x, 3.4, z), lines: ['Heid tae heid wi\' history.', 'The Duke\'s been dinged.', 'Plinth perfect.'] }); }
  { const x = -12, z = -5; for (const d of [-0.5, 0.5]) cyl('metal', x + d, 0.45, z, 0.03, 0.03, 0.9, IRON, { phys: false, seg: 4 });
    cyl('flat', x, 1.2, z, 0.5, 0.5, 0.45, 0xf2ece0, { phys: false, seg: 16, rz: Math.PI / 2 }); for (const d of [-0.24, 0.24]) cyl('flat', x + d, 1.2, z, 0.52, 0.52, 0.06, 0x8a1f2a, { phys: false, seg: 16, rz: Math.PI / 2 });
    body(new CANNON.Cylinder(0.5, 0.5, 0.5, 12), x, 1.2, z, { rz: Math.PI / 2, target: 'drum', surface: 'board' });
    addTarget({ id: 'drum', name: 'Pipe-Band Drum', hint: 'hit the big drum', points: 75, kind: 'hit', pos: V(x + 3, 0, z), ringR: 0.9, stand: V(x + 6, 0, z + 1.5), aim: V(x, 1.2, z), lines: ['BOOM-boom-boom!', 'The drum major\'s nodding.', 'Beat that.'] }); }

  // ---------- the CROWNING STONE (the finale: counts only once the rest are bagged) ----------
  { const x = -26, z = 4; solid('castleStone', x, 0.25, z, 2.6, 0.5, 2.6, 0x9a8a6a, {}); solid('stone', x, 1.4, z, 1.2, 1.8, 1.2, 0xc8b490, {}); solid('stone', x, 2.4, z, 1.5, 0.2, 1.5, 0xd8c8a0, { phys: false });
    cyl('flat', x, 2.62, z, 0.5, 0.5, 0.24, 0x5a1f4a, { phys: false, seg: 12 }); // cushion
    cyl('metal', x, 2.92, z, 0.36, 0.34, 0.3, 0xe8c040, { phys: false, seg: 16 }); B.add('flat', new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, 3.02, z, 1, 1, 1), 0x6a1a4a, {});
    for (let i = 0; i < 4; i++) B.add('metal', new THREE.TorusGeometry(0.34, 0.035, 4, 12, Math.PI), M4(x, 3.06, z, 1, 1.2, 1, 0, i * Math.PI / 4), 0xe8c040, {});
    B.add('metal', new THREE.SphereGeometry(0.08, 8, 6), M4(x, 3.52, z, 1, 1, 1), 0xe8c040, {}); solid('metal', x, 3.68, z, 0.04, 0.22, 0.04, 0xe8c040, { phys: false }); solid('metal', x, 3.7, z, 0.14, 0.04, 0.04, 0xe8c040, { phys: false });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; B.add('flat', new THREE.OctahedronGeometry(0.05), M4(x + Math.sin(a) * 0.36, 2.94, z + Math.cos(a) * 0.36, 1, 1, 1), [0xc8202a, 0x2a6a3a, 0x2a4a8a, 0xf2f2f2][i % 4], {}); }
    body(new CANNON.Cylinder(0.42, 0.42, 0.75, 10), x, 3.15, z, { target: 'crown', surface: 'metal' });
    quad('atlasLit', x + 0.62, 1.4, z, 1.0, 0.7, Math.PI / 2, atlas.draw(100, 70, (g, w, h) => { g.fillStyle = '#c8b490'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2a10'; g.textAlign = 'center'; g.font = 'bold 12px Georgia'; g.fillText('THE CROWNING', w / 2, 28); g.fillText('STONE', w / 2, 46); }));
    addTarget({ id: 'crown', name: 'The Crown', final: true, hint: 'FINALE: bag every other target, then crown it - land one on the crown', points: 250, kind: 'hit', pos: V(x + 3.2, 0, z), ringR: 1.1, stand: V(x + 7, 0, z), aim: V(x, 3.1, z), lines: ['Crowned!', 'Long may ye reign!', 'The crown\'s yours.'] }); }

  // ---------- Castlehill: the street back down, tall lands, setts, the Hub-style spire ----------
  for (const s of [-1, 1]) { for (let x = 46; x < 100; x += 9) { const n = 5 + Math.floor(rand() * 2), H = 1.4 + n * 3, tone = pick(SAND), key = rand() < 0.5 ? 'castleStone' : 'stone', ry = s > 0 ? Math.PI : 0, Fz = s * 7.01;
      solid(key, x + 4.5, H / 2, s * 12, 9, H, 10, tone, { tile: 3 }); B.add('roof', ROOF, M4(x + 4.5, H, s * 12, 10.3, 3.4, 9.05, 0, Math.PI / 2), 0x4a4e54, { tile: 2.2 });
      for (let k = 0; k < 3; k++) for (let j = 0; j < n; j++) quad('facade', x + 1.5 + k * 3, 1.6 + j * 3, Fz, 1.2, 2.4, ry, cellUV(j ? pick([FACADE.small, FACADE.sashA, FACADE.smallLit]) : FACADE.door), vt()); } }
  for (const s of [-1, 1]) { solid('castleStone', 44, 0.6, s * 14.5, 1, 1.2, 15, 0xa89474, { tile: 2.4 }); } // Esplanade end walls where Castlehill begins
  for (let k = 0; k < 6; k++) cyl('metal', 46 + k * 2, 0.45, (k % 2 ? 1 : -1) * 6.2, 0.1, 0.11, 0.9, IRON, { seg: 6 }); // bollards
  { const x = 74, z = -10; solid('stone', x, 14, z, 8, 28, 8, 0x6e6658, { phys: false, tile: 3 }); B.add('stone', new THREE.ConeGeometry(3.8, 36, 8), M4(x, 46, z, 1, 1, 1), 0x6e6658, { tile: 3 }); for (const a of [-1, 1]) for (const b of [-1, 1]) B.add('stone', new THREE.ConeGeometry(0.6, 7, 4), M4(x + a * 3.6, 31.5, z + b * 3.6, 1, 1, 1), 0x6e6658, {}); }
  boxBody(60, 3, 0, 1, 6, 14, { playerOnly: true });
  for (const s of [-1, 1]) boxBody(10, 3, s * (SZ + 13), 120, 6, 1, { playerOnly: true });
  // lamps along the ground
  for (const x of [-30, -6, 18, 40]) for (const s of [-1, 1]) { const z = s * (SZ - 1.2); cyl('metal', x, 2.4, z, 0.07, 0.11, 4.8, IRON, { seg: 6 }); solid('lamp', x, 5.0, z, 0.36, 0.5, 0.36, 0xffffff, { phys: false }); }

  const groups = [V(20, 0, 6), V(-36, 0, -8), V(50, 0, 2)];
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P_, facadeTex, atlas.tex); materials.flat.side = THREE.DoubleSide;
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  { const m = materials.flat.clone(); m.map = tarmacTexture(); materials.tarmac = m; }
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  // the crown goes last in the list (it's the finale)
  targets.push(targets.splice(targets.findIndex((t) => t.id === 'crown'), 1)[0]);
  const batches = B.build(scene, materials, { shadows: P_.shadows });
  const views = { spawn: [40, 0, 90, 4, 0.5], gate: [-20, -8, 80, 8, 0.5], stands: [0, 0, 160, 8, 0.5], castlehill: [-10, 0, -90, 4, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) { if (x > 44) return 'setts'; if (x < ES.DITCH) return 'setts'; return 'tarmac'; }
export default {
  id: 'esplanade', name: 'The Castle Esplanade', short: 'Esplanade', surfaceAt, finale: true,
  sounds: { birds: [[-60, 10], [0, 30]], gulls: [[0, 40], [-40, -30]], far: [[-70, 0], [70, 0], [0, 40], [0, -40]], roadX: 90 },
  blurb: "Level 11: The Castle Esplanade - the finale. 10 targets. NEW: the Crowning Stone - bag the rest, then crown it.",
  intro: "Welcome tae the Castle Esplanade - the last pitch!<br><small>The parade ground, the stands, the gatehouse. Easy first one: the board just ahead. Save the crown for last.</small>",
  build,
  tiers: { infoboard: 'easy', drum: 'easy', memorial: 'easy', sentry: 'easy', cannon: 'easy', statue: 'tricky', seats: 'tricky', banner: 'tricky', niche: 'tricky', crown: 'tricky' },
  spawn: ES.SPAWN, spawnYaw: ES.SPAWNYAW,
  ballHomes: () => [[37, 0.4, 0.5], [0, 0.4, 0], [-30, 0.4, 0]],
  bounds: { x: 62, zMin: -40, zMax: 40 },
  next: 'pennywell',
};
