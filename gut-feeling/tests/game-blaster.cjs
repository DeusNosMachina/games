// Bedside Blaster: the canvas is the view (the screen's shape on touch, the square with a mouse), the look
// clamps against the painted art, smooth edge scrolling under uneven frames, direct aim
// (tap, slide, mouse, several fingers, gentle edge scrolling, edge arrows), the on-canvas touch controls
// (thumbstick, FIRE, flashlight stun, RELOAD and the stick chip, all through touch()), damage zones,
// armor, the charged pierce, the active reload, juice pickups, pouncer timing, Ralph Jr.'s weak spot,
// pacing, and determinism. Test objects live on T so they never collide with the game's globals.
const {run,close,assert}=require('./harness.cjs');
run('let rng=4242;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296}');
run(`
var T = {};
function bbStart(tier, difficulty = 1) {
  state.difficulty = difficulty; openMini(5); mini.tier = tier; startMini(); launchMini(); updateMini(3.3);
  mini.spawn = 999; mini.bottleT = 999; mini.targets = []; T = {};
}
// Spawns a frozen gremlin with its head centred on room point (hx, hy).
function bbGremlin(kind, hx, hy) {
  const e = spawnCrawler(kind, 'bin'), o = blasterOffset(e.r);
  e.mode = 'crawl'; e.stun = 99; e.x = hx - e.s - o.x; e.y = hy - 2 * e.s - o.y;
  return e;
}
function bbTick(seconds) { for (let t = 0; t < seconds - 1e-9; t += 0.02) updateMini(0.02); }
// Room coordinates to canvas coordinates.
function bbAt(x, y) { const B = blasterRoomBox(); return { x: x + B.x, y: y + B.y }; }
// A finger straight into the touch() hook, in room coordinates.
function bbDown(x, y, id = 1) { BLASTER.touch('down', bbAt(x, y), id); }
function bbMove(x, y, id = 1) { BLASTER.touch('move', bbAt(x, y), id); }
function bbUp(id = 1, kind = 'up') { BLASTER.touch(kind, bbAt(0, 0), id); }
// A finger in canvas coordinates: the touch controls live outside the room. A box press lands mid-box.
function bbPress(kind, p, id) {
  BLASTER.touch(kind, p.w ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : { x: p.x, y: p.y }, id);
}
// A real pointer event at canvas point (cx, cy): the blaster's window listener first (capture), then
// the framework's canvas listener, which hands every pointer to touch().
function bbEvent(type, pointerType, id, cx, cy, extra = {}) {
  const ev = { type, pointerType, pointerId: id, button: 0, target: $('miniCanvas'), currentTarget: $('miniCanvas'),
    preventDefault() {}, ...bbClient(cx, cy), ...extra };
  blasterPointerEvent(ev);
  const fn = $('miniCanvas').events[type];
  if (fn) fn(ev);
}
function bbFinger(type, id, x, y) { const p = bbAt(x, y); bbEvent(type, 'touch', id, p.x, p.y); }
function bbMouse(type, x, y, extra = {}) { const p = bbAt(x, y); bbEvent(type, 'mouse', 1, p.x, p.y, extra); }
// Invert miniPoint's letterboxed mapping for the harness's canvas rect (1000x625 unless a test swaps it).
function bbClient(x, y) {
  const r = $('miniCanvas').getBoundingClientRect(), { w, h } = activeCanvas(),
    s = Math.min(r.width / w, r.height / h) || 1;
  return { clientX: r.left + (r.width - w * s) / 2 + x * s, clientY: r.top + (r.height - h * s) / 2 + y * s };
}
function bbCoarse(on) { matchMedia = q => ({ matches: on && /coarse/.test(q) }); }
function bbTall(on) {
  if (on) { window.innerWidth = 390; window.innerHeight = 844; }
  else { delete window.innerWidth; delete window.innerHeight; }
}
`);
const n=s=>run(s),j=s=>JSON.parse(run('JSON.stringify('+s+')'));
const sight=()=>j('[Math.round(mini.sight.x),Math.round(mini.sight.y)]');

// The canvas is the view, edge to edge: in the screen's own shape on a touch screen (a 600 px short
// side, so nothing is letterboxed) and the 600 x 600 square with a mouse. A turned phone re-fits it.
const screenSize = (w, h) => n(`window.innerWidth=${w};window.innerHeight=${h};resize()`);
n('bbCoarse(true);bbStart(1)');
assert.deepEqual(j('activeCanvas()'), { w: 960, h: 600 }, 'a landscape touch screen (the harness window is 1280 x 800) gets its shape');
assert.deepEqual(j('blasterView()'), { w: 960, h: 600 }, 'and the view is the whole canvas');
assert.deepEqual(j('blasterRoomBox()'), { x: 0, y: 0 }, 'the room starts at the corner');
screenSize(844, 390);
assert.deepEqual(j('activeCanvas()'), { w: 1298, h: 600 }, 'an 844 x 390 phone on its side');
assert.deepEqual(j('[$("miniCanvas").width,$("miniCanvas").height]'), [1298, 600], 'and the canvas element was re-fitted');
// Rotation: the portrait canvas comes in on the resize, and the element follows.
n('bbTall(true);resize()');
assert.equal(n('mini.portrait'), true, 'turned upright, the run flips to its portrait canvas');
assert.deepEqual(j('activeCanvas()'), { w: 600, h: 1298 }, 'which is the upright screen\'s shape');
assert.deepEqual(j('[$("miniCanvas").width,$("miniCanvas").height]'), [600, 1298], 'and the canvas element follows the turn');
n('drawMini()');
n('bbTall(false);window.innerWidth=844;window.innerHeight=390;resize()');
assert.equal(n('mini.portrait'), false, 'turned back on its side');
assert.deepEqual(j('[$("miniCanvas").width,$("miniCanvas").height]'), [1298, 600], 'the canvas element turns back too');
n('drawMini()');
screenSize(2400, 600);
assert.deepEqual(j('activeCanvas()'), { w: 1400, h: 600 }, 'a very wide screen stops at 1400');
close();
n('bbTall(false);bbCoarse(false);bbTall(true);bbStart(1)');
assert.equal(n('mini.portrait'), false, 'with a mouse an upright window keeps the square');
assert.deepEqual(j('activeCanvas()'), { w: 600, h: 600 });
close();
n('bbTall(false);resize();bbStart(1)');
assert.deepEqual(j('activeCanvas()'), { w: 600, h: 600 }, 'so does a laptop window');
n('drawMini()');
close();

// The look clamps: at every view size and at both ends of both ranges, every point along the window's
// edges falls inside some layer's painted art (BLASTER_ART), so the base colour never shows.
const views = [[false, 1280, 800], [true, 1280, 800], [true, 844, 390], [true, 2400, 600], [true, 390, 844], [true, 600, 1040], [true, 390, 1000], [true, 700, 760]];
for (const [touch, w, h] of views) {
  n(`bbCoarse(${touch});window.innerWidth=${w};window.innerHeight=${h};bbStart(1)`);
  const V = j('blasterView()'), R = j('blasterLookRange()');
  const bad = j(`(()=>{const V=blasterView(),R=blasterLookRange(),out=[];
    for(const yaw of R.yaw)for(const pitch of R.pitch){mini.look.yaw=yaw;mini.look.pitch=pitch;
      const pts=[];for(let x=0;x<=V.w;x+=10)pts.push([x,0],[x,V.h]);for(let y=0;y<=V.h;y+=10)pts.push([0,y],[V.w,y]);
      for(const [x,y] of pts){const ok=Object.keys(BLASTER_ART).some(k=>{const o=blasterOffset(BLASTER_LAYERS[k].rate),A=BLASTER_ART[k],X=x-o.x,Y=y-o.y;return X>=A.x0&&X<=A.x1&&Y>=A.y0&&Y<=A.y1});
        if(!ok)out.push([yaw,pitch,x,y])}}
    return out.slice(0,3)})()`);
  assert.deepEqual(bad, [], `${touch ? 'touch' : 'mouse'} ${V.w} x ${V.h}: the art covers the window at every look extreme`);
  assert.ok(R.yaw[0] <= R.yaw[1] && R.pitch[0] <= R.pitch[1], `${V.w} x ${V.h}: a sane range`);
  close();
}
n('bbCoarse(false);bbTall(false);resize()');
// The numbers: the square keeps its old range; a wider view loses yaw by its extra width (half from
// each end), a taller one pitch by its extra height, pinned once nothing is left.
const rangeAt = (touch, w, h) => {
  n(`bbCoarse(${touch});window.innerWidth=${w};window.innerHeight=${h};bbStart(1)`);
  const r = j('blasterLookRange()');
  close();
  return r;
};
assert.deepEqual(rangeAt(false, 1280, 800), { yaw: [300, 1500], pitch: [190, 320] }, 'the square is untouched');
assert.deepEqual(rangeAt(true, 844, 390), { yaw: [649, 1151], pitch: [190, 320] }, 'an 844 x 390 phone');
assert.deepEqual(rangeAt(true, 2400, 600), { yaw: [700, 1100], pitch: [190, 320] }, 'the widest view');
const tallR = rangeAt(true, 390, 844);
assert.ok(tallR.pitch[0] === tallR.pitch[1] && Math.abs(tallR.pitch[0] - 340.2) < 0.5, `a tall phone pins the pitch at ${tallR.pitch[0]}`);
assert.deepEqual(tallR.yaw, [300, 1500], 'and keeps the full yaw');
assert.deepEqual(rangeAt(true, 700, 760).pitch, [215.5, 294.5], 'a slightly tall view keeps a little pitch');
n('bbCoarse(false);bbTall(false);resize()');
console.log('PASS: the canvas is the view in the screen\'s shape, re-fits on a turn, and the look clamps keep the art over it.');

// The touch controls float over the bottom of the view: the stick in the bottom-left corner, FIRE big in
// the bottom-right one with the stun above it and RELOAD to its left, none overlapping; the stick only
// grabs near itself; the HUD stays clear of them; the framework draws no buttons of its own; and where
// its buttons would cover the canvas, everything lifts clear.
for (const [tag, w, h] of [['phone landscape', 844, 390], ['phone portrait', 390, 844], ['tablet', 1280, 800]]) {
  n(`bbCoarse(true);window.innerWidth=${w};window.innerHeight=${h};bbStart(1);T.L=blasterLayout();T.C=activeCanvas()`);
  const C = j('T.C');
  const check = (L, why, lift = 0) => {
    const circles = ['stick', 'fire', 'flash', 'reload'].map(k => ({ k, x: L[k].x, y: L[k].y, r: L[k].r + (k === 'stick' ? 12 : 0) }));
    for (const c of circles)
      assert.ok(c.x - c.r >= 0 && c.x + c.r <= C.w && c.y - c.r >= 0 && c.y + c.r <= C.h - lift, `${tag}${why}: ${c.k} is on the canvas`);
    const [stick, fire, flash, reload] = circles;
    assert.ok(C.h - lift - (stick.y + stick.r) <= 20 && stick.x - stick.r <= 20, `${tag}${why}: the stick sits in the bottom-left corner`);
    assert.ok(C.h - lift - (fire.y + fire.r) <= 20 && C.w - (fire.x + fire.r) <= 20, `${tag}${why}: FIRE sits in the bottom-right corner`);
    assert.ok(fire.r >= 92 && fire.r > flash.r && fire.r > reload.r, `${tag}${why}: FIRE is the big one`);
    assert.ok(flash.y + flash.r <= fire.y - fire.r && Math.abs(flash.x - fire.x) < 10, `${tag}${why}: the stun sits right above FIRE`);
    assert.ok(reload.x + reload.r <= fire.x - fire.r && Math.abs(reload.y - fire.y) < fire.r, `${tag}${why}: RELOAD sits just left of FIRE`);
    for (let a = 0; a < circles.length; a++)
      for (let b = a + 1; b < circles.length; b++) {
        const p = circles[a], q = circles[b];
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r, `${tag}${why}: ${p.k} and ${q.k} do not overlap`);
      }
    const ch = L.chip;
    assert.ok(ch.x >= 0 && ch.x + ch.w <= C.w && ch.y >= 0 && ch.y + ch.h <= C.h - lift, `${tag}${why}: the chip is on the canvas`);
    assert.ok(ch.y + ch.h <= L.stick.y - L.stick.r - 12 && Math.abs(ch.x + ch.w / 2 - L.stick.x) < 1, `${tag}${why}: the chip sits just above the stick`);
    for (const c of circles) {
      const dx = Math.max(ch.x - c.x, 0, c.x - ch.x - ch.w), dy = Math.max(ch.y - c.y, 0, c.y - ch.y - ch.h);
      assert.ok(Math.hypot(dx, dy) >= c.r, `${tag}${why}: the chip clears ${c.k}`);
    }
    return circles;
  };
  const L = j('T.L'), circles = check(L, '');
  // The stick's grab zone is the stick and a margin, nothing more: taps elsewhere aim and shoot.
  const at = (x, y) => n(`blasterControlAt({x:${x},y:${y}})`);
  assert.equal(at(L.stick.x, L.stick.y), 'stick', `${tag}: the stick answers on itself`);
  assert.equal(at(L.stick.x + L.stick.r + 12 + 35, L.stick.y), 'stick', `${tag}: and just off its rim`);
  assert.equal(at(L.stick.x + L.stick.r + 12 + 46, L.stick.y), null, `${tag}: but not past the margin`);
  assert.ok(L.stickZone.r <= L.stick.r + 12 + 40, `${tag}: the zone is the stick plus 40 px`);
  assert.equal(at(C.w / 2, C.h / 2), null, `${tag}: the view centre is room`);
  assert.equal(at(C.w / 2, C.h - 10), null, `${tag}: so is the bottom middle`);
  n(`mini.ammo=mini.magazine=60;T.shots=mini.shotsFired;BLASTER.touch("down",{x:${C.w / 2},y:${C.h - 10}},3);BLASTER.touch("up",{x:${C.w / 2},y:${C.h - 10}},3);bbTick(.2)`);
  assert.equal(n('mini.shotsFired-T.shots'), 1, `${tag}: a tap at the bottom middle shoots`);
  // The HUD keeps clear: the charges panel and reload bar, the labels, and the edge arrows at their lowest.
  const H = j('blasterHudBoxes()');
  const boxes = [H.pips, H.bar, { x: 14, y: 12, w: 180, h: 22 }, { x: C.w - 60, y: 12, w: 40, h: 22 }];
  n('mini.targets=[];for(const id of ["curtainL","cabinetR","railL","railR","dresserL","sofaR"]){const e=spawnCrawler("crawler",id);e.mode="crawl";e.stun=99;e.y+=900}');
  for (const end of [0, 1]) {
    n(`mini.look.yaw=mini.lookTarget.yaw=blasterLookRange().yaw[${end}]`);
    for (const a of j('blasterArrows().map(a=>({x:a.x,y:a.y}))')) boxes.push({ x: a.x, y: a.y - 30, w: 60, h: 60 });
  }
  assert.ok(boxes.length >= 6, `${tag}: arrows on both sides were checked`);
  for (const b of boxes) {
    for (const c of circles) {
      const dx = Math.max(b.x - c.x, 0, c.x - b.x - b.w), dy = Math.max(b.y - c.y, 0, c.y - b.y - b.h);
      assert.ok(Math.hypot(dx, dy) >= c.r, `${tag}: the HUD box at ${b.x},${b.y} clears ${c.k}`);
    }
    const ch = L.chip;
    assert.ok(b.x + b.w <= ch.x || b.x >= ch.x + ch.w || b.y + b.h <= ch.y || b.y >= ch.y + ch.h, `${tag}: the HUD box at ${b.x},${b.y} clears the chip`);
  }
  assert.ok(H.pips.x + H.pips.w / 2 === C.w / 2 && H.bar.y >= H.pips.y + H.pips.h, `${tag}: the charges sit top centre with the reload bar under them`);
  n('mini.targets=[]');
  assert.equal(n('mini.blasterOwnControls'), true, `${tag}: a touch screen runs its own controls`);
  assert.equal(n('$("miniControls").dataset.count'), '0', `${tag}: no framework buttons at all, the game draws its own`);
  assert.equal(n('$("miniControls").innerHTML'), '', `${tag}: and no assist button either`);
  assert.deepEqual(j('blasterCover()'), { bottom: 0, left: 0, right: 0 }, `${tag}: so nothing covers the canvas`);
  // Where the framework's own buttons would sit over the canvas (its geometry for a phone with one
  // button), everything lifts clear of what they cover.
  const cover = j(`(()=>{const vw=${w},vh=${h},f=miniOverlayFrame(vw,vh,T.C.w/T.C.h,MINI_FRAME_SIZES.phone,{t:0,r:0,b:0,l:0},'bottom',1),k=T.C.w/f.fitW;return {bottom:Math.round(f.coverCss.bottom*k),left:Math.round(f.coverCss.left*k),right:Math.round(f.coverCss.right*k)}})()`);
  assert.ok(cover.bottom > 40, `${tag}: the framework would cover a band along the bottom`);
  check(j(`blasterLayout(${JSON.stringify(cover)})`), ' under a cover', cover.bottom);
  n('mini.blasterOwnControls=false');
  assert.deepEqual(j('blasterCover()'), j('mini.frame.cover'), `${tag}: otherwise the blaster reads the framework's cover`);
  n('mini.blasterOwnControls=true;drawMini()');
  close();
}
n('bbCoarse(false);bbTall(false);resize()');
console.log('PASS: controls in the bottom corners over the room, a small stick zone, the HUD clear of them, nothing under the cover.');

// Tap anywhere: the sight sweeps to the tap, then the shot lands on whatever is under it.
n('bbStart(1);T.a=bbGremlin("crawler",200,260);bbDown(200,260);bbUp()');
assert.equal(n('mini.blasterQueue.length'),1,'a tap queues a shot while the sight sweeps');
assert.equal(n('T.a.hp'),1,'the shot has not landed mid-sweep');
n('bbTick(.1)');
assert.equal(n('T.a.mode'),'dying','the tap hit the gremlin under it');
assert.deepEqual(sight(),[200,260],'the sight snapped to the tap');
assert.equal(n('mini.ammo'),6);assert.equal(n('mini.got'),1);assert.equal(n('mini.headshots'),1);
n('mini.targets=[];bbTick(.2);bbDown(520,120);bbUp();bbTick(.1)');
assert.equal(n('mini.shotsFired'),2);assert.equal(n('mini.shotsHit'),1,'a tap on empty floor misses');
// A second finger can tap while the first one is down, through the real pointer path.
n('bbTick(.5);bbFinger("pointerdown",1,300,300);T.b=bbGremlin("crawler",420,240);bbFinger("pointerdown",9,420,240);bbFinger("pointerup",9,420,240)');
n('bbFinger("pointerup",1,300,300);bbTick(.3)');
assert.equal(n('mini.shotsFired'),4,'the second finger fired, and so did the first one\'s tap');
assert.equal(n('T.b.mode'),'dying','the second finger tap hit its target');
close();
console.log('PASS: tap-to-fire with a sight sweep, misses, two-finger tapping.');

// Touch aiming: a sliding finger carries the sight anywhere, ceiling and top corners included, and
// letting go shoots there. Checked through the real pointer path on the mouse screen's square canvas and
// the touch screen's wide and tall ones.
for (const tag of ['square', 'wide', 'tall']) {
  const tall = tag === 'tall',
    box = tall ? { left: 8, top: 100, width: 374, height: 648 } : { left: 0, top: 0, width: 1000, height: 625 };
  n(`bbCoarse(${tag !== 'square'});bbTall(${tall});bbStart(1);mini.ammo=mini.magazine=60;$("miniCanvas").getBoundingClientRect=()=>(${JSON.stringify(box)})`);
  for (const [x, y] of [[3, 3], [597, 3], [300, 2], [2, 300]]) {
    n(`T.shots=mini.shotsFired;bbFinger("pointerdown",5,${x},${y});bbFinger("pointerup",5,${x},${y});bbTick(.2)`);
    assert.deepEqual(sight(), [x, y], `${tag}: a tap reaches ${x},${y}`);
    assert.equal(n('mini.shotsFired-T.shots'), 1, `${tag}: and fires there`);
  }
  // A slide: the sight rides the finger at every step, up to the ceiling, and the room holds still.
  n('T.yaw=mini.lookTarget.yaw;T.pitch=mini.lookTarget.pitch;T.shots=mini.shotsFired;bbFinger("pointerdown",5,300,450)');
  for (const [x, y] of [[290, 440], [260, 330], [180, 200], [120, 90], [300, 75]]) {
    n(`bbFinger("pointermove",5,${x},${y});bbTick(.02)`);
    assert.deepEqual(sight(), [x, y], `${tag}: the sight follows the finger to ${x},${y}`);
  }
  assert.equal(n('mini.lookTarget.yaw'), n('T.yaw'), `${tag}: aiming does not turn the room`);
  assert.equal(n('mini.shotsFired'), n('T.shots'), `${tag}: no shot until the finger lifts`);
  n('T.g=bbGremlin("crawler",300,75);bbFinger("pointerup",5,300,75);bbTick(.1)');
  assert.equal(n('T.g.mode'), 'dying', `${tag}: letting go shoots the gremlin under the sight`);
  // Into the top-left corner: the sight gets there, the room scrolls that way, and the lift is only a look.
  n('T.yaw=mini.lookTarget.yaw;T.pitch=mini.lookTarget.pitch;T.shots=mini.shotsFired;bbFinger("pointerdown",5,300,300);bbFinger("pointermove",5,150,150);bbFinger("pointermove",5,2,2);bbTick(.3)');
  assert.deepEqual(sight(), [2, 2], `${tag}: the sight reaches the top-left corner`);
  assert.ok(n('mini.lookTarget.yaw') < n('T.yaw') - 80, `${tag}: the left edge scrolls the room left`);
  // An upright phone sees the whole height, so its pitch is pinned; elsewhere the top edge tilts up.
  if (tall) assert.equal(n('mini.lookTarget.pitch'), n('T.pitch'), `${tag}: the pinned pitch holds`);
  else assert.ok(n('mini.lookTarget.pitch') < n('T.pitch'), `${tag}: the top edge tilts it up`);
  n('bbFinger("pointerup",5,2,2);bbTick(.2)');
  assert.equal(n('mini.shotsFired'), n('T.shots'), `${tag}: lifting while it scrolls never fires`);
  // A slide that runs off the room onto the blanket keeps the sight on the edge.
  n('bbFinger("pointerdown",5,300,300);bbFinger("pointermove",5,-80,300);bbTick(.05)');
  assert.deepEqual(sight(), [0, 300], `${tag}: past the room's edge the sight stays on it`);
  n('bbFinger("pointerup",5,-80,300);$("miniCanvas").getBoundingClientRect=()=>({width:1000,height:625,left:0,top:0})');
  close();
  n('bbCoarse(false);bbTall(false);resize()');
}
// The right edge scrolls the other way; at the end of the room a slide into the band still shoots.
n('bbStart(1);T.yaw=mini.lookTarget.yaw;bbDown(300,300);bbMove(598,300);bbTick(.25)');
assert.ok(n('mini.lookTarget.yaw') > n('T.yaw') + 60, 'the right edge scrolls right');
n('bbUp();mini.lookTarget.yaw=BLASTER_YAW[1];T.shots=mini.shotsFired;bbDown(300,300);bbMove(590,300);bbTick(.1);bbUp();bbTick(.2)');
assert.equal(n('mini.shotsFired-T.shots'), 1, 'nothing left to scroll, so the lift shoots');
// Hold still, then slide: the charge keeps building and the piercing shot goes where the finger ends up.
n('mini.targets=[];T.c=bbGremlin("bruiser",420,250);bbDown(250,330);bbTick(.3);bbMove(420,250);bbTick(.4)');
assert.equal(n('blasterChargeLevel()'), 1, 'a held, sliding finger charges');
n('bbUp();bbTick(.1)');
assert.equal(n('mini.chargedShots'), 1);assert.equal(n('T.c.mode'), 'dying', 'the charged shot landed where the slide ended');
close();
// The look-around: a few hundred a second deep in the band, which is 12% of the view on each side;
// its first third barely moves, its middle third builds, and its last third is full speed.
assert.ok(n('BLASTER_EDGE_YAW') >= 400 && n('BLASTER_EDGE_YAW') <= 560, 'the edge turns a few hundred a second');
assert.ok(n('BLASTER_EDGE_PITCH') <= 250, 'and tilts gently');
assert.ok(n('blasterEdgeRamp(1/3)') <= 0.15 && n('blasterEdgeRamp(0.5)') > 0.4 && n('blasterEdgeRamp(0.5)') < 0.7 && n('blasterEdgeRamp(2/3)') === 1, 'the band ramps by thirds');
const turn = x => n(`mini.lookTarget.yaw=mini.look.yaw=800;mini.lookVel={yaw:0,pitch:0};bbDown(300,300);bbMove(${x},300);bbTick(1);T.turned=mini.lookTarget.yaw-800;bbUp();bbTick(.3);T.turned`);
n('bbStart(1)');
const full = turn(599), last = turn(600 - 72 * 0.2), middle = turn(600 - 72 * 0.5), early = turn(600 - 72 * 0.8), none = turn(600 - 80);
assert.ok(full > 420 && full <= n('BLASTER_EDGE_YAW'), `a second on the very edge turns ${full.toFixed(0)}`);
assert.ok(Math.abs(last - full) < 1, `the band's last third is already full speed (${last.toFixed(0)})`);
assert.ok(middle > full * 0.3 && middle < full * 0.75, `half way in it builds (${middle.toFixed(0)})`);
assert.ok(early > 0 && early < full * 0.12, `its first third barely moves (${early.toFixed(0)})`);
assert.equal(none, 0, 'and short of the band nothing turns');
close();
// A wide view's band is 12% of its width, so a thumb has room to feather in it.
n('bbCoarse(true);window.innerWidth=844;window.innerHeight=390;bbStart(1);T.V=blasterView()');
assert.ok(Math.abs(n('blasterEdge(T.V.w-0.12*T.V.w*0.5,300).x') - n('blasterEdgeRamp(0.5)')) < 1e-9, 'the band scales with the view');
assert.equal(n('blasterEdge(T.V.w-0.12*T.V.w-2,300).x'), 0);
close();
n('bbCoarse(false);bbTall(false);resize()');
// Smooth under uneven frames and touch events: hold a finger deep in the band and feed the look uneven
// steps. The look only ever moves one way, its speed builds instead of jumping and never passes the
// band's rate, and after the finger lifts it glides to a stop instead of halting.
n('bbStart(1);mini.lookTarget.yaw=mini.look.yaw=700;mini.lookVel={yaw:0,pitch:0};bbDown(300,300);bbMove(596,300)');
const steps = j(`(()=>{const out=[],dts=[16,33,16,50,16,16,33,8,50,16,33,16,16,50,33,16,16,16,33,50].map(v=>v/1000);
  for(const dt of dts){const y0=mini.look.yaw,t0=mini.lookTarget.yaw;blasterUpdateLook(dt);out.push({dt,v:(mini.look.yaw-y0)/dt,tv:(mini.lookTarget.yaw-t0)/dt})}
  bbUp();for(const dt of [16,33,16,50,16,33,16,50].map(v=>v/1000)){const y0=mini.look.yaw,t0=mini.lookTarget.yaw;blasterUpdateLook(dt);out.push({dt,v:(mini.look.yaw-y0)/dt,tv:(mini.lookTarget.yaw-t0)/dt,up:true})}
  return out})()`);
const cap = n('BLASTER_EDGE_YAW');
for (const [i, s] of steps.entries()) {
  assert.ok(s.v >= 0 && s.tv >= 0, `step ${i}: the look never turns back (${s.v.toFixed(1)})`);
  assert.ok(s.v <= cap * 1.001 && s.tv <= cap * 1.001, `step ${i}: never faster than the band (${s.tv.toFixed(0)})`);
}
assert.ok(steps[0].tv < cap * 0.4, `the turn starts gently (${steps[0].tv.toFixed(0)}), not at full speed`);
for (let i = 1; i < 8; i++) assert.ok(steps[i].tv >= steps[i - 1].tv - 1e-6, `step ${i}: the turn speed builds without a dip`);
assert.ok(steps[12].tv > cap * 0.97, 'and settles at the band rate');
const lifted = steps.filter(s => s.up);
assert.ok(lifted[0].tv > 0 && lifted[0].tv < cap, 'a lifted finger lets the turn glide down');
assert.equal(lifted[lifted.length - 1].tv, 0, 'to a stop within a few frames');
close();
// An edge arrow: a tap on it turns the room to face its gremlin, and is not a shot. It is the quick turn.
n('bbStart(1);T.ar=spawnCrawler("crawler","cabinetR");T.ar.mode="crawl";T.ar.stun=99;T.a=blasterArrows()[0]');
assert.equal(n('T.a&&T.a.side'), 1, 'a gremlin past the right edge gets an arrow');
n('T.shots=mini.shotsFired;bbDown(T.a.x+30,T.a.y);bbUp();bbTick(.4);T.px=shooterProjection(T.ar).x');
assert.ok(n('T.px>300&&T.px<560'), 'the arrow brought it into view');
assert.equal(n('mini.shotsFired'), n('T.shots'), 'the arrow tap did not fire');
close();
console.log('PASS: touch aims anywhere on both canvases, slides carry the sight, edges scroll gently, arrows turn.');

// The touch controls, every one through touch(): the stick (on by default) steers and scrolls gently,
// FIRE fires (held, it pierces), the stun stuns, RELOAD reloads, the chip hides the stick and the choice
// is remembered, and the stick, FIRE and a finger in the room all work at once.
n('bbCoarse(true);bbStart(1);delete state.stats.blasterStick;T.L=blasterLayout();mini.ammo=mini.magazine=60');
assert.equal(n('blasterStickShown()'), true, 'the stick is on by default on a touch screen');
n('T.shots=mini.shotsFired;BLASTER.touch("down",{x:40,y:60},3);BLASTER.touch("up",{x:40,y:60},3);bbTick(.2);BLASTER.touch("down",{x:900,y:40},3);BLASTER.touch("up",{x:900,y:40},3);bbTick(.2)');
assert.equal(n('mini.shotsFired') - n('T.shots'), 2, 'away from the controls it is all room: the top corners shoot');
n('T.shots=mini.shotsFired');
n('mini.sight={x:300,y:300};bbPress("down",T.L.stick,2);bbPress("move",{x:T.L.stick.x,y:T.L.stick.y-T.L.stick.r},2);bbTick(.3)');
assert.ok(n('mini.sight.y') < 150 && Math.abs(n('mini.sight.x') - 300) < 1, 'pushing the stick up raises the sight');
n('bbPress("move",{x:T.L.stick.x+T.L.stick.r,y:T.L.stick.y},2);T.sx=mini.sight.x;bbTick(.2)');
assert.ok(n('mini.sight.x') > n('T.sx') + 80, 'and right moves it right');
n('T.sy=mini.sight.y;T.sx=mini.sight.x;bbPress("move",{x:T.L.stick.x+3,y:T.L.stick.y+2},2);bbTick(.3)');
assert.ok(Math.abs(n('mini.sight.y') - n('T.sy')) < 2 && Math.abs(n('mini.sight.x') - n('T.sx')) < 2, 'a centred stick holds the sight still');
n('bbPress("up",T.L.stick,2);T.off={x:T.L.stick.x-70,y:T.L.stick.y+40};bbPress("down",T.off,2);T.b=mini.blasterPresses.p2');
assert.ok(n('T.b.how==="stick"&&T.b.kx===0&&T.b.ky===0&&T.b.cx===T.off.x'), 'a thumb that lands off the stick centres it there');
n('bbPress("up",T.off,2)');
// Pinned on an edge, the stick turns the room gently, and easing off eases the turn.
n('mini.lookTarget.yaw=mini.look.yaw=1300;mini.sight={x:300,y:300};T.shots=mini.shotsFired;bbPress("down",T.L.stick,2);bbPress("move",{x:T.L.stick.x-T.L.stick.r,y:T.L.stick.y},2);bbTick(1.2)');
assert.deepEqual(sight().map(v => v === 0), [true, false], 'the stick pins the sight on the left edge');
assert.ok(n('mini.lookTarget.yaw') < 1300 - 150, 'where it scrolls the room');
assert.ok(n('mini.lookTarget.yaw') > 1300 - n('BLASTER_EDGE_YAW') * 1.2, 'no faster than the edge allows');
n('T.yaw=mini.lookTarget.yaw;bbPress("move",{x:T.L.stick.x-T.L.stick.r*.45,y:T.L.stick.y},2);bbTick(.5);T.half=T.yaw-mini.lookTarget.yaw');
n('T.yaw=mini.lookTarget.yaw;bbPress("move",{x:T.L.stick.x-T.L.stick.r,y:T.L.stick.y},2);bbTick(.5);T.full=T.yaw-mini.lookTarget.yaw');
assert.ok(n('T.half') > 0 && n('T.half') < n('T.full') * 0.65, 'a lighter push on the edge turns slower');
n('bbPress("up",T.L.stick,2);bbTick(.1)');
assert.equal(n('mini.shotsFired'), n('T.shots'), 'the stick never fires');
// FIRE shoots at the sight; held, it charges and pierces.
n('mini.sight={x:200,y:200};bbPress("down",T.L.fire,3);bbPress("up",T.L.fire,3)');
assert.equal(n('mini.shotsFired'), n('T.shots') + 1, 'FIRE shoots at the sight');
assert.equal(n('mini.chargedShots'), 0);
n('bbTick(.3);T.g=bbGremlin("bruiser",200,200);bbPress("down",{x:T.L.fire.x+T.L.fire.r,y:T.L.fire.y},3);bbTick(.7)');
assert.equal(n('blasterChargeLevel()'), 1, 'a held FIRE charges, even pressed near its rim');
n('bbPress("up",T.L.fire,3)');
assert.equal(n('mini.chargedShots'), 1, 'and lets go a piercing shot');
assert.equal(n('T.g.mode'), 'dying');
n('bbTick(.3);bbPress("down",T.L.fire,3);bbTick(.2);bbPress("cancel",T.L.fire,3);T.shots=mini.shotsFired;bbTick(.2)');
assert.equal(n('mini.shotsFired'), n('T.shots'), 'a lost FIRE press never fires');
assert.equal(n('mini.blasterTrigger'), null);
// The stick, FIRE and a finger in the room, all at once.
n('mini.targets=[];T.shots=mini.shotsFired;mini.sight={x:300,y:300};bbPress("down",T.L.stick,2);bbPress("move",{x:T.L.stick.x,y:T.L.stick.y-30},2);bbPress("down",T.L.fire,3)');
n('T.g2=bbGremlin("crawler",420,240);bbDown(420,240,4);bbUp(4);bbTick(.2)');
assert.equal(n('T.g2.mode'), 'dying', 'a finger in the room shoots while the stick and FIRE are held');
n('T.sy=mini.sight.y;bbTick(.2)');
assert.ok(n('mini.sight.y') < n('T.sy'), 'and the stick keeps steering');
n('bbPress("up",T.L.fire,3);bbPress("up",T.L.stick,2);bbTick(.1)');
assert.equal(n('mini.shotsFired') - n('T.shots'), 2, 'FIRE fired on release too');
// The flashlight stun, above FIRE.
n('T.h=mini.helps;T.shots=mini.shotsFired;T.sw=spawnCrawler("crawler","bin");T.sw.mode="wind";T.sw.wind=.5;bbPress("down",T.L.flash,5);bbPress("up",T.L.flash,5)');
assert.equal(n('mini.helps'), n('T.h') - 1, 'the stun button spends an assist');
assert.ok(n('T.sw.stun>0'), 'and stuns what is in view');
assert.ok(n('mini.flashText').includes('STUN'));
assert.equal(n('mini.shotsFired'), n('T.shots'), 'it is not a shot');
// RELOAD, beside FIRE: a press starts the reload and a second one in the green makes it hot.
n('mini.targets=[];mini.magazine=7;mini.ammo=3;bbPress("down",T.L.reload,6);bbPress("up",T.L.reload,6)');
assert.ok(n('mini.reload>0'), 'RELOAD reloads');
n('T.w=blasterReloadWindow();bbTick(T.w[0]+.04);bbPress("down",T.L.reload,6);bbPress("up",T.L.reload,6)');
assert.equal(n('mini.cleanReloads'), 1, 'and a press in the green is a hot reload');
assert.equal(n('mini.ammo'), 7);
// The chip hides the stick and remembers it; hidden, that corner is just room.
n('T.shots=mini.shotsFired;bbPress("down",T.L.chip,7);bbPress("up",T.L.chip,7)');
assert.equal(n('state.stats.blasterStick'), 0, 'the chip hides the stick');
assert.equal(JSON.parse(n('localStorage.getItem(STORE)')).stats.blasterStick, 0, 'and the choice is saved');
assert.equal(n('blasterStickShown()'), false);
n('mini.sight={x:300,y:300};bbPress("down",T.L.stick,2);T.p=mini.blasterPresses.p2||null;bbPress("move",{x:T.L.stick.x,y:T.L.stick.y-60},2);bbTick(.3);bbPress("up",T.L.stick,2);bbTick(.1)');
assert.equal(n('T.p.how'), 'touch', 'hidden, the stick is not there to grab: that corner is room');
assert.deepEqual(sight(), j('[Math.round(T.L.stick.x),Math.round(T.L.stick.y-60)]'), 'and a finger there carries the sight');
n('T.f=bbGremlin("crawler",450,300);bbDown(450,300);bbUp();bbTick(.12)');
assert.equal(n('T.f.mode'), 'dying', 'a finger in the room still fires where it lands');
n('drawMini();bbPress("down",T.L.fire,3);drawMini();bbPress("up",T.L.fire,3);mini.ammo=0;reloadBlaster();drawMini()');
close();
n('bbStart(1)');
assert.equal(n('blasterStickShown()'), false, 'the next night remembers the stick is hidden');
n('T.L=blasterLayout();bbPress("down",T.L.chip,7);bbPress("up",T.L.chip,7)');
assert.equal(n('state.stats.blasterStick'), 1, 'the chip shows it again');
assert.equal(JSON.parse(n('localStorage.getItem(STORE)')).stats.blasterStick, 1);
assert.equal(n('blasterStickShown()'), true);
close();
n('bbCoarse(false)');
// A mouse screen keeps the DOM buttons and has no touch controls; a finger still taps in the room.
n('bbStart(1)');
assert.equal(n('mini.blasterOwnControls'), false, 'with a mouse the framework buttons stay');
assert.ok(n('$("miniControls").innerHTML').includes('data-action="fire"') && n('$("miniControls").innerHTML').includes('data-action="reload"'));
assert.equal(n('$("miniControls").dataset.count'), '3', 'FIRE, RELOAD and the assist');
assert.equal(n('blasterTouchUI()'), false, 'and no touch controls');
n('bbMouse("pointermove",76,452)');
assert.equal(n('blasterStickShown()'), false, 'a mouse never sees the stick');
assert.deepEqual(sight(), [76, 452], 'and aims there as before');
n('T.shots=mini.shotsFired;bbFinger("pointerdown",7,76,452);T.how=mini.blasterPresses.p7&&mini.blasterPresses.p7.how;bbFinger("pointerup",7,76,452);bbTick(.2)');
assert.equal(n('T.how'), 'touch', 'where the stick would be is just room');
assert.equal(n('mini.shotsFired'), n('T.shots') + 1, 'so a finger taps and fires there');
n('mini.sight={x:300,y:300};mini.fireHeld=false;bbTick(.3);miniAction("fire")');
assert.equal(n('mini.shotsFired'), n('T.shots') + 2, 'and the FIRE button shoots at the sight');
close();
console.log('PASS: stick, FIRE, stun, RELOAD and chip through touch(), all at once, remembered; mouse keeps the DOM row.');

// Mouse: the sight follows the pointer, a left click fires there, right-drag or Shift-drag looks, edges auto-pan.
n('bbStart(1);bbMouse("pointermove",150,330)');
assert.deepEqual(sight(),[150,330],'the sight follows the mouse');
n('T.c=bbGremlin("crawler",150,330);bbMouse("pointerdown",150,330);bbMouse("pointerup",150,330)');
assert.equal(n('T.c.mode'),'dying','a click fires at the pointer immediately');
n('T.yaw=mini.lookTarget.yaw;bbMouse("pointerdown",300,300,{button:2});bbMouse("pointermove",250,300,{button:2});bbMouse("pointerup",250,300,{button:2})');
assert.equal(n('Math.round(mini.lookTarget.yaw-T.yaw)'),-90,'right-drag pans');
assert.equal(n('mini.shotsFired'),1,'right-drag never fires');
n('bbMouse("pointerdown",300,300,{shiftKey:true});bbMouse("pointermove",350,300);bbMouse("pointerup",350,300)');
assert.equal(n('Math.round(mini.lookTarget.yaw-T.yaw)'),0,'Shift-drag pans');
n('bbMouse("pointermove",595,300);T.yaw=mini.lookTarget.yaw;bbTick(.3)');
assert.ok(n('mini.lookTarget.yaw')>n('T.yaw')+50,'the room drifts when the sight nears an edge');
n('bbMouse("pointerout",595,300);T.yaw=mini.lookTarget.yaw;bbTick(.3)');
assert.equal(n('mini.lookTarget.yaw'),n('T.yaw'),'auto-pan stops when the mouse leaves');
n('drawMini()');
close();
console.log('PASS: mouse sight follow, click to fire, right/Shift drag, edge auto-pan.');

// Damage: headshots do double; bedpan helmets pop on the first headshot; bruisers shrug off body shots.
n('bbStart(1);T.h=bbGremlin("helmet",300,250);fireBlaster(300,250)');
assert.equal(n('T.h.helmet'),false,'the first headshot pops the helmet');assert.equal(n('T.h.hp'),1);
n('mini.shotCd=0;fireBlaster(300,250)');assert.equal(n('T.h.mode'),'dying');
n('T.br=bbGremlin("bruiser",300,250);mini.shotCd=0;fireBlaster(300,250+20*T.br.s)');
assert.equal(n('T.br.hp'),3,'a body shot bounces off a bruiser');
n('mini.shotCd=0;fireBlaster(300,250)');assert.equal(n('T.br.hp'),1,'a headshot does two');
n('T.cr=bbGremlin("crawler",300,250);mini.targets=[T.cr];mini.shotCd=0;fireBlaster(300,250+20*T.cr.s)');
assert.equal(n('T.cr.mode'),'dying','one body shot evicts a crawler');
close();
console.log('PASS: headshots, helmet pops, bruiser shrugs.');

// Charged shot: hold 0.6 s and release; the beam pierces everything along its line.
n('bbStart(1);mini.sight={x:300,y:300};T.M=blasterMuzzle();T.L=Math.hypot(300-T.M.x,300-T.M.y);T.ux=(300-T.M.x)/T.L;T.uy=(300-T.M.y)/T.L');
n('T.p1=bbGremlin("crawler",300,300);T.p2=bbGremlin("crawler",300+T.ux*130,300+T.uy*130);fireBlaster(300,300)');
assert.equal(n('T.p1.mode'),'dying');assert.equal(n('T.p2.mode'),'crawl','a normal shot stops at the first gremlin');
n('mini.targets=[];bbTick(.3);mini.sight={x:300,y:300};T.q1=bbGremlin("crawler",300,300);T.q2=bbGremlin("crawler",300+T.ux*130,300+T.uy*130);T.q3=bbGremlin("bruiser",80,120)');
n('bbDown(300,300);bbTick(.66);bbUp()');
assert.equal(n('mini.chargedShots'),1,'a still hold fired a charged shot on release');
assert.equal(n('T.q1.mode'),'dying');assert.equal(n('T.q2.mode'),'dying','the charged shot pierced the second gremlin');
assert.equal(n('T.q3.hp'),3,'nothing off the line was touched');
assert.equal(n('mini.pierces'),1);
n('mini.targets=[];bbTick(.3);T.q4=bbGremlin("bruiser",300,300);fireBlaster(300,300+20*T.q4.s,true)');
assert.equal(n('T.q4.hp'),1,'charged body shots get through a bruiser');
// FIRE button / Space: press starts, release fires; the click that follows a held button is not a second shot.
n('mini.targets=[];bbTick(.3);T.shots=mini.shotsFired;mini.fireHeld=true;miniAction("fire");bbTick(.7);mini.fireHeld=false;miniAction("fire");bbTick(.1)');
assert.equal(n('mini.shotsFired-T.shots'),1,'one held trigger, one shot');assert.equal(n('mini.chargedShots'),3);
n('bbTick(.4);miniAction("fire")');assert.equal(n('mini.shotsFired-T.shots'),2,'a plain FIRE tap shoots at the sight');
close();
console.log('PASS: charged pierce through two gremlins, bruiser armor, FIRE hold and release.');

// Active reload: inside the green is instant and hot; outside jams it.
n('bbStart(1);mini.ammo=1;mini.sight={x:520,y:120};fireBlaster()');
assert.ok(n('mini.reload>0'),'emptying the magazine starts a reload');
n('T.w=blasterReloadWindow();bbTick(T.w[0]+.04);reloadBlaster()');
assert.equal(n('mini.reload'),0);assert.equal(n('mini.ammo'),7);assert.equal(n('mini.hot'),2);assert.equal(n('mini.cleanReloads'),1);
n('T.hb=bbGremlin("bruiser",300,250);fireBlaster(300,250)');
assert.equal(n('T.hb.mode'),'dying','a hot headshot does four');assert.equal(n('mini.hot'),1);
n('mini.ammo=1;mini.shotCd=0;mini.hot=0;fireBlaster(520,120);bbTick(.05);reloadBlaster()');
assert.equal(n('mini.jams'),1,'pressing outside the green jams');
n('bbTick(mini.reloadBase-.04)');assert.ok(n('mini.reload>0'),'a jam is slower than a plain reload');
n('bbTick(.8)');assert.equal(n('mini.ammo'),7);
assert.ok(n('(()=>{const a=blasterTuning(0),b=blasterTuning(2);return a.window[1]-a.window[0]>b.window[1]-b.window[0]})()'),'level 1 has the wider green');
close();
console.log('PASS: active reload window, hot rounds, jams.');

// Juice bottles add three charges.
n('bbStart(1);T.spot=BLASTER_PERCHES.find(p=>p.layer==="mid"&&p.x===852);T.bt=blasterSpawnBottle(T.spot);T.bp=shooterProjection(T.bt);mini.ammo=3;fireBlaster(T.bp.x,T.bp.y)');
assert.equal(n('mini.ammo'),5,'shooting the bottle pays three charges for one');assert.equal(n('mini.bottlesShot'),1);
n('blasterSpawnBottle(T.spot);mini.ammo=9;mini.shotCd=0;fireBlaster(T.bp.x,T.bp.y)');
assert.equal(n('mini.ammo'),10,'juice can overfill the magazine by three');
close();
console.log('PASS: juice bottle pickups.');

// Pouncers: watch 2 and later, with a short wind-up and a fast leap. Leaps that land cost an oops.
for(let t=0;t<3;t++)assert.ok(n(`!BLASTER_MIX[${t}][0].pouncer&&BLASTER_MIX[${t}][1].pouncer>0`),`level ${t+1} pouncers wait for watch 2`);
n('bbStart(1);mini.shift=1;T.cw=spawnCrawler("crawler","dresserL");T.pw=spawnCrawler("pouncer","bedside")');
assert.ok(n('T.pw.windMax<T.cw.windMax*.5&&T.pw.leapDuration<T.cw.leapDuration*.6'),'pouncers have short fuses');
n('mini.targets=[T.pw];T.pw.mode="wind";T.pw.wind=T.pw.windMax;T.waited=0;while(T.pw.mode==="wind"){updateMini(.01);T.waited+=.01}');
assert.ok(Math.abs(n('T.waited-T.pw.windMax'))<.03,'the pouncer leaps right on its wind-up');
n('T.flew=0;while(mini.targets.includes(T.pw)){updateMini(.01);T.flew+=.01}');
assert.ok(n('T.flew')<=0.6,'the leap is fast');
assert.equal(n('mini.miss'),1,'a landed leap is an oops');assert.ok(n('mini.splat!==null'),'and slime on the lens');
n('bbTick(1.5)');assert.equal(n('mini.splat'),null,'the lens wipes clean');
n('T.lw=spawnCrawler("crawler","bin");T.lw.mode="leap";T.lw.leap=T.lw.leapDuration*.5;T.lp=shooterProjection(T.lw);fireBlaster(T.lp.x+T.lp.s,T.lp.y+2*T.lp.s)');
assert.equal(n('T.lw.mode'),'dying','a gremlin can be shot mid-leap');
n('T.sw=spawnCrawler("crawler","bin");T.sw.mode="wind";T.sw.wind=.2;T.sl=spawnCrawler("crawler","bedside");T.sl.mode="leap";T.sl.leap=.1;miniAction("assist");bbTick(.4)');
assert.equal(n('T.sw.mode'),'wind');assert.equal(n('T.sl.mode'),'wind','the stun knocks leapers back');assert.ok(n('T.sw.stun>0'));
close();
console.log('PASS: pouncer timing, face splats, mid-air shots, flashlight stun.');

// Ralph Jr.: armored until he roars; two mouth hits make him flinch, fewer and he lunges.
n('bbStart(2);T.rj=blasterSpawnBoss();bbTick(.8);T.rj.mode="idle";T.rj.cycleT=9;T.rp=shooterProjection(T.rj);T.mx=T.rp.x+2*T.rj.s;T.my=T.rp.y+17*T.rj.s');
assert.ok(n('T.mx>0&&T.mx<600'),'Ralph Jr. lands in view');
n('fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.hp'),14,'his mouth is shut until he roars');
n('T.rj.mode="roar";T.rj.cycleT=1;T.rj.roarHits=0;mini.shotCd=0;fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.hp'),12,'the open mouth is the weak spot');
n('mini.shotCd=0;fireBlaster(T.rp.x,T.rp.y-10*T.rj.s)');assert.equal(n('T.rj.hp'),12,'the rest of him is still armor');
n('mini.shotCd=0;fireBlaster(T.mx,T.my);bbTick(1.05)');assert.equal(n('T.rj.mode'),'stagger','two hits make him flinch');assert.equal(n('mini.miss'),0);
n('T.rj.mode="roar";T.rj.cycleT=.2;T.rj.roarHits=0;bbTick(1.4)');assert.equal(n('mini.miss'),1,'an unpunished roar ends in a lunge at your face');
n('T.rj.mode="roar";T.rj.cycleT=1;T.rj.hp=2;mini.shotCd=0;fireBlaster(T.mx,T.my)');assert.equal(n('T.rj.mode'),'dying');assert.equal(n('mini.bossDown'),true);
close();
n('bbStart(2);mini.spawn=1;mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');
assert.ok(n('mini.targets.some(e=>e.kind==="boss")'),'Ralph Jr. crashes level 3 watch 3');close();
n('bbStart(1);mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');assert.ok(n('!mini.bossSpawned'),'but only on level 3');close();
console.log('PASS: Ralph Jr. weak spot, flinch, lunge and arrival.');

// Pacing: spawns run to the final seconds; level 1 is slower, sparser and more patient than level 3.
for(let tier=0;tier<3;tier++){
  n(`bbStart(${tier});mini.spawn=1;mini.bottleT=99;while(mini.screen==="play"){updateMini(.05);mini.targets=[]}`);
  const times=j('mini.spawnTimes'),limit=n('mini.limit');
  assert.equal(n("mini.screen"),"outro");assert.ok(times[times.length-1]>limit-2.6,`level ${tier+1} still spawns in the last seconds`);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]<4.3,`level ${tier+1} spawn gap at ${times[i]}`);
  close();
}
for(let s=0;s<3;s++){
  const easy=j(`blasterTuning(0,${s})`),hard=j(`blasterTuning(2,${s})`);
  assert.ok(easy.interval>hard.interval*1.3,'level 1 spawns slower');assert.ok(easy.windup>hard.windup*1.5,'level 1 winds up longer');
  assert.ok(easy.creep>hard.creep&&easy.peek>hard.peek&&easy.cap<hard.cap,'level 1 crawls slower, peeks longer, crowds less');
}
n('bbStart(0)');assert.equal(n('blasterTuning().cap'),1,'First Rodeo starts one at a time');
const first=j('(()=>{mini.spawn=0;updateMini(.02);return mini.targets.map(e=>blasterHideVisible(BLASTER_HIDES.find(h=>h.id===e.hideId)))})()');
assert.deepEqual(first,[true],'the first gremlin appears in view');close();
console.log('PASS: spawns to the end with a rush, and level 1 is gentler than level 3.');

// Same seed, same night; routes come from furniture anchors, not a fixed list.
const night=seed=>{n(`rng=${seed};bbStart(1);mini.spawn=.5;for(let i=0;i<900;i++){updateMini(.02);for(const e of mini.targets)if(e.mode==="leap")e.mode="dying"}`);const r=n('mini.targets.map(e=>e.kind+"@"+(e.hideId||"")+":"+Math.round(e.path?e.path[1].x:0)).join()+"|"+mini.spawnTimes.map(t=>t.toFixed(2)).join()');close();return r;};
assert.equal(night(77),night(77),'deterministic for a given seed');
assert.notEqual(night(77),night(78),'different seeds take different routes');
n('rng=5;bbStart(1);mini.shift=1;T.routes=new Set();for(let i=0;i<30;i++){mini.targets=[];const e=spawnCrawler();T.routes.add(e.hideId+">"+Math.round(e.path[2].x))}');
assert.ok(n('T.routes.size')>=8,'watch 2 routes vary');close();
console.log('PASS: deterministic, randomized routes.');

// Every drawing path runs: hints, leaps, splat, boss roar, reload, charge, mouse cursor.
n('bbStart(0);mini.spawn=0;bbTick(.5);drawMini();T.d1=spawnCrawler("bruiser","bin");T.d1.mode="leap";T.d1.leap=.4;blasterSpawnBottle();drawMini()');
n('mini.splat={t:.6,x:300,y:300};mini.ammo=0;reloadBlaster();mini.fireHeld=true;miniAction("fire");bbTick(.7);drawMini();mini.fireHeld=false;bbTick(.1)');
n('T.d2=blasterSpawnBoss();bbTick(.8);T.d2.mode="roar";mini.rush=true;mini.lightBurst=.5;mini.muzzle=.05;drawMini();T.d2.mode="lunge";T.d2.leap=.3;drawMini();pauseMini();drawMini();pauseMini()');
n('bbMouse("pointermove",300,300);drawMini();finishMini(false);updateMini(2.3);drawResultArt();BLASTER.scene($("miniPreview").getContext("2d"),420,240)');
close();
console.log('PASS: every blaster draw path runs.');

// Legendary (level 4): registered, with every breed from the first watch, shorter fuses than level 3, six
// charges, a longer night with a bigger quota, and Ralph Jr. twice but never two at once.
assert.equal(n('BLASTER.legendary'), true, 'Bedside Blaster has a Legendary level');
assert.equal(n('BLASTER.tierNotes.length'), 4);
assert.equal(n('miniTierCount(BLASTER)'), 4);
for (const k of ['crawler', 'helmet', 'bruiser', 'pouncer']) assert.ok(n(`BLASTER_MIX[3][0].${k}>0`), `Legendary watch 1 has ${k}s`);
for (let s = 0; s < 3; s++) {
  const l3 = j(`blasterTuning(2,${s})`), l4 = j(`blasterTuning(3,${s})`);
  assert.ok(l4.windup < l3.windup && l4.leap < l3.leap, `Legendary watch ${s + 1} has shorter fuses than level 3`);
  assert.ok(Object.values(l4).flat().every(Number.isFinite), 'every Legendary number is finite');
  assert.ok(l4.cap >= l3.cap, 'and at least as big a crowd');
}
assert.ok(n('BLASTER_MAGAZINES[3]<BLASTER_MAGAZINES[2]&&BLASTER_GOALS[3]>BLASTER_GOALS[2]'), 'fewer charges, more evictions');
n('bbStart(3)');
assert.equal(n('mini.limit'), 150, 'the longest night');
assert.equal(n('mini.magazine'), 6);assert.equal(n('mini.ammo'), 6);
assert.ok(n('BLASTER.lesson().goal').includes('Legendary'), 'the briefing says so');
assert.ok(n('BLASTER.shiftMessage(1)').includes('Ralph Jr.'), 'watch 2 warns about Ralph Jr.');
n('mini.phaseTime=mini.limit/3+.01;bbTick(.1);T.r1=mini.targets.find(e=>e.kind==="boss")');
assert.ok(n('!!T.r1'), 'Ralph Jr. crashes Legendary watch 2');assert.equal(n('mini.bossVisits'), 1);
n('mini.phaseTime=mini.limit*2/3+.01;bbTick(.1)');
assert.equal(n('mini.targets.filter(e=>e.kind==="boss").length'), 1, 'watch 3 waits while he is still in the room');
n('T.r1.mode="roar";T.r1.cycleT=9;T.r1.hp=2;T.rp=shooterProjection(T.r1);mini.shotCd=0;fireBlaster(T.rp.x+2*T.r1.s,T.rp.y+17*T.r1.s)');
assert.equal(n('T.r1.mode'), 'dying');
n('bbTick(1.1);T.r2=mini.targets.find(e=>e.kind==="boss")');
assert.ok(n('!!T.r2&&T.r2!==T.r1'), 'then he is back for watch 3');
assert.ok(n('mini.flashText').includes('BACK'));assert.equal(n('mini.bossVisits'), 2);
n('bbTick(.8);T.r2.mode="roar";T.r2.cycleT=9;T.r2.hp=2;T.rp=shooterProjection(T.r2);mini.shotCd=0;mini.ammo=3;fireBlaster(T.rp.x+2*T.r2.s,T.rp.y+17*T.r2.s);bbTick(1.1)');
assert.equal(n('mini.bossDowns'), 2);assert.ok(n('BLASTER.onWin()').includes('twice'));
assert.ok(n('!mini.targets.some(e=>e.kind==="boss")'), 'and only twice');
close();
// The lobby offers it once level 3 has a medal.
n('T.m=state.medals[5].slice();state.medals[5][2]=1;openMini(5)');
assert.ok(n('$("tierGrid").innerHTML').includes('LEVEL 4'), 'the lobby shows Legendary');
n('state.medals[5]=T.m');close();
// Idle play loses Legendary on every prescription.
for (let d = 0; d < 3; d++) {
  n(`state.difficulty=${d};openMini(5);mini.tier=3;startMini();launchMini();updateMini(3.3);for(let i=0;i<4000&&mini.screen==="play";i++)updateMini(.05);updateMini(2.3)`);
  assert.equal(n('mini.screen'), 'result');assert.equal(n('mini.win'), false, `idle Legendary P${d} lost`);
  close();
}
// Every screen of a Legendary run draws, in a wide and a tall window, on a touch screen and with a mouse.
for (const [tall, touch] of [[false, false], [true, false], [false, true], [true, true]]) {
  n(`bbCoarse(${touch});bbTall(${tall})`);
  n('state.difficulty=2;openMini(5);mini.tier=3;startMini();drawMini();launchMini();drawMini();updateMini(3.3);drawMini()');
  assert.equal(n('mini.screen'), 'play');
  n('for(let i=0;i<70;i++){updateMini(.05);drawMini()}');
  n('mini.phaseTime=mini.limit/3+.01;updateMini(.05);drawMini();T.lb=mini.targets.find(e=>e.kind==="boss");T.lb.mode="roar";drawMini();mini.ammo=0;reloadBlaster();drawMini()');
  n('finishMini(true);drawMini();updateMini(2.3);drawResultArt();drawMini()');
  assert.equal(n('mini.screen'), 'result');
  close();
  n('bbCoarse(false);bbTall(false);resize()');
}
console.log('PASS: Legendary: every breed, short fuses, six charges, Ralph Jr. twice, idle loses, every screen draws.');
