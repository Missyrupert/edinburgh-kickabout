// Level data: the Grassmarket -> Victoria Street (the original v1-v1.3 level, unchanged).
import * as THREE from 'three';
import { buildWorld, NORTH, BEND } from '../world.js';
// v2.5: what's under foot / under the ball. Road = granite setts, pavements = flagstones, back court = flags, the close = setts.
const INV = NORTH.clone().invert(), tmp = new THREE.Vector3();
export function surfaceAt(x, z) {
  if (z > BEND.pivotZ) { tmp.set(x, 0, z).applyMatrix4(INV); x = tmp.x; z = tmp.z; if (Math.abs(x) < 4.6) return 'setts'; return 'paving'; } // Victoria Street side
  if (Math.abs(x - 2.6) < 1.2 && Math.abs(z - 25.6) < 1.2) return 'paving'; // memorial top
  if (x < -14 && x > -24 && z > -18 && z < 0) return Math.hypot(x + 22.5, z + 2.5) < 2.2 ? 'grass' : 'paving'; // back court, grass round the tree
  if (x <= -7 && x > -14 && Math.abs(z + 9.25) < 0.8) return 'setts'; // the close
  if (Math.abs(x) < 4.6) return 'setts';
  return 'paving';
}
export default {
  id: 'grassmarket', surfaceAt,
  sounds: { oldtown: true, birds: [[-22.5, -2.5], [0, 40]], gulls: [[0, 120], [-40, 60]], far: [[-40, -20], [40, 10], [0, -70], [-30, 50], [30, -40]], roadX: 60 }, name: 'The Grassmarket', short: 'Grassmarket',
  blurb: "A wee kickabout in the Old Town. 11 targets hidden around the street, the close and up the hill.",
  intro: "Welcome tae the Grassmarket!<br><small>There's a ba' at your feet. Try the green bin up on the left.</small>",
  build: buildWorld,
  tiers: { bench: 'easy', cone: 'easy', lamp: 'easy', door: 'easy', post: 'easy', tardis: 'easy', bin: 'tricky', close: 'tricky', dug: 'tricky', case: 'tricky', skip: 'tricky' },
  spawn: [0, 0.5, -36], spawnYaw: 180,
  ballHomes: (views) => [[0.3, 0.4, -33.6], [-19, 0.4, -6], [views.terrace[0] - 1.5, 4.0, views.terrace[1] + 2]],
  bounds: { x: 45, zMin: -60, zMax: 80 },
  next: 'pilton',
};
