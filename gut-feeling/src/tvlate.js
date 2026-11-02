// The 3 AM channel: the station on the 75-inch TV in Macy's room that only exists after dark.
// Short sketches on a shuffled rotation: an infomercial, a cooking show, the weather inside her
// stomach, Rowdy's talk show, and so on. Uses art.js primitives, gremlin(), plant(), brick(),
// ivStand() and rowdy.js drawRowdy() at runtime, plus clamp() and rand() from state.js.
//
// Public API (the room's TV calls these, guarded with typeof):
//   tvLateDraw(g, w, h, t)   paints the current sketch into the w × h rectangle at the origin
//                            (translate to the TV face first). t is any running clock in seconds,
//                            used only for ambient motion. Clips to the rectangle. 16:9 fits exactly;
//                            other shapes get a centered 600 × 338 stage with the set extended.
//   tvLateTick(dt)           advances the timeline. Returns an sfx() name when a caption beat starts
//                            with a sound, else null: play it quietly or ignore it.
//   tvLateCaption()          the caption on screen right now ('' before the first beat).
//   tvLateNow()              { id, name, tag, s, length, beat, pos, rotation } for a channel chip.
//   tvLateShow(id)           plays that sketch now (id or index); the rotation carries on after it.
//   tvLateReset()            a fresh shuffle from the top.
//   tvLateSketches           the pool: { id, name, tag, accent, length, beats, draw, ... }.
//   tvLateChannelName        { name: '3 AM', tagline: 'Should not exist' }; it prints as '3 AM'.
//
// Sketches run 12 to 20 seconds with 2 to 5 caption beats each. The order is shuffled with rand()
// and never repeats until every sketch has aired; the sign-off always closes a rotation. Drawing
// never consumes randomness: static and grain come from a hash of the clock. House voice, no dashes.

const TV_LATE_W = 600,
  TV_LATE_H = 338,
  TV_LATE_STATIC = 0.45,
  TV_LATE_MAX_STEP = 0.5,
  TV_LATE_FONT = '"Trebuchet MS", Arial, sans-serif',
  TV_LATE_ENSURE = ['#7a4b33', '#e9d39a', '#ef9fb0'],
  TV_LATE_GARNISH = ['straw', 'mini', 'pudding', 'pea', 'umbrella'],
  TV_LATE_JUICED = ['apple', 'pizza', 'volleyball'],
  TV_LATE_PRODUCTS = [
    { name: 'ARMOR', price: '$89.99', note: 'FEATHER GRADE' },
    { name: 'LUXURY LUGGAGE', price: '$450', note: 'HOLDS ONE LUNCH' },
    { name: 'A BRICK', price: '$40', note: 'IT IS A BRICK' }
  ];

const tvLateChannelName = Object.freeze({
  name: '3 AM',
  tagline: 'Should not exist',
  toString() {
    return '3 AM';
  }
});

const TV_LATE_SHEILA = {
    skin: '#c98e66',
    hair: '#2b1d1a',
    hairStyle: 'bun',
    top: '#8a86c9',
    pants: '#6d69ad',
    apron: '#fbf8ef',
    item: 'spoon'
  },
  TV_LATE_BARB = {
    skin: '#f1c7a2',
    hair: '#b8563a',
    hairStyle: 'net',
    top: '#f2a7b8',
    pants: '#f2a7b8',
    apron: '#fbf8ef',
    item: 'tray'
  },
  TV_LATE_DAD = {
    skin: '#f3bb99',
    hair: '#4b3022',
    hairStyle: 'wavy',
    top: '#4e6175',
    trim: '#c3c9cc',
    pants: '#6b737c',
    item: 'mug'
  };

let tvLateState = { order: [], pos: 0, s: 0, beat: -1, variant: 0, rotation: 0, started: false },
  tvLateView = { x: 0, y: 0, w: TV_LATE_W, h: TV_LATE_H };

const tvLateWrapCache = new Map();

// ---- Small helpers ----

// A repeatable 0..1 from any number: static, grain and stars, with no random draws at all.
function tvLateHash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Many rectangles, one fill.
function tvLateRects(g, list, col) {
  if (!list.length) return;
  g.fillStyle = col;
  g.beginPath();
  for (const r of list) g.rect(r[0], r[1], r[2], r[3]);
  g.fill();
}

// The whole visible screen, in stage coordinates, whatever its shape.
function tvLateFill(g, col) {
  rect(g, tvLateView.x, tvLateView.y, tvLateView.w, tvLateView.h, col);
}

function tvLateFont(size, italic) {
  return `${italic ? 'italic ' : ''}700 ${size}px ${TV_LATE_FONT}`;
}

function tvLateText(g, text, x, y, size, col, align = 'center', shade = null, italic = false) {
  g.font = tvLateFont(size, italic);
  g.textAlign = align;
  if (shade) {
    g.fillStyle = shade;
    g.fillText(text, x + size * 0.08, y + size * 0.08);
  }
  g.fillStyle = col;
  g.fillText(text, x, y);
  g.textAlign = 'left';
}

function tvLateMeasure(g, text, size) {
  const m = typeof g.measureText === 'function' ? g.measureText(text) : null;
  return m && Number.isFinite(m.width) ? m.width : text.length * size * 0.56;
}

// A caption in at most two lines that fit maxW, shrinking the type up to 40% if it has to.
function tvLateWrap(g, text, maxW, size, italic) {
  const key = `${text}|${Math.round(maxW)}|${Math.round(size * 10)}|${italic ? 1 : 0}`,
    hit = tvLateWrapCache.get(key);
  if (hit) return hit;
  let out = null;
  for (let step = 0; step < 5 && !out; step++) {
    const sz = size * (1 - step * 0.1),
      lines = [''];
    g.font = tvLateFont(sz, italic);
    for (const word of text.split(' ')) {
      const cur = lines[lines.length - 1],
        next = cur ? cur + ' ' + word : word;
      if (!cur || tvLateMeasure(g, next, sz) <= maxW) lines[lines.length - 1] = next;
      else lines.push(word);
    }
    if (lines.length <= 2 && lines.every(l => tvLateMeasure(g, l, sz) <= maxW)) out = { lines, size: sz };
  }
  if (!out) {
    const words = text.split(' '),
      half = Math.ceil(words.length / 2);
    out = { lines: [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean), size: size * 0.6 };
  }
  if (tvLateWrapCache.size > 96) tvLateWrapCache.clear();
  tvLateWrapCache.set(key, out);
  return out;
}

// The heroine's name for captions; long names fall back so a caption stays short.
function tvLateName() {
  const n = typeof state === 'object' && state && typeof state.name === 'string' ? state.name.trim() : '';
  return n && n.length <= 12 ? n : 'Macy';
}

function tvLateFormat(text) {
  return String(text).replace(/\{name\}/g, tvLateName());
}

function tvLateEase(u) {
  const v = clamp(u, 0, 1);
  return v * v * (3 - 2 * v);
}

// Sun rays and price stars: n wedges from (x, y), one fill.
function tvLateRays(g, x, y, r, n, rot, col) {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2,
      b = a + Math.PI / n;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
    g.closePath();
  }
  g.fill();
}

function tvLateStar(g, x, y, r, n, rot, col, edge) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2,
      rad = i % 2 ? r * 0.78 : r;
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
  }
  path(
    g,
    p => {
      pts.forEach((q, i) => (i ? p.lineTo(...q) : p.moveTo(...q)));
      p.closePath();
    },
    col,
    edge,
    2
  );
}

function tvLateNote(g, x, y, s, col) {
  ellipse(g, x, y, 3 * s, 2.4 * s, col);
  line(g, [[x + 2.6 * s, y], [x + 2.6 * s, y - 10 * s], [x + 6 * s, y - 8 * s]], col, 1.4 * s);
}

// ---- Cast and props ----

// Ensure, as Barb pours it: cream bottle, flavor band, cap. Feet at (x, y).
function tvLateBottle(g, x, y, s, band) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  rr(g, -5, -17, 10, 17, 3, '#f4efe2', '#a59c8a', 0.7);
  rr(g, -5, -12, 10, 7, 1.5, band);
  rr(g, -3.4, -21, 6.8, 5, 1.6, '#cfc6b4');
  g.restore();
}

// A plain cartoon person, feet at (x, y), about 92 units tall at s = 1 like girl().
// o: skin, hair, hairStyle ('bun' | 'net' | 'wavy'), top, trim, pants, apron, item ('spoon' |
// 'tray' | 'mug'), dir (1 faces right), walk (stride phase), talk (mouth open), lift (item raised).
function tvLatePerson(g, x, y, s, o, t) {
  const dir = o.dir < 0 ? -1 : 1,
    stride = Math.sin(o.walk || 0) * 7,
    bob = o.walk ? Math.abs(Math.cos(o.walk)) * 1.5 : Math.sin(t * 2.1) * 0.6,
    lift = o.lift || 0;
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  shadow(g, 0, 1, 18, 4);
  line(g, [[-5, -31], [-5 - stride, -1]], o.pants, 7.5);
  line(g, [[5, -31], [5 + stride, -1]], o.pants, 7.5);
  g.translate(0, -bob);
  line(g, [[-9, -55], [-14, -36]], o.top, 6.5);
  rr(g, -14, -62, 28, 36, 9, o.top);
  if (o.trim) line(g, [[0, -60], [0, -28]], o.trim, 2);
  if (o.apron) {
    rr(g, -10, -52, 20, 30, 5, o.apron);
    line(g, [[-10, -52], [-6, -61]], o.apron, 2);
    line(g, [[10, -52], [6, -61]], o.apron, 2);
  }
  const hand = o.item === 'tray' ? [22, -50] : [17, -44 - lift * 14];
  line(g, [[9, -55], hand], o.top, 6.5);
  ellipse(g, hand[0], hand[1], 3.4, 3.4, o.skin);
  if (o.item === 'spoon') {
    line(g, [hand, [hand[0] + 5, hand[1] - 19]], '#c89a62', 2.6);
    ellipse(g, hand[0] + 5.5, hand[1] - 21, 3.2, 4.2, '#c89a62');
  } else if (o.item === 'tray') {
    rr(g, 8, -55, 34, 4, 2, '#cfd8dc');
    for (let i = 0; i < 3; i++) tvLateBottle(g, 14 + i * 11, -55, 0.62, TV_LATE_ENSURE[i]);
  } else if (o.item === 'mug') {
    rr(g, hand[0] - 3, hand[1] - 9, 10, 10, 2, '#f4efe2');
    line(g, [[hand[0] + 7, hand[1] - 6], [hand[0] + 9, hand[1] - 3], [hand[0] + 7, hand[1]]], '#f4efe2', 1.6);
  }
  ellipse(g, 0, -75, 12, 13, o.skin);
  if (o.hairStyle === 'bun') {
    ellipse(g, -9, -90, 6.5, 6, o.hair);
    path(
      g,
      p => {
        p.moveTo(-12, -74);
        p.bezierCurveTo(-14, -92, 12, -94, 12, -78);
        p.quadraticCurveTo(2, -84, -12, -74);
      },
      o.hair
    );
  } else if (o.hairStyle === 'net') {
    ellipse(g, -1, -84, 13, 8, o.hair);
    ellipse(g, -1, -86, 12, 6.5, '#ffffff40');
  } else {
    path(
      g,
      p => {
        p.moveTo(-12, -74);
        p.quadraticCurveTo(-15, -86, -7, -88);
        p.quadraticCurveTo(-1, -94, 5, -88);
        p.quadraticCurveTo(13, -88, 12, -77);
        p.quadraticCurveTo(4, -82, -12, -74);
      },
      o.hair
    );
  }
  ellipse(g, 2.5, -75, 1.5, 2.1, '#2b2a30');
  ellipse(g, 8.5, -75, 1.5, 2.1, '#2b2a30');
  if (o.talk) ellipse(g, 6, -67.5, 2.6, 2, '#7a3b3b');
  else line(g, [[3, -68], [9, -68.5]], '#7a3b3b', 1.2);
  g.restore();
}

// Number 22: a Ramsey volleyball player in royal blue, ponytail and scrunchie. Feet at (x, y).
// swing 0 is the hitting arm cocked back, 1 is through the ball; air tucks the legs.
function tvLatePlayer(g, x, y, s, swing, air) {
  const a = -2.7 + clamp(swing, 0, 1) * 3;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  path(
    g,
    p => {
      p.moveTo(-6, -82);
      p.quadraticCurveTo(-22, -80 + air * 6, -19, -62 + air * 4);
    },
    null,
    '#5a3a2c',
    6
  );
  ellipse(g, -9, -82, 3.2, 3.2, '#f1abbd');
  line(g, [[-4, -30], [-9 - air * 6, -15], [-5, -1 - air * 8]], '#1d2b4a', 7);
  line(g, [[4, -30], [9, -16 + air * 4], [6, -1 - air * 4]], '#1d2b4a', 7);
  rr(g, -12, -62, 24, 33, 7, '#1f67cb');
  tvLateText(g, '22', 0, -38, 13, '#f2cf6b');
  line(g, [[-7, -57], [-4 + swing * 10, -92 + swing * 22]], '#f3bb99', 5);
  line(g, [[6, -57], [6 + Math.cos(a) * 24, -57 + Math.sin(a) * 24]], '#f3bb99', 5);
  ellipse(g, 0, -72, 10, 11, '#f3bb99');
  path(
    g,
    p => {
      p.moveTo(-10, -72);
      p.bezierCurveTo(-11, -88, 10, -88, 10, -76);
      p.quadraticCurveTo(0, -80, -10, -72);
    },
    '#704c3e'
  );
  ellipse(g, 5, -72, 1.4, 2, '#322c31');
  g.restore();
}

// Ralph, very small: purple, crowned, worried. Feet at (x, y), about 44 units tall at s = 1.
function tvLateRalph(g, x, y, s, talk) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  poly(g, [[-13, -28], [-24, -40], [-6, -33]], '#a27ad2');
  poly(g, [[13, -28], [24, -40], [6, -33]], '#a27ad2');
  ellipse(g, 0, -17, 17, 17, '#a27ad2');
  ellipse(g, 0, -8, 10, 6, '#eadcff55');
  ellipse(g, -6, -22, 4.5, 5, '#fff9e8');
  ellipse(g, 6, -22, 4.5, 5, '#fff9e8');
  ellipse(g, -5.5, -21, 2, 2.8, '#324452');
  ellipse(g, 6.5, -21, 2, 2.8, '#324452');
  line(g, [[-10, -30], [-3, -27.5]], '#5d3d8c', 2);
  line(g, [[10, -30], [3, -27.5]], '#5d3d8c', 2);
  if (talk) ellipse(g, 0, -11, 4, 3, '#65394e');
  else line(g, [[-4, -11], [4, -11]], '#65394e', 1.6);
  poly(g, [[-10, -33], [-11, -43], [-5, -38], [0, -45], [5, -38], [11, -43], [10, -33]], '#f7dc6f');
  ellipse(g, 0, -36.5, 1.8, 1.8, '#e46a7a');
  g.restore();
}

// Infomercial vests for gremlin() hosts, riding the same bob.
function tvLateVest(g, x, y, s, t, col) {
  g.save();
  g.translate(x, y + Math.sin(t * 3.4) * 2.8 * s);
  g.scale(s, s);
  poly(g, [[-19, -20], [-8, -14], [-8, -3], [-18, -6]], col);
  poly(g, [[19, -20], [8, -14], [8, -3], [18, -6]], col);
  poly(g, [[-5, -6], [0, -3.5], [5, -6], [5, -1], [0, -3.5], [-5, -1]], '#f2cf6b');
  g.restore();
}

// A kazoo at a gremlin's mouth, same bob.
function tvLateKazoo(g, x, y, s, t) {
  rr(g, x + 2 * s, y - 13 * s + Math.sin(t * 3.4) * 2.8 * s, 15 * s, 4.5 * s, 2 * s, '#f2cf6b');
}

// Jell-O on a plate. wob is how hard it is still thinking about the last thing that happened.
function tvLateJello(g, x, y, s, t, wob, col) {
  const q = Math.sin(t * 9) * wob;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  ellipse(g, 0, 1, 31, 6, '#e9eef0');
  path(
    g,
    p => {
      p.moveTo(-23, 0);
      p.bezierCurveTo(-24 + q, -32 - q * 0.5, 24 + q, -32 + q * 0.5, 23, 0);
      p.closePath();
    },
    col
  );
  line(g, [[-11 + q * 0.4, -20], [-12, -1]], '#ffffff2a', 3);
  line(g, [[8 + q * 0.4, -21], [10, -1]], '#ffffff2a', 3);
  ellipse(g, -8 + q * 0.6, -18, 4, 6, '#ffffff55');
  g.restore();
}

function tvLateVolleyball(g, x, y, r) {
  ellipse(g, x, y, r, r, '#f8f6ee');
  path(
    g,
    p => {
      p.moveTo(x - r * 0.9, y - r * 0.3);
      p.quadraticCurveTo(x, y + r * 0.2, x + r * 0.6, y - r * 0.8);
      p.moveTo(x - r * 0.4, y + r * 0.9);
      p.quadraticCurveTo(x - r * 0.1, y, x + r * 0.95, y + r * 0.1);
    },
    null,
    '#1f67cb',
    Math.max(0.6, r * 0.16)
  );
}

// ---- 1. The Gut Feeling Juicer ----
function tvLateJuicerItem(g, kind, x, y) {
  if (kind === 'apple') {
    ellipse(g, x, y, 12, 11, '#d8434f');
    line(g, [[x, y - 9], [x + 2, y - 16]], '#6b4a2e', 2);
    ellipse(g, x + 6, y - 14, 5, 2.4, '#6fb36a');
  } else if (kind === 'pizza') {
    poly(g, [[x - 13, y - 9], [x + 13, y - 9], [x, y + 14]], '#f2c25c');
    rr(g, x - 14, y - 13, 28, 6, 3, '#c98a4b');
    ellipse(g, x - 4, y - 3, 3, 3, '#c94a3c');
    ellipse(g, x + 4, y + 2, 2.6, 2.6, '#c94a3c');
  } else tvLateVolleyball(g, x, y, 12);
}

function tvLateJuicer(g, s, t) {
  const V = tvLateView,
    p = s - 3,
    n = p < 0 ? -1 : Math.floor(p / 3.6),
    u = p < 0 ? 0 : (p % 3.6) / 3.6,
    busy = n >= 0 && n < 3,
    shake = busy && u > 0.3 && u < 0.62 ? Math.sin(t * 70) * 2.2 : 0;
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#4a2f8f', '#16336b'));
  tvLateRays(g, 300, 110, 700, 16, t * 0.06, '#ffffff0d');
  rr(g, 18, 16, 150, 46, 10, '#f2c14e', '#fff3c4', 2);
  tvLateText(g, 'GUT FEELING', 93, 36, 15, '#5a2a7a');
  tvLateText(g, 'JUICER', 93, 55, 17, '#d9475b');
  rect(g, V.x, 196, V.w, V.h, gradient(g, 0, 196, 0, 90, '#ece6f6', '#a99fc6'));
  rect(g, V.x, 196, V.w, 5, '#ffffff');
  gremlin(g, 92, 258, 1.75, 0, t);
  tvLateVest(g, 92, 258, 1.75, t, '#d9475b');
  gremlin(g, 508, 258, 1.75, 2, t + 1.3);
  tvLateVest(g, 508, 258, 1.75, t + 1.3, '#d9475b');
  const made = clamp(n + (u > 0.66 ? 1 : 0), 0, 3);
  for (let i = 0; i < made; i++) {
    const drop = i === n && u < 0.8 ? (0.8 - u) * 60 : 0;
    tvLateBottle(g, 372 + i * 26, 200 - drop, 1.5, TV_LATE_ENSURE[i]);
  }
  g.save();
  g.translate(shake, 0);
  rr(g, 262, 166, 76, 34, 8, gradient(g, 262, 166, 0, 34, '#d7dee4', '#7d8c98'));
  rr(g, 270, 104, 60, 66, 14, gradient(g, 270, 0, 60, 0, '#f4f8fa', '#97a6b2'), '#6c7b87', 1.2);
  rr(g, 284, 88, 32, 22, 5, '#55606b');
  rr(g, 334, 140, 30, 9, 4, '#aab6c0');
  ellipse(g, 300, 183, 7, 7, busy && u > 0.3 && u < 0.62 ? '#ef6f6f' : '#7fd08a');
  line(g, [[283, 112], [283, 160]], '#ffffff99', 3);
  g.restore();
  if (busy && u < 0.3) tvLateJuicerItem(g, TV_LATE_JUICED[n], 300, 18 + (u / 0.3) * 72);
  if (busy && u > 0.3 && u < 0.62) {
    tvLateText(g, 'WHIRR', 300 + shake, 80, 13, '#ffffff', 'center', '#00000088');
  }
  if (s < 3 || (s > 3 && s < 3.6)) spark(g, 322, 118, '#ffffff', 0.8 + Math.sin(t * 6) * 0.2);
  if (s >= 13.8) {
    const pop = tvLateEase((s - 13.8) / 0.35);
    g.save();
    g.translate(455, 72);
    g.scale(pop, pop);
    tvLateStar(g, 0, 0, 60, 14, t * 0.4, '#ffe14d', '#d9475b');
    tvLateText(g, 'ONLY', 0, -20, 11, '#5a2a7a');
    tvLateText(g, '$19.99', 0, 4, 22, '#d9475b');
    tvLateText(g, 'PLUS 400 MORE', 0, 19, 8.5, '#5a2a7a');
    tvLateText(g, 'EASY PAYMENTS', 0, 29, 8.5, '#5a2a7a');
    g.restore();
  }
  if (s >= 14.2) {
    const on = Math.floor(t * 3) % 2 === 0;
    rr(g, 146, 214, 308, 30, 8, '#d9475b', on ? '#ffe14d' : '#fff3c4', 2.5);
    tvLateText(g, 'CALL NOW: PRESS THE NURSE BUTTON', 300, 235, 14, '#ffffff');
  }
}

// ---- 2. Cooking With Sheila ----
function tvLateGarnish(g, kind, x, y, t) {
  if (kind === 'straw') {
    line(g, [[x + 4, y - 40], [x + 16, y - 72]], '#f4f1ea', 4);
    line(g, [[x + 7, y - 48], [x + 10, y - 56]], '#e86f7c', 4);
  } else if (kind === 'mini') {
    tvLateJello(g, x, y - 44, 0.42, t + 0.7, 2, '#7fcf6f');
  } else if (kind === 'pudding') {
    ellipse(g, x + 58, y - 3, 5, 2.4, '#8a5a3a');
    line(g, [[x + 72, y - 30], [x + 61, y - 9]], '#ffffff', 1.5);
    tvLateText(g, 'pudding?', x + 74, y - 34, 10, '#ffffff', 'center', '#00000088');
  } else if (kind === 'pea') {
    ellipse(g, x, y - 47, 4.5, 4.5, '#6fb36a');
    spark(g, x + 9, y - 54, '#ffffff', 0.35);
  } else {
    line(g, [[x + 6, y - 40], [x + 10, y - 70]], '#c89a62', 2);
    path(
      g,
      p => {
        p.moveTo(x - 6, y - 66);
        p.quadraticCurveTo(x + 10, y - 84, x + 26, y - 70);
        p.closePath();
      },
      '#f2c14e'
    );
  }
}

function tvLateCooking(g, s, t, v, b) {
  const V = tvLateView,
    boards = [];
  tvLateFill(g, '#7a4f36');
  for (let x = Math.floor(V.x / 40) * 40; x < V.x + V.w; x += 40) boards.push([x, V.y, 3, V.h]);
  tvLateRects(g, boards, '#5f3b28');
  g.save();
  g.translate(300, 14);
  g.rotate(-0.035 + Math.sin(t * 0.9) * 0.012);
  rr(g, -125, 0, 250, 48, 8, '#f3e3b8', '#a8865a', 2);
  tvLateText(g, 'COOKING WITH SHEILA', 0, 23, 18, '#a34a52');
  tvLateText(g, 'EPISODE 1,214 · JELL-O', 0, 39, 10, '#7a5a3a');
  g.restore();
  const talk = b.since < 2.4 && Math.sin(t * 15) > 0,
    lift = s > 7 && s < 8.5 ? 1 : 0;
  plant(g, 66, 200, 1.1);
  tvLatePerson(g, 210, 252, 1.85, { ...TV_LATE_SHEILA, talk, lift }, t);
  rect(g, V.x, 196, V.w, V.h, gradient(g, 0, 196, 0, 90, '#a7d8cb', '#5f988d'));
  rect(g, V.x, 196, V.w, 5, '#e0f5ee');
  const land = s - 7.7,
    wob = 1.2 + (land > 0 && land < 1.4 ? (1.4 - land) * 4 : 0),
    kind = TV_LATE_GARNISH[v % TV_LATE_GARNISH.length];
  tvLateJello(g, 360, 200, 1.7, t, wob, '#e2414f');
  if (s >= 7.2) {
    const fall = (1 - tvLateEase((s - 7.2) / 0.5)) * 90;
    g.save();
    g.translate(0, -fall);
    tvLateGarnish(g, kind, 360, 200, t);
    g.restore();
  }
  if (s >= 14.5) {
    rr(g, 400, 70, 170, 64, 10, '#fff7df', '#e86f7c', 3);
    tvLateText(g, 'NEXT WEEK', 485, 96, 14, '#a34a52');
    tvLateText(g, 'JELL-O', 485, 122, 22, '#e2414f');
  }
}

// ---- 3. Gut Weather ----
function tvLateWeather(g, s, t, v, b) {
  const V = tvLateView,
    front = 70 + (s / 18) * 320,
    i = b.i,
    targets = [[262, 150], [front, 120], [150, 214], [418, 222], [342, 70]],
    aim = targets[clamp(i, 0, 4)],
    rain = [];
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#1c3a66', '#0c1a34'));
  rr(g, 28, 22, 414, 240, 10, '#2c6a86', '#9cd4e6', 2);
  line(g, [[150, 24], [152, 58], [186, 74]], '#e58e98', 16);
  path(
    g,
    p => {
      p.moveTo(184, 70);
      p.bezierCurveTo(194, 34, 300, 30, 320, 92);
      p.bezierCurveTo(338, 160, 292, 214, 226, 212);
      p.bezierCurveTo(190, 210, 160, 198, 138, 188);
      p.lineTo(140, 164);
      p.bezierCurveTo(168, 170, 200, 166, 218, 152);
      p.bezierCurveTo(236, 138, 232, 106, 210, 98);
      p.bezierCurveTo(198, 94, 190, 86, 184, 70);
      p.closePath();
    },
    '#f2a0a6',
    '#b8566a',
    2.5
  );
  path(
    g,
    p => {
      p.moveTo(142, 172);
      p.quadraticCurveTo(120, 178, 104, 192);
      for (let r = 0; r < 3; r++) {
        const y = 196 + r * 20,
          right = r % 2 === 0;
        p.quadraticCurveTo(right ? 114 : 54, y + 4, right ? 170 : 70, y + 10);
      }
    },
    null,
    '#e9c27a',
    9
  );
  tvLateText(g, 'STOMACH', 264, 194, 11, '#7a2a3a');
  tvLateText(g, 'SMALL INTESTINE', 112, 256, 9, '#ffffff', 'center', '#00000066');
  rr(g, 36, 30, 60, 24, 6, '#0c1a34aa');
  tvLateText(g, '98.6°', 66, 47, 13, '#ffe14d');
  tvLateText(g, 'L', 292, 150, 22, '#ff6b6b', 'center', '#00000066');
  tvLateText(g, 'H', 400, 60, 22, '#6fb7ff', 'center', '#00000066');
  const fade = i >= 4 ? clamp(1 - (s - b.at) / 1.5, 0.25, 1) : 1;
  g.globalAlpha = fade;
  for (let k = 0; k < 6; k++) {
    const rx = 232 + k * 11,
      ry = 74 + ((t * 40 + k * 9) % 26);
    rain.push([rx, ry, 2, 7]);
  }
  tvLateRects(g, rain, '#9be27a');
  ellipse(g, 260, 66, 34, 14, '#9fb59a');
  ellipse(g, 246, 57, 18, 13, '#aec4a8');
  ellipse(g, 274, 55, 20, 15, '#aec4a8');
  g.globalAlpha = 1;
  const tri = [];
  for (let k = 0; k < 5; k++) {
    const y = 52 + k * 44,
      x = front + Math.sin(k * 1.7 + s * 0.6) * 8;
    tri.push([x, y - 7, x, y + 7, x + 11, y]);
  }
  line(g, tri.map(q => [q[0], q[1] + 7]), '#5fb8ff', 3);
  g.fillStyle = '#5fb8ff';
  g.beginPath();
  for (const q of tri) {
    g.moveTo(q[0], q[1]);
    g.lineTo(q[2], q[3]);
    g.lineTo(q[4], q[5]);
    g.closePath();
  }
  g.fill();
  tvLateText(g, 'JELL-O FRONT', clamp(front, 70, 400), 42, 9, '#d9f6ff', 'center', '#00000088');
  if (i >= 2) {
    const by = 222 + Math.sin(t * 3) * 3,
      tilt = Math.sin(t * 2.2) * 0.25;
    g.save();
    g.translate(120, by);
    g.rotate(tilt);
    poly(g, [[-14, 0], [14, 0], [9, 7], [-9, 7]], '#c98a4b');
    poly(g, [[0, -2], [0, -22], [12, -4]], '#f8f6ee');
    g.restore();
    poly(g, [[150, 206], [162, 226], [138, 226]], '#ffe14d');
    tvLateText(g, '!', 150, 223, 13, '#3a2a10');
  }
  if (i >= 3) {
    rr(g, 336, 200, 80, 44, 8, '#f8f6ee', '#ffe14d', 2);
    tvLateText(g, '40%', 388, 230, 18, '#2c6a86');
    tvLateBottle(g, 352, 236, 1.5, TV_LATE_ENSURE[1]);
  }
  if (i >= 4) {
    const up = tvLateEase((s - b.at) / 1.2);
    tvLateRays(g, 342, 78 - up * 8, 30, 10, t * 0.5, '#ffe14d88');
    ellipse(g, 342, 78 - up * 8, 15, 15, '#ffd23f');
    tvLateText(g, 'THU', 342, 112, 11, '#ffe14d', 'center', '#00000088');
  }
  gremlin(g, 522, 258, 1.8, 1, t);
  const hx = 486,
    hy = 230 + Math.sin(t * 3.4) * 5,
    wig = Math.sin(t * 2.6) * 4;
  line(g, [[hx, hy], [aim[0] + wig, aim[1] + wig * 0.5]], '#f4efe2', 2.5);
  ellipse(g, aim[0] + wig, aim[1] + wig * 0.5, 3, 3, '#ff6b6b');
}

// ---- 4. Late Night With Rowdy ----
function tvLateRowdyShow(g, s, t, v, b) {
  const V = tvLateView,
    i = b.i,
    folds = [],
    towers = [],
    lights = [];
  tvLateFill(g, '#1a2150');
  for (let x = Math.floor(V.x / 34) * 34; x < V.x + V.w; x += 34) folds.push([x, V.y, 12, V.h]);
  tvLateRects(g, folds, '#222b63');
  rr(g, 150, 26, 336, 162, 8, gradient(g, 0, 26, 0, 162, '#1d2b6a', '#4b3b7c'), '#f2cf6b', 2);
  ellipse(g, 450, 62, 15, 15, '#f6efcf');
  for (let k = 0; k < 11; k++) {
    const bw = 22 + tvLateHash(k) * 12,
      bh = 40 + tvLateHash(k + 20) * 70,
      bx = 156 + k * 30;
    towers.push([bx, 188 - bh, bw, bh]);
    for (let j = 0; j < 4; j++) {
      if (tvLateHash(k * 7 + j) > 0.45) lights.push([bx + 5 + (j % 2) * 9, 200 - bh + Math.floor(j / 2) * 14, 4, 5]);
    }
  }
  tvLateRects(g, towers, '#121838');
  tvLateRects(g, lights, '#f2cf6b');
  if (i >= 3) {
    const shown = i >= 4 ? clamp(Math.floor((s - b.at) / 0.9) + 1, 0, 3) : 0;
    rr(g, 336, 32, 140, 88, 8, '#fff7df', '#1f67cb', 3);
    tvLateText(g, 'TOP THREE', 406, 52, 13, '#1f67cb');
    const rows = [`1. ${tvLateName().toUpperCase()}`, `2. ${tvLateName().toUpperCase()}`, '3. THE PUDDING'];
    for (let k = 0; k < shown; k++) tvLateText(g, rows[k], 350, 74 + k * 17, 12, '#3a2a10', 'left');
  }
  rr(g, 398, 168, 112, 86, 16, '#6c4f8a');
  ivStand(g, 452, 262, 0.92);
  rr(g, 392, 214, 20, 46, 8, '#7d5e9c');
  rr(g, 496, 214, 20, 46, 8, '#7d5e9c');
  const dripping = i === 2,
    speed = dripping ? 1.4 : 0.35,
    dy = ((t * speed) % 1) * 24;
  ellipse(g, 469, 184 + dy, 1.8, 2.6, '#cfe8f2');
  if (dripping) {
    rr(g, 486, 96, 76, 34, 12, '#f8f6ee');
    poly(g, [[494, 128], [478, 146], [508, 128]], '#f8f6ee');
    tvLateText(g, 'drip.', 524, 119, 16, '#2c6a86');
  }
  const pose = ['cheer', 'point', 'idle', 'point', 'cheer'][clamp(i, 0, 4)];
  drawRowdy(g, 248, 250, 1.62, pose, t, { face: 1, shadow: false });
  rr(g, 158, 194, 180, 10, 4, '#a06c4f');
  rr(g, 165, 202, 166, 70, 8, gradient(g, 0, 202, 0, 70, '#8a5a42', '#5e3b2c'));
  ellipse(g, 248, 236, 19, 19, '#f2cf6b');
  tvLateText(g, 'R', 248, 244, 22, '#1f67cb');
  rr(g, 300, 180, 14, 15, 3, '#f4efe2');
  line(g, [[314, 184], [318, 188], [314, 192]], '#f4efe2', 2);
  rr(g, 18, 242, 140, 30, 6, '#2a2f6a');
  const loud = i === 0 || i === 4;
  for (let k = 0; k < 3; k++) {
    const gx = 40 + k * 46,
      gt = t * (loud ? 1.8 : 1) + k * 0.9;
    gremlin(g, gx, 252, 0.78, [0, 2, 3][k], gt);
    tvLateKazoo(g, gx, 252, 0.78, gt);
    if (loud) tvLateNote(g, gx + 14, 210 - ((t * 30 + k * 14) % 40), 1, '#f2cf6b');
  }
}

// ---- 5. Ralph's Apology Hour ----
function tvLateApology(g, s, t, v, b) {
  const V = tvLateView,
    folds = [],
    lines = [],
    i = b.i,
    hopT = s % 2.4,
    hop = hopT < 0.45 ? Math.sin((hopT / 0.45) * Math.PI) * 24 : 0,
    scroll = Math.min(120, 24 + s * 7);
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#2d4a7a', '#162845'));
  for (let x = Math.floor(V.x / 40) * 40; x < V.x + V.w; x += 40) folds.push([x, V.y, 14, V.h]);
  tvLateRects(g, folds, '#ffffff0a');
  ellipse(g, 300, 64, 46, 46, '#d9c37a');
  ellipse(g, 300, 64, 38, 38, '#22385f');
  tvLateText(g, 'OFFICE OF', 300, 48, 9, '#d9c37a');
  tvLateText(g, 'RALPH', 300, 94, 11, '#d9c37a');
  poly(g, [[284, 76], [282, 56], [292, 64], [300, 52], [308, 64], [318, 56], [316, 76]], '#d9c37a');
  for (const fx of [110, 490]) {
    line(g, [[fx, 40], [fx, 262]], '#c9ced6', 3);
    rr(g, fx + 2, 44, 44, 30, 2, '#a27ad2');
    poly(g, [[fx + 14, 66], [fx + 13, 54], [fx + 19, 59], [fx + 24, 51], [fx + 29, 59], [fx + 35, 54], [fx + 34, 66]], '#f7dc6f');
  }
  tvLateRalph(g, 300, 180 - hop, 1.1, b.since < 2.8 && i !== 3 && Math.sin(t * 13) > 0);
  poly(g, [[236, 168], [364, 168], [352, 290], [248, 290]], '#6b4a3a');
  rr(g, 228, 158, 144, 14, 4, '#8a6450');
  ellipse(g, 300, 222, 16, 16, '#d9c37a');
  line(g, [[285, 160], [292, 136]], '#3a3a44', 2);
  line(g, [[315, 160], [308, 136]], '#3a3a44', 2);
  ellipse(g, 292, 134, 4, 5, '#2a2a30');
  ellipse(g, 308, 134, 4, 5, '#2a2a30');
  rr(g, 268, 166, 64, scroll, 3, '#f6efd9', '#c9b98f', 1);
  for (let y = 176; y < 166 + scroll - 6; y += 8) lines.push([276, y, 36 + tvLateHash(y) * 12, 2]);
  tvLateRects(g, lines, '#8a7a5a');
  if (i === 3) {
    const slide = tvLateEase((s - b.at) / 0.3),
      hot = Math.floor(t * 4) % 2 === 0;
    g.save();
    g.translate((1 - slide) * -620, 0);
    rr(g, 40, 92, 520, 64, 6, hot ? '#d9363e' : '#b8242c', '#ffffff', 3);
    tvLateText(g, 'THIS IS NOT LEGALLY AN APOLOGY', 300, 124, 21, '#ffffff');
    tvLateText(g, 'NO LAWYERS WERE CONSULTED FOR THIS DISCLAIMER', 300, 143, 10, '#ffe1e1');
    g.restore();
  }
}

// ---- 6. Gremlin Shopping Network ----
function tvLateProduct(g, k, t) {
  const turn = 0.62 + Math.abs(Math.cos(t * 1.2)) * 0.38;
  g.save();
  g.translate(262, 212);
  g.scale(turn * 1.45, 1.45);
  if (k === 0) {
    path(
      g,
      p => {
        p.moveTo(-40, -50);
        p.quadraticCurveTo(0, -42, 40, -50);
        p.quadraticCurveTo(32, -25, 40, 0);
        p.quadraticCurveTo(0, -8, -40, 0);
        p.quadraticCurveTo(-32, -25, -40, -50);
      },
      '#f4f1ea',
      '#c9c2b4',
      1.5
    );
    ellipse(g, 0, -25, 3, 3, '#d9d2c4');
    poly(g, [[-9, -39], [9, -39], [9, -28], [0, -21], [-9, -28]], '#8a9aa6');
  } else if (k === 1) {
    poly(g, [[-26, -60], [26, -60], [32, 0], [-32, 0]], '#e3e9ee');
    rr(g, -28, -66, 56, 12, 3, '#cbd5dd');
    tvLateText(g, 'LUX', 0, -24, 16, '#c9a23a');
  } else if (k === 2) brick(g, -31, 0, '#c96f5a', 3);
  else tvLateStar(g, 0, -32, 28, 5, t, '#f2cf6b', '#fff3c4');
  g.restore();
}

function tvLateShopping(g, s, t) {
  const V = tvLateView,
    k = s < 3 ? -1 : s < 7 ? 0 : s < 11 ? 1 : 2;
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#6a2066', '#1f1438'));
  tvLateRays(g, 262, 200, 600, 12, -t * 0.05, '#ffffff0b');
  for (let j = 0; j < 3; j++) spark(g, 70 + j * 170, 36 + j * 22, '#ffd6f0', 0.5 + 0.3 * Math.sin(t * 3 + j));
  rr(g, 18, 16, 92, 40, 8, '#ef6fb6', '#ffe0f2', 2);
  tvLateText(g, 'GSN', 64, 45, 24, '#ffffff');
  tvLateText(g, 'ITEMS SOLD: 0', 64, 72, 9, '#ffd6f0');
  ellipse(g, 262, 222, 92, 18, '#8a5fa8');
  ellipse(g, 262, 214, 88, 16, '#d8c2e8');
  tvLateProduct(g, k < 0 ? 3 : k, t);
  gremlin(g, 92, 262, 1.6, 3, t);
  if (k >= 0) {
    const item = TV_LATE_PRODUCTS[k];
    rr(g, 392, 48, 188, 150, 12, '#fdf3d0', '#ef6fb6', 3);
    tvLateText(g, item.name, 486, 84, item.name.length > 9 ? 16 : 22, '#6a2066');
    tvLateText(g, item.price, 486, 128, 32, '#d9363e');
    tvLateText(g, item.note, 486, 152, 11, '#8a5fa8');
    if (Math.floor(t * 2.5) % 2 === 0) tvLateText(g, 'ONLY 3 LEFT!', 486, 184, 13, '#d9363e');
  }
}

// ---- 7. Nature documentary: the hallway at night ----
function tvLateNature(g, s, t, v, b) {
  const V = tvLateView,
    cam = s * 26,
    barbX = s < 3.5 ? 700 : 700 - (s - 3.5) * 17,
    dadMove = s > 13 ? Math.min(s - 13, 4.5) : 0,
    dadX = 850 + dadMove * 9,
    doors = [],
    pools = [];
  tvLateFill(g, '#24324d');
  rect(g, V.x, 206, V.w, V.h, gradient(g, 0, 206, 0, 120, '#1a2540', '#0f1729'));
  g.save();
  g.translate(-cam, 0);
  rect(g, cam + V.x, 200, V.w, 6, '#3b4b6b');
  for (let x = 60; x < 1300; x += 250) {
    if (x < cam - 120 || x > cam + V.w) continue;
    doors.push([x, 96, 70, 108]);
    pools.push(x + 125);
  }
  tvLateRects(g, doors, '#18233a');
  for (const d of doors) rr(g, d[0] + 24, d[1] + 18, 22, 26, 3, '#f2d79233');
  for (const px of pools) {
    rr(g, px - 30, 24, 60, 6, 3, '#9fb8e655');
    glow(g, px, 232, 90, '#9fb8e626');
  }
  if (cam < 520) {
    rr(g, 400, 56, 90, 70, 6, '#0c1424', '#3b4b6b', 3);
    ellipse(g, 462, 78, 9, 9, '#f6efcf');
  }
  rr(g, 690, 62, 46, 18, 4, '#163a24');
  tvLateText(g, 'EXIT', 713, 76, 11, '#7dff9c');
  glow(g, 713, 72, 40, '#7dff9c22');
  rr(g, 960, 92, 64, 116, 8, '#2c3d5c', '#5a6f96', 2);
  rr(g, 968, 102, 48, 70, 4, '#9fd3ff33');
  if (b.i >= 4) tvLateText(g, 'EMPTY', 992, 140, 11, '#ff8a8a');
  const barbWalk = s >= 3.5 ? s * 7 : 0;
  tvLatePerson(g, barbX, 248, 0.95, { ...TV_LATE_BARB, dir: -1, walk: barbWalk }, t);
  tvLatePerson(g, dadX, 246, 0.95, { ...TV_LATE_DAD, walk: dadMove > 0 && dadMove < 4.5 ? s * 6 : 0, lift: 0.4 }, t);
  if (b.i >= 4) tvLateText(g, '?', dadX + 6, 146, 20, '#f2d792', 'center', '#00000088');
  g.restore();
  rect(g, V.x, V.y, V.w, -V.y + 22, '#000000');
  g.globalAlpha = 0.5;
  tvLateText(g, 'NIGHT FOOTAGE', 18, 15, 9, '#ffffff', 'left');
  g.globalAlpha = 1;
}

// ---- 8. Emergency Broadcast Test ----
function tvLateBars(g) {
  const V = tvLateView,
    top = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'],
    mid = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'],
    bw = V.w / 7;
  for (let k = 0; k < 7; k++) {
    rect(g, V.x + k * bw, V.y, bw + 0.5, 200 - V.y, top[k]);
    rect(g, V.x + k * bw, 200, bw + 0.5, 24, mid[k]);
  }
  rect(g, V.x, 224, V.w, V.y + V.h - 224, '#101018');
  rect(g, V.x + bw * 1.25, 224, bw * 1.25, V.y + V.h - 224, '#f4f4f4');
  rect(g, V.x + bw * 2.5, 224, bw * 1.25, V.y + V.h - 224, '#2c0a5e');
}

function tvLateBroadcast(g, s, t, v, b) {
  const i = b.i;
  if (i >= 3) {
    tvLateFill(g, '#0d1020');
    tvLateText(g, 'TEST COMPLETE', 300, 92, 30, '#ffffff', 'center', '#00000088');
    tvLateText(g, 'YOUR PATIENCE', 300, 140, 13, '#c0c0c0');
    rr(g, 170, 150, 260, 26, 6, '#1c2238', '#c0c0c0', 2);
    const left = 0.03 + Math.max(0, 1 - (s - b.at) / 1.2) * 0.5;
    rr(g, 174, 154, 252 * left, 18, 4, '#e04848');
    tvLateText(g, `${Math.round(left * 100)}%`, 300, 200, 15, '#e04848');
    return;
  }
  tvLateBars(g);
  if (i <= 0) {
    rr(g, 110, 72, 380, 76, 8, '#000000ee', '#ffffff', 2);
    tvLateText(g, 'EMERGENCY BROADCAST SYSTEM', 300, 106, 19, '#ffffff');
    tvLateText(g, 'THIS IS ONLY A TEST', 300, 130, 12, '#c0c0c0');
  } else {
    const amp = 18 + Math.sin(t * 5) * 6,
      pts = [];
    for (let x = 60; x <= 540; x += 12) pts.push([x, 110 + Math.sin(x * 0.09 + t * 14) * amp]);
    rr(g, 50, 70, 500, 80, 8, '#000000cc');
    line(g, pts, '#7dff9c', 3);
    tvLateText(g, '1000 Hz', 520, 92, 11, '#7dff9c', 'right');
  }
  if (i === 2) {
    const peek = tvLateEase((s - b.at) / 1.2) * 34;
    g.save();
    g.beginPath();
    g.rect(400, 150, 140, 98);
    g.clip();
    gremlin(g, 470, 282 - peek, 1.5, 1, t);
    g.restore();
  }
}

// ---- 9. Rams Replay ----
// One play, a in seconds: the set, the approach and jump, the spike into the floor, and the bounce
// that leaves through the roof. The ball meets her hand at a = 1.
const TV_LATE_SPIKER = 1.5;

function tvLatePose(a) {
  const run = clamp(a / 0.6, 0, 1),
    jump = a < 0.6 ? 0 : Math.sin(clamp((a - 0.6) / 0.85, 0, 1) * Math.PI) * 48,
    swing = clamp((a - 0.75) / 0.4, 0, 1),
    x = 196 + run * 70,
    y = 238 - jump,
    ang = -2.7 + swing * 3;
  return {
    x,
    y,
    jump,
    swing,
    hand: [x + (6 + Math.cos(ang) * 24) * TV_LATE_SPIKER, y + (-57 + Math.sin(ang) * 24) * TV_LATE_SPIKER]
  };
}

function tvLatePlay(a) {
  const pose = tvLatePose(a),
    hit = tvLatePose(1).hand;
  let ball;
  if (a < 1) {
    ball = [120 + (hit[0] - 120) * a, 190 + (hit[1] - 190) * a - Math.sin(a * Math.PI) * 90];
  } else if (a < 1.2) {
    const u = (a - 1) / 0.2;
    ball = [hit[0] + (400 - hit[0]) * u, hit[1] + (232 - hit[1]) * u];
  } else ball = [400, 232 - (a - 1.2) * 640];
  pose.ball = ball;
  pose.hole = a >= 1.5;
  pose.impact = a >= 1.18 && a < 1.5;
  return pose;
}

function tvLateGym(g, play, s) {
  const V = tvLateView,
    boards = [],
    bleach = [];
  tvLateFill(g, '#c8b48a');
  for (let y = 120; y < 196; y += 12) bleach.push([V.x, y, V.w, 3]);
  tvLateRects(g, bleach, '#a8926a');
  rr(g, 60, 52, 110, 40, 4, '#1f67cb');
  tvLateText(g, 'RAMS', 115, 80, 20, '#f2cf6b');
  rr(g, 430, 52, 130, 40, 4, '#f2cf6b');
  tvLateText(g, 'GO BLUE', 495, 80, 18, '#1f67cb');
  rect(g, V.x, V.y, V.w, 30 - V.y, '#4a3b2e');
  for (let x = Math.floor(V.x / 50) * 50; x < V.x + V.w; x += 50) boards.push([x, 18, 3, 14]);
  tvLateRects(g, boards, '#2e241c');
  if (play.hole) {
    poly(g, [[370, -4], [432, -4], [440, 14], [424, 34], [408, 26], [386, 36], [362, 18]], '#0d1430');
    ellipse(g, 392, 12, 1.6, 1.6, '#ffffff');
    ellipse(g, 418, 20, 1.2, 1.2, '#ffffff');
  }
  rect(g, V.x, 196, V.w, V.h, gradient(g, 0, 196, 0, 120, '#d9a868', '#a87638'));
  line(g, [[V.x, 238], [V.x + V.w, 238]], '#f4efe2', 3);
  line(g, [[340, 120], [340, 252]], '#6b737c', 4);
  rr(g, 316, 136, 48, 46, 2, null, '#2a2a30', 1.5);
  line(g, [[316, 136], [364, 128]], '#f4efe2', 4);
  tvLatePlayer(g, play.x, play.y, TV_LATE_SPIKER, play.swing, play.jump > 6 ? 1 : 0);
  if (play.impact) ellipse(g, 400, 238, 30, 6, '#f4efe2aa');
  if (play.ball[1] > -20) tvLateVolleyball(g, play.ball[0], play.ball[1], 9);
  if (play.hole && s % 4.5 < 4.2) {
    for (let k = 0; k < 4; k++) rect(g, 382 + k * 11, 36 + ((s * 90 + k * 23) % 160), 5, 3, '#4a3b2e');
  }
}

function tvLateBallCam(g, u, t) {
  const V = tvLateView,
    stars = [];
  if (u < 1.2) {
    const z = 1 + u * u * 5,
      grid = [];
    tvLateFill(g, '#5a4836');
    for (let k = -7; k <= 7; k++) {
      grid.push([300 + k * 56 * z - 3 * z, V.y, 6 * z, V.h]);
      grid.push([V.x, 169 + k * 56 * z - 3 * z, V.w, 6 * z]);
    }
    tvLateRects(g, grid, '#2e241c');
    rr(g, 300 - 22 * z, 169 - 6 * z, 44 * z, 12 * z, 3 * z, '#fff6d8');
    glow(g, 300, 169, 60 * z, '#fff6d855');
    tvLateRays(g, 300, 169, 520, 18, u * 0.3, '#ffffff12');
    return;
  }
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#03050f', '#0d1d4a'));
  for (let k = 0; k < 40; k++) stars.push([V.x + tvLateHash(k) * V.w, V.y + tvLateHash(k + 99) * V.h * 0.8, 2, 2]);
  tvLateRects(g, stars, '#ffffffcc');
  const rise = clamp((u - 1.2) / 6, 0, 1);
  ellipse(g, 300, 520 - rise * 150, 420, 230, '#2f6fae');
  ellipse(g, 300, 520 - rise * 150, 420, 230, '#6fd0ff22');
  ellipse(g, 470, 70, 18 + rise * 10, 18 + rise * 10, '#f6efcf');
  if (u < 1.6) tvLateFill(g, `rgba(255,255,255,${(1 - (u - 1.2) / 0.4).toFixed(3)})`);
  if (u > 4) {
    rr(g, 216, 18, 168, 26, 6, '#00000088');
    tvLateText(g, 'ALTITUDE: YES', 300, 36, 13, '#7dff9c');
  }
}

function tvLateReplay(g, s, t) {
  const take = s < 4.5 ? 0 : s < 9 ? 1 : 2,
    grain = [],
    frame = Math.floor(t * 12);
  if (take === 2) tvLateBallCam(g, s - 9, t);
  else tvLateGym(g, tvLatePlay(take === 0 ? s : (s - 4.5) * 0.6), take === 0 ? s : s - 4.5);
  if (take < 2) tvLateFill(g, '#a07a3a26');
  for (let k = 0; k < 26; k++) {
    const gx = tvLateView.x + tvLateHash(frame * 31 + k) * tvLateView.w,
      gy = tvLateView.y + tvLateHash(frame * 17 + k + 0.5) * tvLateView.h;
    grain.push([gx, gy, 3, 2]);
  }
  tvLateRects(g, grain, '#ffffff44');
  rr(g, 18, 16, 118, 28, 6, '#1f67cb', '#f2cf6b', 2);
  tvLateText(g, ['REPLAY 1/3', 'SLOW MO 2/3', 'BALL CAM 3/3'][take], 77, 35, 12, '#ffffff');
  for (const at of [4.5, 9]) {
    const w = (s - at + 0.25) / 0.5;
    if (w > 0 && w < 1) {
      const x = -60 + w * 720;
      ellipse(g, x, 169, 70, 70, '#f2cf6b');
      tvLateText(g, 'R', x, 192, 64, '#1f67cb');
    }
  }
}

// ---- 10. Sign-off ----
function tvLateSignOff(g, s, t, v, b) {
  const V = tvLateView,
    stars = [],
    red = [],
    white = [],
    blue = [],
    dots = [],
    cols = 22,
    rows = 13,
    cw = 7,
    ch = 6,
    fx = 232,
    fy = 66;
  tvLateFill(g, gradient(g, 0, V.y, 0, V.h, '#070b1e', '#1c2a55'));
  for (let k = 0; k < 46; k++) {
    if (tvLateHash(k + Math.floor(t * 2) * 0.37) > 0.9) continue;
    stars.push([V.x + tvLateHash(k * 3) * V.w, V.y + tvLateHash(k * 5 + 1) * V.h * 0.7, 2, 2]);
  }
  tvLateRects(g, stars, '#ffffffbb');
  ellipse(g, 300, 330, 380, 70, '#0a1024');
  line(g, [[fx - 2, 54], [fx - 2, 268]], '#c9ced6', 4);
  ellipse(g, fx - 2, 52, 5, 5, '#f2cf6b');
  for (let c = 0; c < cols; c++) {
    const dy = Math.round((Math.sin(t * 2.4 - c * 0.45) * 5 * c) / cols / 2) * 2,
      x = fx + c * cw;
    for (let r = 0; r < rows; r++) {
      const y = fy + r * ch + dy;
      if (c < 9 && r < 7) {
        blue.push([x, y, cw, ch]);
        if ((c + r) % 2 === 0 && c > 0 && r > 0 && c < 8 && r < 6) dots.push([x + 2, y + 2, 3, 2]);
      } else (r % 2 ? white : red).push([x, y, cw, ch]);
    }
  }
  tvLateRects(g, red, '#c8323c');
  tvLateRects(g, white, '#f4f1ea');
  tvLateRects(g, blue, '#26408a');
  tvLateRects(g, dots, '#f4f1ea');
  if (b.i === 1) {
    gremlin(g, 278, 262, 0.7, 0, t);
    tvLateKazoo(g, 278, 262, 0.7, t);
    tvLateNote(g, 300, 220 - ((t * 24) % 50), 1.2, '#f2cf6b');
  }
  if (b.i >= 3) {
    const colon = Math.floor(t * 2) % 2 === 0 ? ':' : ' ';
    rr(g, 404, 104, 170, 84, 10, '#0b0f1e', '#ff5a5a', 2);
    tvLateText(g, `3${colon}00`, 474, 166, 44, '#ff5a5a');
    tvLateText(g, 'AM', 548, 166, 14, '#ff5a5a');
  }
}

// ---- The pool ----
// beats: { at, text, cue? }; text may be a list with one entry per variant (a fresh pick each airing).
const tvLateSketches = [
  {
    id: 'juicer',
    name: 'The Gut Feeling Juicer',
    tag: 'PAID PROGRAMMING',
    accent: '#f2c14e',
    length: 18,
    beats: [
      { at: 0.4, text: 'Tired of food that tastes like food?' },
      { at: 3, text: 'The Gut Feeling Juicer! Apple in, Ensure out!', cue: 'powerup' },
      { at: 6.6, text: 'Pizza in... Ensure out!' },
      { at: 10.2, text: 'A volleyball? Believe it or not: Ensure.' },
      { at: 14.2, text: 'Operators are standing by. In the hallway.', cue: 'coin' }
    ],
    draw: tvLateJuicer
  },
  {
    id: 'cooking',
    name: 'Cooking With Sheila',
    tag: 'COOKING WITH SHEILA',
    accent: '#e86f7c',
    length: 18,
    variants: 5,
    beats: [
      { at: 0.4, text: 'Welcome back to Cooking With Sheila!' },
      { at: 3.5, text: "Tonight we're making Jell-O.", cue: 'squelch' },
      {
        at: 7.2,
        text: [
          'Garnish with a straw. Very fancy.',
          'Garnish with a smaller Jell-O.',
          'Garnish with a suggestion of pudding.',
          'Garnish with one pea. For drama.',
          "Garnish with a tiny umbrella. It's on vacation."
        ]
      },
      { at: 11, text: 'Serves one. Wobbles for everyone.' },
      { at: 14.5, text: 'Next week: Jell-O.' }
    ],
    draw: tvLateCooking
  },
  {
    id: 'weather',
    name: 'Gut Weather',
    tag: 'GUT WEATHER',
    accent: '#6fc3e8',
    length: 18,
    beats: [
      { at: 0.4, text: "Here's your Gut Weather. Let's go to the map." },
      { at: 3.5, text: 'A cold front of Jell-O is moving through.' },
      { at: 7.5, text: 'Small craft advisory for the small intestine.' },
      { at: 11, text: 'A 40% chance of Ensure overnight.' },
      { at: 14.5, text: 'Partly nauseous, clearing by Thursday.', cue: 'clear' }
    ],
    draw: tvLateWeather
  },
  {
    id: 'rowdy',
    name: 'Late Night With Rowdy',
    tag: 'LATE NIGHT WITH ROWDY',
    accent: '#f2cf6b',
    length: 18,
    variants: 3,
    beats: [
      { at: 0.4, text: "It's Late Night With Rowdy! Hit it, boys!", cue: 'combo' },
      {
        at: 3.5,
        text: [
          'My guest: the IV pole. How long you been hanging around?',
          'My guest: the IV pole. What keeps you going?',
          'My guest: the IV pole. Any big projects coming up?'
        ]
      },
      { at: 7, text: 'IV Pole: drip.', cue: 'drip' },
      { at: 10, text: 'Wow. Okay. Top three things in this hospital.' },
      { at: 13.5, text: '1. {name}. 2. {name}. 3. The pudding.', cue: 'win' }
    ],
    draw: tvLateRowdyShow
  },
  {
    id: 'apology',
    name: "Ralph's Apology Hour",
    tag: "RALPH'S APOLOGY HOUR",
    accent: '#a27ad2',
    length: 18,
    variants: 3,
    beats: [
      { at: 0.4, text: 'And now, a prepared statement from Ralph.' },
      { at: 3, text: 'Ralph: "I am sorry for the gastro... gastrointes..."' },
      { at: 7, text: 'Ralph: "...for any distress. Who wrote this?"' },
      { at: 10.5, text: 'THIS IS NOT LEGALLY AN APOLOGY.', cue: 'lock' },
      {
        at: 14,
        text: [
          'Ralph: "Thank you. No questions. I am very small."',
          'Ralph: "I regret nothing. Except this hour."',
          'Ralph: "Same time tomorrow. I\'ll bring snacks."'
        ]
      }
    ],
    draw: tvLateApology
  },
  {
    id: 'shopping',
    name: 'Gremlin Shopping Network',
    tag: 'GREMLIN SHOPPING NETWORK',
    accent: '#ef6fb6',
    length: 18,
    beats: [
      { at: 0.4, text: "You're watching the Gremlin Shopping Network!" },
      { at: 3, text: 'A pillow? No. This is ARMOR.', cue: 'shield' },
      { at: 7, text: 'A barf bag? Please. This is LUXURY LUGGAGE.' },
      { at: 11, text: 'And our finest item: A BRICK.', cue: 'coin' },
      { at: 14.5, text: "Only 3 left! There were only ever 3. It's a brick." }
    ],
    draw: tvLateShopping
  },
  {
    id: 'nature',
    name: 'The Hallway at Night',
    tag: 'WILD WARD',
    accent: '#b9c98a',
    length: 19,
    italic: true,
    beats: [
      { at: 0.5, text: 'The hallway, at night. Few dare to cross it.' },
      { at: 4, text: 'Here we see Barb, on her great migration.' },
      { at: 8, text: 'She carries Ensure to the young. They refuse it.' },
      { at: 12, text: 'And here, the elusive nocturnal Dad. Hunting coffee.' },
      { at: 15.5, text: 'The machine is empty. It has always been empty.' }
    ],
    draw: tvLateNature
  },
  {
    id: 'broadcast',
    name: 'Emergency Broadcast Test',
    tag: 'EMERGENCY BROADCAST TEST',
    accent: '#e04848',
    length: 15,
    beats: [
      { at: 0.4, text: 'This is a test of the Emergency Broadcast System.' },
      { at: 3.5, text: '[ A LONG, ANNOYING TONE ]', cue: 'countdown' },
      { at: 7.5, text: '[ STILL THE TONE. A NURSE TAKES YOUR VITALS. ]' },
      { at: 11.5, text: 'THIS WAS ONLY A TEST. OF YOUR PATIENCE.', cue: 'clear' }
    ],
    draw: tvLateBroadcast
  },
  {
    id: 'replay',
    name: 'Rams Replay',
    tag: 'RAMS REPLAY',
    accent: '#1f67cb',
    length: 17,
    beats: [
      { at: 0.4, text: 'Rams Replay! Number 22 goes up for the spike.', cue: 'swing' },
      { at: 4.5, text: 'Again, in slow motion. Look at that arm.' },
      { at: 9, text: "And now, from the ball's point of view.", cue: 'leap' },
      { at: 13, text: 'The ball has not come down. Officials are checking.' }
    ],
    draw: tvLateReplay
  },
  {
    id: 'signoff',
    name: 'Sign-off',
    tag: 'SIGN-OFF',
    accent: '#9fb3d8',
    length: 16,
    last: true,
    powerOff: 1.1,
    beats: [
      { at: 0.4, text: 'This concludes our broadcast day.' },
      { at: 3.5, text: '[ THE ANTHEM, PLAYED ON ONE KAZOO ]' },
      { at: 8, text: 'Get some sleep. A nurse will be by to wake you.' },
      { at: 11.5, text: 'WE RETURN AT 3 AM. IT IS ALWAYS 3 AM.', cue: 'daily' }
    ],
    draw: tvLateSignOff
  }
];

// ---- Timeline ----

// A fresh order: everything shuffled, never opening with the sketch that just aired, sign-off last.
function tvLateShuffle(first = -1) {
  const prev = tvLateState.order[tvLateState.order.length - 1],
    lasts = [],
    ids = [];
  tvLateSketches.forEach((sk, i) => {
    if (i === first) return;
    if (sk.last) lasts.push(i);
    else ids.push(i);
  });
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand(0, i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (ids.length > 1 && ids[0] === prev) [ids[0], ids[1]] = [ids[1], ids[0]];
  if (first >= 0) ids.unshift(first);
  return ids.concat(lasts);
}

function tvLateEnter(pos) {
  const st = tvLateState,
    sk = tvLateSketches[st.order[pos]];
  st.pos = pos;
  st.s = 0;
  st.beat = -1;
  st.variant = sk.variants > 1 ? Math.floor(rand(0, sk.variants)) : 0;
}

function tvLateBegin() {
  if (tvLateState.started) return;
  tvLateState.started = true;
  tvLateState.order = tvLateShuffle();
  tvLateEnter(0);
}

function tvLateReset() {
  tvLateState = { order: [], pos: 0, s: 0, beat: -1, variant: 0, rotation: 0, started: false };
  tvLateBegin();
}

// Plays a sketch now (id or index). The rest of the pool follows, shuffled, with sign-off last.
function tvLateShow(id) {
  const i = typeof id === 'number' ? id : tvLateSketches.findIndex(sk => sk.id === id);
  if (!tvLateSketches[i]) return false;
  tvLateBegin();
  tvLateState.order = tvLateSketches[i].last ? [i] : tvLateShuffle(i);
  tvLateEnter(0);
  return true;
}

function tvLateSketch() {
  tvLateBegin();
  return tvLateSketches[tvLateState.order[tvLateState.pos]];
}

function tvLateBeatIndex(sk, s) {
  let i = -1;
  for (let j = 0; j < sk.beats.length; j++) if (s >= sk.beats[j].at) i = j;
  return i;
}

function tvLateBeatText(sk, i, variant) {
  const beat = sk.beats[i];
  if (!beat) return '';
  const text = Array.isArray(beat.text) ? beat.text[variant % beat.text.length] : beat.text;
  return tvLateFormat(text);
}

function tvLateNext() {
  const st = tvLateState;
  if (st.pos + 1 < st.order.length) {
    tvLateEnter(st.pos + 1);
    return;
  }
  st.rotation++;
  st.order = tvLateShuffle();
  tvLateEnter(0);
}

function tvLateTick(dt) {
  const st = tvLateState;
  tvLateBegin();
  let left = Number.isFinite(dt) ? clamp(dt, 0, TV_LATE_MAX_STEP) : 0,
    cue = null;
  for (let guard = 0; guard < 64; guard++) {
    const sk = tvLateSketches[st.order[st.pos]];
    if (st.s + left < sk.length) {
      st.s += left;
      break;
    }
    left -= sk.length - st.s;
    tvLateNext();
  }
  const sk = tvLateSketches[st.order[st.pos]],
    beat = tvLateBeatIndex(sk, st.s);
  if (beat !== st.beat) {
    st.beat = beat;
    if (beat >= 0 && sk.beats[beat].cue) cue = sk.beats[beat].cue;
  }
  return cue;
}

function tvLateCaption() {
  const sk = tvLateSketch();
  return tvLateBeatText(sk, tvLateBeatIndex(sk, tvLateState.s), tvLateState.variant);
}

function tvLateNow() {
  const st = tvLateState,
    sk = tvLateSketch();
  return {
    id: sk.id,
    name: sk.name,
    tag: sk.tag,
    s: st.s,
    length: sk.length,
    beat: tvLateBeatIndex(sk, st.s),
    pos: st.pos,
    rotation: st.rotation
  };
}

// ---- The frame: lower third, station bug, signal ----

function tvLateLowerThird(g, sk, b, k) {
  if (!b.text) return;
  const V = tvLateView,
    italic = !!sk.italic,
    size = Math.max(17, 7 / k),
    wrap = tvLateWrap(g, b.text, V.w - 64, size, italic),
    sz = wrap.size,
    lh = sz * 1.22,
    bandH = sz * 0.75 + wrap.lines.length * lh,
    fade = clamp(b.since / 0.25, 0, 1),
    y0 = V.y + V.h - bandH - 8 + (1 - fade) * 6,
    x0 = V.x + 14;
  g.globalAlpha = fade;
  rr(g, x0, y0, V.w - 28, bandH, 6, '#0b1022d9');
  rect(g, x0, y0 + 4, 5, bandH - 8, sk.accent);
  if (10 * k >= 5) {
    g.font = tvLateFont(10, false);
    const tw = tvLateMeasure(g, sk.tag, 10) + 16;
    rr(g, x0, y0 - 16, tw, 18, 4, sk.accent);
    tvLateText(g, sk.tag, x0 + 8, y0 - 3, 10, '#0b1022', 'left');
  }
  wrap.lines.forEach((text, j) => {
    tvLateText(g, text, x0 + 18, y0 + sz * 0.38 + sz * 0.86 + j * lh, sz, '#ffffff', 'left', '#000000b3', italic);
  });
  g.globalAlpha = 1;
}

// "3 AM" in the corner, like a network watermark, with a crescent moon.
function tvLateBug(g, k) {
  const V = tvLateView,
    z = clamp(5 / (12 * k), 1, 2.2),
    x = V.x + V.w - 12,
    y = V.y + 10;
  g.save();
  g.translate(x, y);
  g.scale(z, z);
  g.globalAlpha = 0.8;
  rr(g, -62, 0, 62, 24, 7, '#00000066', '#ffffffaa', 1.2);
  path(
    g,
    p => {
      p.arc(-48, 12, 7, 0.6, Math.PI * 2 - 0.6, false);
      p.arc(-45, 10, 5.6, Math.PI * 2 - 0.9, 0.9, true);
      p.closePath();
    },
    '#f2cf6b'
  );
  tvLateText(g, '3 AM', -22, 17, 12, '#ffffff');
  g.restore();
}

// Static for a sketch change: gray wash plus a few dozen streaks from a hash of the clock.
function tvLateStatic(g, w, h, t, a, calm) {
  rect(g, 0, 0, w, h, `rgba(118,122,130,${(a * 0.92).toFixed(3)})`);
  if (calm) return;
  const frame = Math.floor(t * 30),
    light = [],
    dark = [];
  for (let i = 0; i < 48; i++) {
    const x = tvLateHash(frame * 97 + i) * w,
      y = tvLateHash(frame * 53 + i + 0.31) * h,
      bw = (0.03 + tvLateHash(frame + i * 7.7) * 0.18) * w;
    (i % 2 ? light : dark).push([x - bw / 2, y, bw, Math.max(1, h * 0.012)]);
  }
  g.globalAlpha = a;
  tvLateRects(g, light, '#e8ecef');
  tvLateRects(g, dark, '#25282e');
  g.globalAlpha = 1;
}

// The old-set power-off: the picture folds to a line, then a dot.
function tvLatePowerOff(g, w, h, u) {
  if (u < 0.55) {
    const q = u / 0.55,
      band = Math.max(2, h * (1 - q)),
      top = (h - band) / 2;
    rect(g, 0, 0, w, top, '#000000');
    rect(g, 0, top + band, w, h - top - band, '#000000');
    rect(g, 0, top, w, band, `rgba(255,255,255,${(q * 0.85).toFixed(3)})`);
    return;
  }
  const q = clamp((u - 0.55) / 0.45, 0, 1);
  rect(g, 0, 0, w, h, '#000000');
  const rx = Math.max(0.5, w * 0.5 * (1 - q)),
    ry = Math.max(0.5, 1.6 * (1 - q * 0.5));
  ellipse(g, w / 2, h / 2, rx, ry, `rgba(255,255,255,${(1 - q).toFixed(3)})`);
}

// Scanlines, a slow roll bar, a little flicker and a few specks, all in screen pixels.
function tvLateSignal(g, w, h, t, s, sk) {
  const calm = typeof reduced !== 'undefined' && !!reduced,
    rows = [];
  for (let y = 0; y < h; y += 3) rows.push([0, y, w, 1]);
  tvLateRects(g, rows, '#0000001f');
  if (!calm) {
    const bar = h * 0.14,
      ry = ((t * 0.09) % 1) * (h + bar * 2) - bar,
      flick = tvLateHash(Math.floor(t * 20)),
      tick = Math.floor(t * 24),
      specks = [];
    rect(g, 0, ry, w, bar, gradient(g, 0, ry, 0, bar, '#ffffff00', '#ffffff12'));
    if (flick > 0.6) rect(g, 0, 0, w, h, `rgba(0,0,0,${((flick - 0.6) * 0.12).toFixed(3)})`);
    for (let i = 0; i < 8; i++) specks.push([tvLateHash(tick * 13 + i) * w, tvLateHash(tick * 7 + i + 0.5) * h, 1.5, 1]);
    tvLateRects(g, specks, '#ffffff66');
  }
  const burst = clamp(1 - s / TV_LATE_STATIC, 0, 1);
  if (burst > 0) tvLateStatic(g, w, h, t, burst, calm);
  if (sk.powerOff && s > sk.length - sk.powerOff) tvLatePowerOff(g, w, h, (s - (sk.length - sk.powerOff)) / sk.powerOff);
}

function tvLateDraw(g, w, h, t) {
  if (!g || !(w > 0) || !(h > 0)) return;
  const st = tvLateState,
    sk = tvLateSketch(),
    tt = Number.isFinite(t) ? t : 0,
    k = Math.min(w / TV_LATE_W, h / TV_LATE_H),
    W = w / k,
    H = h / k,
    ox = (W - TV_LATE_W) / 2,
    oy = (H - TV_LATE_H) / 2,
    i = tvLateBeatIndex(sk, st.s),
    at = i >= 0 ? sk.beats[i].at : 0,
    b = { i, at, since: st.s - at, text: tvLateBeatText(sk, i, st.variant) };
  tvLateView.x = -ox;
  tvLateView.y = -oy;
  tvLateView.w = W;
  tvLateView.h = H;
  g.save();
  g.beginPath();
  g.rect(0, 0, w, h);
  g.clip();
  g.save();
  g.scale(k, k);
  g.translate(ox, oy);
  g.save();
  sk.draw(g, st.s, tt, st.variant, b);
  g.restore();
  tvLateLowerThird(g, sk, b, k);
  tvLateBug(g, k);
  g.restore();
  tvLateSignal(g, w, h, tt, st.s, sk);
  g.restore();
}
