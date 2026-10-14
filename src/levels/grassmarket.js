// Level data: the Grassmarket -> Victoria Street (the original v1-v1.3 level, unchanged).
import { buildWorld } from '../world.js';
export default {
  id: 'grassmarket', name: 'The Grassmarket', short: 'Grassmarket',
  blurb: "A wee kickabout in the Old Town. 11 targets hidden around the street, the close and up the hill.",
  intro: "Welcome tae the Grassmarket!<br><small>There's a ba' at your feet. Try the green bin up on the right.</small>",
  build: buildWorld,
  spawn: [0, 0.5, -36], spawnYaw: 180,
  ballHomes: (views) => [[0.3, 0.4, -33.6], [-19, 0.4, -6], [views.terrace[0] - 1.5, 4.0, views.terrace[1] + 2]],
  bounds: { x: 45, zMin: -60, zMax: 80 },
  next: 'pilton',
};
