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

## Visuals (v1.1)
CC0 Poly Haven photo PBR textures (colour + normal + roughness, 1K JPEG) and a 1K CC0 HDRI for sky and reflections,
ACES tone mapping, warm low sun + hemisphere fill, distance haze. Phones: shadows off, pixel ratio capped at 1.5.
See CREDITS.md for licences.

## Graphics presets & performance (v1.2)
- Presets: **low** (Lambert, 512px textures, no shadows, 1.0x pixel ratio), **medium** (Lambert + normal maps, 1K, 1.5x), **high** (PBR + HDRI environment, 2K shadow map, AA, 2x).
- Auto-pick: desktop -> high; phone/tablet -> medium if `deviceMemory >= 6` and `>= 8` cores, else low. Change it in the pause menu (saved on the device).
- Dynamic resolution: render scale drops 10% when frames average > 22 ms, recovers 5% after 3 s under 14 ms (floor 0.5 / 0.6 / 0.7).
- Static world is merged per material (about 15-30 draw calls instead of 420-660); facades and signs come from two atlases; grime is baked into vertex colours.
- Physics: fixed 1/120 s steps with interpolation, so results don't depend on frame rate.
- Textures are WebP. KTX2/Basis was not used because there's no encoder in the toolchain.

### URL switches
| URL | Effect |
|---|---|
| `?perf=1` | perf overlay: FPS, frame ms, draws, triangles, textures (+MB estimate), geometries, programs, render resolution |
| `?preset=low` / `medium` / `high` | force a preset (also saved) |
| `?preset=auto` | clear the saved choice |
| `?dynres=0` | disable dynamic resolution |
| `P` key | toggle the perf overlay |

### Testing on your phone (Pixel)
1. Open `https://missyrupert.github.io/edinburgh-kickabout/?perf=1` in Chrome, in landscape.
2. Play for about 1 minute: walk up to the terrace, kick a few balls.
3. Try again with `?perf=1&preset=low`, then `?perf=1&preset=high`.

**What to report** for each preset:
- Phone model.
- Typical FPS and frame ms from the overlay.
- The `x` render scale it settles at.
- Whether it stutters (when, and where).
- Whether the phone gets hot.
- Any control problems: joystick, look drag, kick charge, BALL button.

## Verify / profile
- `npm run build && npm run verify`: headless checks.
- `node scripts/profile.mjs dist <label> [?query]`: same views and same profile, saved to `perf/<label>.json`.
- `node scripts/shots.mjs`: extra screenshots.

## Deploy
`./scripts/deploy.sh` builds and force-pushes dist/ to the gh-pages branch -> https://missyrupert.github.io/edinburgh-kickabout/
