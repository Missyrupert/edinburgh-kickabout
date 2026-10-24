// Level 7: Portobello Promenade (v3.6). The prom (terracotta tarmac), the low sea wall and its ramps, the wide beach and the
// Forth with Fife beyond. Sandstone villas and terraces, the red-brick Victorian baths (swim centre + Turkish baths), an Edwardian
// cafe with a drum tower, timber groynes, benches, bins, lamp standards, an ice-cream kiosk. All names fictional; no brands.
// NEW: the sand slows a rolling ball (a damping zone applied each physics step; kicks unchanged) and the groyne goal.
// The sea behaves like Granton's: splash, message, ball back at your feet (main.js LEVEL.sea). North = +z = the Forth.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, GRIME_UV, sandTexture } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const PB = { FZ: -14, SY: -1.6, WL: 34, XW: 60, RAMPS: [-24, 20] };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1846), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const { FZ, SY, WL, XW, RAMPS } = PB, ACC = 0xE07A5F, IRON = 0x2a2d31, PROM = 0xe8a48c, SLAB = 0xc4c0b6;
  const SAND = [0xd8cdb8, 0xcfc3ac, 0xdcd2be, 0xc8bca4, 0xd2c6b0, 0xbfb39c];
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * k, c.b * (k + (rand() - 0.5) * 0.05)).getHex(); };
  const flatG = (key, x0, x1, z0, z1, col, o = {}) => quad(key, (x0 + x1) / 2, o.y ?? 0.012, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, null, col, { rx: -Math.PI / 2, tile: o.tile || 0 });
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const vcolGeo = (parts) => mergeSimple(parts.map(([geo, m, col]) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); return gg; }));
  const T = (x, y, z, rz = 0, rx = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), V(1, 1, 1));
  function topple(id, shapeHalf, geo, x, y, z, mass, tgt) { const b = new CANNON.Body({ mass, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(...shapeHalf)) }); b.position.set(x, y, z); b.userData = { target: id, surface: 'board' }; world.addBody(b); dynamics.push({ geo, body: b, home: b.position.clone() }); return addTarget({ ...tgt, id, kind: 'topple', body: b }); }

  // ---------- ground: the promenade (terracotta tarmac) at y = 0, the sea wall, the beach at y = SY, the Forth beyond ----------
  boxBody(0, -1, (FZ - 30 + 0.5) / 2, 160, 2, 0.5 - FZ + 30, { surface: 'tarmac' }); // prom + the land behind
  boxBody(0, SY - 1, (0.5 + WL) / 2, 160, 2, WL - 0.5, { surface: 'sand' }); // the beach (ends at the waterline: past it the ball drops into the Forth)
  flatG('tarmac', -XW - 20, XW + 20, FZ + 3, 0.5, PROM, { tile: 4 });
  flatG('tarmac', -XW - 20, XW + 20, FZ, FZ + 3, SLAB, { tile: 2, y: 0.016 }); solid('stone', 0, 0.05, FZ + 3, (XW + 20) * 2, 0.1, 0.25, 0xa8a49c, { phys: false });
  for (let i = 0; i < 30; i++) quad('grime', -XW + rand() * XW * 2, 0.02, FZ + 3 + rand() * (-FZ - 3), 1.5 + rand() * 3, 1 + rand() * 2, 0, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 });
  // sea wall: concrete face down to the sand, a low parapet with flat coping (gaps at the two ramps)
  solid('flat', 0, SY / 2, 0.52, (XW + 20) * 2, -SY, 0.06, 0xb9b2a4, { phys: false });
  for (let x = -XW - 18; x < XW + 20; x += 6 + rand() * 4) quad('grime', x, SY + 0.5, 0.56, 3 + rand() * 4, 0.9, 0, GRIME_UV[1], 0x8a9a7a); // tide mark / weed
  { const gaps = RAMPS.map((r) => [r - 1.2, r + 2.6]).sort((a, b) => a[0] - b[0]); let x = -XW - 20;
    for (const [g0, g1] of [...gaps, [XW + 20, XW + 20]]) { if (g0 > x) { solid('stone', (x + g0) / 2, 0.28, 0.2, g0 - x, 0.56, 0.5, 0xc8c0b0, { tile: 1.6 }); solid('stone', (x + g0) / 2, 0.6, 0.2, g0 - x, 0.08, 0.62, 0xd8d2c4, { phys: false }); } x = g1; } }
  // ramps down to the sand: a landing at prom height, then a slope along the wall
  for (const R of RAMPS) { solid('flat', R + 1.25, -0.8 + SY / 2 + 0.8, 1.9, 2.6, -SY, 2.8, 0xb9b2a4); flatG('tarmac', R, R + 2.5, 0.5, 3.3, PROM, { y: 0.01, tile: 4 });
    const L = 8, th = Math.atan2(-SY, L), len = Math.hypot(L, SY), cx = R + 2.5 + L / 2, cy = SY / 2 - 0.2 / Math.cos(th);
    solid('flat', cx, cy, 1.9, len, 0.4, 2.8, 0xb88a76, { rz: -th, surface: 'concrete' });
    solid('flat', cx, (cy + SY) / 2, 3.35, len, -SY * 0.9, 0.12, 0xa9a294, { phys: false, rz: -th }); }
  // sand: dry, then darker wet sand, foam at the waterline; the Forth beyond (it carries on to Fife)
  B.add('sand', QUAD, M4(0, SY + 0.006, (0.5 + WL) / 2, 160, WL - 0.5, 1, -Math.PI / 2), 0xffffff, { tile: 5 });
  B.add('sand', QUAD, M4(0, SY + 0.01, WL - 4, 160, 8, 1, -Math.PI / 2), 0xa89272, { tile: 5 });
  for (let i = 0; i < 20; i++) { const x = -70 + rand() * 140, z = 2 + rand() * (WL - 10); B.add('sand', QUAD, M4(x, SY + 0.012, z, 2 + rand() * 4, 1 + rand() * 3, 1, -Math.PI / 2, rand() * 3), 0xe6d6b4, { tile: 5 }); } // damp patches / footprints
  for (const [z, w, c] of [[WL - 0.2, 0.5, 0xf4f6f2], [WL + 1.8, 0.35, 0xdfe8ea], [WL + 4.5, 0.3, 0xcfdcdf]]) for (let x = -80; x < 80; x += 7 + rand() * 6) B.add('flat', QUAD, M4(x, SY - 0.2, z + (rand() - 0.5) * 0.6, 5 + rand() * 6, w, 1, -Math.PI / 2), c, {}); // surf lines
  B.add('flat', QUAD, M4(0, SY - 0.25, WL + 200, 700, 400, 1, -Math.PI / 2), 0x5b7486, {});
  for (let i = 0; i < 50; i++) { const x = -90 + rand() * 180, z = WL + 6 + rand() * 140, w = 2 + rand() * 6; B.add('flat', QUAD, M4(x, SY - 0.24, z, w, 0.14, 1, -Math.PI / 2, rand() * 0.3), 0x8a9eae, {}); }
  for (let i = 0; i < 10; i++) B.add('flat', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(-300 + i * 66 + rand() * 30, SY - 0.3, 230 + rand() * 30, 60 + rand() * 50, 8 + rand() * 14, 30), 0x3e4e50, {}); // Fife hills
  { const x = 110, z = 260; B.add('flat', new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, SY - 0.3, z - 60, 26, 12, 18), 0x445456, {}); } // the island out in the Forth

  // ---------- timber groynes: lines of weathered posts with a plank rail, out from the wall into the surf ----------
  const GROYNES = [-34, -4, 14, 44], GAPX = 14, GAPZ = [11.6, 13.4];
  for (const gx of GROYNES) { for (let z = 2.2; z < WL + 5; z += 1.1) { if (gx === GAPX && z > GAPZ[0] - 0.3 && z < GAPZ[1] + 0.3) continue; const h = 0.9 + Math.sin(z * 1.7 + gx) * 0.25 - Math.max(0, z - WL) * 0.06;
      solid('wood', gx, SY + h / 2, z, 0.26, h, 0.26, pick([0x7a6248, 0x6e563e, 0x846c50]), { surface: 'board' }); }
    for (const [z0, z1] of gx === GAPX ? [[2.2, GAPZ[0] - 0.4], [GAPZ[1] + 0.4, WL + 5]] : [[2.2, WL + 5]]) solid('wood', gx + 0.18, SY + 0.35, (z0 + z1) / 2, 0.08, 0.3, z1 - z0, 0x4a3a28, { phys: false }); }
  // the groyne gap goal (NEW twist): two posts painted coral, kick it through the gap on the sand
  for (const z of [GAPZ[0] - 0.3, GAPZ[1] + 0.3]) { solid('wood', GAPX, SY + 0.7, z, 0.3, 1.4, 0.3, 0x5a4632, { surface: 'board' }); solid('flat', GAPX, SY + 1.25, z, 0.32, 0.25, 0.32, ACC, { phys: false }); }
  sign('GROYNE GOAL', GAPX + 0.2, SY + 1.75, (GAPZ[0] + GAPZ[1]) / 2, 1.6, 0.34, Math.PI / 2, '#E07A5F', '#ffffff', 'bold 44px Arial');
  addTarget({ id: 'groyne', name: 'Groyne Goal', hint: 'NEW: kick it through the gap in the groyne (the sand slows it - hit it harder)', points: 150, kind: 'zone', kickOnly: true, pos: V(GAPX + 2.5, SY, 12.5), ringR: 1.0, stand: V(GAPX + 5.5, SY, 12.5), aim: V(GAPX, SY + 0.3, 12.5),
    zone: new THREE.Box3(V(GAPX - 0.6, SY, GAPZ[0]), V(GAPX + 0.2, SY + 1.4, GAPZ[1])), lines: ['Through the groyne! The tide couldnae have done it better.', 'Gap found. The posts are 100 year old and still beat.', 'Groyne goal! Sand in the boots, ba\' in the net.'] });

  // ---------- frontages along the prom (south side, facing the sea): sandstone villas and terraces, the baths, the cafe ----------
  function terrace(x0, x1, floors, tone, opt = {}) { const len = x1 - x0, mid = (x0 + x1) / 2, h = 1 + floors * 3.2, D = opt.D || 10, z = FZ;
    solid('stone', mid, h / 2, z - D / 2, len, h, D, tone, { tile: 3.2 + rand() }); B.add('roof', ROOF, M4(mid, h, z - D / 2, D + 0.3, 3.4, len + 0.05, 0, Math.PI / 2), 0x5c6168, { tile: 2.2 });
    solid('stone', mid, h - 0.25, z + 0.18, len + 0.2, 0.5, 0.4, 0xe2d6be, { phys: false });
    const bays = Math.max(2, Math.round(len / 3.4));
    for (let i = 0; i < bays; i++) for (let j = 0; j < floors; j++) { const u = x0 + (i + 0.5) * len / bays; if (j === 0 && opt.ground === false) continue;
      quad('facade', u, 1.6 + j * 3.2, z + 0.01, len / bays * 0.8, 3.0, 0, cellUV(j === 0 ? (i % 3 === 1 ? FACADE.door : FACADE.sashA) : j === floors - 1 ? pick([FACADE.small, FACADE.sashB]) : pick([FACADE.sashA, FACADE.sashB, FACADE.triple, FACADE.lit])), vt()); }
    for (let u = x0 + 3.4; u < x1 - 2; u += 6.8) { solid('stone', u, 1.6 + 1.6, z + 0.45, 2.6, 6.2, 0.9, tone, { phys: false, tile: 2.6 }); for (let j = 0; j < 2; j++) quad('facade', u, 1.6 + j * 3.2, z + 0.91, 2.0, 2.8, 0, cellUV(FACADE.sashA), vt()); solid('stone', u, 6.4, z + 0.5, 2.8, 0.25, 1.0, 0xe2d6be, { phys: false }); } // canted bay windows
    for (let u = x0 + 2.5; u < x1 - 1; u += 7) solid('stone', u, h + 2.2, z - D / 2, 1.0, 2.6, 2.8, tone, { phys: false, tile: 2.6 });
    solid('stone', mid, 0.5, z + 1.6, len, 1.0, 0.25, tone, { phys: false }); for (let u = x0 + 0.6; u < x1; u += 0.9) cyl('metal', u, 1.25, z + 1.6, 0.025, 0.025, 0.5, IRON, { phys: false, seg: 4 }); // front garden wall + railings
    quad('grime', mid, 1.0, z + 0.03, len, 2.0, 0, GRIME_UV[0]); }
  const winArch = atlas.draw(96, 160, (g, w, h) => { g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c3a44'; g.beginPath(); g.moveTo(12, h - 8); g.lineTo(12, 48); g.arc(w / 2, 48, w / 2 - 12, Math.PI, 0); g.lineTo(w - 12, h - 8); g.fill();
    g.strokeStyle = '#f2ece0'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 8); g.moveTo(12, 92); g.lineTo(w - 12, 92); g.stroke(); g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(16, 50, 20, 100); });
  const winRender = atlas.draw(96, 128, (g, w, h) => { g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h); g.fillStyle = '#34424c'; g.fillRect(14, 12, w - 28, h - 26); g.strokeStyle = '#f2efe8'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 14); g.moveTo(14, h / 2); g.lineTo(w - 14, h / 2); g.stroke(); g.fillStyle = 'rgba(170,210,230,0.3)'; g.fillRect(18, 16, 14, h - 34); });
  // east: sandstone villas (spawn end) and a terrace with shops
  terrace(48, XW + 20, 3, SAND[0]); terrace(26, 48, 3, SAND[3]);
  const shopWin = [(g, w, h) => { g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h); for (let x = 10; x < w - 10; x += 22) { g.fillStyle = ['#E07A5F', '#2a6a8a', '#f4d35e', '#7ab0c0'][x % 4]; g.beginPath(); g.arc(x + 8, h - 40, 9, 0, 7); g.fill(); g.fillRect(x + 2, h - 26, 12, 16); } g.fillStyle = '#c8c0b0'; g.fillRect(0, h - 10, w, 10); },
    (g, w, h) => { g.fillStyle = '#f2ece0'; g.fillRect(0, 0, w, h); for (let x = 12; x < w - 20; x += 30) { g.fillStyle = ['#f4d35e', '#E07A5F', '#2a6a8a'][(x / 30 | 0) % 3]; g.beginPath(); g.moveTo(x, h - 12); g.lineTo(x + 20, h - 12); g.lineTo(x + 16, h - 40); g.lineTo(x + 4, h - 40); g.fill(); g.fillStyle = '#6a4a30'; g.fillRect(x + 22, h - 70, 3, 58); } },
    (g, w, h) => { g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) { g.fillStyle = '#7a6248'; g.fillRect(6, 24 + r * 26 + 16, w - 12, 4); for (let x = 10; x < w - 12; x += 7) { g.fillStyle = ['#c8202a', '#efe3c8', '#2a4f8a', '#1f7a4a', '#e07a2a'][(x + r) % 5]; g.fillRect(x, 24 + r * 26 + 2, 5, 14); } } }].map((f) => atlas.draw(192, 128, f));
  { const shops = [['SEA BREEZE GIFTS', 0x2a6a8a], ['THE BUCKET & SPADE', ACC], ['PORTY BOOKS', 0x2E2F2C]], x0 = 6, x1 = 26, sw = (x1 - x0) / 3;
    terrace(x0, x1, 3, SAND[2], { ground: false });
    shops.forEach(([n, col], i) => { const u = x0 + (i + 0.5) * sw; solid('wood', u, 1.9, FZ + 0.06, sw - 0.4, 3.8, 0.12, col, { phys: false }); quad('atlasLit', u, 1.7, FZ + 0.13, sw - 1.6, 2.1, 0, shopWin[i]); quad('atlasLit', u, 3.35, FZ + 0.16, sw - 0.8, 0.62, 0, atlas.fascia(n, null, '#' + new THREE.Color(col).getHexString(), '#F1E6C8', (sw - 0.8) / 0.62)); }); }
  // a lane back from the prom (gap between buildings) with a far building closing it
  terrace(-4, 6, 3, SAND[4], { D: 6 }); // (narrow end block)
  // the cafe: white-harled Edwardian corner with a drum tower (after AG's photo), a decked terrace with parasols in front
  { const x0 = -22, x1 = -6, h = 8.6, mid = (x0 + x1) / 2, z = FZ;
    solid('flat', mid, h / 2, z - 5, x1 - x0, h, 10, 0xeeeae0); solid('flat', mid, h + 0.25, z - 5, x1 - x0 + 0.3, 0.5, 10.3, 0xd8d4c8, { phys: false }); B.add('roof', ROOF, M4(mid, h + 0.5, z - 6, 8.3, 2.0, x1 - x0, 0, Math.PI / 2), 0x6a6e72, {});
    for (let x = x0 + 1.6; x < x1 - 1; x += 2.6) for (const y of [1.7, 5.5]) quad('atlas', x, y, z + 0.01, 1.7, 2.3, 0, winRender);
    const tx = x1 - 0.2; cyl('flat', tx, 6.5, z + 0.6, 2.4, 2.4, 13, 0xf2efe8, { seg: 12 }); cyl('flat', tx, 13.4, z + 0.6, 2.0, 2.5, 0.8, 0xd8d4c8, { phys: false, seg: 12 }); cyl('flat', tx, 14.6, z + 0.6, 1.4, 1.8, 1.6, 0xeceae2, { phys: false, seg: 10 }); cyl('metal', tx, 16.2, z + 0.6, 0.06, 0.06, 1.6, IRON, { phys: false, seg: 4 });
    for (const y of [5.4, 8.6, 11.8]) for (let k = -2; k <= 2; k++) { const a = k * 0.45; quad('atlas', tx + Math.sin(a) * 2.42, y, z + 0.6 + Math.cos(a) * 2.42, 0.9, 2.0, a, winRender); }
    quad('atlasLit', mid - 1, 3.6, z + 0.03, 9, 0.8, 0, atlas.fascia('THE SANDCASTLE CAFE', 'COFFEE · CAKES · ICES', '#2E6E84', '#F1E6C8', 9 / 0.8));
    // decking terrace (low timber platform), parasols, windbreak screens, tables
    solid('wood', mid - 1, 0.1, z + 3.6, 13, 0.2, 6, 0x8a6a4a, { tile: 1 }); for (let x = x0 + 1; x < x1 - 1.5; x += 1.2) cyl('wood', x, 0.55, z + 6.5, 0.04, 0.04, 0.7, 0x6a4a30, { phys: false, seg: 4 }); solid('wood', mid - 1, 0.9, z + 6.5, 12.6, 0.08, 0.1, 0x6a4a30, { phys: false });
    for (const [x, c] of [[x0 + 2.5, 0xe8e2d4], [x0 + 7, ACC], [x0 + 11.5, 0xe8e2d4]]) { cyl('metal', x, 1.2, z + 3.6, 0.04, 0.04, 2.2, IRON, { phys: false, seg: 4 }); B.add('flat', new THREE.ConeGeometry(1.5, 0.6, 8), M4(x, 2.4, z + 3.6, 1, 1, 1), c, {}); solid('wood', x, 0.95, z + 3.6, 1.0, 0.06, 1.0, 0x7a5a3a, { phys: false }); for (const s of [-1, 1]) solid('wood', x + s * 0.9, 0.55, z + 3.6, 0.4, 0.06, 0.9, 0x7a5a3a, { phys: false }); } }
  // the Victorian baths: red-brick with arched windows and stone dressings, a big entrance with the door target
  { const x0 = -40, x1 = -22, h = 11, mid = (x0 + x1) / 2, z = FZ, BR = 0xa0503c;
    solid('stone', mid, h / 2, z - 7, x1 - x0, h, 14, BR, { tile: 2.4 }); solid('stone', mid, h + 0.4, z + 0.05, x1 - x0 + 0.3, 0.8, 0.5, 0xe0d4bc, { phys: false });
    for (let x = x0 + 0.6; x < x1; x += 0.8) cyl('metal', x, h + 1.25, z + 0.1, 0.03, 0.03, 0.9, IRON, { phys: false, seg: 4 }); solid('metal', mid, h + 1.7, z + 0.1, x1 - x0, 0.06, 0.06, IRON, { phys: false }); // iron roof railing
    for (const y of [2.6, 7.4]) for (let x = x0 + 1.8; x < x1 - 1; x += 2.6) if (!(y < 4 && Math.abs(x - mid) < 2)) quad('atlas', x, y, z + 0.01, 1.5, 2.6, 0, winArch);
    for (const y of [0.4, 5.2, 9.6]) solid('stone', mid, y, z + 0.08, x1 - x0, 0.25, 0.16, 0xe0d4bc, { phys: false }); // stone string courses
    for (const x of [x0 + 0.3, x1 - 0.3]) solid('stone', x, h / 2, z + 0.15, 0.6, h, 0.3, 0xe0d4bc, { phys: false });
    solid('stone', mid, 1.9, z + 0.3, 4.0, 3.8, 0.6, 0xe0d4bc, { phys: false }); solid('wood', mid, 1.3, z + 0.62, 1.9, 2.6, 0.12, 0x1f3a4a, { target: 'bathsdoor', surface: 'board' }); quad('atlas', mid, 1.3, z + 0.69, 1.6, 2.4, 0, atlas.draw(128, 256, drawTargetDoor));
    quad('atlasLit', mid, 3.25, z + 0.62, 3.6, 0.5, 0, atlas.sign('THE PROMENADE BATHS', '#f2ece0', '#7a2a1a', 3.6 / 0.5, 'bold 52px Georgia', '#7a2a1a'));
    quad('atlasLit', mid, 10.1, z + 0.32, 8, 0.7, 0, atlas.sign('SWIM CENTRE · TURKISH BATHS', '#e0d4bc', '#5a2418', 8 / 0.7, 'bold 50px Georgia', '#e0d4bc'));
    addTarget({ id: 'bathsdoor', name: 'Baths Door', hint: 'hit the door of the swimming baths', points: 75, kind: 'hit', pos: V(mid, 0, z + 2), ringR: 1.0, stand: V(mid, 0, z + 6.5), aim: V(mid, 1.1, z + 0.6),
      lines: ['Doors open: lengths at six.', 'Turkish baths? Ye\'ve fair worked up a sweat.', 'Splash! Wrong pool, right door.'] }); }
  // west: more sandstone terraces running off towards Joppa
  terrace(-58, -40, 3, SAND[1]); terrace(-XW - 20, -58, 3, SAND[5]);
  // the far end of the prom both ways: hazy continuation so it doesn't stop dead
  for (const s of [-1, 1]) { const x = s * (XW + 45); solid('stone', x, 6, FZ - 5, 50, 12, 10, SAND[2], { phys: false, tile: 4 }); quad('tarmac', x, 0.01, (FZ + 0.5) / 2 + 1.5, 50, -FZ - 2.5, 0, null, PROM, { rx: -Math.PI / 2, tile: 4 }); }

  // ---------- promenade furniture: Victorian lamp standards, benches, bins, the ice-cream kiosk, a lifebuoy, notices ----------
  for (let x = -XW + 4; x < XW + 18; x += 16) { const z = -0.9; cyl('metal', x, 2.3, z, 0.07, 0.12, 4.6, 0x2c4a5a, { seg: 6 }); cyl('metal', x, 0.25, z, 0.2, 0.22, 0.5, 0x2c4a5a, { phys: false, seg: 6 }); B.add('lamp', CYL(0.22, 0.16, 6), M4(x, 4.9, z, 1, 0.6, 1), 0xfff2d0, {}); cyl('metal', x, 5.3, z, 0.02, 0.26, 0.3, 0x2c4a5a, { phys: false, seg: 6 }); }
  for (let x = -XW + 10; x < XW + 14; x += 16) { if (RAMPS.some((r) => Math.abs(x - r - 1) < 4)) continue; const z = -0.75; for (const s of [-1, 1]) solid('metal', x + s * 0.85, 0.42, z, 0.08, 0.84, 0.6, 0x2c4a5a, { phys: false }); for (let k = 0; k < 3; k++) solid('wood', x, 0.45, z - 0.18 + k * 0.16, 1.8, 0.05, 0.12, 0x8a6a48, { phys: false }); for (let k = 0; k < 2; k++) solid('wood', x, 0.7 + k * 0.17, z + 0.26, 1.8, 0.12, 0.04, 0x8a6a48, { phys: false }); boxBody(x, 0.4, z, 1.8, 0.8, 0.6); }
  // the bin target (green municipal bin by the wall)
  { const x = 34, z = -1.0; cyl('metal', x, 0.5, z, 0.32, 0.28, 1.0, 0x2a5a3a, { phys: false, seg: 8 }); cyl('metal', x, 1.04, z, 0.34, 0.34, 0.08, 0x1e4a2e, { phys: false, seg: 8 }); boxBody(x, 0.5, z, 0.6, 1.0, 0.6, { target: 'bin', surface: 'metal' });
    addTarget({ id: 'bin', name: 'Prom Bin', hint: 'hit the bin by the sea wall', points: 50, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 0.9, stand: V(x, 0, z - 5), aim: V(x, 0.6, z), lines: ['Keep Porty tidy!', 'Bin: binned.', 'In the bin. Well, at it.'] }); }
  for (const x of [-46, -8, 52]) { cyl('metal', x, 0.5, -1.0, 0.32, 0.28, 1.0, 0x2a5a3a, { seg: 8 }); }
  // ice-cream kiosk (easy first target, straight ahead of the spawn): striped hut, hatch facing up the prom
  { const x = 42, z = -4.5; solid('flat', x, 1.3, z, 2.4, 2.6, 2.4, 0xf6f0e4, { target: 'kiosk', surface: 'board' }); for (let k = 0; k < 4; k++) solid('flat', x, 0.3 + k * 0.6, z, 2.42, 0.2, 2.42, ACC, { phys: false }); solid('flat', x, 2.75, z, 2.9, 0.25, 2.9, 0x2a6a8a, { phys: false });
    B.add('flat', new THREE.ConeGeometry(0.35, 1.0, 8), M4(x, 3.45, z, 1, -1, 1), 0xd8a860, {}); B.add('flat', new THREE.SphereGeometry(0.4, 8, 6), M4(x, 4.05, z, 1, 1, 1), 0xf8e8e0, {});
    solid('wood', x + 1.25, 1.35, z, 0.1, 1.0, 1.5, 0xf4d35e, { target: 'kiosk', surface: 'board' }); quad('atlasLit', x + 1.31, 2.15, z, 2.2, 0.42, Math.PI / 2, atlas.sign('WAVE & WAFFLE ICES', '#2a6a8a', '#ffffff', 2.2 / 0.42, 'bold 44px Arial', '#2a6a8a'));
    addTarget({ id: 'kiosk', name: 'Ice-Cream Kiosk', hint: 'hit the ice-cream kiosk hatch', points: 50, kind: 'hit', pos: V(x + 2.4, 0, z), ringR: 1.1, stand: V(x + 5.5, 0, z), aim: V(x + 1.25, 1.2, z), lines: ['Two 99s and a ball, please!', 'Hatch chapped. Raspberry sauce on the hoose.', 'Brain freeze! Nice strike.'] }); }
  // lifebuoy on a post on the sea wall (chip it)
  { const x = 2, z = 0.2; cyl('metal', x, 1.0, z, 0.05, 0.05, 2.0, 0xc8202a, { phys: false, seg: 6 }); B.add('flat', new THREE.TorusGeometry(0.34, 0.09, 6, 14), M4(x, 1.4, z - 0.1, 1, 1, 1), 0xe8661e, {}); body(new CANNON.Cylinder(0.43, 0.43, 0.2, 10), x, 1.4, z - 0.1, { rx: Math.PI / 2, target: 'lifebuoy', surface: 'board' }); boxBody(x, 1.0, z, 0.1, 2.0, 0.1, { surface: 'metal' });
    addTarget({ id: 'lifebuoy', name: 'Lifebuoy', hint: 'hit the lifebuoy on the sea wall', points: 75, kind: 'hit', pos: V(x, 0, z - 1.4), ringR: 0.9, stand: V(x, 0, z - 5.5), aim: V(x, 1.4, z), lines: ['Man overboard? Naw, ball on board.', 'Saved! The lifeguard\'s impressed.', 'Ring hit. Throw it tae the next one.'] }); }
  // beach notice board on two posts by the west ramp
  { const x = RAMPS[0] - 1.5, z = -4; for (const s of [-1, 1]) cyl('wood', x, 0.8, z + s * 0.6, 0.05, 0.05, 1.6, 0x5a4632, { phys: false, seg: 4 }); solid('wood', x, 1.35, z, 0.1, 0.9, 1.4, 0x2a6a8a, { target: 'notices', surface: 'board' });
    quad('atlasLit', x + 0.06, 1.35, z, 1.3, 0.8, Math.PI / 2, atlas.draw(160, 96, (g, w, h) => { g.fillStyle = '#2a6a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText('BEACH NOTICES', w / 2, 20); g.fillStyle = '#f4f0e6'; g.fillRect(10, 30, 66, 56); g.fillRect(84, 30, 66, 26); g.fillStyle = '#E07A5F'; g.fillRect(84, 60, 66, 26); g.fillStyle = '#556'; for (let k = 0; k < 6; k++) g.fillRect(16, 38 + k * 8, 54, 3); }));
    addTarget({ id: 'notices', name: 'Beach Notices', hint: 'hit the beach notice board', points: 75, kind: 'hit', pos: V(x + 1.2, 0, z), ringR: 0.9, stand: V(x + 5, 0, z), aim: V(x, 1.3, z), lines: ['Notice: nae dogs on the sand, May tae September.', 'Read it? Ye kicked it.', 'Bulletin delivered.'] }); }

  // ---------- on the sand: sandcastle, a striped windbreak, a bucket ----------
  { const x = 30, z = 9, y = SY; const parts = [[new THREE.CylinderGeometry(1.0, 1.15, 0.5, 10), T(x, y + 0.25, z), 0xcdb488], [new THREE.CylinderGeometry(0.62, 0.72, 0.45, 8), T(x, y + 0.72, z), 0xd6bf94]];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; parts.push([new THREE.CylinderGeometry(0.2, 0.26, 0.5, 6), T(x + Math.cos(a) * 0.8, y + 0.75, z + Math.sin(a) * 0.8), 0xc8ae80]); }
    parts.push([new THREE.CylinderGeometry(0.008, 0.008, 0.5, 3), T(x, y + 1.2, z), 0x5a4632], [new THREE.PlaneGeometry(0.3, 0.18), T(x + 0.15, y + 1.36, z), ACC]);
    for (const [g, m, c] of parts) B.add('flat', g, m, c, {}); body(new CANNON.Cylinder(1.0, 1.15, 0.95, 10), x, y + 0.47, z, { target: 'sandcastle', surface: 'sand' });
    addTarget({ id: 'sandcastle', name: 'Sandcastle', hint: 'hit the sandcastle (the sand slows the ball)', points: 75, kind: 'hit', pos: V(x, SY, z - 2.2), ringR: 1.1, stand: V(x, SY, z - 5.2), aim: V(x, SY + 0.5, z), lines: ['King o\' the castle!', 'Turrets intact. Mostly.', 'The tide was comin\' for it anyway.'] }); }
  { const x = -16, z = 7; const parts = []; for (let k = 0; k < 5; k++) parts.push([new THREE.BoxGeometry(0.5, 1.1, 0.03), T(-1 + k * 0.5, 0, 0), k % 2 ? 0xf4f2ea : k === 2 ? ACC : 0x2a6a8a]); for (let k = 0; k <= 5; k++) parts.push([new THREE.CylinderGeometry(0.025, 0.025, 1.5, 4), T(-1.25 + k * 0.5, -0.15, 0), 0x6a4a30]);
    topple('windbreak', [1.25, 0.6, 0.06], vcolGeo(parts), x, SY + 0.62, z, 1.2, { name: 'Windbreak', hint: 'knock down the stripy windbreak', points: 75, pos: V(x, SY, z), stand: V(x, SY, z + 4.5), aim: V(x, SY + 0.5, z), lines: ['Windbreak: broken.', 'Doon it goes. The haar\'s comin\' in anyway.', 'Scotland\'s summer: windbreak essential, now flat.'] }); }
  { const x = -28, z = 10; const parts = [[new THREE.CylinderGeometry(0.3, 0.22, 0.45, 10), T(0, 0, 0), 0xf4d35e], [new THREE.TorusGeometry(0.22, 0.015, 4, 10, Math.PI), T(0, 0.22, 0), 0xe8661e], [new THREE.BoxGeometry(0.06, 0.6, 0.02), T(0.18, 0.2, 0, -0.4), 0x2a6a8a]];
    topple('bucket', [0.28, 0.23, 0.28], vcolGeo(parts), x, SY + 0.24, z, 0.25, { name: 'Bucket & Spade', hint: 'knock over the bucket and spade', points: 75, pos: V(x, SY, z), stand: V(x + 4.5, SY, z), aim: V(x, SY + 0.2, z), lines: ['Bucket ower! Sandcastle cancelled.', 'Spade\'s flyin\'.', 'Tipped. The weans are no\' happy.'] }); }
  // cafe A-board on the prom (topples)
  { const x = -9, z = FZ + 7.6; const parts = [[new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.12, 0, 0), 0x2E6E84], [new THREE.BoxGeometry(0.05, 0.95, 0.62), new THREE.Matrix4().makeRotationZ(-0.2).setPosition(-0.12, 0, 0), 0x2E6E84], [new THREE.BoxGeometry(0.01, 0.6, 0.5), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.155, 0.05, 0), 0xf4f2ea], [new THREE.BoxGeometry(0.012, 0.12, 0.44), new THREE.Matrix4().makeRotationZ(0.2).setPosition(0.165, 0.25, 0), ACC]];
    topple('menuboard', [0.12, 0.47, 0.31], vcolGeo(parts), x, 0.48, z, 0.5, { name: 'Cafe Menu Board', hint: 'knock over the cafe menu board', points: 50, pos: V(x, 0, z), stand: V(x + 4.5, 0, z), aim: V(x, 0.5, z), lines: ['Today\'s special: ball, scrambled.', 'Menu: knocked aff.', 'Chalk it up!'] }); }
  // people-free colour on the sand: towels, a few gulls' feathers worth of flecks
  for (const [x, z, c] of [[-8, 14, 0xE07A5F], [-6, 15.5, 0x2a6a8a], [20, 6, 0xf4d35e], [50, 12, 0x2E6E84]]) B.add('flat', QUAD, M4(x, SY + 0.02, z, 0.9, 1.8, 1, -Math.PI / 2, 0, rand()), c, {});

  // ---------- edges: player-only wall at the waterline; world ends ----------
  boxBody(0, SY + 1.5, WL - 0.8, 160, 3, 0.3, { playerOnly: true });
  for (const s of [-1, 1]) { boxBody(s * (XW + 0.5), 0, (FZ + WL) / 2, 1, 8, WL - FZ + 4, { playerOnly: true }); }

  // ---------- the sand slows a rolling ball (rolling resistance zone; kick physics untouched) ----------
  // each physics step: a ball low on the sand gets heavier damping; anywhere else (or in the air) it keeps the normal values.
  const BALL_DAMP = 0.08, BALL_ADAMP = 0.25, SAND_DAMP = 0.8, SAND_ADAMP = 0.8;
  world.addEventListener('preStep', () => { for (const b of world.bodies) if (b.collisionFilterGroup === 4 && b.mass > 0) {
    const onSand = surfaceAt(b.position.x, b.position.z) === 'sand' && b.position.y < SY + 0.45;
    b.linearDamping = onSand ? SAND_DAMP : BALL_DAMP; b.angularDamping = onSand ? SAND_ADAMP : BALL_ADAMP; } });

  const groups = [[30, 0, -7], [-10, 0, -3], [0, SY, 18], [-40, SY, 8]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.tarmac = tm(tarmacTexture()); materials.sand = tm(sandTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [50, -6, 90, 4, 0.5], prom: [20, -7, 80, 3, 0.5], beach: [0, 6, 90, 6, -1.1], groyne: [20, 12.5, 90, 4, -1.1], baths: [-31, -2, 0, 8, 0.5], cafe: [-6, -2, 160, 6, 0.5], fife: [0, -2, 180, 2, 0.5] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  if (z > PB.WL - 1.5) return 'water'; // (the wet edge counts as sea, so a returned ball is never left on the lip)
  if (z > 0.5) return PB.RAMPS.some((r) => x > r - 0.1 && x < r + 10.6 && z < 3.4) ? 'concrete' : 'sand';
  if (z > PB.FZ + 3) return 'tarmac';
  return 'paving';
}
export default {
  id: 'portobello', name: 'Portobello', short: 'Portobello', surfaceAt,
  sounds: { harbour: true, birds: [[-30, -10], [40, -10]], gulls: [[0, 20], [-40, 30], [40, 25], [10, 40]], water: [[-40, 36], [0, 36], [40, 36]], far: [[-80, -20], [80, -20], [0, -50]], roadX: 90 },
  blurb: "Level 7: Portobello. The prom, the sand and the Forth. 10 targets. NEW: the sand slows the ball, and the groyne goal.",
  intro: "Welcome tae Porty!<br><small>The prom, the beach and Fife across the water. The ball runs slow on the sand. Easy first one: the ice-cream kiosk, just ahead.</small>",
  build,
  tiers: { kiosk: 'easy', bin: 'easy', menuboard: 'easy', bathsdoor: 'easy', notices: 'easy', lifebuoy: 'easy', windbreak: 'easy', bucket: 'easy', sandcastle: 'tricky', groyne: 'tricky' },
  spawn: [50, 0.5, -6], spawnYaw: 90,
  ballHomes: () => [[47.5, 0.4, -6], [0, 0.4, -5], [-30, 0.4, -5], [10, PB.SY + 0.4, 8]],
  bounds: { x: 60, zMin: -11, zMax: 60 },
  sea: { y: -2.4, water: -1.85, lines: ["Splash! Intae the Forth. Fife's no' gettin' it - here's your ball back.", "Washed oot! The tide's brought it back tae your feet.", "In the sea! A dug fetched it. Ball's back."] },
  next: 'grassmarket',
};
