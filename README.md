# Edinburgh Kickabout

First-person football kickabout on a stylised Old Town street (Grassmarket -> Victoria Street slope -> terrace with Castle view).
Three.js + cannon-es, built with Vite. No backend, no paid assets: all textures and sounds are generated in code.

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN IP for the phone)
npm run build      # static build in dist/
npm run preview    # serve dist/ on :5173
npm run verify     # headless Chrome test (needs /usr/bin/google-chrome or CHROME=path)
```

## Controls
Desktop: WASD walk, Shift run, Space jump, mouse look, hold+release left click (or E) to kick, aim up to chip it, R fetches the nearest ball, Esc pauses.
Touch: left joystick (push far to run), drag the right side to look, hold+release KICK, JUMP, BALL (fetch), II (pause).

## Targets (11, 1,100 pts)
Communal bin (get it in) 150 · Memorial bench 50 · Traffic cone (knock over) 75 · Lamppost with blue ribbon 100 ·
Kicker's Close (kick it through the pend) 125 · Wee Dug statue (back court, through the close) 125 · Bakery door 75 ·
Pillar box 75 · Busker's case (roll it in) 100 · Police box (terrace) 75 · Builders' skip (terrace, chip it in) 150.
Three balls: at spawn, in the back court, on the terrace.

## Layout
```
src/main.js      renderer, player, balls, kicking, scoring, HUD, game loop, window.__game test hooks
src/world.js     street geometry, physics colliders, targets, skyline/Castle, pigeons
src/controls.js  keyboard/mouse + pointer lock, touch joystick/look/buttons
src/audio.js     procedural WebAudio (kick, bounces, clang, success, wind, traffic, gulls, pigeons)
src/textures.js  canvas textures (sandstone tenement, cobbles, flagstones, ball, signs, door)
scripts/verify.mjs  headless Playwright checks + screenshots
```
