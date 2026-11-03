// Not part of the suite. A human-speed yardstick for the ward: a player who sees the fight a quarter second
// late, walks up and taps SWING at the nearest gremlin, backs off from wind-ups (and steps off charge lanes,
// blob lines, gunk rings, the CT donut's lit lane and whatever the MRI magnet is about to fling), jumps a
// charge, a lunge or the donut that is about to land, holds SHIELD when cornered with JUMP and the dash both
// resting, lobs a BRICK at a bruiser at range, eats when down to two hearts and picks up nutrients and
// hidden bricks when nothing is coming. Only inputs: the joystick (a double-tap of it dashes, the second tap
// DASHGAP seconds after the first), the SWING, JUMP, SHIELD, BRICK and EAT buttons (or, with SCHEME=tap,
// touches on the room plus the kit buttons). combat.cjs keeps the masher and the dodging bot; this says
// whether a person can clear a first visit. KIT=0 plays with SWING, JUMP, the dash and EAT only.
// Usage from the repository root (reaction s, trials per room, prescription 0-2):
//   node gut-feeling/tests/tools/ward-human.cjs 0.25 20 1
//   CAMPAIGN=1 node gut-feeling/tests/tools/ward-human.cjs 0.25 20 1   (four departments on one set of hearts)
// A 0.25 s player should clear every department nearly always, with a heart or two to spare; a 0.35 s player
// should usually clear. Read the per-room line: cleared, average hearts left, nutrients eaten and picked up,
// combos, the wave where losses happened, and what landed the hits. Other knobs (env): SCHEME=tap, ONLY=<room>,
// GRUDGE=<level>, PRE=<code run first>, DASHGAP (default 0.1 s), and the human model below (GLANCE, ATTN,
// NOISE, GREED).
const { run, close, nodes } = require('../harness.cjs');

const REACT = +process.argv[2] || 0.25,
  KIT = process.env.KIT !== '0',
  TRIALS = +process.argv[3] || 20,
  DIFF = process.argv[4] === undefined ? 1 : +process.argv[4],
  ROOMS = process.env.ONLY ? [+process.env.ONLY] : [1, 2, 3, 4],
  GRUDGE = +(process.env.GRUDGE || 0),
  STEP = 1 / 60,
  THINK = 3; // a decision every 3 frames (0.05 s)

run('var hidSerial=0;let rng=1;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296};begin();drawWorld()');
// PRE: code run in the page first, to try a tuning knob (PRE='WARD.firstCap=4').
if (process.env.PRE) run(process.env.PRE);
// Count where the hearts went.
run(`globalThis.hurtLog=[];globalThis.realDamage=damage;damage=(s,f)=>{const hp=state.hp;realDamage(s,f);if(state.hp<hp)hurtLog.push(s)}`);

// What the player has on screen right now. The policy reads one of these from REACT seconds ago.
const SNAP = `(() => ({
  now: time,
  es: wardFighters().map(e => ({ id: e.id, x: e.x, y: e.y, type: e.type, boss: !!e.boss, wind: e.wind || 0, act: e.act,
    charge: e.charge || 0, cx: e.chargeX || 0, cy: e.chargeY || 0, ax: e.aimX, ay: e.aimY, stun: e.stun || 0,
    dizzy: e.dizzy || 0, hop: e.hopT || 0, z: e.z || 0, fx: e.fx, fy: e.fy, small: !!e.small })),
  blobs: projectiles.filter(p => !p.friendly && p.kind === 'blob' && p.life > 0).map(p => ({ id: p.hid ||= ++hidSerial, x: p.x, y: p.y + 32, vx: p.vx, vy: p.vy })),
  lobs: projectiles.filter(p => !p.friendly && p.kind === 'brick' && p.life > 0).map(p => ({ id: p.hid ||= ++hidSerial, x: p.tx, y: p.ty, life: p.life })),
  drops: typeof wardDrops === 'undefined' ? [] : wardDrops.filter(d => d.life > 0).map(d => ({ x: d.x, y: d.y })),
  bricks: wardBrickDrops.map(b => ({ x: b.x, y: b.y })),
  // The room's twist as it shows on screen: the MRI's warning and pull (bedpans and helmets fly at the bore),
  // the CT's lit lane and the rolling donut.
  tw: { room: wardTwist.room, phase: wardTwist.phase, left: (wardTwist.room === 1 ? WARD_TWIST.mri.warn : WARD_TWIST.donut.warn) - wardTwist.pt,
    lane: wardTwist.lane, dir: wardTwist.dir, donut: wardTwist.donut && { x: wardTwist.donut.x, y: wardTwist.donut.y, dir: wardTwist.donut.dir },
    bore: WARD_TWIST.mri.bore, flyers: wardTwist.room === 1 ? [...wardTwist.pans.map(p => ({ x: p.x, y: p.y })),
      ...wardFighters().filter(e => e.type === 2 && dist(e, player) >= WARD_TWIST.mri.grip).map(e => ({ x: e.x, y: e.y }))] : [] }
}))()`;

// The human part. Everything about the gremlins is REACT old. A new threat (a wind-up, a charge lane, a
// blob, a gunk ring) is not seen at once: each 0.05 s glance spots it with a chance that shrinks with how
// busy the screen is (GLANCE seconds per thing on screen, on average), which is what a crowded wave 3 does
// to a person. Of the threats seen, the ATTN most urgent are dodged; the thumb is NOISE degrees off,
// re-rolled every quarter second; and a swing in progress finishes unless the hit is less than GREED out.
// With these defaults the build before this yardstick lost about one first visit in four in the CT and
// ultrasound wards at 0.25 s, all of them in wave 3, and its campaign got through all four departments
// once in twenty tries, mostly collapsing in the second: what the playtest said. When this was written the
// first visits cleared 80 of 80 at 0.25 s and at 0.35 s with about three hearts left, and the campaign
// 20 of 20 at both.
const ATTN = +(process.env.ATTN || 2),
  NOISE = +(process.env.NOISE || 30),
  GREED = +(process.env.GREED || 0.3),
  GLANCE = +(process.env.GLANCE || 0.12);
let jitter = 0,
  jitterT = 0,
  prng = 1,
  spotted = new Map();
const roll = () => ((prng = (prng * 1103515245 + 12345) >>> 0) / 4294967296);

function decide(view, me) {
  const late = me.now - view.now,
    threats = [];
  // Every way a gremlin can hurt Macy soon, with how soon (seconds) and which way is out.
  const offLane = (x, y, ux, uy) => {
    const l = Math.hypot(ux, uy) || 1,
      off = ((me.x - x) * -uy + (me.y - y) * ux) / l,
      side = Math.sign(off) || 1;
    return { off: Math.abs(off), along: ((me.x - x) * ux + (me.y - y) * uy) / l, ox: (-uy / l) * side, oy: (ux / l) * side };
  };
  const awayFrom = (x, y) => {
    const d = Math.max(1, Math.hypot(me.x - x, me.y - y));
    return { ox: (me.x - x) / d, oy: (me.y - y) / d };
  };
  for (const e of view.es) {
    const d = Math.hypot(me.x - e.x, me.y - e.y),
      left = Math.max(0, e.wind - late);
    if (e.wind > 0 && (e.act === 'bite' || e.act === 'bump') && d < 170) threats.push({ key: 'e' + e.id, soon: left, jump: d < 125, ...awayFrom(e.x, e.y) });
    else if ((e.wind > 0 && e.act === 'charge') || (e.charge > 0 && (e.type === 2 || e.boss))) {
      const lane = offLane(e.x, e.y, e.charge > 0 ? e.cx : e.ax - e.x, e.charge > 0 ? e.cy : e.ay - e.y);
      if (lane.off < 70 && lane.along > -20 && lane.along < 430)
        threats.push({ key: 'e' + e.id, soon: (e.charge > 0 ? 0 : left) + Math.max(0, lane.along) / 400, jump: lane.along < 150, ox: lane.ox, oy: lane.oy });
    } else if (e.charge > 0 && d < 140) threats.push({ key: 'e' + e.id, soon: 0, jump: d < 100, ...awayFrom(e.x, e.y) });
    else if (e.wind > 0 && (e.act === 'spit' || e.act === 'barrage' || e.act === 'spit5') && d < 480) {
      const lane = offLane(e.x, e.y, me.x - e.x, me.y - e.y);
      threats.push({ key: 'e' + e.id, soon: left + d / 200, ox: lane.ox, oy: lane.oy });
    } else if (e.wind > 0 && (e.act === 'lob' || e.act === 'slam')) {
      const r = e.act === 'slam' ? 150 : 85;
      if (Math.hypot(me.x - e.ax, (me.y - e.ay) * 1.3) < r) threats.push({ key: 'e' + e.id, soon: left + 0.8, ...awayFrom(e.ax, e.ay) });
    }
  }
  for (const b of view.blobs) {
    const x = b.x + b.vx * late,
      y = b.y + b.vy * late,
      lane = offLane(x, y, b.vx, b.vy),
      v = Math.hypot(b.vx, b.vy) || 1;
    if (lane.along > 0 && lane.off < 34 && lane.along < 260) threats.push({ key: 'b' + b.id, soon: lane.along / v, ox: lane.ox, oy: lane.oy });
  }
  for (const l of view.lobs)
    if (l.life - late > -0.05 && Math.hypot(me.x - l.x, (me.y - l.y) * 1.3) < 90) threats.push({ key: 'l' + l.id, soon: Math.max(0, l.life - late), ...awayFrom(l.x, l.y) });
  // The twists. The CT: the lit lane, then the donut rolling down it (jump it if it is too late to step out).
  const tw = view.tw;
  if (tw.room === 3 && (tw.phase === 'warn' || tw.donut)) {
    const lane = tw.donut ? tw.donut.y : tw.lane,
      dir = tw.donut ? tw.donut.dir : tw.dir,
      x0 = tw.donut ? tw.donut.x + dir * 560 * late : dir > 0 ? -54 : 1054,
      ahead = (me.x - x0) * dir;
    if (Math.abs(me.y - lane) < 44 && ahead > -40) {
      const soon = (tw.donut ? 0 : Math.max(0, tw.left - late)) + Math.max(0, ahead - 48) / 560;
      threats.push({ key: 'donut' + lane, soon, jump: true, ox: 0, oy: me.y >= lane ? 1 : -1 });
    }
  }
  // The MRI: once the bore glows, every bedpan and helmet flies straight at it. Step out of those lines.
  if (tw.room === 1 && tw.phase !== 'idle')
    for (const f of tw.flyers) {
      const lane = offLane(f.x, f.y, tw.bore.x - f.x, tw.bore.y - f.y),
        len = Math.hypot(tw.bore.x - f.x, tw.bore.y - f.y);
      if (lane.off < 44 && lane.along > -10 && lane.along < len)
        threats.push({
          key: 'mag' + Math.round(f.x) + ',' + Math.round(f.y),
          soon: (tw.phase === 'warn' ? Math.max(0, tw.left - late) : 0) + lane.along / 560,
          ox: lane.ox,
          oy: lane.oy
        });
    }
  // Spotting: a threat stays spotted while it lasts; a new one waits for a glance to land on it.
  const busy = Math.max(1, view.es.length + (view.blobs.length + view.lobs.length) * 0.5),
    chance = 1 - Math.exp(-0.05 / (GLANCE * busy)),
    live = new Set(threats.map(t => t.key));
  for (const k of [...spotted.keys()]) if (!live.has(k)) spotted.delete(k);
  for (const t of threats) if (!spotted.get(t.key) && roll() < chance) spotted.set(t.key, true);
  const seen = threats.filter(t => spotted.get(t.key)).sort((a, b) => a.soon - b.soon).slice(0, ATTN);
  // Something to swing at: the nearest gremlin that is on the ground.
  const fs = view.es
    .filter(e => e.hop <= 0 && e.z < 16)
    .sort((a, b) => Math.hypot(me.x - a.x, me.y - a.y) - Math.hypot(me.x - b.x, me.y - b.y));
  const target = fs[0] || null,
    reach = target ? Math.hypot(me.x - target.x, me.y - target.y) < 100 + (target.type === 2 ? 10 : 0) : false,
    urgent = seen.length && seen[0].soon < GREED;
  let ax = 0,
    ay = 0,
    hop = false,
    dashTo = null,
    attack = reach,
    mode = target ? 'fight' : 'idle',
    goal = null;
  if (seen.length && (urgent || !reach)) {
    mode = 'dodge';
    for (const t of seen) {
      ax += t.ox;
      ay += t.oy;
      if (t.jump && t.soon < 0.15) hop = true;
    }
    if (me.x > 820 && me.y < 280) {
      ax -= 1;
      ay += 1;
    }
    if (me.x < 90 && ax < 0) ax = 0.3;
    if (me.x > 910 && ax > 0) ax = -0.3;
    if (me.y < 220 && ay < 0) ay = 0.3;
    if (me.y > 545 && ay > 0) ay = -0.3;
    if (Math.hypot(ax, ay) < 0.2) {
      ax = 500 - me.x;
      ay = 400 - me.y;
    }
    if (urgent) attack = false;
    // Cornered with the jump on cooldown: dash out.
    if (hop && me.jumpCd > 0 && me.dashCd <= 0) dashTo = { x: ax, y: ay };
  } else if (
    ((view.drops.length && me.food < me.maxFood) || (KIT && view.bricks.length && me.bricks < 3)) &&
    !(target && Math.hypot(me.x - target.x, me.y - target.y) < 140)
  ) {
    const pool = [...(me.food < me.maxFood ? view.drops : []), ...(KIT && me.bricks < 3 ? view.bricks : [])],
      n = pool.sort((a, b) => Math.hypot(me.x - a.x, me.y - a.y) - Math.hypot(me.x - b.x, me.y - b.y))[0];
    ax = n.x - me.x;
    ay = n.y - me.y;
    mode = 'walk';
    goal = n;
  } else if (me.supply && me.food < me.maxFood && !(target && Math.hypot(me.x - target.x, me.y - target.y) < 180)) {
    ax = me.supply.x - me.x;
    ay = me.supply.y - me.y;
    mode = 'walk';
    goal = me.supply;
  } else if (target && Math.hypot(me.x - target.x, me.y - target.y) > 72) {
    ax = target.x - me.x;
    ay = target.y - me.y;
  }
  // The top-right corner is the door to the hallway: a player in a fight stays out of it.
  if (me.x > 850 && me.y < 240 && ay < 0) ay = Math.abs(ay) * 0.3 + 0.2;
  if ((jitterT -= 0.05) <= 0) {
    jitter = ((roll() * 2 - 1) * NOISE * Math.PI) / 180;
    jitterT = 0.25;
  }
  const l = Math.hypot(ax, ay),
    c = Math.cos(jitter),
    s = Math.sin(jitter),
    jx = l > 0.01 ? ax / l : 0,
    jy = l > 0.01 ? ay / l : 0;
  // The kit. SHIELD when something lands in a moment that a jump will not clear and the dash is resting; a BRICK at a
  // bruiser that is out of pillow reach but in range.
  const shield = KIT && urgent && seen[0].soon < 0.3 && (!seen[0].jump || me.jumpCd > 0) && me.dashCd > 0 && !me.shieldBroken;
  const bruiser = fs.find(e => e.type === 2 && e.stun <= 0 && e.dizzy <= 0),
    toBruiser = bruiser ? Math.hypot(me.x - bruiser.x, me.y - bruiser.y) : 0;
  const brick = KIT && !urgent && me.bricks > 0 && !!bruiser && toBruiser > 130 && toBruiser < 320;
  return { jx: jx * c - jy * s, jy: jx * s + jy * c, attack, jump: hop, dash: dashTo, mode, goal, target, urgent, shield, brick };
}

// The tap-the-room scheme, played by the same eyes: hold a finger on the gremlin to keep swinging, lift it
// to dodge (a flick dashes, a two-finger tap jumps, a tap on the floor walks away), one new tap at most every
// TAPGAP seconds. Taps land where the gremlin was REACT ago, so a moving one is sometimes missed.
const SCHEME = process.env.SCHEME || 'stick',
  TAPGAP = +(process.env.TAPGAP || 0.3);
let finger = null;
const touch = (kind, id, x, y) =>
  run(kind === 'down' ? `wardTouchDown(${id},${x},${y},{x:${x},y:${y}})` : `wardTouchUp(${id},${x},${y},false)`);
function tapRelease() {
  if (finger.hold === null) return;
  touch('up', finger.hold.id, finger.hold.x, finger.hold.y);
  finger.hold = null;
  finger.holdOn = null;
}
function tapPlay(act, me) {
  const ready = me.now >= finger.next;
  if (act.mode === 'dodge') {
    tapRelease();
    if (!ready) return;
    finger.next = me.now + TAPGAP;
    const a = ++finger.id,
      b = ++finger.id;
    if (act.jump && me.jumpCd <= 0) {
      touch('down', a, me.x - 30, me.y);
      touch('down', b, me.x + 30, me.y);
      touch('up', a, me.x - 30, me.y);
      touch('up', b, me.x + 30, me.y);
    } else if (act.urgent && me.dashCd <= 0) {
      touch('down', a, me.x, me.y - 40);
      touch('up', a, me.x + act.jx * 70, me.y - 40 + act.jy * 70);
    } else {
      const x = Math.max(60, Math.min(940, me.x + act.jx * 150)),
        y = Math.max(190, Math.min(560, me.y + act.jy * 150));
      touch('down', a, x, y);
      touch('up', a, x, y);
    }
    return;
  }
  if (act.mode === 'walk' && act.goal) {
    tapRelease();
    if (!ready || run('!!wardGoal')) return;
    finger.next = me.now + TAPGAP;
    const a = ++finger.id;
    touch('down', a, act.goal.x, act.goal.y);
    touch('up', a, act.goal.x, act.goal.y);
    return;
  }
  if (act.mode === 'fight' && act.target) {
    if (finger.holdOn === act.target.id && run('!!wardPrey')) return;
    tapRelease();
    if (!ready) return;
    finger.next = me.now + TAPGAP;
    const a = ++finger.id,
      x = act.target.x,
      y = act.target.y - 20;
    touch('down', a, x, y);
    finger.hold = { id: a, x, y };
    finger.holdOn = act.target.id;
    return;
  }
  tapRelease();
}

// The joystick scheme through its real buttons: a tap of SWING (or JUMP, BRICK, EAT) is a pointerdown and a
// pointerup on that button; SHIELD is a pointerdown held until a pointerup; the stick is joy.x / joy.y, as
// the joystick sets them. A dash is the real gesture: a quick tap of the stick the way she means to go, and
// DASHGAP seconds later a second press that way (the harness's stick is centred at 500, 312.5 with a 300 px
// throw).
const DASHGAP = +(process.env.DASHGAP || 0.1);
let pointer = 500,
  shieldFinger = null,
  nextBrick = 0,
  shields = 0,
  bricks = 0,
  dashes = 0,
  dashTap = null;
const touchEvent = id => ({ pointerId: id, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, preventDefault() {} });
function press(id) {
  const e = touchEvent(++pointer);
  nodes[id].events.pointerdown(e);
  nodes[id].events.pointerup(e);
}
function stickTap(jx, jy) {
  const e = { ...touchEvent(++pointer), clientX: 500 + jx * 300, clientY: 312.5 + jy * 300 };
  nodes.joystick.events.pointerdown(e);
  nodes.joystick.events.pointerup(e);
}
function releaseShield() {
  if (!shieldFinger) return;
  nodes.shieldBtn.events.pointerup(touchEvent(shieldFinger.id));
  shieldFinger = null;
}

// One department, first visit unless GRUDGE is set. fresh: full hearts, one nutrient in the pocket, the
// room's supplies on the floor and every snack cart stocked; otherwise hearts, pocket, supplies and carts
// carry over (the campaign).
function fight(room, seed, fresh) {
  close();
  run(
    `state.difficulty=${DIFF};state.upgrades=[];state.medals=rooms.map(()=>[0,0,0]);` +
      (fresh ? 'state.hp=5;state.food=1;state.taken=[];if(typeof snackStock!=="undefined")for(const k in snackStock)delete snackStock[k];state.stats={};' : '') +
      `state.wardClears=rooms.map((_, i)=>i===${room}?${GRUDGE}:0);for(const k in wardProgress)delete wardProgress[k];keys.clear();joy.x=joy.y=0;deadDelay=0;` +
      `hurtLog=[];rng=${seed};loadRoom(${room});${GRUDGE ? 'wardRematch();' : ''}equip(0);player.inv=0;player.vomit=0;player.attackCd=0;player.z=0;` +
      `player.shieldHeld=false;player.shieldBroken=false;player.shieldMeter=wardShieldCap()`
  );
  const views = [];
  prng = seed;
  spotted = new Map();
  finger = { id: 100, hold: null, holdOn: null, next: 0 };
  shieldFinger = null;
  nextBrick = shields = bricks = dashes = 0;
  dashTap = null;
  run(`setControlScheme('${SCHEME === 'tap' ? 'tap' : 'stick'}')`);
  const lag = Math.max(0, Math.round(REACT / (STEP * THINK)));
  let t = 0,
    eaten = 0,
    act = { jx: 0, jy: 0, attack: false };
  const start = run('state.food'),
    hp0 = run('state.hp'),
    dash0 = run('wardDashSerial');
  for (; t < 60 * 240; t++) {
    if (run('mini.open||deadDelay>0||encounter.complete')) break;
    if (run('isModal()')) run('for(const d of $$("dialog"))d.close()');
    if (t % THINK === 0) {
      views.push(JSON.parse(run(`JSON.stringify(${SNAP})`)));
      const view = views[Math.max(0, views.length - 1 - lag)];
      const me = JSON.parse(
        run(
          `JSON.stringify({now:time,x:player.x,y:player.y,hp:state.hp,food:state.food,maxFood:maxFood(),jumpCd:player.jumpCd,dashCd:player.dashCd,` +
            `bricks:wardKit.bricks,shieldBroken:!!player.shieldBroken,brickCd:player.brickCd||0,` +
            `cd:player.attackCd,supply:(supplies.filter(supplyAvailable)[0]||(typeof snackReady==='function'&&snackReady()&&snackCartHere())||null)})`
        )
      );
      act = decide(view, me);
      const hungry = me.hp <= 2 && me.food > 0;
      if (hungry) {
        press('touchEat');
        eaten++;
      }
      // The kit buttons are the same in both schemes. SHIELD is held for a beat, then let go.
      if (act.shield && !shieldFinger) {
        shieldFinger = { id: ++pointer, until: me.now + 0.6 };
        nodes.shieldBtn.events.pointerdown(touchEvent(shieldFinger.id));
        shields++;
      } else if (shieldFinger && me.now >= shieldFinger.until) releaseShield();
      if (act.brick && me.brickCd <= 0 && me.now >= nextBrick) {
        press('brickBtn');
        nextBrick = me.now + 1.2;
        bricks++;
      }
      if (SCHEME === 'tap') tapPlay(act, me);
      else {
        if (dashTap && me.now >= dashTap.due) {
          // The second tap of the double-tap, the way she is pushing now.
          stickTap(act.jx, act.jy);
          dashTap = null;
        }
        run(`joy.x=${act.jx};joy.y=${act.jy}`);
        // JUMP when it is ready; when it is resting, the dash it falls back on. (Before the stick dash this
        // pressed JUMP regardless, so the yardstick never dashed at all.)
        if (act.jump && me.jumpCd <= 0) press('jumpBtn');
        else if (act.dash && !dashTap && me.dashCd <= 0) {
          stickTap(act.jx, act.jy);
          dashTap = { due: me.now + DASHGAP - 1e-6 };
          run(`joy.x=${act.jx};joy.y=${act.jy}`);
        }
        // A tap of SWING whenever the last swing is done and something is in reach.
        if (act.attack && me.cd <= 0) press('attackBtn');
      }
    }
    run(`advanceSimulation(${STEP})`);
  }
  const out = JSON.parse(
    run(
      `JSON.stringify({complete:encounter.complete,wave:encounter.wave,hp:state.hp,food:state.food,dead:deadDelay>0||mini.open,hurt:hurtLog,combos:(state.stats&&state.stats.combos)||0})`
    )
  );
  dashes = run('wardDashSerial') - dash0;
  tapRelease();
  releaseShield();
  run('keys.clear();joy.x=joy.y=0;heldAttack=false;wardTouchReset();deadDelay=0');
  return {
    ...out,
    won: out.complete && out.hp > 0 && !out.dead,
    hp0,
    eaten,
    picked: out.food + eaten - start,
    seconds: +(t / 60).toFixed(1),
    shields,
    bricks,
    dashes
  };
}

const avg = (list, k) => (list.length ? list.reduce((a, r) => a + r[k], 0) / list.length : 0).toFixed(1);

if (process.env.CAMPAIGN) {
  // MRI, lounge, CT, ultrasound in a row on one set of hearts: how far does a fresh game get before the
  // first collapse? (Combos carry in state.stats; the campaign starts each game with none.)
  const reach = [0, 0, 0, 0, 0],
    ends = [];
  for (let i = 0; i < TRIALS; i++) {
    let n = 0,
      last = null;
    for (const room of [1, 2, 3, 4]) {
      last = fight(room, 1000 + i * 7919 + room, room === 1);
      if (!last.won) break;
      n++;
    }
    reach[n]++;
    if (n === 4) ends.push(last);
  }
  console.log(
    `campaign P${DIFF} ${SCHEME} react ${REACT}: all four ${reach[4]}/${TRIALS} · stopped after 0/1/2/3 rooms ${JSON.stringify(reach.slice(0, 4))}` +
      ` · hearts at the end ${avg(ends, 'hp')} · pocket ${avg(ends, 'food')}`
  );
} else
  for (const room of ROOMS) {
    const runs = [];
    for (let i = 0; i < TRIALS; i++) runs.push(fight(room, 1000 + i * 7919, true));
    const won = runs.filter(r => r.won),
      lostAt = {},
      hurt = {};
    for (const r of runs) {
      if (!r.won) lostAt['w' + r.wave] = (lostAt['w' + r.wave] || 0) + 1;
      for (const s of r.hurt) hurt[s] = (hurt[s] || 0) + 1;
    }
    console.log(
      `room ${room} P${DIFF}${GRUDGE ? ' grudge ' + GRUDGE : ''} ${SCHEME} react ${REACT}: cleared ${won.length}/${runs.length}` +
        ` · hearts left ${avg(won, 'hp')} · ate ${avg(runs, 'eaten')} · picked up ${avg(runs, 'picked')} · combos ${avg(runs, 'combos')}` +
        ` · ${avg(runs, 'seconds')} s · kit: shield ${avg(runs, 'shields')} brick ${avg(runs, 'bricks')} dash ${avg(runs, 'dashes')}` +
        ` · lost at ${JSON.stringify(lostAt)} · hits ${JSON.stringify(hurt)}`
    );
  }
