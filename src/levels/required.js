// v3.9.2: explicit list of the ordinary targets each street needs for "finished" (optional challenges like Pilton's c_* excluded).
// Keep in step with each level's build(); smoke39 checks these match the live target IDs.
export const REQUIRED = {
  pilton: ['garage', 'trolley', 'busstop', 'lamp', 'bin', 'gap', 'wheelie', 'noballs'],
  pennywell: ['oldpump', 'newsboard', 'porkshop', 'bookies', 'mexicanito', 'canopy', 'busstop', 'kirknotice', 'stpaulsgate', 'schoolgate'],
  granton: ['square', 'gasframe', 'purge', 'bollard', 'lifebuoy', 'hmdoor', 'buoy', 'hatch', 'creel', 'dinghy'],
  newhaven: ['fishdoor', 'lighthouse', 'piergate', 'planter', 'tideboard', 'fishboxes', 'rowboat', 'bell', 'landing', 'stairdoor'],
  leith: ['bridgelamp', 'bridgetop', 'pubdoor', 'shipwheel', 'aboard', 'maltloft', 'barrel', 'policebox', 'bollard', 'timberbush'],
  portobello: ['groyne', 'bathsdoor', 'bin', 'kiosk', 'lifebuoy', 'notices', 'sandcastle', 'windbreak', 'bucket', 'menuboard'],
  easterroad: ['crossbar', 'turnstile', 'fanzine', 'programmes', 'pubdoor', 'chippy', 'newsagent', 'stairdoor', 'busstop', 'stewards'],
  londonroad: ['pubdoor', 'newsagent', 'cafe', 'stairdoor', 'churchboard', 'shelter', 'postbox', 'gatesign', 'braegoal', 'bench'],
  grassmarket: ['bin', 'bench', 'cone', 'lamp', 'close', 'dug', 'door', 'post', 'case', 'tardis', 'skip'],
  royalmile: ['closedown', 'kirkdoor', 'heart', 'mercat', 'busker', 'tartansign', 'windowbox', 'tourboard', 'fudgedoor', 'whiskydoor'],
  esplanade: ['niche', 'sentry', 'banner', 'seats', 'infoboard', 'cannon', 'memorial', 'statue', 'drum', 'crown'],
};
export const streetsLeft = (done, except) => Object.keys(REQUIRED).filter((id) => id !== except && !REQUIRED[id].every((k) => (done(id) || {})[k]));
