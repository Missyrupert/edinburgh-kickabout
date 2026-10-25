// targeted check for the fixed verify.mjs assertion (fresh player starts in Pennywell) - not the full verify
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await pg.goto((process.argv[2] || 'http://localhost:4199/') + '?debug'); await pg.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 60000 });
const r = await pg.evaluate(() => [window.__game.level, window.__game.targets.length]); console.log(r[0] === 'pennywell' && r[1] === 10 ? 'OK  ' : 'FAIL', 'new players start in Pennywell', r); await b.close(); process.exit(r[0] === 'pennywell' ? 0 : 1);
