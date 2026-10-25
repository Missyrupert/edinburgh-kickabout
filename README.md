# Edinburgh Kickabout (v3.9.2)

A first-person street-football game set in 11 Edinburgh streets. It's built for phones, and works on desktop too.
It uses three.js and cannon-es, built with Vite. It's a static site with no backend, accounts, analytics or ads.

Live: https://missyrupert.github.io/edinburgh-kickabout/

## Levels
Every level is open from the menu. The numbers are a suggested order, not a lock.

| # | Level | URL param |
|---|---|---|
| 01 | Pennywell | `?level=pennywell` |
| 02 | West Pilton | `?level=pilton` |
| 03 | Granton | `?level=granton` |
| 04 | Newhaven | `?level=newhaven` |
| 05 | Leith | `?level=leith` |
| 06 | Easter Road | `?level=easterroad` |
| 07 | Portobello | `?level=portobello` |
| 08 | London Road | `?level=londonroad` |
| 09 | Grassmarket | `?level=grassmarket` |
| 10 | Royal Mile | `?level=royalmile` |
| 11 | Castle Esplanade (finale) | `?level=esplanade` |

- Most streets have 10 targets (the Grassmarket has 11). West Pilton has 8 ordinary targets plus 3 optional challenges. In the scripted playtests each target took between 1 and 6 kicks; that's a test result, not a promise.
- The Esplanade's crown only counts once its other targets are bagged.
- Crowning the Esplanade shows the game-complete card. The card only claims the full journey if every other street is cleared too.

## Other URL params
- `?preset=low|medium|high` sets the graphics preset (the default is auto).
- `?perf=1` shows the perf overlay.
- `?debug` exposes `window.__game` for the test scripts. It's a convenience switch, not security.

## Controls
- **Touch:**
  - Left joystick to walk (push far to run); drag the right side to look.
  - Hold and release **KICK** to kick; look up to chip it.
  - **JUMP**, **BALL** (fetch a ball) and **II** (pause).
- **Desktop:**
  - WASD to walk, Shift to run, Space to jump, mouse to look.
  - Hold and release the left button (or E) to kick.
  - R fetches a ball, Esc pauses.
- **Pause menu:**
  - **Replay this level** resets that level's targets and score. Replays score points, but pocket money and unlocks are only paid the first time.
  - **Settings → Reset progress** clears gameplay progress (targets, unlocks, boots and balls) and pocket money. Settings (sound, volume, graphics preset) and any `-bak` / `-corrupt-` save copies stay.

## Build, run and deploy
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static build in dist/ (relative base, works on the Pages subpath)
npx vite preview --port 4199   # serve dist/ for the smoke tests
./scripts/deploy.sh  # build, start a dedicated preview of the new dist on a free port, run the smokes against it, push dist/ to gh-pages
```
Bump the version in three places: `BUILD` in `src/main.js`, `public/version.json` and `package.json`.

## Tests
These are headless-Chrome Playwright scripts in `scripts/`. Run them against `vite preview` on port 4199. Every script loads the game with `?debug`.
- `timeout 120 node scripts/smokeNN.mjs`: smoke17 to smoke38. smoke35 to smoke37 cover London Road, the Royal Mile and the Esplanade. smoke38 covers saves, `?debug` gating, replay and reset. smoke39 covers the finale in both states, save-notice timing and a failed save copy.
- `timeout 120 node scripts/smoke28.mjs http://localhost:4199/ '' <preset> <level,level>` runs the visual check. Run one preset at a time, two levels per run, to stay under the timeout.
- `scripts/smoke-freshstart.mjs` checks that a new player starts in Pennywell.
- `scripts/verify.mjs` (`npm run verify`) is the old long all-in-one run. It's kept for reference, but it's slow and isn't used for releases; use the smokes instead.

## Performance budget
Measured headless with SwiftShader, so these are relative numbers, not a phone measurement.
- low and medium: about 27 draw calls and up to about 50k triangles. Pennywell is the reference at 27 calls and 48–50k triangles.
- high: about 45 draw calls and up to about 102k triangles.

## Saves and privacy
See `PRIVACY.md`. Progress, pocket money and settings stay in this browser's localStorage. Damaged saves are kept as `<key>-corrupt-<timestamp>`, and the last good copy is kept as `<key>-bak`.

## Licence and credits
See `LICENSE` (all rights reserved), `CREDITS.md` and `public/THIRD_PARTY_NOTICES.txt` (shipped as `THIRD_PARTY_NOTICES.txt` in the build, with full MIT/OFL texts) (shipped assets and their licences, plus the reference-photo note).
