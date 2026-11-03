// Hospital map (src/map.js): layouts per aspect, drawing in every state, the Valley Hospital floor 7
// signage (header, corridor, elevator chip, Room 5), every arcade's name and medal dots on its room's
// plate (tap to play), her room by day and after dark (LIGHTS OUT / LIGHTS ON), hit testing, the locked
// and cleared ward markers, the exit that explains itself, the restroom that knocks back, mounting into
// a stub element, and every map action.
const fs = require('node:fs');
const path = require('node:path');
const { run, close, assert, nodes } = require('./harness.cjs');
// Structured results cross the VM boundary as plain JSON, so deepEqual compares values, not realms.
const J = code => JSON.parse(run(`JSON.stringify(${code})`));

for (const name of ['hospitalMapDraw', 'hospitalMapHit', 'mountHospitalMap', 'hospitalMapInvalidate', 'hospitalMapLayout', 'hospitalMapPlate']) {
  assert.equal(run(`typeof ${name}`), 'function', `${name} exists`);
}

// Safe before anything is mounted.
run('hospitalMapInvalidate()');
assert.equal(run('hospitalMapView.el'), null);
console.log('PASS: the API exists and hospitalMapInvalidate is safe before mount.');

// A context that records every fillText with the font it was drawn in, and measures text at about
// the width Trebuchet bold really has.
run(`
var hmLog = [];
var hmCtx = new Proxy(
  {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText(t) {
      const px = parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(String(this.font)) ? /(\\d+(?:\\.\\d+)?)px/.exec(String(this.font))[1] : 11);
      return { width: String(t).length * px * 0.55 };
    },
    fillText(t) {
      hmLog.push({ t: String(t), font: String(this.font) });
    }
  },
  { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) }
);
function hmDraw(w, h) {
  hmLog = [];
  hospitalMapDraw(hmCtx, w, h);
  return hmLog.map(e => e.t);
}
`);

const SIZES = [
  [900, 560, 'wide'],
  [390, 600, 'portrait'],
  [800, 360, 'strip']
];
// Phones in portrait (the map is 96vw less padding), phones on their side, small and big desktops.
const ALL_SIZES = [
  ...SIZES,
  [346, 577, 'portrait'],
  [384, 640, 'portrait'],
  [332, 553, 'portrait'],
  [300, 500, 'portrait'],
  [780, 320, 'strip'],
  [844, 340, 'strip'],
  [700, 300, 'strip'],
  [560, 330, 'wide'],
  [1100, 640, 'wide']
];
const NAMES = ['Your room', 'MRI room', 'Family lounge', 'CT scan', 'Ultrasound'];
const GAMES = J('[0, 1, 2, 3, 4, 5].map(i => games[i].info.game)');
assert.equal(GAMES[0], 'Fastpitch Fever', 'her room by day');
assert.equal(GAMES[5], 'Bedside Blaster', 'her room after dark');

run('state.room = 0; state.wardClears = [0, 0, 0, 0, 0, 0]; state.won = false; state.ralph = false; state.ralphReady = false');
for (const [w, h, kind] of SIZES) {
  assert.equal(run(`hospitalMapLayout(${w}, ${h}).kind`), kind, `${w}x${h} picks ${kind}`);
  assert.equal(run(`hospitalMapDraw(c, ${w}, ${h}).kind`), kind, `${w}x${h} draws`);
  const texts = run(`hmDraw(${w}, ${h})`);
  for (const name of [...NAMES, 'Gift shop', 'DAILY', 'EXIT', 'YOU', 'PLAY', 'LIGHTS OUT']) assert.ok(texts.includes(name), `${kind} shows ${name}`);
}
console.log('PASS: 900x560, 390x600 and 800x360 pick wide, portrait and strip layouts and draw them.');

// Valley Hospital, seventh floor, Room 5: the header, the corridor stripe, the elevator chip, her plate.
const mapSrc = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');
for (const old of ['4F', 'FLOOR 4', 'floor 4', 'fourth', 'Fourth', '412']) assert.ok(!mapSrc.includes(old), `map.js no longer says ${old}`);
assert.equal(run('HOSPITAL_MAP_COPY.header'), 'VALLEY HOSPITAL · FLOOR 7');
assert.equal(run('HOSPITAL_MAP_COPY.floor'), 'VALLEY · 7F · PEDIATRICS', 'the wing is pediatrics');
// The still layer (corridor, elevator) is cached offscreen, so read it straight from the base painter.
run(`function hmBase(w, h) {
  hmLog = [];
  hospitalMapDrawBase(hmCtx, hospitalMapLayout(w, h));
  return hmLog.map(e => e.t);
}`);
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmBase(${w}, ${h}).concat(hmDraw(${w}, ${h}))`);
  assert.ok(texts.includes('VALLEY · 7F · PEDIATRICS'), `${kind} corridor says where we are`);
  assert.ok(texts.includes('7'), `${kind} elevator chip shows 7`);
  assert.ok(texts.includes('ROOM 5'), `${kind} Macy's plate says Room 5`);
  for (const gone of ['4', 'GUT WING · 4F', '4F', 'FLOOR 4']) assert.ok(!texts.includes(gone), `${kind} has no ${gone}`);
}
// The longer stripe still fits in the corridor between the elevator and the Daily Dose poster.
for (const [w, h, kind] of [...SIZES, [322, 537, 'portrait'], [300, 500, 'portrait'], [844, 340, 'strip']]) {
  const fit = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h}), lift = L.places.find(p => p.kind === 'lift').rect,
      size = clamp(11 * L.k, 11, 15), tw = HOSPITAL_MAP_COPY.floor.length * size * 0.55, f = L.floorText;
    return L.axis === 'x'
      ? { from: f.x, to: f.x + tw, after: lift.x + lift.w, before: L.daily.x }
      : { from: f.y - tw / 2, to: f.y + tw / 2, after: lift.y + lift.h, before: L.daily.y };
  })()`);
  assert.ok(fit.from > fit.after && fit.to < fit.before, `${kind} ${w}x${h}: the corridor stripe fits (${JSON.stringify(fit)})`);
}
assert.match(run('hospitalMapButtonsHtml()'), /Your room \(Room 5\)\./, 'the hidden list says Room 5 too');
// The header line goes into the dialog's kicker: through closest('dialog') when the element has it,
// else #mapDialog.
run(`var hmKicker = { textContent: 'Gut wing · floor 4' };
  var hmDialog = { querySelector: s => (s === '.modal-kicker' ? hmKicker : null) };
  hospitalMapHeader({ closest: s => (s === 'dialog' ? hmDialog : null) });`);
assert.equal(run('hmKicker.textContent'), 'VALLEY HOSPITAL · FLOOR 7', 'the header follows closest("dialog")');
run('hospitalMapHeader({})');
assert.equal(nodes.mapDialogchild.textContent, 'VALLEY HOSPITAL · FLOOR 7', 'or #mapDialog');
assert.equal(run('hospitalMapHeader(null) !== undefined'), true, 'and is safe without an element');
console.log('PASS: VALLEY HOSPITAL · FLOOR 7 in the header, the 7F stripe, a 7 on the elevator and ROOM 5 on her plate.');

// Every room's plate: its name, then its arcade's name with one medal dot per level (four, Legendary
// included), in every layout. Her room carries both arcades: Fastpitch Fever by day, Bedside Blaster
// after dark under the moon.
const copy0 = J('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 0))');
assert.equal(copy0.name, 'Your room');
assert.equal(copy0.tag, 'ROOM 5');
assert.deepEqual(copy0.arcades.map(a => [a.id, a.text, a.glyph]), [
  [0, 'Fastpitch Fever', 'play'],
  [5, 'Bedside Blaster · after dark', 'moon']
]);
assert.deepEqual(copy0.arcades.map(a => a.medals.length), [4, 4], 'four medal dots each (TIER_COUNT)');
assert.equal(run('TIER_COUNT'), 4);
assert.deepEqual(
  J('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 1)).arcades.map(a => a.text)'),
  ['Loud Donut Pinball'],
  'other rooms carry their own arcade'
);
run('state.room = 5');
const copy5 = J('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 0))');
assert.equal(copy5.name, 'Your room · after dark', 'after dark, the plate takes the night name');
assert.equal(copy5.nameShort, 'Your room', 'and shortens to the day name where it does not fit');
assert.deepEqual(copy5.arcades.map(a => a.current), [false, true], 'the night line is the one in play');
run('state.room = 0');
assert.deepEqual(J('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 0)).arcades.map(a => a.current)'), [true, false]);

run('state.wardClears = [0, 2, 0, 1, 9, 0]');
for (const [w, h, kind] of ALL_SIZES) {
  for (const room of [0, 5, 2]) {
    run(`state.room = ${room}`);
    const texts = run(`hmDraw(${w}, ${h})`),
      all = texts.join(' ');
    for (const [id, game] of GAMES.entries()) {
      const first = id === 5 ? 'Bedside Blaster' : game;
      assert.ok(texts.some(t => t.startsWith(first.split(' ')[0])) && all.includes(first.split(' ').pop()), `${kind} ${w}x${h} (room ${room}) names ${game}`);
    }
    assert.ok(all.includes('after dark'), `${kind} ${w}x${h}: the night arcade says after dark`);
    const plates = J(`(() => {
      const L = hospitalMapLayout(${w}, ${h});
      return L.places.filter(p => p.kind === 'room').map(p => {
        const plate = hospitalMapPlate(p, L, hmCtx);
        return { id: p.id, dots: plate.rows.flatMap(r => r.items).filter(i => i.type === 'dots').map(i => i.arcade.medals.length),
          arcades: plate.arcades.map(a => a.id) };
      });
    })()`);
    for (const p of plates) {
      assert.deepEqual(p.arcades, p.id === 0 ? [0, 5] : [p.id], `${kind} room ${p.id} lists its arcades`);
      assert.deepEqual(p.dots, p.arcades.map(() => 4), `${kind} room ${p.id}: four dots per arcade`);
    }
  }
}
run('state.room = 0');
console.log('PASS: every plate names its arcade (her room both, the night one after dark) with four medal dots, in every layout.');

// The dots: bronze, silver and gold fill in; Legendary's dot wears a gold ring, faint until the game
// has a Legendary level.
run(`var hmStrokes = [];
var hmDotCtx = new Proxy({ stroke() { hmStrokes.push({ stroke: this.strokeStyle, fill: this.fillStyle }); }, fill() { hmStrokes.push({ fill: this.fillStyle }); } },
  { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) });`);
const dotStrokes = legendary =>
  J(`(() => { hmStrokes = []; hospitalMapDots(hmDotCtx, 0, 0, hospitalMapLayout(900, 560), [1, 2, 3, 0], ${legendary}); return hmStrokes; })()`);
const ring = run('HOSPITAL_MAP_LEGEND_RING');
assert.match(ring, /^#d9a21f$/i, 'the Legendary ring is gold');
let st = dotStrokes(true);
assert.deepEqual(
  st.filter(s => s.fill && !s.stroke).map(s => s.fill).slice(0, 3),
  J('HOSPITAL_MAP_MEDAL_COLORS.slice(1)'),
  'bronze, silver and gold dots fill in'
);
assert.ok(st.some(s => s.stroke === ring), 'a Legendary game rings its fourth dot in gold');
st = dotStrokes(false);
assert.ok(st.some(s => s.stroke === ring + '66') && !st.some(s => s.stroke === ring), 'a game without Legendary rings it faintly');
console.log('PASS: medal dots fill bronze, silver and gold; the Legendary dot wears a gold ring.');

// Phone portrait text never drops below 11 px.
for (const [w, h] of [[390, 600], [346, 577], [300, 500]]) {
  for (const room of [0, 5]) {
    run(`state.room = ${room}`);
    run(`hmDraw(${w}, ${h})`);
    const sizes = run('hmLog.map(e => parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(e.font)[1]))');
    assert.ok(sizes.length > 20, 'portrait draws its labels');
    assert.ok(Math.min(...sizes) >= 11, `smallest portrait label at ${w} px is ${Math.min(...sizes)} px`);
  }
}
run('state.room = 0');
console.log('PASS: every label on a phone-width map is at least 11 px.');

// Fit: in every layout and state the plate, PLAY (or GO) and LIGHTS stay inside their room and never
// overlap; no game's tap target overlaps a chip.
// g is the measuring context, as a frame being drawn would set it (null: the estimate hits use
// before the first draw).
run(`function hmGeom(w, h, g) {
  const L = hospitalMapLayout(w, h);
  hospitalMapMeasureCtx = g;
  try {
    return L.places.filter(p => p.kind === 'room').map(p => {
      const plate = hospitalMapPlate(p, L), box = r => r && { x: r.x, y: r.y, w: r.w, h: r.h };
      return { id: p.id, inner: box(p.inner), plate: box(plate), arcades: plate.arcades.map(a => box(a.rect)),
        chip: box(hospitalMapChip(p, L)), lights: box(hospitalMapLights(p, L)) };
    });
  } finally {
    hospitalMapMeasureCtx = null;
  }
}`);
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const inside = (a, r) => a.x >= r.x - 0.5 && a.y >= r.y - 0.5 && a.x + a.w <= r.x + r.w + 0.5 && a.y + a.h <= r.y + r.h + 0.5;
for (const [w, h, kind] of ALL_SIZES) {
  for (const [room, clears] of [
    [0, '[0, 2, 0, 1, 9, 0]'],
    [5, '[0, 2, 0, 1, 9, 0]'],
    [1, '[0, 0, 0, 0, 0, 0]'],
    [4, '[0, 3, 7, 1, 9, 0]']
  ]) {
    run(`state.room = ${room}; state.wardClears = ${clears}`);
    for (const g of ['hmCtx', 'null']) {
      for (const r of J(`hmGeom(${w}, ${h}, ${g})`)) {
        const at = `${kind} ${w}x${h}, Macy in ${room}, room ${r.id} (${g})`;
        assert.ok(inside(r.plate, r.inner), `${at}: the plate fits the room ${JSON.stringify([r.plate, r.inner])}`);
        for (const c of [r.chip, r.lights].filter(Boolean)) assert.ok(inside(c, r.inner), `${at}: chips stay in the room`);
        assert.ok(!overlap(r.plate, r.chip), `${at}: the plate clears PLAY ${JSON.stringify([r.plate, r.chip])}`);
        assert.ok(!overlap(r.plate, r.lights), `${at}: the plate clears LIGHTS ${JSON.stringify([r.plate, r.lights])}`);
        assert.ok(!overlap(r.chip, r.lights), `${at}: PLAY and LIGHTS do not touch ${JSON.stringify([r.chip, r.lights])}`);
        for (const a of r.arcades) assert.ok(!overlap(a, r.chip) && !overlap(a, r.lights), `${at}: a game name is never under a chip`);
      }
    }
  }
}
run('state.room = 0; state.wardClears = [0, 0, 0, 0, 0, 0]');
console.log('PASS: plates, PLAY and LIGHTS fit their rooms without overlapping, in every layout and state.');

// Each room's name is a tap target for that room, each game's name for its lobby, in every layout;
// so are the other places.
for (const [w, h, kind] of ALL_SIZES) {
  for (const id of [0, 1, 2, 3, 4]) {
    const hit = run(`(() => {
      const p = hospitalMapLayout(${w}, ${h}).places.find(q => q.kind === 'room' && q.id === ${id});
      return hospitalMapHit(p.labelAt.x, p.labelAt.y, ${w}, ${h});
    })()`);
    assert.deepEqual({ ...hit }, { kind: 'room', id }, `${kind} ${w}x${h} label of room ${id}`);
    const games = J(`(() => {
      const L = hospitalMapLayout(${w}, ${h}), p = L.places.find(q => q.kind === 'room' && q.id === ${id});
      return hospitalMapPlate(p, L).arcades.map(a => hospitalMapHit(a.rect.x + a.rect.w * 0.3, a.rect.y + a.rect.h / 2, ${w}, ${h}));
    })()`);
    assert.deepEqual(games.map(g => ({ ...g })), (id === 0 ? [0, 5] : [id]).map(g => ({ kind: 'game', id: g })), `${kind} ${w}x${h} game names in room ${id}`);
  }
  const at = expr => run(`(() => { const L = hospitalMapLayout(${w}, ${h}); const q = ${expr}; return hospitalMapHit(q.x, q.y, ${w}, ${h}); })()`);
  assert.equal(at('(c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 }))(hospitalMapLights(L.places.find(p => p.lightsAt), L))').kind, 'night', `${kind} LIGHTS OUT chip`);
  assert.equal(at('({ x: L.daily.x + L.daily.w / 2, y: L.daily.y + L.daily.h / 2 })').kind, 'daily', `${kind} daily poster`);
  assert.equal(at('L.places.find(p => p.kind === "shop").labelAt').kind, 'shop', `${kind} gift shop`);
  assert.equal(at('({ x: L.exitZone.x + L.exitZone.w * 0.6, y: L.exitZone.y + L.exitZone.h / 2 })').kind, 'exit', `${kind} exit`);
  if (kind === 'portrait') assert.equal(at('L.places.find(p => p.kind === "restroom").labelAt').kind, 'restroom', `${kind} restroom`);
  assert.equal(run(`hospitalMapHit(1, 1, ${w}, ${h})`), null, `${kind} empty corner`);
}
console.log('PASS: hit tests find every room at its name, every game at its name, plus lights, daily, shop, restroom and exit.');

// Locked wards: gremlin eyes, a padlock glyph by the game's name, and LOCKED on the chip of the room
// Macy is in. Everywhere else the chip says GO.
run('state.room = 1; state.wardClears = [0, 0, 0, 0, 0, 0]');
assert.equal(run('hospitalMapRoomState(1).locked'), true);
assert.equal(run('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 1)).arcades[0].glyph'), 'lock');
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('LOCKED') && texts.includes('GO'), `${kind} shows the locked chip and GO chips`);
  const chip = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h});
    const c = hospitalMapChip(L.places.find(p => p.id === 1), L);
    return { hit: hospitalMapHit(c.x + c.w / 2, c.y + c.h / 2, ${w}, ${h}), locked: c.locked, text: c.text };
  })()`);
  assert.deepEqual({ ...chip.hit }, { kind: 'room', id: 1, play: true }, `${kind} PLAY chip`);
  assert.equal(chip.locked, true);
  assert.equal(chip.text, 'LOCKED');
  const go = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h});
    const c = hospitalMapChip(L.places.find(p => p.id === 3), L);
    return { hit: hospitalMapHit(c.x + c.w / 2, c.y + c.h / 2, ${w}, ${h}), text: c.text };
  })()`);
  assert.deepEqual({ ...go.hit }, { kind: 'room', id: 3 }, `${kind} GO travels`);
  assert.equal(go.text, 'GO');
}
// Cleared wards: grudge flames (with +N past the pips), PLAY, no padlock.
run('state.wardClears = [0, 2, 0, 1, 9, 0]');
assert.equal(run('hospitalMapRoomState(1).grudge'), 2);
assert.equal(run('hospitalMapRoomState(1).locked'), false);
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(!texts.includes('LOCKED'), `${kind} has no locked chip once cleared`);
  assert.ok(texts.includes('PLAY'), `${kind} shows PLAY`);
  assert.ok(texts.some(t => /^\+\d$/.test(t)), `${kind} shows extra grudge past the pips`);
}
console.log('PASS: locked wards show padlocks and LOCKED; cleared wards show PLAY and grudge flames; elsewhere GO.');

// After dark: the tile sleeps, PLAY plays the night arcade, and the switch reads LIGHTS ON.
run('state.room = 5');
for (const [w, h, kind] of SIZES) {
  const chip = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h});
    const c = hospitalMapChip(L.places.find(p => p.kind === 'room' && p.id === 0), L);
    return hospitalMapHit(c.x + c.w / 2, c.y + c.h / 2, ${w}, ${h});
  })()`);
  assert.deepEqual({ ...chip }, { kind: 'room', id: 5, play: true }, `${kind} night PLAY chip`);
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('z'), `${kind} home tile sleeps after dark`);
  assert.ok(texts.includes('LIGHTS ON') && !texts.includes('LIGHTS OUT'), `${kind} the switch reads LIGHTS ON`);
}
run('state.room = 0');
for (const [w, h, kind] of SIZES) assert.ok(run(`hmDraw(${w}, ${h})`).includes('LIGHTS OUT'), `${kind} by day it reads LIGHTS OUT`);
console.log('PASS: by day the switch reads LIGHTS OUT; after dark the tile sleeps, PLAY plays the night arcade and the switch reads LIGHTS ON.');

// Ralph at the exit, and the discharge party: the exit sign reads GO HOME.
run('state.ralphReady = true; state.ralph = false');
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('NOPE.') && texts.includes('RALPH'), `${kind} shows Ralph at the exit`);
  assert.ok(texts.includes('EXIT') && !texts.includes('GO HOME'), `${kind} the exit is still just an exit`);
}
run('state.ralph = true; state.won = true');
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('FREE!') && !texts.includes('NOPE.'), `${kind} throws the discharge party`);
  assert.ok(texts.includes('GO HOME') && !texts.includes('EXIT'), `${kind} the exit reads GO HOME`);
}
run('state.won = false; state.ralph = false; state.ralphReady = false; state.room = 0');
console.log('PASS: Ralph at the exit, and the discharge party with GO HOME on the exit, all render.');

// The passport corner counts against DISCHARGE_STARS.
run('state.medals = [[3, 3, 0, 0], [3, 3, 0, 0], [3, 2, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]]');
assert.equal(run('stars()'), 19);
for (const [w, h, kind] of SIZES) assert.ok(run(`hmDraw(${w}, ${h})`).includes('19/21'), `${kind} badge reads 19/21`);
console.log('PASS: the passport corner reads stars()/DISCHARGE_STARS.');

// Mount into a stub element: it builds a canvas and the hidden button list, sizes and draws.
run(`
function hmNode(tag) {
  return {
    tag,
    innerHTML: '',
    style: {},
    dataset: {},
    width: 0,
    height: 0,
    events: {},
    addEventListener(type, fn) {
      this.events[type] = fn;
    },
    getContext: () => hmCtx,
    getBoundingClientRect() {
      return { left: 0, top: 0, width: hmView.w, height: hmView.h };
    }
  };
}
var hmView = { w: 390, h: 650 };
var hmCanvas = hmNode('canvas');
var hmList = hmNode('div');
var hmEl = {
  innerHTML: '',
  querySelector(sel) {
    if (!this.innerHTML.includes('data-hospital-map')) return null;
    return sel.startsWith('canvas') ? hmCanvas : hmList;
  },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 650 })
};
`);
run('state.medals = Array.from({ length: 6 }, () => [0, 0, 0, 0])');
nodes.mapDialogchild.textContent = 'Gut wing · floor 4';
assert.ok(run('mountHospitalMap(hmEl) === hmCanvas'), 'mount returns the canvas');
assert.equal(nodes.mapDialogchild.textContent, 'VALLEY HOSPITAL · FLOOR 7', 'mounting sets the map header');
assert.match(run('hmEl.innerHTML'), /<canvas data-hospital-map/);
assert.equal(run('hospitalMapView.w'), 390);
run('hmView.w = hospitalMapView.w; hmView.h = hospitalMapView.h');
assert.equal(run('hmCanvas.style.height'), run('hospitalMapView.h') + 'px');
assert.ok(run('hmCanvas.width') >= 390, 'canvas sized through configureCanvas');
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) {
  assert.equal(run(`typeof hmCanvas.events.${type}`), 'function', `canvas listens for ${type}`);
}
const KEYS = ['room:0', 'room:1', 'room:2', 'room:3', 'room:4', 'game:0', 'game:5', 'game:1', 'game:2', 'game:3', 'game:4', 'night', 'shop', 'daily', 'restroom', 'exit'];
const list = run('hmList.innerHTML');
for (const key of KEYS) assert.ok(list.includes(`data-hmap="${key}"`), `hidden list has ${key}`);
assert.equal((list.match(/aria-label="/g) || []).length, KEYS.length, 'every hidden button has an aria-label');
assert.match(list, /Play Bedside Blaster \(Your room · after dark\)\. Medals: level 1 none, level 2 none, level 3 none, Legendary none\./);
assert.match(list, /Lights out: Your room · after dark, Bedside Blaster\./);
assert.ok(!list.includes('data-room'), 'hidden buttons do not trigger the old grid handler');
assert.ok(run('mountHospitalMap(hmEl) === hmCanvas'), 'a second mount reuses the canvas');
// The harness's plain mapGrid node works too, which is what renderMap will hand over.
run("mountHospitalMap($('mapGrid'))");
run('mountHospitalMap(hmEl)');
console.log('PASS: mountHospitalMap builds and reuses a canvas plus a labelled hidden button list.');

// Actions: spy on the game's entry points, then tap through the map.
const calls = () => JSON.parse(run('JSON.stringify(hmCalls.splice(0))'));
run(`
var hmCalls = [];
var hmReal = { goRoom, showShop, openDaily, tryOpenArcade, checkDischarge, sfx };
goRoom = id => hmCalls.push('goRoom:' + id);
showShop = () => hmCalls.push('shop');
openDaily = () => hmCalls.push('daily');
tryOpenArcade = id => (hmCalls.push('arcade:' + id), !hospitalMapLocked(id));
checkDischarge = () => hmCalls.push('discharge');
var hmSounds = [];
sfx = name => hmSounds.push(name);
function hmTap(x, y) {
  hmCanvas.events.pointerdown({ clientX: x, clientY: y });
  hmCanvas.events.pointerup({ clientX: x, clientY: y });
}
function hmLayout() {
  return hospitalMapLayout(hospitalMapView.w, hospitalMapView.h);
}
function hmTapRect(r) {
  hmTap(r.x + r.w * 0.3, r.y + r.h / 2);
}
function hmArcade(id) {
  const L = hmLayout(), p = L.places.find(q => q.kind === 'room' && q.id === hospitalMapTile(id));
  return hospitalMapPlate(p, L).arcades.find(a => a.id === id).rect;
}
`);
run('state.started = true; state.room = 0; state.wardClears = [0, 0, 0, 0, 0, 0]');
run('(() => { const p = hmLayout().places.find(q => q.id === 3); hmTap(p.labelAt.x, p.labelAt.y); })()');
assert.deepEqual(calls(), ['goRoom:3'], 'tapping CT travels there');
run('(() => { const L = hmLayout(); hmTapRect(hospitalMapLights(L.places.find(q => q.lightsAt), L)); })()');
assert.deepEqual(calls(), ['goRoom:5'], 'LIGHTS OUT goes to your room after dark');
run('state.room = 5');
assert.equal(run('(() => { const L = hmLayout(); return hospitalMapLights(L.places.find(q => q.lightsAt), L).text; })()'), 'LIGHTS ON');
run('(() => { const L = hmLayout(); hmTapRect(hospitalMapLights(L.places.find(q => q.lightsAt), L)); })()');
assert.deepEqual(calls(), ['goRoom:0'], 'LIGHTS ON comes back to your room');
run('hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "night" } }) } })');
assert.deepEqual(calls(), ['goRoom:0'], 'the hidden switch does the same');
run('state.room = 0; hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "night" } }) } })');
assert.deepEqual(calls(), ['goRoom:5'], 'and turns the lights out by day');
run('(() => { const L = hmLayout(); const c = hospitalMapChip(L.places.find(q => q.id === 0), L); hmTap(c.x + 4, c.y + c.h / 2); })()');
assert.deepEqual(calls(), ['arcade:0'], 'the PLAY chip opens the arcade');
// A tap on a game's name opens its lobby from anywhere, as PLAY does: both of her room's arcades too.
for (const id of [0, 5, 2, 3, 4]) {
  run('state.wardClears = [0, 1, 1, 1, 1, 0]');
  run(`hmTapRect(hmArcade(${id}))`);
  assert.deepEqual(calls(), ['arcade:' + id], `tapping ${GAMES[id]} opens its lobby`);
}
run('state.wardClears = [0, 0, 0, 0, 0, 0]; hospitalMapView.notice = ""; hmTapRect(hmArcade(1))');
assert.deepEqual(calls(), ['arcade:1'], 'a locked game is asked too');
assert.match(run('hospitalMapView.notice'), /gremlins/i, 'and explains itself');
run('hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "game:5" } }) } })');
assert.deepEqual(calls(), ['arcade:5'], 'the hidden game button plays it');
run('(() => { const p = hmLayout().places.find(q => q.kind === "shop"); hmTap(p.labelAt.x, p.labelAt.y); })()');
assert.deepEqual(calls(), ['shop'], 'the gift shop opens the shop');
run('(() => { const d = hmLayout().daily; hmTap(d.x + d.w / 2, d.y + d.h / 2); })()');
assert.deepEqual(calls(), ['daily'], 'the poster opens the Daily Dose');
// A drag that ends somewhere else does nothing.
run(`(() => {
  const L = hmLayout(), a = L.places.find(q => q.id === 1).labelAt, b = L.places.find(q => q.id === 4).labelAt;
  hmCanvas.events.pointerdown({ clientX: a.x, clientY: a.y });
  hmCanvas.events.pointerup({ clientX: b.x, clientY: b.y });
})()`);
assert.deepEqual(calls(), [], 'press and release on different targets is ignored');
// Locked PLAY stays on the map and explains why.
run('state.room = 1');
run('(() => { const L = hmLayout(); const c = hospitalMapChip(L.places.find(q => q.id === 1), L); hmTap(c.x + 4, c.y + c.h / 2); })()');
assert.deepEqual(calls(), ['arcade:1']);
assert.match(run('hospitalMapView.notice'), /gremlins/i, 'a locked arcade leaves a notice on the map');
// Hover and focus outlines find every kind of target.
for (const key of ['game:0', 'game:5', 'game:3', 'night', 'restroom', 'room:1:play', 'exit']) {
  assert.ok(run(`!!hospitalMapTargetShape(${JSON.stringify(key)}, hmLayout())`), `${key} has an outline`);
  run(`hospitalMapView.hover = hospitalMapView.focus = ${JSON.stringify(key)}; hmDraw(hospitalMapView.w, hospitalMapView.h)`);
}
run('hospitalMapView.hover = hospitalMapView.focus = ""');
console.log('PASS: rooms, LIGHTS OUT and LIGHTS ON, PLAY, game names, shop and daily all route correctly.');

// The exit explains itself, word for word from dischargeMissing().
const tapExit = '(() => { const z = hmLayout().exitZone; hmTap(z.x + z.w * 0.6, z.y + z.h / 2); })()';
run(tapExit);
assert.deepEqual(calls(), [], 'a locked exit does nothing');
assert.match(run('hospitalMapView.notice'), /^The exit still wants: 21 more stars \(0\/21\) · a medal in /);
assert.equal(run('hospitalMapView.notice'), run('"The exit still wants: " + dischargeMissing().join(" · ") + "."'));
run('state.medals = [[3, 3, 0, 0], [3, 3, 0, 0], [3, 2, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]]');
run(tapExit);
assert.equal(
  run('hospitalMapView.notice'),
  'The exit still wants: 2 more stars (19/21) · a medal in Bedside Blaster · Ralph evicted from your room.',
  'the playtest case, spelled out'
);
assert.ok(run('hospitalMapView.noticeUntil - time') > 3.5, 'a long list stays up long enough to read');
run('mountHospitalMap(hmEl)');
assert.match(run('hmList.innerHTML'), /Discharge exit\. The exit still wants: 2 more stars \(19\/21\)/, 'the hidden exit button says it too');
// The notice wraps on a phone instead of squashing.
run('hmDraw(346, 577)');
const noticeLines = run('hmLog.filter(e => /stars \\(19|Bedside Blaster ·|Ralph evicted|a medal in Bedside/.test(e.t)).map(e => e.t)');
assert.ok(noticeLines.length >= 2, `the notice wraps on a phone: ${JSON.stringify(noticeLines)}`);
run('state.medals = [[3, 3, 0], [3, 3, 0], [3, 0, 0], [3, 0, 0], [2, 0, 0], [1, 0, 0]]');
assert.equal(run('hospitalMapDischargeReady()'), true);
run(tapExit);
assert.deepEqual(calls(), ['discharge'], 'a complete passport calls checkDischarge');
assert.equal(run('hospitalMapView.notice'), run('HOSPITAL_MAP_COPY.ralphNew'));
run('state.ralphReady = true');
run(tapExit);
assert.deepEqual(calls(), ['discharge']);
assert.equal(run('hospitalMapView.notice'), 'The exit still wants: Ralph evicted from your room.', 'then only Ralph is missing');
// Ralph out and nothing missing: GO HOME, and the exit hands over to the send-off when it exists.
run('state.ralph = true');
assert.equal(run('hospitalMapGoHome()'), true, 'nothing missing and Ralph out reads GO HOME');
run('state.won = true');
run(tapExit);
assert.deepEqual(calls(), [], 'discharged: no more checks');
assert.equal(run('hospitalMapView.notice'), run('HOSPITAL_MAP_COPY.won'), 'without a send-off it says so');
run(`var hmSendOff = 0; dischargeStart = () => hmSendOff++; $('mapDialog').open = true;`);
run(tapExit);
assert.equal(run('hmSendOff'), 1, 'GO HOME starts the send-off');
assert.equal(run("$('mapDialog').open"), false, 'and closes the map first');
run('delete globalThis.dischargeStart; state.won = false; state.ralph = false; state.ralphReady = false; state.medals = Array.from({ length: 6 }, () => [0, 0, 0, 0])');
console.log('PASS: the exit lists exactly what dischargeMissing() says, then reads GO HOME and starts the send-off.');

// The restroom (on the phone plan): every knock knocks twice, rattles the door and gets the next line
// of the deck; the tenth gets the payoff and the sign admits it. state.stats.knocks keeps count.
const deck = J('HOSPITAL_MAP_KNOCKS');
assert.ok(deck.length >= 6, 'a small deck');
for (const line of ['OCCUPIED. STILL.', 'Someone is reading in there. A whole book.', 'It’s Ralph. He’s been in there since Tuesday.'])
  assert.ok(deck.includes(line), `the deck has "${line}"`);
for (const line of [...deck, run('HOSPITAL_MAP_KNOCK_PAYOFF'), ...Object.values(J('HOSPITAL_MAP_COPY')).flat()])
  assert.ok(!/[—–]/.test(line), `no dashes in "${line}"`);
run('state.stats = {}; state.room = 0; hmSounds = []; time = 100');
assert.equal(run('hmLayout().kind'), 'portrait');
const knock = () =>
  run(`(() => { const p = hmLayout().places.find(q => q.kind === 'restroom'); hmTap(p.rect.x + p.rect.w * 0.5, p.rect.y + p.rect.h * 0.8); return hospitalMapView.notice; })()`);
const said = [];
for (let n = 1; n <= 12; n++) {
  said.push(knock());
  assert.equal(run('state.stats.knocks'), n, `knock ${n} is counted`);
  if (n > 1) assert.notEqual(said[n - 1], said[n - 2], `knock ${n} says something new`);
}
assert.deepEqual(calls(), [], 'knocking goes nowhere');
assert.deepEqual(said.slice(0, 9), deck.slice(0, 9), 'the deck in order');
assert.equal(said[9], run('HOSPITAL_MAP_KNOCK_PAYOFF'), 'the tenth knock gets the payoff');
assert.equal(said[10], deck[9 % deck.length], 'then the deck carries on');
assert.equal(JSON.parse(run('localStorage.getItem(STORE)')).stats.knocks, 12, 'the count is saved');
assert.ok(run('hmSounds.filter(s => s === "pump").length') >= 12 && !run('hmSounds.includes("ui")'), 'a knock, not a click');
// The second knock lands a beat later on the map clock; the payoff unlocks the door.
run('hmSounds = []; state.stats.knocks = 9; hospitalMapKnock()');
assert.deepEqual(J('hmSounds.splice(0)'), ['pump']);
run('time += 0.2; hospitalMapSoundTick()');
assert.deepEqual(J('hmSounds.splice(0)'), ['pump'], 'knock-knock');
run('time += 0.4; hospitalMapSoundTick()');
assert.deepEqual(J('hmSounds.splice(0)'), ['unlock'], 'the payoff unlocks');
run('hospitalMapView.knockQueue = [{ at: time - 2, name: "pump" }]; hospitalMapSoundTick()');
assert.deepEqual(J('hmSounds.splice(0)'), [], 'a stale knock is dropped');
// The door rattles for half a second, then rests.
run(`var hmRattles = []; var hmRealDoor = hospitalMapDrawDoor;
  hospitalMapDrawDoor = (g, p, L, r = 0) => (p.kind === 'restroom' && hmRattles.push(r), hmRealDoor(g, p, L, r));`);
run('hospitalMapView.knockT = time - 0.05; hmDraw(hospitalMapView.w, hospitalMapView.h)');
assert.ok(Math.abs(run('hmRattles.pop()')) > 0.01, 'the door rattles');
run('hospitalMapView.knockT = time - 1; hmDraw(hospitalMapView.w, hospitalMapView.h)');
assert.equal(run('hmRattles.pop()'), 0, 'and rests');
run('hospitalMapDrawDoor = hmRealDoor');
assert.ok(run('hmDraw(hospitalMapView.w, hospitalMapView.h)').includes('OCCUPIED. AGAIN.'), 'after the payoff the sign says AGAIN');
run('state.stats = {}');
assert.ok(run('hmDraw(hospitalMapView.w, hospitalMapView.h)').includes('OCCUPIED. ALWAYS.'), 'before it, ALWAYS');
run('hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "restroom" } }) } })');
assert.equal(run('state.stats.knocks'), 1, 'the hidden restroom button knocks too');
assert.equal(run('hospitalMapView.notice'), deck[0]);
run('state.stats = {}');
console.log('PASS: the restroom knocks twice, rattles, answers from the deck, pays off at ten and counts knocks.');

// Keyboard and screen reader buttons do the same things.
run('hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "room:2" } }) } })');
assert.deepEqual(calls(), ['goRoom:2'], 'hidden room button travels');
run('hmList.events.focusin({ target: { closest: () => ({ dataset: { hmap: "shop" } }) } })');
assert.equal(run('hospitalMapView.focus'), 'shop', 'focus highlights the matching place');
run('hmList.events.focusout({})');
assert.equal(run('hospitalMapView.focus'), '');
run('hmDraw(hospitalMapView.w, hospitalMapView.h)');

// ENSURE STORAGE (DO NOT ASK): on the plan past ten refusals, in the hidden list past twenty, and all it
// ever says is "Do not ask."
const storageAt = (w, h) =>
  run(`(() => {
    const L = hospitalMapLayout(${w}, ${h}), r = L.storage.rect, s = hospitalMapStorageSign(null, L);
    return { closet: hospitalMapHit(r.x + r.w / 2, r.y + r.h / 2, ${w}, ${h}), sign: hospitalMapHit(s.x + s.w / 2, s.y + s.h / 2, ${w}, ${h}),
      clear: !hospitalMapInRect(L.daily, s.x + s.w / 2, s.y + s.h / 2, s.w / 2) && !hospitalMapInRect(L.exitZone, s.x + s.w / 2, s.y + s.h / 2) };
  })()`);
for (const [n, shown, listed] of [
  [0, false, false],
  [9, false, false],
  [10, true, false],
  [19, true, false],
  [20, true, true]
]) {
  run(`state.stats = { ensureRefused: ${n} }`);
  for (const [w, h, kind] of SIZES) {
    const texts = run(`hmDraw(${w}, ${h})`),
      at = storageAt(w, h);
    assert.equal(texts.includes('ENSURE STORAGE') && texts.includes('(DO NOT ASK)'), shown, `${kind} at ${n}: storage ${shown ? 'shown' : 'hidden'}`);
    assert.equal((at.closet && at.closet.kind) === 'storage', shown, `${kind} at ${n}: the closet is ${shown ? '' : 'not '}a target`);
    if (shown) {
      assert.equal(at.sign.kind, 'storage', `${kind}: so is its sign`);
      assert.ok(at.clear, `${kind}: the sign keeps clear of the Daily Dose and the exit`);
    }
  }
  run('mountHospitalMap(hmEl)');
  assert.equal(run('hmList.innerHTML').includes('data-hmap="storage"'), listed, `the hidden list at ${n}`);
}
assert.match(run('hmList.innerHTML'), /Ensure storage\. Do not ask\./);
run('hmDraw(390, 600)');
assert.ok(Math.min(...run('hmLog.map(e => parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(e.font)[1]))')) >= 11, 'the storage sign is 11 px or more on a phone too');
run('hospitalMapView.notice = ""; (() => { const r = hmLayout().storage.rect; hmTap(r.x + r.w / 2, r.y + r.h / 2); })()');
assert.deepEqual(calls(), [], 'tapping it does nothing');
assert.equal(run('hospitalMapView.notice'), 'Do not ask.', 'but say so');
run('hospitalMapView.notice = ""; hmList.events.click({ target: { closest: () => ({ dataset: { hmap: "storage" } }) } })');
assert.equal(run('hospitalMapView.notice'), 'Do not ask.', 'the hidden button too');
run('hospitalMapView.focus = "storage"; hmDraw(hospitalMapView.w, hospitalMapView.h); hospitalMapView.focus = ""; state.stats = {}');
console.log('PASS: ENSURE STORAGE (DO NOT ASK) appears at ten, joins the hidden list at twenty, and only ever says "Do not ask."');

run(
  'goRoom = hmReal.goRoom; showShop = hmReal.showShop; openDaily = hmReal.openDaily; tryOpenArcade = hmReal.tryOpenArcade; checkDischarge = hmReal.checkDischarge; sfx = hmReal.sfx'
);
close();
console.log('PASS: the hidden buttons route like the canvas, and the spies are put back.');
