// Hospital map (src/map.js): layouts per aspect, drawing in every state, the Valley Hospital floor 7
// signage (header, corridor, elevator chip, Room 5), hit testing at each room's label, the locked and
// cleared ward markers, mounting into a stub element, and every map action.
const fs = require('node:fs');
const path = require('node:path');
const { run, close, assert, nodes } = require('./harness.cjs');

for (const name of ['hospitalMapDraw', 'hospitalMapHit', 'mountHospitalMap', 'hospitalMapInvalidate', 'hospitalMapLayout']) {
  assert.equal(run(`typeof ${name}`), 'function', `${name} exists`);
}

// Safe before anything is mounted.
run('hospitalMapInvalidate()');
assert.equal(run('hospitalMapView.el'), null);
console.log('PASS: the API exists and hospitalMapInvalidate is safe before mount.');

// A context that records every fillText with the font it was drawn in.
run(`
var hmLog = [];
var hmCtx = new Proxy(
  {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: t => ({ width: String(t).length * 6.5 }),
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
const NAMES = ['Your room', 'MRI room', 'Family lounge', 'CT scan', 'Ultrasound'];

run('state.room = 0; state.wardClears = [0, 0, 0, 0, 0, 0]; state.won = false; state.ralph = false; state.ralphReady = false');
for (const [w, h, kind] of SIZES) {
  assert.equal(run(`hospitalMapLayout(${w}, ${h}).kind`), kind, `${w}x${h} picks ${kind}`);
  assert.equal(run(`hospitalMapDraw(c, ${w}, ${h}).kind`), kind, `${w}x${h} draws`);
  const texts = run(`hmDraw(${w}, ${h})`);
  for (const name of [...NAMES, 'Gift shop', 'DAILY', 'EXIT', 'YOU']) assert.ok(texts.includes(name), `${kind} shows ${name}`);
  assert.ok(texts.includes('PLAY ' + run('games[0].info.game')) || texts.includes('PLAY'), `${kind} shows a PLAY chip in Macy's room`);
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
  assert.ok(texts.includes('ROOM 5') || texts.includes('ROOM 5 · HOME BASE'), `${kind} Macy's plate says Room 5`);
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
assert.deepEqual(
  { ...run('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 0))') },
  { name: 'Your room', sub: 'ROOM 5', subLong: 'ROOM 5 · HOME BASE' }
);
run('state.room = 5');
assert.equal(run('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 0)).subLong'), 'ROOM 5 · THE NIGHT SHIFT', 'after dark too');
run('state.room = 0');
assert.equal(run('hospitalMapPlaceCopy(hospitalMapLayout(900, 560).places.find(p => p.id === 1)).sub'), 'RADIOLOGY', 'other plates unchanged');
assert.match(run('hospitalMapButtonsHtml()'), /Your room \(Room 5\): /, 'the hidden list says Room 5 too');
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

// Phone portrait text never drops below 11 px.
run('hmDraw(390, 600)');
const sizes = run('hmLog.map(e => parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(e.font)[1]))');
assert.ok(sizes.length > 20, 'portrait draws its labels');
assert.ok(Math.min(...sizes) >= 11, `smallest portrait label is ${Math.min(...sizes)} px`);
console.log('PASS: every label on a 390 px wide map is at least 11 px.');

// Each room's label is a tap target for that room, in every layout; so are the other places.
for (const [w, h, kind] of SIZES) {
  for (const id of [0, 1, 2, 3, 4]) {
    const hit = run(`(() => {
      const p = hospitalMapLayout(${w}, ${h}).places.find(q => q.kind === 'room' && q.id === ${id});
      return hospitalMapHit(p.labelAt.x, p.labelAt.y, ${w}, ${h});
    })()`);
    assert.deepEqual({ ...hit }, { kind: 'room', id }, `${kind} label of room ${id}`);
  }
  const at = (expr, label) => run(`(() => { const L = hospitalMapLayout(${w}, ${h}); const q = ${expr}; return hospitalMapHit(q.x, q.y, ${w}, ${h}); })()`);
  assert.equal(at('L.places.find(p => p.moonAt).moonAt').kind, 'night', `${kind} moon chip`);
  assert.equal(at('({ x: L.daily.x + L.daily.w / 2, y: L.daily.y + L.daily.h / 2 })').kind, 'daily', `${kind} daily poster`);
  assert.equal(at('L.places.find(p => p.kind === "shop").labelAt').kind, 'shop', `${kind} gift shop`);
  assert.equal(at('({ x: L.exitZone.x + L.exitZone.w * 0.6, y: L.exitZone.y + L.exitZone.h / 2 })').kind, 'exit', `${kind} exit`);
  assert.equal(run(`hospitalMapHit(1, 1, ${w}, ${h})`), null, `${kind} empty corner`);
}
console.log('PASS: hit tests find every room at its label, plus night, daily, shop and exit, in all three layouts.');

// Locked wards: gremlin eyes, a padlock chip, and LOCKED on the PLAY chip of the room Macy is in.
run('state.room = 1; state.wardClears = [0, 0, 0, 0, 0, 0]');
assert.equal(run('hospitalMapRoomState(1).locked'), true);
for (const [w, h, kind] of SIZES) {
  assert.ok(run(`hmDraw(${w}, ${h})`).includes('LOCKED'), `${kind} shows the locked chip`);
  const chip = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h});
    const c = hospitalMapChip(L.places.find(p => p.id === 1), L);
    return { hit: hospitalMapHit(c.x + c.w / 2, c.y + c.h / 2, ${w}, ${h}), locked: c.locked };
  })()`);
  assert.deepEqual({ ...chip.hit }, { kind: 'room', id: 1, play: true }, `${kind} PLAY chip`);
  assert.equal(chip.locked, true);
}
// Cleared wards: grudge flames (with +N past the pips), PLAY with the game name, no padlock.
run('state.wardClears = [0, 2, 0, 1, 9, 0]');
assert.equal(run('hospitalMapRoomState(1).grudge'), 2);
assert.equal(run('hospitalMapRoomState(1).locked'), false);
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(!texts.includes('LOCKED'), `${kind} has no locked chip once cleared`);
  assert.ok(texts.some(t => t.startsWith('PLAY')), `${kind} shows PLAY`);
  assert.ok(texts.some(t => /^\+\d$/.test(t)), `${kind} shows extra grudge past the pips`);
}
console.log('PASS: locked wards show LOCKED chips; cleared wards show PLAY and grudge flames.');

// After dark, Ralph at the exit, and the discharge party.
run('state.room = 5');
for (const [w, h, kind] of SIZES) {
  const chip = run(`(() => {
    const L = hospitalMapLayout(${w}, ${h});
    const c = hospitalMapChip(L.places.find(p => p.kind === 'room' && p.id === 0), L);
    return hospitalMapHit(c.x + c.w / 2, c.y + c.h / 2, ${w}, ${h});
  })()`);
  assert.deepEqual({ ...chip }, { kind: 'room', id: 5, play: true }, `${kind} night PLAY chip`);
  assert.ok(run(`hmDraw(${w}, ${h})`).includes('z'), `${kind} home tile sleeps after dark`);
}
run('state.ralphReady = true; state.ralph = false');
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('NOPE.') && texts.includes('RALPH'), `${kind} shows Ralph at the exit`);
}
run('state.ralph = true; state.won = true');
for (const [w, h, kind] of SIZES) {
  const texts = run(`hmDraw(${w}, ${h})`);
  assert.ok(texts.includes('FREE!') && !texts.includes('NOPE.'), `${kind} throws the discharge party`);
}
run('state.won = false; state.ralph = false; state.ralphReady = false; state.room = 0');
console.log('PASS: after dark, Ralph at the exit and the discharge party all render.');

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
const list = run('hmList.innerHTML');
for (const key of ['room:0', 'room:1', 'room:2', 'room:3', 'room:4', 'night', 'room:0:play', 'shop', 'daily', 'exit']) {
  assert.ok(list.includes(`data-hmap="${key}"`), `hidden list has ${key}`);
}
assert.equal((list.match(/aria-label="/g) || []).length, 10, 'every hidden button has an aria-label');
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
var hmReal = { goRoom, showShop, openDaily, tryOpenArcade, checkDischarge };
goRoom = id => hmCalls.push('goRoom:' + id);
showShop = () => hmCalls.push('shop');
openDaily = () => hmCalls.push('daily');
tryOpenArcade = id => (hmCalls.push('arcade:' + id), !hospitalMapLocked(id));
checkDischarge = () => hmCalls.push('discharge');
function hmTap(x, y) {
  hmCanvas.events.pointerdown({ clientX: x, clientY: y });
  hmCanvas.events.pointerup({ clientX: x, clientY: y });
}
function hmLayout() {
  return hospitalMapLayout(hospitalMapView.w, hospitalMapView.h);
}
`);
run('state.started = true; state.room = 0; state.wardClears = [0, 0, 0, 0, 0, 0]');
run('(() => { const p = hmLayout().places.find(q => q.id === 3); hmTap(p.labelAt.x, p.labelAt.y); })()');
assert.deepEqual(calls(), ['goRoom:3'], 'tapping CT travels there');
run('(() => { const p = hmLayout().places.find(q => q.moonAt); hmTap(p.moonAt.x, p.moonAt.y); })()');
assert.deepEqual(calls(), ['goRoom:5'], 'the moon chip goes to your room after dark');
run('(() => { const L = hmLayout(); const c = hospitalMapChip(L.places.find(q => q.id === 0), L); hmTap(c.x + 4, c.y + c.h / 2); })()');
assert.deepEqual(calls(), ['arcade:0'], 'the PLAY chip opens the arcade');
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
// The exit does nothing until discharge is possible.
const tapExit = '(() => { const z = hmLayout().exitZone; hmTap(z.x + z.w * 0.6, z.y + z.h / 2); })()';
run(tapExit);
assert.deepEqual(calls(), [], 'a locked exit does nothing');
assert.match(run('hospitalMapView.notice'), /21 more stars/);
run('state.medals = [[3, 3, 0], [3, 3, 0], [3, 0, 0], [3, 0, 0], [2, 0, 0], [1, 0, 0]]');
assert.equal(run('hospitalMapDischargeReady()'), true);
run(tapExit);
assert.deepEqual(calls(), ['discharge'], 'a complete passport calls checkDischarge');
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

run('goRoom = hmReal.goRoom; showShop = hmReal.showShop; openDaily = hmReal.openDaily; tryOpenArcade = hmReal.tryOpenArcade; checkDischarge = hmReal.checkDischarge');
close();
console.log('PASS: rooms, night, PLAY, shop, daily, exit and the hidden buttons all route correctly.');
