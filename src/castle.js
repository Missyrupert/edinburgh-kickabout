import * as THREE from 'three';
import { CASTLE_UV } from './textures.js';
import { roofPrism } from './batch.js';

// Edinburgh Castle as a distant backdrop, as seen from the Grassmarket (looking north at the south face).
// Proportions follow the real south elevation: a crag-and-tail rock (steep cliffs W/S, tail running
// east to the Esplanade), New Barracks low on the west, Crown Square (Great Hall on the cliff edge,
// Palace + tower, War Memorial behind), the Half Moon Battery drum and the gatehouse/Esplanade to the east.
// In this world +x is west (screen-left when facing the castle) and east is -x.
// Everything goes into two batches: 'castleRock' (vertex-coloured, flags too) and 'castleStone' (sandstone).
export function buildCastle(B, CX, CZ, rand, up = 30, opt = {}) {
  const E = (lx) => CX + 16 + lx; // lx: local x; +lx = west (screen-left), -lx = east (screen-right)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = up; // lift: the rock must dominate the view from the square below
  const M4 = (x, y0, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y0 + UP, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(sx, sy, sz));
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const WARM = !!opt.warm; // v3.3: honey sandstone + browner crag + more green, after AG's Vennel-steps photo
  const STONE = WARM ? [0xf2dcae, 0xe6cf9c, 0xf6e4bc, 0xdcc292] : [0xe8e6e2, 0xdcdad6, 0xf0ece4, 0xd2d0cc] /* v2.7: greyer, browner */, SLATE = 0x5c6066, DARK = 0x6e6252;
  const tint = () => STONE[Math.floor(rand() * STONE.length)];
  const box = (lx, y0, lz, w, h, d, c = tint()) => B.add('castleStone', BOX, M4(E(lx), y0 + h / 2, CZ + lz, w, h, d), c, { tile: 7 });
  const roof = (lx, y0, lz, len, wid, h, c = SLATE) => B.add('castleStone', ROOF, M4(E(lx), y0, CZ + lz, wid, h, len, Math.PI / 2), c, { tile: 7 });
  // stepped battlements: a wall with merlons along x
  const wall = (lx0, lx1, lz, y0, top, thick = 1.6, merlons = true) => {
    const w = Math.abs(lx1 - lx0), mid = (lx0 + lx1) / 2, c = tint();
    box(mid, y0, lz, w, top - y0, thick, c);
    if (merlons) for (let x = Math.min(lx0, lx1) + 1; x < Math.max(lx0, lx1) - 0.6; x += 2.6) box(x, top, lz, 1.3, 1.2, thick, c);
  };
  const strip = () => {}; // v2.8: window bands replaced by painted elevations (face)
  const QUAD = new THREE.PlaneGeometry(1, 1);
  const face = (lx, y0, lzFront, w, h, kind, ry = Math.PI) => B.add('castleFace', QUAD, M4(E(lx), y0 + h / 2, CZ + lzFront - 0.06, w, h, 1, ry), 0xffffff, { uvRect: CASTLE_UV[kind] });
  const chims = (lx0, lx1, y0, lz, n) => { for (let i = 0; i < n; i++) { const x = lx0 + (lx1 - lx0) * (i + 0.5) / n, h = 2.2 + rand() * 1.6; box(x, y0, lz, 1.4, h, 2.2, tint()); for (let k = -1; k < 2; k++) B.add('castleStone', new THREE.CylinderGeometry(0.16, 0.2, 0.6, 5), M4(E(x), y0 + h + 0.3, CZ + lz + k * 0.6, 1, 1, 1), 0xa0583a, {}); } }; // chimney clusters

  // ---- Castle Rock: faceted heightfield, dark basalt cliffs with green scrub on the gentler slopes ----
  const T = [[-110, 18], [-92, 28], [-58, 33], [-44, 36], [-32, 44], [20, 44], [27, 38], [64, 37], [78, 26], [90, 6], [100, -6]];
  const top = (lx) => { for (let i = 1; i < T.length; i++) if (lx <= T[i][0]) { const [a, ya] = T[i - 1], [b, yb] = T[i]; const t = THREE.MathUtils.smoothstep(lx, a, b); return ya + (yb - ya) * t; } return -6; };
  const BASE = -6, W = 34, LX0 = opt.lx0 ?? -110, LX1 = opt.lx1 ?? 100, RUG = opt.rug ?? 1, NX = Math.round((LX1 - LX0) / (RUG > 1 ? 3 : 4)), NZ = RUG > 1 ? 26 : 18;
  const hgt = (lx, lz) => {
    const t = Math.abs(lz) / W, tp = top(lx);
    let s = 1; if (t > 0.56) s = 1 - Math.pow(Math.min(1, (t - 0.56) / 0.44), RUG > 1 ? 0.32 : 0.55); // sharp cliff edge, scree below
    if (RUG > 1) s *= THREE.MathUtils.smoothstep(lx, LX0, LX0 + 22) * THREE.MathUtils.smoothstep(-lx, -LX1, -LX1 + 22); // narrower rock: falls away at the ends
    let crag = Math.sin(lx * 0.37 + lz * 0.21) * Math.sin(lz * 0.53 - lx * 0.13) * 2.6 + Math.sin(lx * 1.1) * 0.9;
    if (RUG > 1) crag = crag * RUG + Math.sin(lx * 2.3 + lz * 1.7) * 1.4 + (Math.sin(lx * 0.8) > 0.3 ? -2.2 : 0); // broken dolerite: buttresses, gullies, ledges
    const yy = BASE + (tp + UP - BASE) * s + crag * (s < 0.995 ? 1 : 0.12) * Math.min(1, (tp + UP - BASE) / 20);
    return RUG > 1 && s < 0.97 ? THREE.MathUtils.lerp(yy, Math.round(yy / 5) * 5, 0.35) : yy; // stepped ledges
  };
  if (opt.crag) buildCrag(); else {
  const g = new THREE.PlaneGeometry(LX1 - LX0, 2 * W, NX, NZ); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i) + (LX0 + LX1) / 2, lz = p.getZ(i);
    const jx = (rand() - 0.5) * 2.2 * RUG, jz = (rand() - 0.5) * 2.2 * RUG; // break the grid
    p.setXYZ(i, E(lx + jx), hgt(lx + jx, lz + jz), CZ + lz + jz);
  }
  const rock = g.toNonIndexed(); rock.computeVertexNormals(); // flat facets
  const ROCK = WARM ? [0x4c4a47, 0x5b5853, 0x68645d, 0x403e3c, 0x736d64].map((c) => new THREE.Color(c)) : RUG > 1 ? [0x2a2928, 0x3a3734, 0x4a453f, 0x232322, 0x55504a].map((c) => new THREE.Color(c)) : [new THREE.Color(0x2c2c2d), new THREE.Color(0x38373a), new THREE.Color(0x45423f), new THREE.Color(0x242426)];
  const SCRUB = [new THREE.Color(0x3f5a2c), new THREE.Color(0x4d6b31), new THREE.Color(0x344a26)];
  const triCol = []; const tc = new THREE.Color();
  B.add('castleRock', rock, null, 0xffffff, { vcol: (i, x, y, z, nx, ny) => {
    const tri = Math.floor(i / 3); if (!triCol[tri]) {
      const r = rand();
      if (ny > 0.82 && y > 20 + UP) tc.copy(SCRUB[Math.floor(r * 3)]).lerp(ROCK[1], 0.25);
      else if (ny > (WARM ? 0.5 : 0.62) || (ny > 0.3 && r < (WARM ? 0.4 : 0.22))) tc.copy(r < 0.6 ? SCRUB[Math.floor(r * 5) % 3] : ROCK[2]);
      else if (WARM && y > UP && Math.floor(y / 3.5) % 3 === 0 && r < 0.55) tc.copy(SCRUB[Math.floor(r * 5) % 3]).lerp(ROCK[2], 0.3); // ledges of scrub break the vertical stripes
      else tc.copy(ROCK[Math.floor(r * ROCK.length)]);
      if (y < (WARM ? 30 + UP * 0.5 : 6)) tc.lerp(SCRUB[2], WARM ? 0.55 : 0.45); // trees / gardens at the foot
      triCol[tri] = tc.clone();
    }
    return triCol[tri];
  } });
  }
  // v3.4: a rough, irregular volcanic crag (Grassmarket). Value-noise heightfield with a noisy cliff edge, stepped ledges and
  // gullies, coloured by slope (dark basalt on the faces, scrub and grass on the ledges, trees at the foot), plus big faceted
  // buttress boulders bolted onto the south face to break up the silhouette. One draw call ('castleRock'), ~10k triangles.
  function buildCrag() {
    const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(xi, yi), hash(xi + 1, yi), u), THREE.MathUtils.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v) * 2 - 1; };
    const fbm = (x, y) => vn(x, y) * 0.6 + vn(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + vn(x * 4.3 + 1, y * 4.3 + 3) * 0.15;
    const cliff = (lx, lz) => { // 0 at the summit plateau .. 1 at the foot
      const edge = W * (1.3 + 0.25 * fbm(lx * 0.035, 3.1)), plat = W * (0.42 + 0.06 * fbm(lx * 0.05, 7.7)), d = Math.abs(lz);
      return THREE.MathUtils.clamp((d - plat) / (edge - plat), 0, 1); };
    const hgt2 = (lx, lz) => { const tp = top(lx) + UP, t = cliff(lx, lz);
      let s = 1 - Math.pow(t, 0.75); // steep at the top, easing to scree at the bottom
      s = THREE.MathUtils.lerp(s, Math.round(s * 7) / 7, 0.55); // ledges
      const ends = THREE.MathUtils.smoothstep(lx, LX0, LX0 + 26) * THREE.MathUtils.smoothstep(-lx, -LX1, -LX1 + 26); s *= ends;
      const n = fbm(lx * 0.09, lz * 0.09) * 5 + fbm(lx * 0.23 + 4, lz * 0.23) * 2.2, gully = Math.max(0, vn(lx * 0.06 + 11, 2) - 0.35) * 9;
      return BASE + (tp - BASE) * s + (t > 0.02 ? n - gully * (1 - t) : n * 0.15); };
    const NXc = Math.round((LX1 - LX0) / 3.2), NZc = 40, g2 = new THREE.PlaneGeometry(LX1 - LX0, 3.4 * W, NXc, NZc); g2.rotateX(-Math.PI / 2);
    const p2 = g2.attributes.position;
    for (let i = 0; i < p2.count; i++) { const lx = p2.getX(i) + (LX0 + LX1) / 2 + (rand() - 0.5) * 2.4, lz = p2.getZ(i) + (rand() - 0.5) * 2.4; p2.setXYZ(i, E(lx), hgt2(lx, lz), CZ + lz); }
    const rk = g2.toNonIndexed(); rk.computeVertexNormals();
    const BAS = [0x26282a, 0x303235, 0x3a3c3f, 0x46474b, 0x1e1f21].map((c) => new THREE.Color(c)), GRN = [0x3f5a2c, 0x4d6b31, 0x5a7838, 0x344a26].map((c) => new THREE.Color(c)), tcol = [], c2 = new THREE.Color();
    B.add('castleRock', rk, null, 0xffffff, { vcol: (i, x, y, z, nx, ny) => { const tri = Math.floor(i / 3); if (!tcol[tri]) {
      const sh = (fbm(x * 0.05, y * 0.11) + 1) / 2, r = rand();
      if (y < 12 + UP * 0.35) c2.copy(GRN[Math.floor(r * 4)]).lerp(BAS[2], 0.15); // wooded/grassy foot
      else if (ny > 0.62) c2.copy(GRN[Math.floor(r * 4)]).lerp(BAS[3], 0.3); // grassy ledges
      else if (ny > 0.5 && r < 0.45) c2.copy(GRN[3]).lerp(BAS[2], 0.45);
      else c2.copy(BAS[Math.min(4, Math.floor(sh * 4.2))]).lerp(BAS[3], r * 0.25); // basalt, shaded in irregular patches
      tcol[tri] = c2.clone(); } return tcol[tri]; } });
    // buttress boulders on the south face
    const bould = [0, 1, 2].map((k) => { const gg = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), pp = gg.attributes.position, J = {};
      for (let i = 0; i < pp.count; i++) { const key = pp.getX(i).toFixed(3) + pp.getY(i).toFixed(3) + pp.getZ(i).toFixed(3), j = (J[key] ||= 0.75 + hash(i % 97 + k * 13, k) * 0.45); pp.setXYZ(i, pp.getX(i) * j, pp.getY(i) * j, pp.getZ(i) * j); }
      gg.computeVertexNormals(); return gg; });
    for (let i = 0; i < 34; i++) { const lx = LX0 + 22 + rand() * (LX1 - LX0 - 44), t = 0.25 + rand() * 0.55, edge = W * (1.3 + 0.25 * fbm(lx * 0.035, 3.1)), plat = W * 0.42, lz = -(plat + t * (edge - plat)), y = hgt2(lx, lz), r = 4 + rand() * 5;
      B.add('castleRock', bould[i % 3], new THREE.Matrix4().compose(V(E(lx), y - r * 0.2, CZ + lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3)), V(r * (0.8 + rand() * 0.6), r * (1.1 + rand() * 0.8), r * 0.8)), 0xffffff, { vcol: ((c) => () => c)(BAS[Math.floor(rand() * 5)]) }); }
    // trees and scrub on the lower slopes
    const TREE = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 70; i++) { const lx = LX0 + 16 + rand() * (LX1 - LX0 - 32), t = 0.8 + rand() * 0.25, edge = W * (1.3 + 0.25 * fbm(lx * 0.035, 3.1)), lz = -edge * (0.55 + t * 0.45), y = hgt2(lx, lz), r = 2.2 + rand() * 2.4;
      B.add('castleRock', TREE, new THREE.Matrix4().compose(V(E(lx), y + r * 0.6, CZ + lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand() * 3, 0)), V(r, r * 1.2, r)), 0xffffff, { vcol: ((c) => () => c)(GRN[Math.floor(rand() * 4)]) }); }
  }

  // ---- West: New Barracks (big, plain, angular, lower terrace) + hospital block ----
  box(37, 34, -13, 30, 18, 11); face(37, 34, -18.5, 30, 18, 'barracks'); face(22, 34, -13, 11, 18, 'plain', -Math.PI / 2);
  box(37, 52, -13, 30.6, 0.8, 11.6, 0xa89a80); // flat roof parapet
  box(55, 36, -2, 16, 9, 11); roof(55, 45, -2, 16, 11, 4); face(55, 36, -7.5, 16, 9, 'barracks'); chims(50, 60, 46, -2, 2);
  box(14, 44, 2, 16, 10, 12); roof(14, 54, 2, 16, 12, 5); face(14, 44, -4, 16, 10, 'hall'); chims(8, 20, 55, 2, 2);
  // ---- Crown Square: Great Hall on the south cliff edge, Palace with tower (SE), War Memorial (N) ----
  box(-4, 44, -12, 28, 9, 9); roof(-4, 53, -12, 28, 9.2, 6.5, 0x575a60); face(-4, 44, -16.5, 28, 9, 'hall');
  box(-22, 44, -7, 17, 17, 14); roof(-22, 61, -7, 17, 14.2, 4); if (WARM) wall(-30, -14, -14.2, 60, 61.2, 0.8); face(-22, 44, -14, 17, 17, 'palace'); face(-30.5, 44, -7, 14, 17, 'palace', -Math.PI / 2); chims(-29, -15, 62, -7, 4); // the Palace: bigger bulk, chimney clusters
  box(-22, 30, -12, 19, 14, 6); face(-22, 30, -15, 19, 14, 'plain'); // its rubble substructure down to the rock
  box(-6, 44, 7, 24, 12, 11); roof(-6, 56, 7, 24, 11.2, 5);
  // Palace tower (the clock tower) with corner turrets and a small cap
  box(-29.5, 44, -13.5, 5.5, 24, 5.5); face(-29.5, 44, -16.25, 5.5, 24, 'tower'); box(-29.5, 68, -13.5, 6.3, 1.2, 6.3);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.add('castleStone', new THREE.CylinderGeometry(0.75, 0.75, 3, 6), M4(E(-29.5 + dx * 2.9), 70, CZ - 13.5 + dz * 2.9, 1, 1, 1), tint(), {});
    B.add('castleStone', new THREE.ConeGeometry(0.95, 1.8, 6), M4(E(-29.5 + dx * 2.9), 72.4, CZ - 13.5 + dz * 2.9, 1, 1, 1), SLATE, {});
  }
  B.add('castleStone', new THREE.ConeGeometry(3.3, 4.5, 4), M4(E(-29.5), 71.4, CZ - 13.5, 1, 1, 1, Math.PI / 4), SLATE, {});
  // ---- East: Half Moon Battery (the big low curved drum), forewall, gatehouse, Esplanade ----
  const HM = WARM ? 4 : 0; // v3.3: the Half Moon Battery stands taller over the crag, with a parapet of merlons
  B.add('castleStone', new THREE.CylinderGeometry(12, 12.6, 15 + HM * 2, 20, 1, false, Math.PI * 0.05, Math.PI * 1.25), M4(E(-38), 29 + HM, CZ - 4, 1, 1, 1, Math.PI * 0.62), tint(), { tile: 7 });
  B.add('castleStone', new THREE.CylinderGeometry(12.4, 12.4, 1.4, 20, 1, false, Math.PI * 0.05, Math.PI * 1.25), M4(E(-38), 37.2 + HM * 2, CZ - 4, 1, 1, 1, Math.PI * 0.62), 0xb2a284, {});
  if (WARM) for (let k = 0; k < 14; k++) { const a = Math.PI * 0.62 + Math.PI * 0.05 + (k + 0.5) / 14 * Math.PI * 1.25; B.add('castleStone', BOX, M4(E(-38) + Math.sin(a) * 12.3, 38.6 + HM * 2, CZ - 4 + Math.cos(a) * 12.3, 1.4, 1.3, 1.2, a), tint(), {}); }
  box(-38, 26, 2, 16, 11, 14); // drum core (fills the open side)
  wall(-46, -52, -6, 30, 37.5, 2.5);
  box(-52, 32, 0, 9, 11, 9); face(-52, 32, -4.5, 9, 11, 'plain'); // gatehouse
  for (const s of [-1, 1]) { B.add('castleStone', new THREE.CylinderGeometry(1.3, 1.3, 13, 8), M4(E(-56.5), 38.5, CZ + s * 4.3, 1, 1, 1), tint(), {}); B.add('castleStone', new THREE.ConeGeometry(1.6, 2.6, 8), M4(E(-56.5), 46.3, CZ + s * 4.3, 1, 1, 1), SLATE, {}); }
  box(-74, 30, 0, 34, 3.2, 24, 0xa59a86); // Esplanade platform
  wall(-57, -91, -12.4, 33.2, 34.4, 0.8, false); wall(-57, -91, 12.4, 33.2, 34.4, 0.8, false);
  // ---- curtain walls along the south cliff, stepping down west to east ----
  wall(-30, -16, -18.4, 40, 45.6); wall(-16, 9, -17.6, 40, 44.6); wall(9, 22, -18, 38, 44.2);
  wall(22, 52, -19.6, 32, 35.4); wall(52, 66, -10, 33, 38.4); wall(66, 74, -4, 26, 37.4);
  wall(-30, -36, -15, 37, 44); // step down to the Half Moon
  // ---- flagpole + Saltire on the Palace tower ----
  B.add('castleRock', new THREE.CylinderGeometry(0.12, 0.16, 9, 5), M4(E(-29.5), 78, CZ - 13.5, 1, 1, 1), 0xd8d8d8, {});
  const fx = E(-29.5) - 2.2, fy = 81.2, fz = CZ - 13.5;
  for (const side of [0, Math.PI]) {
    B.add('castleRock', new THREE.PlaneGeometry(4, 2.6), M4(fx, fy, fz, 1, 1, 1, side), 0x1f4fa8, {});
    for (const a of [Math.atan2(2.6, 4), -Math.atan2(2.6, 4)]) B.add('castleRock', new THREE.PlaneGeometry(4.6, 0.42), M4(fx, fy, fz, 1, 1, 1, side, 0, side ? -a : a).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.03)), 0xf2f2f2, {});
  }
}
