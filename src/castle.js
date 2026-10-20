import * as THREE from 'three';
import { roofPrism } from './batch.js';

// Edinburgh Castle as a distant backdrop, as seen from the Grassmarket (looking north at the south face).
// Proportions follow the real south elevation: a crag-and-tail rock (steep cliffs W/S, tail running
// east to the Esplanade), New Barracks low on the west, Crown Square (Great Hall on the cliff edge,
// Palace + tower, War Memorial behind), the Half Moon Battery drum and the gatehouse/Esplanade to the east.
// In this world +x is west (screen-left when facing the castle) and east is -x.
// Everything goes into two batches: 'castleRock' (vertex-coloured, flags too) and 'castleStone' (sandstone).
export function buildCastle(B, CX, CZ, rand) {
  const E = (lx) => CX + 16 + lx; // lx: local x; +lx = west (screen-left), -lx = east (screen-right)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = 30; // v2.5: lifted so the Castle dominates the view up the street // lift: the rock should dominate, as from the Grassmarket
  const M4 = (x, y0, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(V(x, y0 + UP, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(sx, sy, sz));
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const STONE = [0xe2c393, 0xd8b787, 0xcdac7e, 0xe6c99c], SLATE = 0x5c6066, DARK = 0x6e6252;
  const tint = () => STONE[Math.floor(rand() * STONE.length)];
  const box = (lx, y0, lz, w, h, d, c = tint()) => B.add('castleStone', BOX, M4(E(lx), y0 + h / 2, CZ + lz, w, h, d), c, { tile: 7 });
  const roof = (lx, y0, lz, len, wid, h, c = SLATE) => B.add('castleStone', ROOF, M4(E(lx), y0, CZ + lz, wid, h, len, Math.PI / 2), c, { tile: 7 });
  // stepped battlements: a wall with merlons along x
  const wall = (lx0, lx1, lz, y0, top, thick = 1.6, merlons = true) => {
    const w = Math.abs(lx1 - lx0), mid = (lx0 + lx1) / 2, c = tint();
    box(mid, y0, lz, w, top - y0, thick, c);
    if (merlons) for (let x = Math.min(lx0, lx1) + 1; x < Math.max(lx0, lx1) - 0.6; x += 2.6) box(x, top, lz, 1.3, 1.2, thick, c);
  };
  const strip = (lx, y, lz, w) => box(lx, y, lz - 0.08, w, 0.9, 0.2, DARK); // window band (reads as windows at distance)

  // ---- Castle Rock: faceted heightfield, dark basalt cliffs with green scrub on the gentler slopes ----
  const T = [[-110, 18], [-92, 28], [-58, 33], [-44, 36], [-32, 44], [20, 44], [27, 38], [64, 37], [78, 26], [90, 6], [100, -6]];
  const top = (lx) => { for (let i = 1; i < T.length; i++) if (lx <= T[i][0]) { const [a, ya] = T[i - 1], [b, yb] = T[i]; const t = THREE.MathUtils.smoothstep(lx, a, b); return ya + (yb - ya) * t; } return -6; };
  const BASE = -6, W = 34, NX = 52, NZ = 18, LX0 = -110, LX1 = 100;
  const hgt = (lx, lz) => {
    const t = Math.abs(lz) / W, tp = top(lx);
    let s = 1; if (t > 0.56) s = 1 - Math.pow(Math.min(1, (t - 0.56) / 0.44), 0.55); // sharp cliff edge, scree below
    const crag = Math.sin(lx * 0.37 + lz * 0.21) * Math.sin(lz * 0.53 - lx * 0.13) * 2.6 + Math.sin(lx * 1.1) * 0.9;
    return BASE + (tp + UP - BASE) * s + crag * (s < 0.995 ? 1 : 0.12) * Math.min(1, (tp + UP - BASE) / 20);
  };
  const g = new THREE.PlaneGeometry(LX1 - LX0, 2 * W, NX, NZ); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i) + (LX0 + LX1) / 2, lz = p.getZ(i);
    const jx = (rand() - 0.5) * 2.2, jz = (rand() - 0.5) * 2.2; // break the grid
    p.setXYZ(i, E(lx + jx), hgt(lx + jx, lz + jz), CZ + lz + jz);
  }
  const rock = g.toNonIndexed(); rock.computeVertexNormals(); // flat facets
  const ROCK = [new THREE.Color(0x2c2c2d), new THREE.Color(0x38373a), new THREE.Color(0x45423f), new THREE.Color(0x242426)];
  const SCRUB = [new THREE.Color(0x3f5a2c), new THREE.Color(0x4d6b31), new THREE.Color(0x344a26)];
  const triCol = []; const tc = new THREE.Color();
  B.add('castleRock', rock, null, 0xffffff, { vcol: (i, x, y, z, nx, ny) => {
    const tri = Math.floor(i / 3); if (!triCol[tri]) {
      const r = rand();
      if (ny > 0.82 && y > 20 + UP) tc.copy(SCRUB[Math.floor(r * 3)]).lerp(ROCK[1], 0.25);
      else if (ny > 0.62 || (ny > 0.38 && r < 0.22)) tc.copy(r < 0.6 ? SCRUB[Math.floor(r * 5) % 3] : ROCK[2]);
      else tc.copy(ROCK[Math.floor(r * 4)]);
      if (y < 6) tc.lerp(SCRUB[2], 0.45); // trees / gardens at the foot
      triCol[tri] = tc.clone();
    }
    return triCol[tri];
  } });

  // ---- West: New Barracks (big, plain, angular, lower terrace) + hospital block ----
  box(37, 34, -13, 30, 18, 11); for (const y of [38, 42, 46, 50]) strip(37, y, -18.5, 27);
  box(37, 52, -13, 30.6, 0.8, 11.6, 0xa89a80); // flat roof parapet
  box(55, 36, -2, 16, 9, 11); roof(55, 45, -2, 16, 11, 4);
  box(14, 44, 2, 16, 10, 12); roof(14, 54, 2, 16, 12, 5); strip(14, 47, -4, 13);
  // ---- Crown Square: Great Hall on the south cliff edge, Palace with tower (SE), War Memorial (N) ----
  box(-4, 44, -12, 28, 9, 9); roof(-4, 53, -12, 28, 9.2, 6.5, 0x575a60); strip(-4, 47, -16.5, 24);
  box(-22, 44, -7, 15, 13, 14); roof(-22, 57, -7, 15, 14.2, 5); strip(-22, 48, -14, 12); strip(-22, 52, -14, 12);
  box(-6, 44, 7, 24, 12, 11); roof(-6, 56, 7, 24, 11.2, 5);
  // Palace tower (the clock tower) with corner turrets and a small cap
  box(-29.5, 44, -13.5, 5.5, 24, 5.5); box(-29.5, 68, -13.5, 6.3, 1.2, 6.3);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    B.add('castleStone', new THREE.CylinderGeometry(0.75, 0.75, 3, 6), M4(E(-29.5 + dx * 2.9), 70, CZ - 13.5 + dz * 2.9, 1, 1, 1), tint(), {});
    B.add('castleStone', new THREE.ConeGeometry(0.95, 1.8, 6), M4(E(-29.5 + dx * 2.9), 72.4, CZ - 13.5 + dz * 2.9, 1, 1, 1), SLATE, {});
  }
  B.add('castleStone', new THREE.ConeGeometry(3.3, 4.5, 4), M4(E(-29.5), 71.4, CZ - 13.5, 1, 1, 1, Math.PI / 4), SLATE, {});
  // ---- East: Half Moon Battery (the big low curved drum), forewall, gatehouse, Esplanade ----
  B.add('castleStone', new THREE.CylinderGeometry(12, 12.6, 15, 20, 1, false, Math.PI * 0.05, Math.PI * 1.25), M4(E(-38), 29, CZ - 4, 1, 1, 1, Math.PI * 0.62), tint(), { tile: 7 });
  B.add('castleStone', new THREE.CylinderGeometry(12.4, 12.4, 1.4, 20, 1, false, Math.PI * 0.05, Math.PI * 1.25), M4(E(-38), 37.2, CZ - 4, 1, 1, 1, Math.PI * 0.62), 0xb2a284, {});
  box(-38, 26, 2, 16, 11, 14); // drum core (fills the open side)
  wall(-46, -52, -6, 30, 37.5, 2.5);
  box(-52, 32, 0, 9, 11, 9); // gatehouse
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
