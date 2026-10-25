// v2.1 "The Pilton Parade": a flat-roofed 1960s/70s shopping parade with two storeys of flats above,
// modelled on the type found across north Edinburgh schemes (Pilton, Muirhouse, Granton). Shop names are fictional.
// Everything here is procedural (canvas drawings in the shared sign atlas + merged boxes): no external assets.
// Small clutter has NO colliders; only wall-hugging bins/crates get simple boxes, all outside walking lines.
const FRONT = 33.94; // shop-front plane (parade box spans z 34..42)
const PAL = { cream: '#EFE3C8', charcoal: '#2E2F2C', brick: '#9A4E3C', yellow: '#F7C325', teal: '#2E9C8F', harl: '#B9B3A6' };

function txt(g, s, x, y, font, col, align = 'center') { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function tiles(g, x, y, w, h, s, a, b) { for (let j = 0; j * s < h; j++) for (let i = 0; i * s < w; i++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(x + i * s, y + j * s, s - 1, s - 1); } }
function glassSheen(g, w, h) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = PAL.charcoal; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }

// --- window/interior drawings (all in 2048-space px) ---
const D = {
  plaiceCounter(g, w, h) { // the takeaway counter seen through the big window
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, w, h); tiles(g, 0, 0, w, h * 0.55, 18, '#e9e4d6', '#f7f3ea');
    g.fillStyle = '#1e1f1d'; g.fillRect(w * 0.06, h * 0.06, w * 0.5, h * 0.3); // menu board
    const items = [['FISH SUPPER', '6.50'], ['HADDOCK', '5.20'], ['SMOKED SAUSAGE', '3.10'], ['MINCE PIE', '2.80'], ['CHIPS', '1.90']];
    items.forEach(([a, p], i) => { txt(g, a, w * 0.09, h * (0.1 + i * 0.053), '700 15px "Barlow Condensed"', PAL.cream, 'left'); txt(g, p, w * 0.53, h * (0.1 + i * 0.053), '700 15px "Barlow Condensed"', PAL.yellow, 'right'); });
    g.fillStyle = '#cfd3d4'; g.fillRect(w * 0.6, h * 0.12, w * 0.36, h * 0.12); // extraction hood
    g.fillStyle = '#9ea4a6'; g.fillRect(w * 0.58, h * 0.24, w * 0.4, h * 0.04);
    g.fillStyle = '#b8bec0'; g.fillRect(w * 0.6, h * 0.42, w * 0.36, h * 0.2); // fryer range
    for (let i = 0; i < 3; i++) { g.fillStyle = '#5a5e60'; g.fillRect(w * (0.62 + i * 0.115), h * 0.44, w * 0.1, h * 0.05); g.fillStyle = '#d9a640'; g.fillRect(w * (0.63 + i * 0.115), h * 0.455, w * 0.08, h * 0.025); }
    g.fillStyle = 'rgba(255,230,170,.55)'; g.fillRect(w * 0.08, h * 0.44, w * 0.44, h * 0.16); // hot cabinet glass
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c8822e' : '#a8641f'; g.beginPath(); g.ellipse(w * (0.13 + i * 0.065), h * 0.54, 16, 7, 0, 0, 7); g.fill(); } // battered fish
    g.fillStyle = '#d7dadb'; g.fillRect(0, h * 0.62, w, h * 0.04); // steel counter top
    g.fillStyle = PAL.teal; g.fillRect(0, h * 0.66, w, h * 0.34); tiles(g, 0, h * 0.66, w, h * 0.34, 22, '#2a8e82', '#33a597');
    g.fillStyle = '#fff'; g.fillRect(w * 0.72, h * 0.66, w * 0.16, h * 0.1); txt(g, 'SALT & SAUCE?', w * 0.8, h * 0.71, '700 13px "Barlow Condensed"', PAL.charcoal);
    g.fillStyle = '#e8e8e2'; for (let i = 0; i < 5; i++) g.fillRect(w * (0.56 + i * 0.012), h * 0.5, 6, h * 0.12); // wrapping paper stack
    g.fillStyle = 'rgba(255,214,140,.22)'; g.fillRect(0, 0, w, h); glassSheen(g, w, h);
  },
  plaiceMenu(g, w, h) { // left window: opening hours + wall menu
    g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, w, h); tiles(g, 0, 0, w, h, 18, '#e9e4d6', '#f7f3ea');
    g.fillStyle = '#fff'; g.fillRect(w * 0.15, h * 0.12, w * 0.7, h * 0.48); g.strokeStyle = PAL.teal; g.lineWidth = 4; g.strokeRect(w * 0.15, h * 0.12, w * 0.7, h * 0.48);
    txt(g, 'OPENING HOURS', w / 2, h * 0.2, '800 16px "Barlow Condensed"', PAL.teal);
    ['MON-THU 4-10', 'FRI-SAT 12-11', 'SUN 4-10'].forEach((s, i) => txt(g, s, w / 2, h * (0.31 + i * 0.09), '700 15px "Barlow Condensed"', PAL.charcoal));
    g.fillStyle = PAL.teal; g.fillRect(0, h * 0.72, w, h * 0.28); tiles(g, 0, h * 0.72, w, h * 0.28, 22, '#2a8e82', '#33a597');
    g.fillStyle = 'rgba(255,214,140,.2)'; g.fillRect(0, 0, w, h); glassSheen(g, w, h);
  },
  blade(g, w, h) { // projecting fish sign (both faces)
    g.fillStyle = PAL.charcoal; g.fillRect(0, 0, w, h);
    g.fillStyle = PAL.yellow; g.beginPath(); g.ellipse(w * 0.45, h * 0.42, w * 0.32, h * 0.24, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(w * 0.74, h * 0.42); g.lineTo(w * 0.94, h * 0.2); g.lineTo(w * 0.94, h * 0.64); g.fill();
    g.fillStyle = PAL.charcoal; g.beginPath(); g.arc(w * 0.24, h * 0.38, 6, 0, 7); g.fill();
    txt(g, 'FISH & CHIPS', w / 2, h * 0.84, '24px "Alfa Slab One"', PAL.cream);
    g.strokeStyle = PAL.yellow; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  },
  weeShop(g, w, h) { // newsagent: posters, shelves, paper rack
    g.fillStyle = '#d6d2c6'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) { g.fillStyle = '#8a8478'; g.fillRect(w * 0.45, h * (0.15 + r * 0.18), w * 0.5, 5);
      for (let i = 0; i < 12; i++) { g.fillStyle = ['#c23b3b', '#3b6fc2', '#f2d45c', '#5a9a4a', '#e8e2d0'][(i * 7 + r) % 5]; g.fillRect(w * (0.46 + i * 0.04), h * (0.15 + r * 0.18) - 22, 12, 22); } }
    const post = (x, y, pw, ph, bg, a, b) => { g.fillStyle = bg; g.fillRect(x, y, pw, ph); txt(g, a, x + pw / 2, y + ph * 0.38, '800 17px "Barlow Condensed"', PAL.charcoal); if (b) txt(g, b, x + pw / 2, y + ph * 0.7, '600 13px "Barlow Condensed"', PAL.charcoal); };
    post(w * 0.04, h * 0.1, w * 0.34, h * 0.22, '#fff8e8', 'PAPERS · MILK · ROLLS', 'open 6am');
    post(w * 0.06, h * 0.38, w * 0.28, h * 0.18, PAL.yellow, 'HOT PIES', 'an\' bridies');
    post(w * 0.04, h * 0.62, w * 0.3, h * 0.16, '#fff', 'GAS & ELEC TOP-UP', '');
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(w * 0.02, h * 0.86, w * 0.96, 3); glassSheen(g, w, h);
  },
  bookies(g, w, h) { // frosted, vinyl-covered window (bookies don't show the inside)
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8dfdc'); gr.addColorStop(1, '#b9c4c0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f5a3a'; g.fillRect(0, h * 0.68, w, h * 0.32); g.fillRect(0, 0, w, h * 0.08);
    txt(g, 'RACING · FOOTBALL', w / 2, h * 0.3, '800 30px "Barlow Condensed"', '#1f5a3a');
    txt(g, 'LIVE ON SCREEN', w / 2, h * 0.47, '700 22px "Barlow Condensed"', PAL.charcoal);
    txt(g, 'OVER 18s ONLY', w / 2, h * 0.84, '700 18px "Barlow Condensed"', PAL.cream); glassSheen(g, w, h);
  },
  salon(g, w, h) { // hairdresser: mirrors, chairs, price card, plant
    g.fillStyle = '#efd9dc'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) { const x = w * (0.42 + i * 0.27);
      g.fillStyle = '#cfe0e8'; g.fillRect(x, h * 0.12, w * 0.18, h * 0.32); g.strokeStyle = '#b48a4a'; g.lineWidth = 5; g.strokeRect(x, h * 0.12, w * 0.18, h * 0.32);
      g.fillStyle = '#7a2c46'; g.fillRect(x + 6, h * 0.5, w * 0.18 - 12, h * 0.16); g.fillRect(x + 14, h * 0.4, w * 0.18 - 28, h * 0.12); g.fillStyle = '#555'; g.fillRect(x + w * 0.08, h * 0.66, 6, h * 0.12); }
    g.fillStyle = '#fff'; g.fillRect(w * 0.05, h * 0.12, w * 0.3, h * 0.52); g.strokeStyle = '#b44a76'; g.lineWidth = 3; g.strokeRect(w * 0.05, h * 0.12, w * 0.3, h * 0.52);
    [['CUT & BLOW', '£9'], ['WASH & SET', '£7'], ['PERM', '£16'], ['OAPs TUES', '½ PRICE']].forEach(([a, p], i) => { txt(g, a, w * 0.07, h * (0.22 + i * 0.11), '700 14px "Barlow Condensed"', PAL.charcoal, 'left'); txt(g, p, w * 0.33, h * (0.22 + i * 0.11), '700 14px "Barlow Condensed"', '#b44a76', 'right'); });
    g.fillStyle = '#4a7a3a'; g.beginPath(); g.arc(w * 0.2, h * 0.78, 22, 0, 7); g.fill(); g.fillStyle = '#9a5a3a'; g.fillRect(w * 0.18, h * 0.8, 20, 24);
    glassSheen(g, w, h);
  },
  shutter(g, w, h) { // closed roller shutter with faded fly-posters
    g.fillStyle = '#9a9d9f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y + 2, w, 2); }
    const fly = (x, y, pw, ph, bg, a, b, r) => { g.save(); g.translate(x, y); g.rotate(r); g.globalAlpha = 0.72; g.fillStyle = bg; g.fillRect(0, 0, pw, ph); txt(g, a, pw / 2, ph * 0.38, '800 16px "Barlow Condensed"', PAL.charcoal); txt(g, b, pw / 2, ph * 0.7, '600 12px "Barlow Condensed"', PAL.charcoal); g.restore(); };
    fly(w * 0.08, h * 0.2, 90, 120, '#f2e6c0', 'CAR BOOT SALE', 'every sunday', -0.04);
    fly(w * 0.3, h * 0.24, 80, 110, '#e8c8c8', 'BINGO', 'thurs 7pm', 0.03);
    fly(w * 0.62, h * 0.18, 100, 70, '#fff', 'SHOP TO LET', '0131 000 0000', 0.02);
    g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(0, h * 0.85, w, h * 0.15); g.fillStyle = '#5a5a56'; g.fillRect(w * 0.45, h * 0.9, w * 0.1, 8);
  },
  notice(lines, bg = '#fff8e8') { return (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    lines.forEach((s, i) => txt(g, s, w / 2, h * (0.2 + i * (0.65 / Math.max(1, lines.length - 1))), (i ? '600 13px' : '800 16px') + ' "Barlow Condensed"', PAL.charcoal));
    g.fillStyle = 'rgba(200,180,140,.35)'; g.fillRect(0, h * 0.75, w, h * 0.25); }; },
  riser(col) { return (g, w, h) => tiles(g, 0, 0, w, h, 16, col, '#2E2F2C'); },
};

export function buildParade({ solid, quad, atlas, cyl, windows, V, boxBody }) {
  const block = (x0, x1, col) => quad('flat', (x0 + x1) / 2, 2.05, FRONT + 0.03, x1 - x0 - 0.1, 4.0, Math.PI, null, col); // v2.3 shop colour block, readable from distance
  // the block: shops (single storey, z 34-42) + two storeys of flats above, set back to z 36
  solid('harl', 0, 2.1, 38, 30, 4.2, 8, 0xd8d0bf, { tile: 2.5, grime: 0.25 });
  solid('flat', 0, 4.35, 37.9, 30.6, 0.3, 8.4, 0x6f6b64, { phys: false }); // flat roof / canopy over the shops
  solid('flat', 0, 4.15, 33.85, 30.6, 0.35, 0.2, 0x3a3b38, { phys: false }); // fascia board edge
  solid('harl', 0, 7.35, 39, 29.6, 6.2, 6, 0xe6dcc6, { tile: 2.5, grime: 0.18 }); // flats above
  solid('flat', 0, 10.5, 39, 30, 0.2, 6.4, 0x5c5e5b, { phys: false });
  windows('-z', 0, 35.99, 29.6, 2, 3.0, 4.5);
  // balcony-deck railing along the canopy edge (thin, merged, no colliders)
  for (let x = -14.8; x <= 14.8; x += 0.6) solid('metal', x, 5.0, 34.3, 0.04, 0.9, 0.04, 0x2E2F2C, { phys: false });
  solid('metal', 0, 5.45, 34.3, 29.8, 0.06, 0.06, 0x2E2F2C, { phys: false }); solid('metal', 0, 4.6, 34.3, 29.8, 0.04, 0.04, 0x2E2F2C, { phys: false });
  // drainpipes (cast-iron, black) from the canopy gutter
  for (const x of [-15.1, -6.15, 5.1, 15.1]) { quad('flat', x, 0.7, FRONT + 0.01, 0.4, 1.4, Math.PI, null, 0x8a8272); cyl('metal', x, 2.1, 33.85, 0.05, 0.05, 4.2, 0x2a2b29, { phys: false, seg: 6 }); solid('metal', x, 0.08, 33.75, 0.2, 0.06, 0.25, 0x2a2b29, { phys: false }); }
  // brick pilasters between shop units
  for (const x of [-6, 0, 5, 10]) solid('brick', x, 2.0, 33.9, 0.45, 4.0, 0.2, 0xffffff, { phys: false, tile: 1.5 });
  for (const x of [-15.15, 15.15]) solid('brick', x, 2.0, 33.95, 0.3, 4.0, 0.3, 0xffffff, { phys: false, tile: 1.5 });

  const shopUnit = ({ x0, x1, name, sub, bg, fg, riser, window: win, door = 'r', winTex, shutterDown = false, block: bc }) => {
    if (bc) block(x0, x1, bc);
    const w = x1 - x0, xc = (x0 + x1) / 2, dw = 1.0, dx = door === 'r' ? x1 - 0.4 - dw / 2 : x0 + 0.4 + dw / 2;
    quad('atlas', xc, 3.45, FRONT - 0.02, w - 0.5, 0.95, Math.PI, atlas.fascia(name, sub, bg, fg, (w - 0.5) / 0.95));
    if (shutterDown) { quad('atlas', xc, 1.45, FRONT, w - 0.6, 2.9, Math.PI, winTex); solid('metal', xc, 3.0, FRONT - 0.1, w - 0.5, 0.26, 0.22, 0x8a8d8f, { phys: false }); return; }
    const ww = w - dw - 1.0, wx = door === 'r' ? x0 + 0.4 + ww / 2 : x1 - 0.4 - ww / 2;
    quad('atlas', wx, 0.3, FRONT, ww + 0.1, 0.6, Math.PI, riser); // stall riser
    quad('atlas', wx, 1.65, FRONT - 0.005, ww, 2.05, Math.PI, winTex); // window + what's inside
    solid('metal', wx, 2.82, FRONT - 0.08, ww + 0.2, 0.22, 0.2, 0x8a8d8f, { phys: false }); // roller-shutter box
    solid('flat', wx, 0.62, FRONT - 0.08, ww + 0.1, 0.05, 0.16, 0xd9d4c8, { phys: false }); // sill
    quad('flat', dx, 1.15, FRONT - 0.005, dw, 2.3, Math.PI, null, 0x2b2d30); // door
    quad('glass', dx, 1.45, FRONT - 0.01, dw - 0.25, 1.3, Math.PI, null, 0xffffff);
    solid('metal', dx, 2.82, FRONT - 0.08, dw + 0.15, 0.22, 0.2, 0x8a8d8f, { phys: false });
    return { dx };
  };
  const R = (w, h, fn) => atlas.draw(w, h, fn);
  // 1. The Pilton Plaice (9 m, the hero): teal tiles, fish blade sign, extractor flue, counter through the window
  quad('atlas', -10.5, 3.45, FRONT - 0.02, 8.5, 0.95, Math.PI, atlas.fascia('THE PILTON PLAICE', 'FISH & CHIPS · CARRY OOT', PAL.teal, PAL.yellow, 8.5 / 0.95));
  quad('atlas', -8.95, 1.65, FRONT - 0.005, 4.9, 2.05, Math.PI, R(512, 220, D.plaiceCounter)); // big window: the counter
  quad('atlas', -8.95, 0.3, FRONT, 5.0, 0.6, Math.PI, R(256, 32, D.riser('#2a8e82')));
  solid('metal', -8.95, 2.82, FRONT - 0.08, 5.1, 0.22, 0.2, 0x8a8d8f, { phys: false }); solid('flat', -8.95, 0.62, FRONT - 0.08, 5.0, 0.05, 0.16, 0xd9d4c8, { phys: false });
  quad('atlas', -13.95, 1.65, FRONT - 0.012, 1.7, 2.05, Math.PI, R(192, 232, D.plaiceMenu));
  quad('atlas', -13.95, 0.3, FRONT - 0.012, 1.8, 0.6, Math.PI, R(128, 40, D.riser('#2a8e82')));
  quad('flat', -12.05, 1.15, FRONT - 0.012, 1.0, 2.3, Math.PI, null, 0x1f5a52); quad('glass', -12.05, 1.5, FRONT - 0.02, 0.7, 1.3, Math.PI, null, 0xffe8b0); // teal door, lit
  quad('atlas', -12.05, 2.55, FRONT - 0.025, 0.7, 0.24, Math.PI, atlas.sign('OPEN', '#c8102e', '#fff', 0.7 / 0.24, '700 60px "Barlow Condensed", Arial'));
  block(-15, -6, 0x1f6f66);
  const blade = R(256, 160, D.blade); for (const s of [1, -1]) quad('atlas', -15.2 + s * 0.015, 3.0, FRONT - 0.65, 1.0, 0.62, s > 0 ? Math.PI / 2 : -Math.PI / 2, blade); // v2.3: faces split on x (no z-fight)
  solid('metal', -15.2, 3.35, FRONT - 0.25, 0.04, 0.04, 0.85, 0x2E2F2C, { phys: false });
  solid('metal', -7.2, 6.5, 35.8, 0.35, 4.6, 0.3, 0xa7aaab, { phys: false }); solid('metal', -7.2, 8.9, 35.8, 0.5, 0.2, 0.5, 0x7d8082, { phys: false }); // stainless extractor flue
  solid('flat', -8.95, 2.62, FRONT - 0.5, 5.2, 0.05, 0.95, 0x2e9c8f, { phys: false, rx: -0.25 }); // canvas awning (teal), v2.3: below the fascia
  // 2. The Wee Shop (newsagent / grocer)
  shopUnit({ x0: -6, x1: 0, name: 'THE WEE SHOP', sub: 'NEWSAGENT · GROCERIES', bg: PAL.brick, fg: PAL.cream, riser: R(256, 48, D.riser('#7a3e30')), winTex: R(384, 220, D.weeShop), block: 0x7a3a2c });
  quad('atlas', -0.9, 1.75, FRONT - 0.02, 0.5, 0.38, Math.PI, R(96, 74, D.notice(['FLAT TO LET', 'ask inside']))); // card in the door
  // 3. Lucky Tattie (bookmaker)
  shopUnit({ x0: 0, x1: 5, name: 'LUCKY TATTIE', sub: 'BOOKMAKER', bg: '#1f5a3a', fg: PAL.cream, riser: R(256, 48, D.riser('#1a4a30')), winTex: R(320, 220, D.bookies), block: 0x1a4a30 });
  // 4. Curl Up & Dye (hairdresser)
  shopUnit({ x0: 5, x1: 10, name: 'CURL UP & DYE', sub: 'LADIES & GENTS HAIRDRESSER', bg: '#b44a76', fg: PAL.cream, riser: R(256, 48, D.riser('#8a3a5a')), winTex: R(320, 220, D.salon), door: 'l', block: 0x9a3a64 });
  // 5. Video Nasty (shut down, shutter down, to-let board)
  shopUnit({ x0: 10, x1: 15, name: 'VIDEO NASTY', sub: 'VIDEO HIRE · NEW RELEASES', bg: '#3b2350', fg: PAL.yellow, winTex: R(384, 224, D.shutter), shutterDown: true, block: 0x3b2350 });
  quad('atlas', 12.5, 4.9, 33.6, 1.3, 0.7, Math.PI, R(160, 86, D.notice(['TO LET', 'retail unit · 0131 000 0000'], PAL.yellow)));
  solid('metal', 12.5, 4.6, 33.62, 0.05, 0.6, 0.05, 0x2E2F2C, { phys: false });
  // community notices on the pilaster/wall (cheap quads)
  quad('atlas', 5.0, 1.9, 33.78, 0.42, 0.52, Math.PI, R(84, 104, D.notice(["RESIDENTS'", 'ASSOCIATION', 'tues 7pm', 'church hall'])));
  quad('atlas', 0.0, 1.6, 33.78, 0.4, 0.5, Math.PI, R(80, 100, D.notice(['LOST CAT', 'grey, called', 'Smokey', 'ask at Wee Shop'], '#fff')));

  // ---------- everyday clutter ----------
  // wall-hugging bins/crates: simple boxes, all within 0.8 m of the wall (outside the walking line in front of the doors)
  const wheelie = (x, z, col, phys = true) => { solid('flat', x, 0.5, z, 0.6, 1.0, 0.7, col, { phys }); solid('flat', x, 1.02, z, 0.66, 0.06, 0.76, col, { phys: false }); };
  wheelie(-4.2, 34.45 - 0.42, 0x2e5a34); wheelie(-3.5, 34.45 - 0.42, 0x3a3d3c); // Wee Shop bins (front against wall)
  for (const [x, y, c] of [[-1.75, 0.18, 0x4b6a8a], [-1.75, 0.5, 0x8a4b3a], [-1.35, 0.18, 0x4b6a8a]]) solid('flat', x, y, 33.65, 0.38, 0.32, 0.42, c, { phys: y < 0.3 }); // milk/bread crates
  // newspaper A-board (no collider: you walk/kick through it - it's tiny and sits by the wall)
  solid('flat', -5.2, 0.45, 33.55, 0.55, 0.9, 0.04, 0x2E2F2C, { phys: false, rx: 0.15 }); boxBody(-5.2, 0.45, 33.6, 0.55, 0.9, 0.22, { surface: 'board' }); // v2.3 A-board collider (simple box)
  quad('atlas', -5.2, 0.5, 33.505, 0.48, 0.6, Math.PI, R(80, 100, D.notice(['THE DAILY BLETHER', 'in today'], '#f4f1ea')), 0xffffff, { rx: 0 });
  // grey council litter bin on a post at the parade end, behind the line of the hedge
  cyl('metal', -15.6, 0.55, 31.6, 0.05, 0.05, 1.1, 0x2a2b29, { seg: 6 }); cyl('flat', -15.6, 0.85, 31.6, 0.22, 0.2, 0.5, 0x4a4d4c, { seg: 10, phys: false });
  // railings in front of the salon/bookies (pedestrian guard by the kerb gap), thin bars, no colliders
  for (let x = 2.2; x <= 7.8; x += 0.28) solid('metal', x, 0.5, 30.15, 0.03, 1.0, 0.03, 0x2e5a3a, { phys: false });
  boxBody(5, 0.5, 30.15, 5.7, 1.0, 0.08, { surface: 'metal' }); // v2.3 one simple collider for the whole railing
  solid('metal', 5, 0.98, 30.15, 5.7, 0.05, 0.05, 0x2e5a3a, { phys: false }); solid('metal', 5, 0.2, 30.15, 5.7, 0.04, 0.04, 0x2e5a3a, { phys: false });
  // gum spots / staining on the pavement + a grubby step at the bookies (no physics)
  for (let i = 0; i < 18; i++) quad('flat', -14 + (i * 7.31) % 28, 0.011, 30.5 + (i * 3.7) % 3.3, 0.08, 0.08, 0, null, 0x8a8880, { rx: -Math.PI / 2 });
  return { counter: V(-11.6, 0, 32.6) };
}
