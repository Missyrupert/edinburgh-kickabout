// Level data: the Grassmarket (v2.6: reworked as the real wide market square below the Castle).
import { buildSquare, GM } from './grassmarket-square.js';
// what's under foot / under the ball
export function surfaceAt(x, z) {
  if (x < -52 && z > GM.FRONT) return 'setts'; // Victoria Street climb
  if (z < -GM.FRONT - 0.5) return x > 29 && x < 31 && z > -GM.FRONT - GM.DEPTH ? 'setts' : (Math.hypot(x - 22.5, z + 41) < 2.2 ? 'grass' : 'paving'); // the close / back court
  const az = Math.abs(z);
  if (az < GM.SQ) return Math.hypot(x + 50, z + 2) < 2 ? 'paving' : 'setts';
  if (az < GM.ROAD) return 'tarmac';
  return 'paving';
}
export default {
  id: 'grassmarket', name: 'The Grassmarket', short: 'Grassmarket', surfaceAt,
  sounds: { oldtown: true, birds: [[-42, -11], [-46, 10], [45, -11], [54, 9], [12, 12]], gulls: [[0, 120], [-40, 60]], far: [[-80, 40], [80, 0], [0, -70], [-30, 60], [40, -50]], roadX: 95 },
  blurb: 'Level 7: the Grassmarket, the old market square under the Castle. 11 targets round the square, the close and the back court.',
  intro: "Welcome tae the Grassmarket!<br><small>Ba' at your feet. Look up: that's the Castle. Easy first one: the traffic cone just ahead.</small>",
  build: buildSquare,
  tiers: { bench: 'easy', cone: 'easy', lamp: 'easy', door: 'easy', post: 'easy', tardis: 'easy', bin: 'tricky', close: 'tricky', dug: 'tricky', case: 'tricky', skip: 'tricky' },
  spawn: [3, 0.5, -10], spawnYaw: 180,
  ballHomes: () => [[3.3, 0.4, -7.6], [30, 0.4, -38], [-2, 0.4, 0]],
  bounds: { x: 66, zMin: -52, zMax: 34 },
  next: 'pennywell',
};
