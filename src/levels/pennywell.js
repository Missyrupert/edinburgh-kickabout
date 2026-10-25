// v3.11 rebuild from Chris's layout + the design-refs photos (bottom to top): the roundabout at Muirhouse Parkway; the new
// Craigroyston school (curved metal roof, green palisade) on the right with houses on the left; the shopping centre further up on
// the left (flats above, the library behind, the old filling-station nod); the Old Kirk (left) and St Paul's (right, burnt out)
// halfway up; harled flats up the left; Drylaw Police Station at the top. Faded 'YPD'/'YMD' tags are small wall marks only.
// Level 1: Pennywell Road (v3.2). Where Chris grew up: the 1960s Pennywell shopping centre (flats above the shops, the
// library through the back), then up Pennywell Road past the Old Kirk (left) and St Paul's (right) to Craigroyston High
// School at the top. Light roughcast harling, precast concrete, tarmac with bitumen seams, concrete kerbs, grass verges and
// green palisade railings. All shop names are fictional. NEW twist: the school gates are a goal - kick it through them.
// North = +z (up the road). Ground is y = 0 everywhere.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, roughcastTexture, concretePanelTexture, copperTexture, stoneTexture, gasBrickTexture, grassTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const PW = { PARADE: -32, ROAD: 4, PAVE: 7, VERGE: 11.5, TOPZ0: 36, TOPZ1: 43, FENCE: 45, XW: 29, BOT: -78, RB: -88 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1958), pick = (a) => a[Math.floor(rand() * a.length)];
  const B = new Batcher(), atlas = new SignAtlas(), facadeTex = facadeAtlas();
  const targets = [], dynamics = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {}, CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  // v3.11: FR builds a block in a local frame (rotated by FR.rot about y, then moved) - the shopping centre is built facing the road
  let FR = null; const TX = (x, z) => FR ? [FR.ox + x * Math.cos(FR.rot) + z * Math.sin(FR.rot), FR.oz - x * Math.sin(FR.rot) + z * Math.cos(FR.rot)] : [x, z];
  const TV = (v) => { const [x, z] = TX(v.x, v.z); return V(x, v.y, z); };
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const [wx, wz] = TX(x, z); eul.set(rx, ry + (FR ? FR.rot : 0), rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(wx, y, wz), q, V(sx, sy, sz)); };
  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, surface = null, playerOnly = false } = {}) {
    const [wx, wz] = TX(x, z); const b = new CANNON.Body({ mass: 0, material, shape }); b.position.set(wx, y, wz); eul.set(rx, ry + (FR ? FR.rot : 0), rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
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
  const { PARADE: PF, ROAD: RW, PAVE: PV, VERGE: VG, TOPZ0, TOPZ1, FENCE: FZ, XW } = PW, ACC = 0x4E8A3A, PAL = 0x3f6b3a, IRON = 0x24262a;
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * k, c.b * (k + (rand() - 0.5) * 0.05)).getHex(); };
  const HARL = [0xf2f1ec, 0xe9e8e2, 0xeeebe3, 0xe4e3dc, 0xf4f2ea, 0xdedcd4];
  // uPVC-framed window: pane (dark glass, or a warm lit room), white frame + mullion, concrete sill, sometimes curtains
  const win = (x, y, z, ry, w = 1.8, h = 1.4, lit = rand() < 0.22) => { const nx = Math.sin(ry), nz = Math.cos(ry), ax = Math.cos(ry), az = -Math.sin(ry), P2 = (o, u = 0, v = 0) => [x + nx * o + ax * u, y + v, z + nz * o + az * u];
    B.add(lit ? 'interior' : 'glass', QUAD, M4(...P2(0.01), w, h, 1, 0, ry), lit ? pick([0xe8c98a, 0xdcc49a, 0xf0d8a0]) : 0xffffff, {});
    if (rand() < 0.55) { const cw = w * (0.18 + rand() * 0.2); for (const sd of [-1, 1]) B.add('interior', QUAD, M4(...P2(0.015, sd * (w / 2 - cw / 2)), cw, h, 1, 0, ry), pick([0xe9e5dc, 0xd8d0c0, 0x9a6a8a, 0x6a8aa0, 0xc8a070]), {}); }
    const F = 0xf2f2ee; for (const [u, v, bw, bh] of [[0, h / 2, w + 0.08, 0.07], [0, -h / 2, w + 0.08, 0.07], [-w / 2, 0, 0.07, h], [w / 2, 0, 0.07, h], [w * (rand() < 0.5 ? 0.12 : -0.12), 0, 0.05, h]]) B.add('flat', BOX, M4(...P2(0.035, u, v), bw, bh, 0.05, 0, ry), F, {});
    B.add('cpanel', BOX, M4(...P2(0.07, 0, -h / 2 - 0.07), w + 0.24, 0.08, 0.16, 0, ry), 0xc8c5be, {}); };
  const flatG = (key, x0, x1, z0, z1, col, o = {}) => quad(key, (x0 + x1) / 2, o.y ?? (key === 'slab' ? 0.02 : 0.008), (z0 + z1) / 2, x1 - x0, z1 - z0, 0, null, col, { rx: -Math.PI / 2, tile: o.tile || 0 });
  const pwall = (x, z, w, d, h = 4) => boxBody(x, h / 2, z, w, h, d, { playerOnly: true });

  // ---------- ground ----------
  boxBody(0, -1, -15, 92, 2, 180, { surface: 'tarmac' });
  flatG('grass', -45, 45, -102, 75, 0x6f8a45, { y: -0.03, tile: 3 }); // base: rough grass everywhere off the hard surfaces
  { const BOT = PW.BOT, RB = PW.RB; // v3.11: the roundabout at the bottom (Muirhouse Parkway), tarmac ring + grassed island with a kerb
    B.add('tarmac', new THREE.CircleGeometry(12.5, 28), M4(0, 0.009, RB, 1, 1, 1, -Math.PI / 2), 0x8d8f8c, { tile: 4 }); flatG('tarmac', -45, 45, RB - 4.5, RB + 4.5, 0x8d8f8c, { tile: 4 });
    cyl('cpanel', 0, 0.1, RB, 5.8, 5.8, 0.2, 0xb9b7b0, { seg: 20, phys: false }); cyl('grass', 0, 0.13, RB, 5.5, 5.5, 0.22, 0x5f8a3e, { seg: 20 });
    for (const [x, z] of [[0, RB + 5.2], [5.2, RB], [-5.2, RB]]) { cyl('flat', x, 0.5, z, 0.22, 0.25, 1.0, 0xf2f2f2, { seg: 8 }); sign('⬅', x, 0.75, z + 0.24, 0.36, 0.36, 0, '#2a5aa0', '#ffffff', 'bold 80px Arial'); } // keep-left bollards
    for (let a = 0; a < 6.28; a += 0.5) quad('flat', Math.sin(a) * 9, 0.02, RB + Math.cos(a) * 9, 0.12, 1.6, a, null, 0xe8e6de, { rx: -Math.PI / 2 }); // lane dashes
    for (let x = -RW; x < RW; x += 0.9) flatG('flat', x, x + 0.5, BOT + 0.05, BOT + 0.3, 0xe8e6de, { y: 0.022 }); } // give-way into the roundabout
  flatG('tarmac', -RW, RW, PW.BOT, TOPZ0, 0x8d8f8c, { tile: 4 }); flatG('tarmac', -XW, XW, TOPZ0, TOPZ1, 0x8d8f8c, { tile: 4 }); // Pennywell Road + the top road
  for (const s of [-1, 1]) { flatG('slab', s > 0 ? RW : -PV, s > 0 ? PV : -RW, PW.BOT, TOPZ0, 0xc9c6bf, { tile: 1.8 }); // pavements
    flatG('slab', s > 0 ? PV : -XW, s > 0 ? XW : -PV, 33, TOPZ0, 0xc9c6bf, { tile: 1.8 }); }
  flatG('slab', -XW, XW, TOPZ1, FZ, 0xc9c6bf, { tile: 1.8, y: 0.015 });
  for (const s of [-1, 1]) { solid('flat', s * RW, 0.04, -21, 0.25, 0.08, 114, 0xb9b7b0, { phys: false }); solid('flat', s * (PV + 0.12), 0.05, -21, 0.22, 0.1, 114, 0xb4b2aa, { phys: false }); } // concrete kerbs + verge edging
  solid('flat', 0, 0.04, TOPZ1, XW * 2, 0.08, 0.25, 0xb9b7b0, { phys: false });
  // road markings, bitumen crack-seal and patch repairs, ironwork
  for (let z = -75; z < 34; z += 4.5) flatG('flat', -0.08, 0.08, z, z + 2.2, 0xe8e6de, { y: 0.022 });
  for (let z = -55; z < -8; z += 0.7) flatG('flat', RW - 0.41, RW - 0.29, z, z + 0.5, 0xd8b23a, { y: 0.022 }); // double yellows by the shops
  for (let x = -RW; x < RW; x += 0.9) flatG('flat', x, x + 0.5, TOPZ0 - 0.25, TOPZ0 - 0.05, 0xe8e6de, { y: 0.022 }); // give-way
  for (let i = 0; i < 40; i++) { const x = (rand() - 0.5) * 7, z = -76 + rand() * 110; quad('flat', x, 0.018, z, 0.07, 2 + rand() * 6, rand() * 3, null, 0x2b2c2d, { rx: -Math.PI / 2 }); } // bitumen seams
  for (let i = 0; i < 12; i++) { const x = (rand() - 0.5) * 6, z = -74 + rand() * 108; quad('flat', x, 0.016, z, 1 + rand() * 2.2, 0.8 + rand() * 2, rand() * 0.3, null, pick([0x5a5c5b, 0x6a6c6a, 0x4d4f4f]), { rx: -Math.PI / 2 }); } // patch repairs
  for (const [x, z] of [[-2.6, 2], [2.4, 18], [-1.5, 30], [1.8, -8], [-2, -40], [2.2, -64]]) cyl('metal', x, 0.012, z, 0.32, 0.32, 0.02, 0x4a4b4d, { phys: false, seg: 10 }); // manhole covers
  for (const s of [-1, 1]) for (let z = -75; z < 34; z += 9) solid('flat', s * (RW - 0.25), 0.012, z, 0.4, 0.02, 0.8, 0x2e2f30, { phys: false }); // gully grates
  for (let i = 0; i < 90; i++) { const s = rand() < 0.5 ? -1 : 1; quad('grime', s * (RW + 0.2 + rand() * 3), 0.024, -76 + rand() * 110, 0.6 + rand() * 1.6, 0.5 + rand() * 1.4, rand() * 3, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }
  for (let i = 0; i < 28; i++) { const s = rand() < 0.5 ? -1 : 1; quad('flat', s * (PV + 0.3 + rand() * 3.8), 0.006, (s > 0 && rand() < 0.6 ? -76 : -60) + rand() * 92, 0.6 + rand() * 1.6, 0.5 + rand() * 2, rand() * 3, null, pick([0x7c8a4a, 0x86884e, 0x5f7a3a, 0x8f8a5e]), { rx: -Math.PI / 2 }); } // worn verge patches
  for (let i = 0; i < 40; i++) { const s = rand() < 0.5 ? -1 : 1; quad('flat', s * (PV + 0.05), 0.02, -76 + rand() * 108, 0.05, 0.25, 0, null, pick([0x5f7a3a, 0x6d8648]), {}); } // weeds at the kerb edge
  for (let i = 0; i < 18; i++) { const x = (rand() - 0.5) * 50, z = -76 + rand() * 100; if (Math.abs(x) < RW) continue; quad('flat', x, 0.03, z, 0.12, 0.08, rand() * 3, null, pick([0xf2f2f2, 0xd4402c, 0x2d6cc4, 0xe7c23a]), { rx: -Math.PI / 2 }); } // litter

  // ---------- the shopping centre (left side, facing the road): shops below, flats above, canopy, the library through the back ----------
  FR = { rot: -Math.PI / 2, ox: -10, oz: -30 }; // local x (along the shops) -> world z -56..-6; local z = -17 (concourse edge) -> the left pavement
  flatG('slab', -26, 24, PF, -17, 0xd2cfc8, { tile: 2.4 }); // the concourse
  for (let i = 0; i < 45; i++) quad('grime', -24 + rand() * 46, 0.03, PF + 1 + rand() * 13, 0.8 + rand() * 2.4, 0.8 + rand() * 2, rand() * 3, GRIME_UV[rand() < 0.75 ? 0 : 1], 0xffffff, { rx: -Math.PI / 2 }); // concourse stains
  for (let i = 0; i < 160; i++) { const x = -24 + rand() * 46, z = PF + 0.5 + rand() * 14; quad('flat', x, 0.028, z, 0.07, 0.07, 0, null, 0x9a9890, { rx: -Math.PI / 2 }); } // chewing-gum spots

  const SHOPS = [ // x0, x1, name, sub, bg, fg
    [-26, -14, 'THE WEE GROCER', 'FRESH · FROZEN · OPEN 8 TIL LATE', '#2f6b3a', '#f4efe0'],
    [-14, -8, "R.J. McCALLUM'S", 'NEWS · SWEETS · PAPERS', '#b8202a', '#ffffff'],
    [-8, -2, "MACKIE'S PORK SHOP", 'SQUARE SAUSAGE · PIES', '#f3e9d2', '#8a2a1e'],
    [-2, 4, "LADD'S BOOKMAKERS", 'RACING · FOOTBALL · DOGS', '#c8102e', '#ffffff'], // fictional, red-and-white like the real bookies that stood here
    [4, 10, "HADDON'S WINES", 'OFF-LICENCE', '#4a1f2a', '#f1d98a'],
    [10, 16, 'EL MEXICANO', 'SWEETS · TABLET · ICE LOLLIES', '#f2d43a', '#b8202a'], // the long-closed local sweet shop (local-memory name, kept at Chris's request)
  ];
  { const z0 = PF, D = 12, H = 10.4, xc = -1;
    solid('cpanel', -4.5, H / 2, z0 - D / 2, 43, H, D, 0xd9d6cf, { tile: 3.2, phys: false }); boxBody(-4.5, H / 2, z0 - D / 2, 43, H, D); // west part (to the pend)
    solid('cpanel', 22, H / 2, z0 - D / 2, 4, H, D, 0xd9d6cf, { tile: 3.2 }); // east of the pend
    solid('cpanel', 18.5, 7.2, z0 - D / 2, 3, 6.4, D, 0xd9d6cf, { tile: 3.2 }); // the pend: a passage through the back to the library
    boxBody(18.5, 2, z0 - D + 0.2, 3, 4, 0.4); solid('flat', 18.5, 2.0, z0 - 3, 0.1, 4, 6, 0x6a6c6a, { phys: false });
    // flats above: roughcast bands between concrete floor slabs, windows, a couple of balconies
    for (const [y0, y1] of [[4.0, 6.9], [7.3, 10.2]]) solid('harl', -2, (y0 + y1) / 2, z0 + 0.01, 52, y1 - y0, 0.02, HARL[1], { phys: false, tile: 2.5, grime: 0.1 });
    for (const y of [3.95, 7.1, 10.3]) solid('cpanel', -2, y, z0 + 0.12, 52.2, 0.32, 0.26, 0xcfccc4, { phys: false, tile: 1.5 });
    for (let i = 0; i < 17; i++) { const wx = -25 + i * 3.0 + 0.6; if (wx > 16.6 && wx < 20.4) continue; for (const wy of [5.45, 8.75]) { const mine = wx > 5.5 && wx < 9 && wy < 6; // Chris's old flat: above the off-licence
        win(wx, wy, z0 + 0.02, 0, 1.9, 1.5, mine ? true : undefined); } }
    solid('flat', 7.3, 4.7, z0 + 0.25, 2.2, 0.12, 0.4, 0x7b5a3a, { phys: false }); for (let k = 0; k < 4; k++) cyl('flat', 6.5 + k * 0.5, 4.88, z0 + 0.25, 0.1, 0.1, 0.22, pick([0xd4402c, 0xe7c23a, 0xd46aa0]), { phys: false, seg: 6 }); // window box under the old flat
    for (const bx of [-17, -5, 13]) { solid('cpanel', bx, 7.25, z0 + 0.7, 2.8, 0.15, 1.3, 0xcfccc4, { phys: false }); solid('metal', bx, 7.8, z0 + 1.32, 2.8, 0.9, 0.05, 0x9aa0a0, { phys: false }); } // balconies
    solid('flat', -2, 10.5, z0 - D / 2, 52.4, 0.35, D + 0.4, 0x8e8b84, { phys: false }); // flat-roof parapet
    // canopy along the parade (concrete, with a lip so a chipped ball can sit on it)
    solid('cpanel', -2, 3.35, z0 + 1.2, 52, 0.22, 2.4, 0xd2cfc8, { tile: 2 }); solid('cpanel', -2, 3.55, z0 + 2.33, 52, 0.22, 0.14, 0xc6c3bb, { tile: 2 });
    for (let x = -24; x <= 22; x += 6.6) cyl('cpanel', x, 1.62, z0 + 2.1, 0.13, 0.13, 3.24, 0xc4c1ba, { seg: 8 });
    for (const [x0, x1, name, sub, bg, fg] of SHOPS) { const w = x1 - x0, sx = (x0 + x1) / 2;
      solid('cpanel', x0 + 0.2, 1.6, z0 + 0.15, 0.4, 3.2, 0.3, 0xc9c6bf, { phys: false }); // pier between units
      solid('flat', sx, 0.3, z0 + 0.05, w - 0.8, 0.6, 0.1, 0x4a4b4d, { phys: false }); // window + stallriser
      B.add('atlasLit', QUAD, M4(sx, 2.95, z0 + 0.06, w - 0.6, 0.62, 1), 0xe6e6e6, { uvRect: atlas.fascia(name, sub, bg, fg, (w - 0.6) / 0.62) });
      B.add('interior', QUAD, M4(sx, 1.6, z0 - 0.6, w - 1.0, 2.3, 1), pick([0xb8ae98, 0xa89c88, 0xc0b8a8]), {}); for (let k = 0; k < 3; k++) B.add('interior', BOX, M4(sx - (w - 2) / 2 + k * (w - 2) / 2, 1.0 + rand() * 0.6, z0 - 0.45, 0.9, 0.12, 0.2), pick([0xd4402c, 0xe7c23a, 0x2d6cc4, 0xf2f2f2, 0x4a8a3a]), {});
      quad('grime', sx, 0.9, z0 + 0.04, w, 1.8, 0, GRIME_UV[2]); }
    // window displays (simple shelf blocks / posters) so the glass isn't empty
    for (const [x, c] of [[-23, 0x2f6b3a], [-20, 0xe7c23a], [-11, 0xd4402c], [-5, 0xf3e9d2], [1, 0xc8102e], [7, 0x6a1f2a], [13, 0xf2d43a]]) for (let k = 0; k < 3; k++) solid('flat', x + k * 0.9 - 0.9, 0.9 + (k % 2) * 0.5, z0 - 0.2, 0.7, 0.45, 0.2, c, { phys: false });
    // roller shutter on the end unit + stair door to the flats beside the off-licence
    solid('metal', 22, 1.6, z0 + 0.05, 3.4, 3.0, 0.08, 0x9a9c9c, { phys: false }); for (let y = 0.2; y < 3.1; y += 0.12) solid('flat', 22, y, z0 + 0.1, 3.4, 0.03, 0.02, 0x6e7070, { phys: false });
    sign('LIBRARY  →', 18.5, 3.9, z0 + 0.4, 2.6, 0.45, 0, '#2a3f6b', '#ffffff', 'bold 46px Arial');
    quad('glass', 18.5, 1.4, z0 - D + 0.45, 2.4, 2.6, 0, null, 0xfff3d0); sign('PUBLIC LIBRARY', 18.5, 3.1, z0 - D + 0.45, 2.6, 0.45, 0, '#2a3f6b', '#ffffff', 'bold 40px Arial');
    // bins, trolleys, a bench, cycle hoops, bollards on the concourse
    for (const [x, z, c] of [[-25, PF + 1.0, 0x2f5a3a], [-24, PF + 1.0, 0x5a5c5e], [21, PF + 1.0, 0x5a5c5e], [23.5, PF + 0.9, 0x2f5a3a]]) { solid('flat', x, 0.55, z, 0.75, 1.1, 0.8, c, { surface: 'plastic' }); solid('flat', x, 1.12, z - 0.05, 0.8, 0.08, 0.9, c, { phys: false }); }
    for (const [x, z, r] of [[-17, PF + 4, 0.3], [-16.2, PF + 4.3, 0.5], [14, PF + 5, -0.6]]) { solid('metal', x, 0.55, z, 0.55, 0.05, 0.9, 0x9aa0a6, { phys: false, ry: r }); solid('metal', x, 0.85, z, 0.55, 0.5, 0.04, 0x9aa0a6, { phys: false, ry: r }); boxBody(x, 0.5, z, 0.55, 1.0, 0.9, { ry: r, surface: 'metal' }); }
    solid('wood', -8, 0.45, PF + 6, 2.0, 0.08, 0.5, 0x7b5a3a); solid('cpanel', -8.8, 0.22, PF + 6, 0.2, 0.44, 0.5, 0xb8b5ae, { phys: false }); solid('cpanel', -7.2, 0.22, PF + 6, 0.2, 0.44, 0.5, 0xb8b5ae, { phys: false });
    for (let x = -24; x <= 24; x += 3) if (Math.abs(x) > 6) cyl('cpanel', x, 0.45, -17.6, 0.18, 0.2, 0.9, 0xc9c6bf, { seg: 8 }); // concrete bollards at the concourse edge
  }

  // ---------- the old filling-station nod: a retro petrol pump kept as a planter, with a wee plaque (target 1) ----------
  { const x = 5.6, z = -21.6;
    solid('flat', x, 0.15, z, 1.4, 0.3, 1.0, 0x9a978f); solid('flat', x, 1.05, z, 0.62, 1.5, 0.42, 0xb8302a, { surface: 'metal', target: 'oldpump' }); solid('flat', x, 1.32, z + 0.22, 0.46, 0.5, 0.02, 0xf2ede0, { phys: false });
    cyl('glass', x, 2.02, z, 0.2, 0.2, 0.36, 0xfff2c8, { phys: false, seg: 10 }); solid('flat', x - 0.36, 0.95, z + 0.05, 0.08, 0.7, 0.08, IRON, { phys: false });
    for (let k = 0; k < 5; k++) cyl('flat', x - 0.5 + k * 0.25, 0.38, z + 0.35, 0.08, 0.08, 0.2, pick([0xd4402c, 0xe7c23a, 0xf2f2f2, 0x8a3aa0]), { phys: false, seg: 6 });
    sign('PENNYWELL FILLING STATION · STOOD HERE 1960s', x, 0.62, z + 0.52, 1.3, 0.16, 0, '#2E2F2C', '#e9e2cf', 'bold 30px Arial');
    addTarget({ id: 'oldpump', name: 'The Auld Pump', hint: 'ping the old petrol pump (the filling station stood here)', points: 50, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 0.9, stand: V(4.2, 0, -27), aim: V(x, 1.0, z), lines: ['Fill her up! Four star, son.', "Ding! That pump's no' seen action since decimalisation.", 'Pumped. Lovely.'] }); }

  // ---------- targets on the parade ----------
  { // newsagent's paper board (topples)
    const ax = -12.4, az = PF + 1.6, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.BoxGeometry(0.62, 0.95, 0.05), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0, 0.12), 0xb8202a); add(new THREE.BoxGeometry(0.62, 0.95, 0.05), new THREE.Matrix4().makeRotationX(-0.2).setPosition(0, 0, -0.12), 0xb8202a);
    add(new THREE.BoxGeometry(0.5, 0.62, 0.01), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.03, 0.155), 0xf4f2ea); add(new THREE.BoxGeometry(0.44, 0.1, 0.012), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.2, 0.165), 0x1d1d1d); add(new THREE.BoxGeometry(0.44, 0.05, 0.012), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.05, 0.168), 0x555555);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 0.5, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.31, 0.47, 0.12)) }); { const [wx, wz] = TX(ax, az); b.position.set(wx, 0.48, wz); b.quaternion.setFromEuler(0, FR ? FR.rot : 0, 0); } b.userData = { target: 'newsboard', surface: 'board' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'newsboard', name: "McCallum's Paper Board", hint: "knock over the newsagent's paper board", points: 50, kind: 'topple', body: b, pos: V(ax, 0, az), stand: V(ax, 0, az + 4.5), aim: V(ax, 0.5, az), lines: ['HOLD THE FRONT PAGE: BOARD FALLS OVER.', "Read all aboot it!", "That's the papers sorted."] }); }
  const shopDoor = (id, x, name, hint, lines, col, pts = 75) => { solid('wood', x, 1.15, PF + 0.06, 1.15, 2.3, 0.1, col, { target: id, surface: 'board' }); quad('atlas', x, 1.15, PF + 0.12, 1.15, 2.3, 0, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id, name, hint, points: pts, kind: 'hit', pos: V(x, 0, PF + 1.4), ringR: 0.95, stand: V(x, 0, PF + 6.5), aim: V(x, 1.0, PF), lines }); };
  shopDoor('porkshop', -5, "Mackie's Door", 'skelp the pork shop door', ['Square sausage, two rolls, nae sauce. Ta.', "Mackie's says: mind the windae.", 'Cracking. And peppery.'], 0x8a2a1e);
  shopDoor('bookies', 1, "Ladd's Bookies", 'strike the bookies door', ['Each-way winner!', "The bookie's no' happy. You're on a roll.", 'Romped home at 33 to 1.'], 0xc8102e);
  shopDoor('mexicanito', 13, 'El Mexicano', 'hit the sweetie shop door', ["A quarter o' soor plooms, please!", 'Penny tray, emptied. Gie us a gobstopper.', 'Sweet as.'], 0xb8202a);
  { // the canopy above Haddon's Wines - Chris's old flat is right above it (chip target)
    addTarget({ id: 'canopy', name: "Up on Haddon's Canopy", hint: "chip it up onto the canopy over Haddon's Wines (that's the old flat above)", points: 125, kind: 'zone', pos: V(7, 0, PF + 3.2), ringR: 1.2, stand: V(7, 0, PF + 12.5), aim: V(7, 4.2, PF + 1.2),
      zone: new THREE.Box3(V(4, 3.45, PF + 0.1), V(10, 4.6, PF + 2.6)), lines: ["Up on the roof! Ma would've had your guts for garters.", "Left it on the canopy. Some things never change.", 'Chipped like a pro. The whole close heard it.'] }); }
  sign('YPD', 24.03, 1.7, PF - 3.5, 0.9, 0.42, Math.PI / 2, '#d9d6cf', 'rgba(40,58,110,0.5)', 'italic bold 64px Arial'); // v3.11: a small faded tag on the end wall
  FR = null;

  // ---------- Pennywell Road: verges, palisade railings, lamp standards, trees, bus stop, clutter ----------
  const palisade = (x0, z0, x1, z1, col = PAL, h = 1.9) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.round(L / 0.2), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const y of [0.35, h - 0.35]) solid('metal', mx, y, mz, 0.05, 0.07, L, col, { phys: false, ry: a });
    for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; B.add('metal', BOX, M4(x, h / 2, z, 0.07, h, 0.025, 0, a), col, {}); B.add('metal', ROOF, M4(x, h + 0.05, z, 0.07, 0.12, 0.025, 0, a), col, {}); }
    body(new CANNON.Box(new CANNON.Vec3(0.06, h / 2, L / 2)), mx, h / 2, mz, { ry: a, surface: 'metal' }); };
  palisade(VG, -77, VG, -57); palisade(VG, -4, VG, 32.5); // left: houses at the bottom, then from the kirk up (open along the shops)
  palisade(-VG, -77, -VG, -62.7); palisade(-VG, -57.3, -VG, -46); palisade(-VG, -44, -VG, 32.5); // right: the school (gates = goal), then houses and St Paul's
  palisade(-XW, FZ, -3, FZ, 0x5a5e62, 2.4); palisade(3, FZ, XW, FZ, 0x5a5e62, 2.4); // the police station's security fence
  for (const s of [-1, 1]) for (let z = -76; z < 34; z += 13) { const x = s * (PV - 0.4); cyl('cpanel', x, 3.6, z, 0.11, 0.16, 7.2, 0xb4b2ab, { seg: 7 }); solid('cpanel', x - s * 0.7, 7.15, z, 1.5, 0.12, 0.26, 0xb4b2ab, { phys: false }); solid('flat', x - s * 1.35, 7.05, z, 0.5, 0.12, 0.3, 0xfff1c0, { phys: false }); }
  for (const [x, z, s2] of [[9.3, -2, 1.1], [-9.3, -9, 1.2], [9.3, 26, 1.25], [-9.3, 30, 1.0], [24, 38.5, 1.1], [-9.3, -50, 1.15], [9.3, -66, 1.2], [-9.3, -30, 1.05]]) { cyl('wood', x, 2.2 * s2, z, 0.22, 0.32, 4.4 * s2, 0x4e3c2a, { seg: 6 }); for (const [ox, oy, oz, r] of [[0, 6.2, 0, 2.6], [0.9, 5.4, 0.6, 1.9], [-0.8, 5.6, -0.7, 2.0], [0.2, 7.3, -0.2, 1.7]]) B.add('flat', new THREE.IcosahedronGeometry(r * s2, 1), M4(x + ox, oy * s2, z + oz, 1, 0.92, 1), pick([0x46672f, 0x557a36, 0x4c6e32]), {}); }
  // bus stop on the right-hand pavement (target, glass)
  { const x = -5.3, z = 5; solid('metal', x - 0.6, 1.25, z, 0.08, 2.5, 3.2, IRON, { phys: false }); quad('glass', x - 0.55, 1.3, z, 3.1, 2.1, Math.PI / 2, null, 0xd8e6ee); boxBody(x - 0.6, 1.25, z, 0.12, 2.5, 3.2, { target: 'busstop', surface: 'glass' });
    solid('metal', x, 2.55, z, 1.4, 0.08, 3.4, IRON, { phys: false }); for (const dz of [-1.6, 1.6]) solid('metal', x, 1.25, z + dz, 1.2, 2.5, 0.06, IRON, { phys: false }); solid('wood', x - 0.3, 0.55, z, 0.4, 0.06, 2.6, 0x6a6c6a, { phys: false });
    cyl('metal', x + 0.9, 1.4, z - 2.2, 0.05, 0.05, 2.8, IRON, { seg: 6 }); sign('BUS STOP', x + 0.9, 2.75, z - 2.2, 0.7, 0.32, Math.PI / 2, '#e7c23a', '#1d1d1d', 'bold 54px Arial');
    addTarget({ id: 'busstop', name: 'The Bus Shelter', hint: 'clatter the bus-stop panel', points: 75, kind: 'hit', pos: V(x + 0.3, 0, z), ringR: 1.2, stand: V(0.5, 0, z), aim: V(x - 0.6, 1.2, z), lines: ['Next bus: 20 minutes. Next goal: noo.', "Clang! That's woken the auld boy up.", 'Rattled the shelter like a 27 at full tilt.'] }); }
  // clutter: wheelie bins at the flats, a road-works barrier and cones, a grit bin, a dog bin, street nameplate
  for (const [x, z, c] of [[-8.6, -13, 0x2f5a3a], [-8.6, -12.1, 0x5a5c5e], [8.8, 22, 0x2f5a3a], [8.8, 22.9, 0x3a5aa0], [8.8, 23.8, 0x5a5c5e]]) { solid('flat', x, 0.55, z, 0.75, 1.1, 0.8, c, { surface: 'plastic' }); solid('flat', x, 1.12, z, 0.82, 0.08, 0.88, c, { phys: false }); }
  { const x = 5.6, z = 28; for (const dz of [-1, 1]) { solid('flat', x, 0.5, z + dz, 0.12, 1.0, 0.12, 0xd4402c, { phys: false }); } solid('flat', x, 0.85, z, 0.1, 0.22, 2.1, 0xf2f2f2, { phys: false }); solid('flat', x, 0.85, z, 0.11, 0.22, 0.5, 0xd4402c, { phys: false }); boxBody(x, 0.5, z, 0.2, 1.0, 2.2, { surface: 'plastic' });
    for (const dz of [-1.8, 2.0, 2.6]) { cyl('flat', 4.6, 0.36, z + dz, 0.04, 0.17, 0.72, 0xe85a1e, { seg: 8 }); cyl('flat', 4.6, 0.46, z + dz, 0.08, 0.12, 0.08, 0xf2f2f2, { phys: false, seg: 8 }); } }
  solid('flat', -8.6, 0.45, 20, 0.8, 0.9, 0.6, 0xe7c23a, { surface: 'plastic' }); solid('flat', -8.6, 0.93, 20, 0.86, 0.08, 0.66, 0xd8b23a, { phys: false }); // grit bin
  cyl('metal', 8.4, 0.5, 8, 0.04, 0.04, 1.0, IRON, { seg: 5, phys: false }); solid('flat', 8.4, 1.05, 8, 0.36, 0.42, 0.3, 0xb8202a, { phys: false });
  for (const [x, z, r] of [[VG - 0.2, -64, -Math.PI / 2], [-VG + 0.2, 33, Math.PI / 2]]) sign('PENNYWELL ROAD', x, 2.1, z, 1.7, 0.36, r, '#ffffff', '#1d1d1d', 'bold 50px Arial', '#1d1d1d');

  // ---------- the Old Kirk (left, +x) - 'the white church': white harled front block with a grey window grid over brown doors,
  // a long low nave with blue fascias, hall behind; low brick-and-stone wall behind the railings (stone kept only as trim) ----------
  { const x0 = 13.5, W = HARL[0], BLUE = 0x2a4f8a;
    solid('harl', x0 + 2.4, 4.6, 4, 4.8, 9.2, 6.0, W, { tile: 2.5, grime: 0.08 }); // front block
    solid('flat', x0 + 2.4, 9.3, 4, 5.1, 0.25, 6.3, BLUE, { phys: false }); solid('flat', x0 - 0.02, 9.1, 4, 0.08, 0.2, 6.3, BLUE, { phys: false }); // blue fascia
    solid('flat', x0 - 0.02, 6.2, 4, 0.06, 4.0, 2.9, 0x8e9196, { phys: false }); // grey panel round the window grid
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { solid('flat', x0 - 0.05, 4.9 + j * 1.3, 3.35 + i * 1.3, 0.04, 1.0, 1.0, 0xd8dade, { phys: false }); solid('glass', x0 - 0.07, 4.9 + j * 1.3, 3.35 + i * 1.3, 0.04, 0.62, 0.62, 0x55606a, { phys: false }); }
    for (const dz of [-0.62, 0.62]) solid('wood', x0 - 0.02, 1.45, 4 + dz, 0.06, 2.9, 1.15, 0x5a2e1e, { phys: false }); solid('flat', x0 - 0.03, 2.95, 4, 0.06, 0.12, 2.6, 0x8e9196, { phys: false });
    solid('harl', x0 + 10, 3.3, 4, 11.5, 6.6, 13, W, { tile: 2.5, grime: 0.1 }); B.add('roof', ROOF, M4(x0 + 10, 6.6, 4, 13.4, 1.8, 11.7, 0, Math.PI / 2), 0x4a4e54, { tile: 2.2 }); // nave, low pitch
    solid('flat', x0 + 10, 6.62, -2.56, 11.7, 0.22, 0.08, BLUE, { phys: false }); solid('flat', x0 + 10, 6.62, 10.56, 11.7, 0.22, 0.08, BLUE, { phys: false }); // blue fascias
    for (let i = 0; i < 4; i++) { solid('glass', x0 + 6 + i * 2.6, 3.2, -2.53, 1.0, 1.4, 0.04, 0x55606a, { phys: false }); solid('flat', x0 + 6 + i * 2.6, 2.45, -2.56, 1.2, 0.1, 0.1, 0xd8dade, { phys: false }); }
    for (const dz of [-0.6, 0.6]) solid('glass', x0 + 4.79, 3.6, 4 + dz + 6, 0.04, 3.6, 0.5, 0x3a4048, { phys: false }); // tall gable windows on the nave
    sign('THE OLD KIRK', x0 + 4.75, 3.0, 8.2, 2.4, 0.9, -Math.PI / 2, '#2a4f8a', '#ffffff', 'bold 46px Arial', '#ffffff');
    cyl('flat', x0 + 4.9, 3.3, 1.2, 0.06, 0.06, 6.6, 0xd8dade, { seg: 5, phys: false }); // downpipe
    solid('harl', x0 + 6, 2.4, 12.5, 6, 4.8, 4, HARL[2], { tile: 2.5 }); B.add('roof', ROOF, M4(x0 + 6, 4.8, 12.5, 4.4, 1.4, 6.2, 0, Math.PI / 2), 0x4a4e54, {}); // hall
    solid('brick', VG + 0.45, 0.35, 4, 0.5, 0.7, 16, 0x9a8a80, { tile: 1.5 }); solid('rubble', VG + 0.45, 0.75, 4, 0.6, 0.1, 16.1, 0xe6dcc8, { phys: false }); // low brick wall, stone cope (trim)
    // noticeboard at the gate (target)
    const nx = VG - 0.3, nz = 1.0; solid('wood', nx, 1.35, nz, 0.12, 1.1, 1.5, 0x2a3f6b, { target: 'kirknotice', surface: 'board' }); quad('flat', nx - 0.07, 1.4, nz, 1.3, 0.9, -Math.PI / 2, null, 0xf4f2ea);
    sign('ALL WELCOME', nx - 0.08, 1.75, nz, 1.2, 0.22, -Math.PI / 2, '#2a3f6b', '#ffffff', 'bold 44px Arial'); for (const dz of [-0.6, 0.6]) cyl('wood', nx, 0.4, nz + dz, 0.05, 0.05, 0.8, 0x2a3f6b, { seg: 5, phys: false });
    addTarget({ id: 'kirknotice', name: 'Old Kirk Noticeboard', hint: 'ping the kirk noticeboard at the railings', points: 100, kind: 'hit', pos: V(nx - 1.2, 0, nz), ringR: 0.9, stand: V(8.3, 0, nz), aim: V(nx, 1.35, nz), lines: ['Notice: fitba practice, Tuesdays.', "The minister says that'll be a fiver for the roof fund.", 'Pinged it. Hallelujah.'] }); }

  // ---------- St Paul's (right, -x): the distinctive slanted roof - steep grey slate wedge between sharp white gables with dark copes,
  // a clerestory band along the top, tall glazed slot, blue door, dark brick plinth; v3.11: burnt out (blackened windows, scorch marks) ----------
  { const xf = -14, xb = -28, z0 = 8, z1 = 24, Hlo = 3.6, Hhi = 21, zc = (z0 + z1) / 2, W = HARL[0];
    solid('harl', (xf + xb) / 2, Hlo / 2, zc, xf - xb, Hlo, z1 - z0, W, { tile: 2.5, grime: 0.1 });
    solid('brick', (xf + xb) / 2, 0.45, zc, xf - xb + 0.1, 0.9, z1 - z0 + 0.1, 0x6a6460, { phys: false, tile: 1.5 }); // dark brick plinth
    const top = Hhi - 2.6; { const sh = new THREE.Shape(); sh.moveTo(xb - 0.3, Hlo - 0.1); sh.lineTo(xf + 0.4, Hlo - 0.1); sh.lineTo(xb - 0.3, top); sh.closePath(); // slate slope faces the road
      const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 - 0.2, bevelEnabled: false }); g.translate(0, 0, z0 + 0.1); B.add('cpanel', g, null, 0x6a7078, { tile: 1.2 });
      const w = new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: false }); w.translate(0, 0, z0 - 0.35); B.add('harl', w, null, W, { tile: 2.5 }); const w2 = w.clone(); w2.translate(0, 0, z1 - z0 + 0.25); B.add('harl', w2, null, W, { tile: 2.5 }); // sharp white gables
      body(new CANNON.Box(new CANNON.Vec3((xf - xb) / 2, (Hhi - Hlo) / 2, (z1 - z0) / 2)), (xf + xb) / 2, Hlo + 1.5, zc); }
    { const L = Math.hypot(xf + 0.4 - xb + 0.3, top - Hlo + 0.1), th = Math.atan2(top - Hlo, xf - xb + 0.7); for (const zz of [z0 - 0.15, z1 + 0.15]) solid('flat', (xf + xb) / 2 + 0.05, (Hlo + top) / 2 + 0.12, zz, L + 0.3, 0.22, 0.55, 0x3e3a36, { phys: false, rz: -th }); } // dark gable copes
    solid('harl', xb + 1.2, top + 1.1, zc, 2.6, 2.6, z1 - z0 - 1.2, W, { tile: 2.5, phys: false }); // clerestory band at the top of the slope
    for (let k = 0; k < 6; k++) { solid('glass', xb + 2.52, top + 1.2, z0 + 2 + k * 2.4, 0.04, 1.2, 1.4, k % 2 ? 0x1d1c1b : 0x3a3836, { phys: false }); quad('grime', xb + 2.56, top + 2.0, z0 + 2 + k * 2.4, 1.7, 1.6, Math.PI / 2, GRIME_UV[0], 0x2a2826); } // v3.11: burnt out - blackened clerestory, scorch streaks
    solid('flat', xb + 1.2, top + 2.45, zc, 2.9, 0.15, z1 - z0 - 1.0, 0x3e3a36, { phys: false });
    solid('harl', xf + 0.35, 6.4, zc - 5.4, 0.7, 12.8, 3.2, W, { tile: 2.5, grime: 0.08 }); // tall entrance wing with the glazed slot
    solid('glass', xf + 0.72, 7.0, zc - 5.4, 0.05, 7.5, 0.9, 0x9fb0b8, { phys: false }); for (let k = 1; k < 6; k++) solid('flat', xf + 0.74, 3.25 + k * 1.25, zc - 5.4, 0.04, 0.06, 0.95, 0xd8dade, { phys: false });
    solid('flat', xf + 0.72, 1.2, zc - 2.6, 0.06, 2.4, 1.3, 0x2a5aa0, { phys: false }); solid('flat', xf + 0.73, 2.55, zc - 2.6, 0.06, 0.25, 1.6, 0x2a5aa0, { phys: false }); // blue door + band
    solid('harl', xf + 3, 2.3, zc + 4.5, 5, 4.6, 6, HARL[2], { tile: 2.5, grime: 0.12 }); B.add('roof', ROOF, M4(xf + 3, 4.6, zc + 4.5, 5.4, 1.8, 6.4), 0x4a4e54, {}); // porch wing
    solid('flat', xf + 3, 4.55, zc + 1.45, 5.2, 0.25, 0.08, 0x2a5aa0, { phys: false }); // blue fascia
    sign("ST PAUL'S", xf + 5.53, 3.7, zc + 4.5, 2.0, 0.4, Math.PI / 2, '#ffffff', '#2a5aa0', 'bold 50px Georgia', '#2a5aa0');
    // the church gate in the railings (target)
    const gx = -VG + 0.12, gz = 15; for (const dz of [-1.15, 1.15]) solid('cpanel', gx, 0.95, gz + dz, 0.3, 1.9, 0.3, 0xcfccc4); solid('metal', gx, 0.95, gz, 0.06, 1.7, 2.0, 0x2a2c30, { target: 'stpaulsgate', surface: 'metal' });
    for (let k = 0; k < 9; k++) solid('metal', gx, 0.95, gz - 0.9 + k * 0.225, 0.07, 1.7, 0.03, 0x2a2c30, { phys: false });
    addTarget({ id: 'stpaulsgate', name: "St Paul's Gate", hint: "rattle St Paul's gate", points: 100, kind: 'hit', pos: V(gx + 1.2, 0, gz), ringR: 1.0, stand: V(-4.0, 0, gz), aim: V(gx, 0.9, gz), lines: ["Gate rattled. Father's lookin' oot the windae.", "Clang! That's the bell sorted for Sunday.", 'Sweet strike. Amen tae that.'] }); }

  // ---------- post-war harled flats lining the road (walk-ups with concrete bands and recessed balconies) ----------
  const flats = (x0, x1, z0, z1, floors, face, tone) => { const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, h = floors * 2.9 + 0.6;
    solid('harl', xc, h / 2, zc, w, h, d, tone, { tile: 2.6, grime: 0.12 }); solid('cpanel', xc, h + 0.2, zc, w + 0.3, 0.4, d + 0.3, 0xb8b5ae, { phys: false });
    const fx = face > 0 ? x0 - 0.02 : x1 + 0.02, ry = face > 0 ? -Math.PI / 2 : Math.PI / 2, n = Math.round(d / 3.2);
    for (let f = 0; f < floors; f++) { solid('cpanel', fx - face * 0.08, 0.6 + f * 2.9 + 0.05, zc, 0.16, 0.18, d, 0xc8c5be, { phys: false });
      for (let i = 0; i < n; i++) { const wz = z0 + (i + 0.5) * d / n; if (i % 3 === 1) { solid('flat', fx - face * 0.02, 1.95 + f * 2.9, wz, 0.04, 2.3, 1.9, 0x3a3c3e, { phys: false }); solid('metal', fx - face * 0.2, 1.3 + f * 2.9, wz, 0.04, 0.9, 2.0, 0xc8ccd0, { phys: false }); }
        else win(fx, 1.9 + f * 2.9, wz, ry, 1.9, 1.5); } }
    for (let i = 0; i < n; i += 3) quad('grime', fx - face * 0.015, 1.2, z0 + (i + 0.5) * d / n, 1.8, 2.4, ry, GRIME_UV[2]);
    const m = Math.max(1, Math.round(w / 3.2)); for (const [ez, er] of [[z0 - 0.02, Math.PI], [z1 + 0.02, 0]]) for (let f = 0; f < floors; f++) for (let i = 0; i < m; i++) win(x0 + (i + 0.5) * w / m, 1.9 + f * 2.9, ez, er, 1.2, 1.3); // gable-end windows
    for (const ez of [z0 - 0.03, z1 + 0.03]) quad('grime', xc, 1.4, ez, w, 2.8, ez < zc ? Math.PI : 0, GRIME_UV[3]); };
  flats(14, 27, 17, 33, 3, 1, HARL[1]); flats(-27, -14, -15, 5, 4, -1, HARL[4]); flats(14, 27, -76, -58, 3, 1, HARL[5]); flats(-27, -14, -42, -22, 3, -1, HARL[3]);
  // drying-green poles and a washing line on the left verge behind the railings
  for (const z of [19, 24, 29]) { cyl('metal', 12.6, 1.1, z, 0.04, 0.04, 2.2, 0x9a9c9c, { phys: false, seg: 5 }); } solid('flat', 12.6, 2.1, 24, 0.01, 0.01, 10, 0xe8e8e8, { phys: false });
  for (const [z, c] of [[20.5, 0xd4402c], [21.4, 0xf2f2f2], [22.6, 0x2d6cc4], [26, 0xf2f2f2]]) solid('flat', 12.6, 1.8, z, 0.02, 0.6, 0.55, c, { phys: false });
  // substation behind palisade (lived-in clutter) on the left
  solid('brick', 13.5, 1.4, -2.5, 3, 2.8, 2.6, 0xffffff, { tile: 1.5 }); solid('metal', 12.0, 1.0, -2.5, 0.05, 1.6, 1.4, 0x6a6c6a, { phys: false }); sign('DANGER  HIGH VOLTAGE', 11.97, 1.3, -2.5, 1.0, 0.35, -Math.PI / 2, '#e7c23a', '#1d1d1d', 'bold 40px Arial');
  sign('YMD', 11.98, 2.15, -3.4, 0.8, 0.38, -Math.PI / 2, '#ddd8cf', 'rgba(40,58,110,0.5)', 'italic bold 64px Arial'); // v3.11: small faded tag

  // ---------- v3.11: the new Craigroyston school at the bottom right - cream panels, a grey drum, curved standing-seam roof; gates = goal ----------
  { const xc = -28, zc = -62, gz = -60;
    solid('cpanel', xc, 4.5, zc, 22, 9, 14, 0xe8e2d2, { tile: 3 }); solid('brick', xc, 0.6, zc, 22.1, 1.2, 14.1, 0xffffff, { phys: false, tile: 1.5 });
    B.add('metal', new THREE.CylinderGeometry(7.4, 7.4, 14.6, 14, 1, false, Math.PI / 2, Math.PI), M4(xc, 9, zc, 1.55, 1, 0.32, Math.PI / 2, 0, 0), 0xa8b0b8, {}); // curved roof
    for (let f = 0; f < 2; f++) { quad('glass', -16.97, 2.6 + f * 3.4, zc, 12.5, 1.5, Math.PI / 2, null, 0xb8cad6); for (let k = -6; k <= 6; k += 2) solid('flat', -16.95, 2.6 + f * 3.4, zc + k, 0.06, 1.6, 0.1, 0x3a3c3e, { phys: false }); }
    cyl('cpanel', -22, 5, -73.5, 4.6, 4.6, 10, 0x8a929a, { seg: 16 }); cyl('flat', -22, 10.1, -73.5, 4.8, 4.8, 0.25, 0x5a5e62, { seg: 16, phys: false }); // grey drum
    flatG('slab', -16, -VG, gz - 1.3, gz + 1.3, 0xd2cfc8, { tile: 1.5 }); // path to the gate
    for (const s of [-1, 1]) { solid('cpanel', -VG, 1.3, gz + s * 2.95, 0.5, 2.6, 0.5, 0xd2cfc8, { tile: 1 }); solid('metal', -VG - 0.9, 0.95, gz + s * 1.6, 2.2, 1.8, 0.04, PAL, { phys: false, ry: s * 0.6 }); } // gates swung open
    solid('metal', -VG, 2.75, gz, 0.12, 0.12, 6.2, PAL, { phys: false }); sign('CRAIGROYSTON COMMUNITY HIGH SCHOOL', -VG + 0.08, 3.15, gz, 5.6, 0.55, Math.PI / 2, '#1f3f2a', '#f4efe0', 'bold 40px Arial');
    boxBody(-VG - 0.6, 1.4, gz, 0.3, 2.8, 5.4, { playerOnly: true }); // the player stays on the street; the ball goes through
    addTarget({ id: 'schoolgate', name: 'School Gate Goal', hint: 'score through the school gates (kick it - no dribbling in)', points: 150, kind: 'zone', kickOnly: true, pos: V(-VG + 2.5, 0, gz), ringR: 1.3, stand: V(-3.5, 0, gz), aim: V(-VG - 1, 0.6, gz),
      zone: new THREE.Box3(V(-VG - 3.5, 0, gz - 2.6), V(-VG - 0.3, 2.6, gz + 2.6)), lines: ["GOAL! Straight through the school gates. Detention, the lot o' ye.", 'Top bins! The janny saw that.', "Back o' the net. Craigroyston's finest."] }); }
  // ---------- v3.11: Drylaw Police Station at the top - red brick, beige band, hipped slate roof, security fence, radio mast ----------
  { const zf = 51.5, zb = 60.5, zc = (zf + zb) / 2;
    flatG('tarmac', -XW, XW, FZ, 64, 0x8d8f8c, { tile: 4 });
    solid('brick', 0, 3.4, zc, 24, 6.8, zb - zf, 0xffffff, { tile: 1.6 }); solid('cpanel', 0, 3.4, zf - 0.04, 24.2, 0.45, 0.1, 0xd8c8a0, { phys: false });
    B.add('roof', ROOF, M4(0, 7.8, zc, 24.8, 2.0, zb - zf + 0.8), 0x4a4e54, { tile: 2.2 });
    for (let f = 0; f < 2; f++) for (let i = 0; i < 7; i++) { const x = -10.2 + i * 3.4; if (f === 0 && Math.abs(x) < 1) continue; win(x, 1.9 + f * 3.2, zf - 0.02, Math.PI, 1.5, 1.3, false); }
    solid('flat', 0, 1.2, zf - 0.06, 1.9, 2.4, 0.1, 0x2a3f6b, { phys: false }); cyl('glass', 2.0, 2.6, zf - 0.25, 0.14, 0.14, 0.32, 0x4a7ad8, { phys: false, seg: 8 });
    sign('DRYLAW POLICE STATION', 0, 4.25, zf - 0.08, 6.2, 0.6, Math.PI, '#1f2a44', '#ffffff', 'bold 44px Arial');
    cyl('metal', 9.5, 9, zb + 2, 0.12, 0.38, 18, 0x9aa0a6, { seg: 6, phys: false }); for (const y of [13, 16.5]) solid('metal', 9.5, y, zb + 2, 1.8, 0.08, 0.08, 0x9aa0a6, { phys: false }); cyl('flat', 10.3, 15, zb + 2, 0.45, 0.45, 0.12, 0xe8e8e8, { phys: false, seg: 10, rz: Math.PI / 2 }); // radio mast
    solid('metal', 0, 1.2, FZ, 6.0, 2.4, 0.08, 0x5a5e62, { surface: 'metal' }); for (let x = -2.8; x <= 2.8; x += 0.2) solid('metal', x, 1.25, FZ - 0.05, 0.05, 2.5, 0.03, 0x5a5e62, { phys: false }); // closed vehicle gate
    for (let i = 0; i < 3; i++) { const x = -18 + i * 8; solid('flat', x, 0.45, 48.5 + (i % 2), 3.8, 0.9, 1.7, pick([0xf2f2f2, 0x3a5aa0, 0xd8d8d0]), { phys: false }); solid('glass', x - 0.2, 1.1, 48.5 + (i % 2), 2.0, 0.45, 1.5, 0x3a4a5a, { phys: false }); } } // cars in the yard

  // ---------- backdrop: more scheme flats, a high-rise and trees so no edge reads as void ----------
  for (const s of [-1, 1]) for (let z = -84; z < 56; z += 14) { if (s > 0 && z > -66 && z < 16) continue; if (s < 0 && ((z > 4 && z < 26) || (z > -86 && z < -44))) continue; const h = 9 + rand() * 4; solid('harl', s * 36, h / 2, z + 7, 12, h, 12, pick(HARL), { tile: 2.6, phys: false, grime: 0.12 }); solid('cpanel', s * 36, h + 0.2, z + 7, 12.3, 0.4, 12.3, 0xb8b5ae, { phys: false });
    for (let f = 0; f < 3; f++) for (let i = 0; i < 4; i++) win(s * 29.98, 1.9 + f * 2.9, z + 2 + i * 3, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1.8, 1.4); }
  { const x = 46, z = -24, h = 46; solid('cpanel', x, h / 2, z, 14, h, 14, 0xc9c3b6, { tile: 3, phys: false }); for (let f = 0; f < 15; f++) solid('glass', x - 7.02, 2 + f * 3, z, 0.04, 1.3, 11, 0x9aa6ae, { phys: false }); solid('flat', x, h + 0.6, z, 14.4, 1.2, 14.4, 0x9a958c, { phys: false }); }
  for (let i = 0; i < 14; i++) { const x = -40 + rand() * 80, z = 68 + rand() * 6, s2 = 1 + rand() * 0.5; cyl('wood', x, 2.5 * s2, z, 0.25, 0.32, 5 * s2, 0x4e3c2a, { phys: false, seg: 5 }); B.add('flat', new THREE.IcosahedronGeometry(3 * s2, 1), M4(x, 6.5 * s2, z, 1, 0.9, 1), pick([0x46672f, 0x557a36]), {}); }
  solid('cpanel', 0, 7, -101, 90, 14, 4, 0xc9c3b6, { phys: false, tile: 3 }); // flats beyond the Parkway
  // world edges for the player (balls are kept in by buildings, railings and the fence)
  pwall(-XW - 0.5, -15, 1, 172); pwall(XW + 0.5, -15, 1, 172);
  for (const s of [-1, 1]) pwall(s * (VG + XW) / 2, 33.6, XW - VG, 1); // close the verge ends behind the railings at the top road
  pwall(0, 52, 70, 1); boxBody(0, 3, 70, 92, 6, 1); boxBody(-45.5, 3, -15, 1, 6, 180); boxBody(45.5, 3, -15, 1, 6, 180); boxBody(0, 3, -100, 92, 6, 1);
  // ---------- targets ----------
  function addTarget(t) { if (FR) { for (const k of ['pos', 'stand', 'aim']) if (t[k]) t[k] = TV(t[k]); if (t.zone) { const a = TV(t.zone.min), b = TV(t.zone.max); t.zone = new THREE.Box3(a.clone().min(b), a.clone().max(b)); } }
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[14, 0, -40], [12, 0, -14], [-2, 0, 12], [0, 0, -70]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture()); materials.harl = tm(roughcastTexture()); materials.harl.color.setRGB(1.06, 1.08, 1.12); materials.harl.emissive?.setRGB(0.1, 0.1, 0.11); materials.cpanel = tm(concretePanelTexture()); materials.copper = tm(copperTexture()); materials.copper.side = THREE.DoubleSide;
  materials.rubble = tm(stoneTexture('rubble')); materials.grass = tm(grassTexture()); materials.brick = tm(gasBrickTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  materials.interior = new THREE.MeshBasicMaterial({ vertexColors: true }); materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [17, -23, 90, 2], road: [0, -50, 180, 4], kirk: [3, 2, 270, 6], stpauls: [-2, 12, 90, 8], school: [-2, -60, 90, 4], parade: [0, -30, 270, 4], police: [0, 30, 180, 6], roundabout: [0, -70, 0, 6] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  const ax = Math.abs(x);
  if (Math.hypot(x, z - PW.RB) < 5.6) return 'grass'; // the roundabout island
  if (z < PW.BOT) return 'tarmac'; // the roundabout + Parkway
  if (x > PW.PAVE && x < 22 && z > -56 && z < -6) return 'paving'; // the shopping-centre concourse
  if (z >= PW.TOPZ0 && z <= PW.TOPZ1) return 'tarmac';
  if (z > PW.TOPZ1) return z < PW.FENCE ? 'paving' : 'tarmac';
  if (ax < PW.ROAD) return 'tarmac';
  if (ax <= PW.PAVE || z > 33) return 'paving';
  return 'grass';
}
export default {
  id: 'pennywell', name: 'Pennywell Road', short: 'Pennywell', surfaceAt,
  sounds: { birds: [[-9, -9], [9, 26], [24, 38], [-9, -50], [9, -66]], gulls: [[0, 60], [-30, 20], [30, -30]], far: [[-60, 0], [60, 30], [0, 80], [0, -110]], roadX: 50 },
  blurb: 'Level 1: Pennywell Road. Start ootside the shops under the auld flat; doon to the school gates and the roundabout, up past the Old Kirk and St Paul\'s to the polis station. 10 targets.',
  intro: "Welcome tae Pennywell!<br><small>Ootside the shops, under the auld flat above Haddon's. Ball's at your feet. Easy first one: the old petrol pump, straight ahead.</small>",
  build,
  tiers: { oldpump: 'easy', newsboard: 'easy', porkshop: 'easy', bookies: 'easy', mexicanito: 'easy', busstop: 'easy', kirknotice: 'easy', stpaulsgate: 'tricky', canopy: 'tricky', schoolgate: 'tricky' },
  spawn: [17, 0.5, -23], spawnYaw: 90,
  ballHomes: () => [[15.2, 0.4, -23.4], [0, 0.4, -50], [0, 0.4, 10]],
  bounds: { x: 30, zMin: -99, zMax: 50 },
  next: 'granton',
};
