// Hospital map: a drawn floor plan of the seventh floor at Valley Hospital for the map dialog.
// hospitalMapDraw(g, w, h) paints it into any 2D context and picks a layout for the box: 'wide'
// (desktop), 'strip' (phone landscape) or 'portrait' (phone portrait). hospitalMapHit(x, y, w, h)
// says what sits under a point. mountHospitalMap(el) puts a live, tappable canvas inside el plus a
// visually hidden button list for keyboards and screen readers, and writes the dialog's header line
// (HOSPITAL_MAP_COPY.header) into its .modal-kicker. hospitalMapInvalidate() redraws.
// Every global here starts with hospitalMap or HOSPITAL_MAP; nothing reassigns another file's names.

// Plans in design units. A plan stretches up to 30% to fill its box, then letterboxes.
// Rects are [x, y, w, h]. door is [side, where]: side t/b/l/r, where a 0..1 fraction along that
// wall, 'open' (a counter, no wall) or 'lift' (sliding doors). Inside a place, chip, macy, moon and
// eyes are [fx, fy] fractions of its rect; props are [type, fx, fy, scale] and may step outside
// 0..1 (the strip plan posts CT's NO BRAKES sign in the corridor).
const HOSPITAL_MAP_PLANS = {
  wide: {
    w: 680,
    h: 400,
    axis: 'x',
    building: [10, 10, 620, 380],
    corridor: [66, 168, 564, 64],
    exit: [180, 220],
    exitZone: [566, 168, 114, 64],
    sign: [606, 180],
    ralph: [590, 228],
    badge: [655, 258],
    daily: [372, 171, 48, 52],
    wet: [276, 228],
    floorText: [84, 206],
    plants: [[84, 236, 0.34]],
    places: [
      {
        kind: 'room',
        id: 0,
        r: [10, 10, 226, 158],
        door: ['b', 0.84],
        label: 't',
        chip: [0.46, 0.87],
        macy: [0.84, 0.93],
        moon: [0.9, 0.21],
        props: [['iv', 0.5, 0.71, 1], ['bed', 0.7, 0.74, 1]]
      },
      {
        kind: 'room',
        id: 1,
        r: [236, 10, 200, 158],
        door: ['b', 0.17],
        label: 't',
        chip: [0.58, 0.87],
        macy: [0.17, 0.93],
        eyes: [[0.13, 0.61], [0.91, 0.62]],
        props: [['scanner', 0.64, 0.47, 1]]
      },
      {
        kind: 'room',
        id: 3,
        r: [436, 10, 194, 158],
        door: ['b', 0.2],
        label: 't',
        chip: [0.64, 0.87],
        macy: [0.2, 0.93],
        eyes: [[0.08, 0.62], [0.93, 0.72]],
        props: [['scanner', 0.75, 0.42, 1], ['brakes', 0.49, 0.72, 1]]
      },
      { kind: 'lift', r: [10, 168, 56, 64], door: ['r', 'lift'] },
      {
        kind: 'room',
        id: 2,
        r: [10, 232, 200, 158],
        door: ['t', 0.84],
        label: 'b',
        chip: [0.44, 0.13],
        macy: [0.84, 0.31],
        eyes: [[0.09, 0.3], [0.67, 0.5]],
        props: [['sofa', 0.4, 0.58, 1], ['snax', 0.89, 0.93, 1]]
      },
      {
        kind: 'station',
        r: [210, 232, 130, 158],
        door: ['t', 'open'],
        label: 'b',
        props: [['counter', 0.5, 0.42, 1]]
      },
      {
        kind: 'room',
        id: 4,
        r: [340, 232, 190, 158],
        door: ['t', 0.82],
        label: 'b',
        chip: [0.42, 0.13],
        macy: [0.82, 0.31],
        eyes: [[0.1, 0.36], [0.74, 0.86]],
        props: [['bed', 0.56, 0.6, 0.86], ['gel', 0.88, 0.9, 1]]
      },
      {
        kind: 'shop',
        r: [530, 232, 100, 158],
        door: ['t', 0.4],
        label: 'b',
        props: [['gift', 0.6, 0.58, 1]]
      }
    ]
  },
  strip: {
    w: 780,
    h: 320,
    axis: 'x',
    building: [10, 10, 710, 300],
    corridor: [62, 134, 658, 52],
    exit: [143, 177],
    exitZone: [650, 134, 130, 52],
    sign: [700, 146],
    ralph: [668, 184],
    badge: [750, 212],
    daily: [366, 136, 42, 46],
    wet: [312, 184],
    floorText: [76, 166],
    plants: [],
    places: [
      {
        kind: 'room',
        id: 0,
        r: [10, 10, 250, 124],
        door: ['b', 0.86],
        label: 't',
        chip: [0.48, 0.86],
        macy: [0.86, 0.94],
        moon: [0.92, 0.24],
        props: [['iv', 0.6, 0.74, 0.86], ['bed', 0.76, 0.76, 0.86]]
      },
      {
        kind: 'room',
        id: 1,
        r: [260, 10, 230, 124],
        door: ['b', 0.15],
        label: 't',
        chip: [0.5, 0.86],
        macy: [0.15, 0.94],
        eyes: [[0.92, 0.82], [0.56, 0.6]],
        props: [['scanner', 0.77, 0.45, 0.84]]
      },
      {
        kind: 'room',
        id: 3,
        r: [490, 10, 230, 124],
        door: ['b', 0.15],
        label: 't',
        chip: [0.52, 0.86],
        macy: [0.15, 0.94],
        eyes: [[0.92, 0.84], [0.06, 0.62]],
        props: [['scanner', 0.76, 0.45, 0.84], ['brakes', -0.15, 1.36, 1]]
      },
      { kind: 'lift', r: [10, 134, 52, 52], door: ['r', 'lift'] },
      {
        kind: 'room',
        id: 2,
        r: [10, 186, 236, 124],
        door: ['t', 0.86],
        label: 'b',
        chip: [0.46, 0.15],
        macy: [0.86, 0.36],
        eyes: [[0.07, 0.34], [0.94, 0.86]],
        props: [['sofa', 0.66, 0.66, 0.86], ['snax', 0.92, 0.7, 0.86]]
      },
      {
        kind: 'station',
        r: [246, 186, 130, 124],
        door: ['t', 'open'],
        label: 'b',
        props: [['counter', 0.5, 0.4, 0.86]]
      },
      {
        kind: 'room',
        id: 4,
        r: [376, 186, 228, 124],
        door: ['t', 0.86],
        label: 'b',
        chip: [0.44, 0.15],
        macy: [0.86, 0.36],
        eyes: [[0.07, 0.34], [0.94, 0.88]],
        props: [['bed', 0.64, 0.82, 0.74], ['gel', 0.9, 0.93, 0.9]]
      },
      {
        kind: 'shop',
        r: [604, 186, 116, 124],
        door: ['t', 0.34],
        label: 'b',
        props: [['gift', 0.74, 0.62, 0.86]]
      }
    ]
  },
  portrait: {
    w: 360,
    h: 620,
    axis: 'y',
    building: [10, 10, 340, 566],
    corridor: [146, 64, 68, 512],
    exit: [160, 200],
    exitZone: [146, 480, 68, 140],
    sign: [180, 494],
    ralph: [180, 566],
    badge: [180, 604],
    daily: [157, 298, 46, 52],
    dailyStand: true,
    wet: [172, 450],
    // Centered between the elevator (ends at 64) and the Daily Dose stand (starts at 298).
    floorText: [180, 181],
    plants: [[202, 92, 0.34]],
    places: [
      { kind: 'lift', r: [146, 10, 68, 54], door: ['b', 'lift'] },
      {
        kind: 'room',
        id: 0,
        r: [10, 10, 136, 160],
        door: ['r', 0.84],
        label: 't',
        chip: [0.4, 0.91],
        macy: [0.85, 0.94],
        moon: [0.83, 0.2],
        props: [['iv', 0.13, 0.74, 0.8], ['bed', 0.46, 0.76, 0.82]]
      },
      {
        kind: 'room',
        id: 2,
        r: [10, 170, 136, 150],
        door: ['r', 0.5],
        label: 't',
        chip: [0.4, 0.91],
        macy: [0.85, 0.62],
        eyes: [[0.85, 0.24], [0.1, 0.62]],
        props: [['sofa', 0.46, 0.76, 0.8]]
      },
      {
        kind: 'station',
        r: [10, 320, 136, 124],
        door: ['r', 'open'],
        label: 't',
        props: [['counter', 0.46, 0.8, 0.82]]
      },
      {
        kind: 'restroom',
        r: [10, 444, 136, 132],
        door: ['r', 0.5],
        label: 't',
        props: [['toilet', 0.28, 0.9, 1], ['plant', 0.78, 0.92, 0.8]]
      },
      {
        kind: 'room',
        id: 1,
        r: [214, 10, 136, 160],
        door: ['l', 0.84],
        label: 't',
        chip: [0.6, 0.91],
        macy: [0.15, 0.94],
        eyes: [[0.86, 0.6], [0.12, 0.56]],
        props: [['scanner', 0.58, 0.57, 0.78]]
      },
      {
        kind: 'room',
        id: 3,
        r: [214, 170, 136, 150],
        door: ['l', 0.5],
        label: 't',
        chip: [0.6, 0.91],
        macy: [0.15, 0.62],
        eyes: [[0.86, 0.72], [0.16, 0.56]],
        props: [['scanner', 0.56, 0.6, 0.72], ['brakes2', 0.79, 0.4, 1]]
      },
      {
        kind: 'room',
        id: 4,
        r: [214, 320, 136, 150],
        door: ['l', 0.5],
        label: 't',
        chip: [0.6, 0.91],
        macy: [0.15, 0.62],
        eyes: [[0.62, 0.42], [0.14, 0.58]],
        props: [['bed', 0.58, 0.76, 0.74], ['gel', 0.84, 0.62, 0.9]]
      },
      {
        kind: 'shop',
        r: [214, 470, 136, 106],
        door: ['l', 0.42],
        label: 't',
        props: [['gift', 0.78, 0.9, 0.82]]
      }
    ]
  }
};

const HOSPITAL_MAP_COPY = {
  header: 'VALLEY HOSPITAL · FLOOR 7',
  station: ['Nurses’ station', 'ASK NICELY'],
  restroom: ['Restroom', 'OCCUPIED. ALWAYS.'],
  shop: 'Gift shop',
  floor: 'VALLEY HOSPITAL · 7F · GUT WING',
  lift: '7',
  // Macy's room is Room 5. Its plate keeps the name "Your room" and puts the number underneath.
  home: 'ROOM 5',
  you: 'YOU',
  nope: 'NOPE.',
  exit: 'EXIT',
  daily: ['DAILY', 'DOSE'],
  locked: 'Clear the ward first. The gremlins are sitting on the arcade.',
  won: 'Discharged. The door is just showing off now.',
  stamps: 'Medal all six arcades first. The door is counting.',
  levelTwo: 'One level 2 medal, then the door will talk to you.',
  ralph: 'Ralph is blocking the exit. Go to your room and evict him.',
  ralphNew: 'Passport complete. Ralph heard. He is waiting in your room.'
};

// Visually hidden but focusable: the canvas is the picture, these buttons are the controls.
const HOSPITAL_MAP_SKELETON =
  '<canvas data-hospital-map aria-hidden="true" style="display:block;width:100%;grid-column:1/-1;' +
  'touch-action:manipulation;-webkit-tap-highlight-color:transparent;border-radius:16px;' +
  'background:#0f2430"></canvas>' +
  '<div data-hospital-map-list role="group" aria-label="Hospital map" style="position:absolute;width:1px;' +
  'height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);' +
  'white-space:nowrap"></div>';

const HOSPITAL_MAP_FONT = '"Trebuchet MS", Arial, sans-serif';

let hospitalMapView = {
    el: null,
    canvas: null,
    list: null,
    g: null,
    w: 0,
    h: 0,
    raf: 0,
    wait: 0,
    last: 0,
    dirty: true,
    hover: '',
    press: '',
    focus: '',
    notice: '',
    noticeUntil: 0
  },
  hospitalMapLayoutMemo = { key: '', value: null },
  hospitalMapBaseMemo = { key: '', canvas: null };

// ---- Small helpers ----
function hospitalMapReduced() {
  return typeof reduced !== 'undefined' && !!reduced;
}

function hospitalMapClock() {
  return typeof time === 'number' ? time : 0;
}

function hospitalMapSfx(name) {
  if (typeof sfx === 'function') sfx(name);
}

function hospitalMapMix(a, b, t) {
  const pa = parseInt(a.slice(1, 7), 16),
    pb = parseInt(b.slice(1, 7), 16);
  let out = '#';
  for (const shift of [16, 8, 0]) {
    const ca = (pa >> shift) & 255,
      cb = (pb >> shift) & 255;
    out += Math.round(ca + (cb - ca) * t)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

function hospitalMapText(g, t, x, y, size, color, align = 'left', maxW = 0) {
  g.fillStyle = color;
  g.font = `700 ${size}px ${HOSPITAL_MAP_FONT}`;
  g.textAlign = align;
  if (maxW > 0) g.fillText(t, x, y, maxW);
  else g.fillText(t, x, y);
  g.textAlign = 'left';
}

function hospitalMapMeasure(g, t, size) {
  g.font = `700 ${size}px ${HOSPITAL_MAP_FONT}`;
  const m = typeof g.measureText === 'function' ? g.measureText(t) : null;
  return m && Number.isFinite(m.width) ? m.width : t.length * size * 0.58;
}

function hospitalMapInRect(r, x, y, m = 0) {
  return !!r && x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
}

function hospitalMapEsc(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function hospitalMapGame(id) {
  return typeof games !== 'undefined' && games[id] && games[id].info ? games[id].info.game : '';
}

function hospitalMapLocked(id) {
  if (typeof arcadeBlocked === 'function') return !!arcadeBlocked(id);
  return typeof wardLocked === 'function' && !!wardLocked(id);
}

// Everything the map shows about one room, read fresh from state.
function hospitalMapRoomState(id) {
  const cur = state.room,
    combat = id >= 1 && id <= 4,
    medals = (state.medals && state.medals[id]) || [0, 0, 0];
  return {
    id,
    here: id === cur || (id === 0 && cur === 5),
    combat,
    locked: hospitalMapLocked(id),
    grudge: combat ? Math.max(0, Math.floor(Number(state.wardClears && state.wardClears[id]) || 0)) : 0,
    medals: [0, 1, 2].map(i => clamp(Math.floor(Number(medals[i]) || 0), 0, 3))
  };
}

function hospitalMapDailyPick() {
  return typeof dailyPick === 'function' ? dailyPick() : null;
}

function hospitalMapDischargeReady() {
  return !state.won && stars() >= 12 && stamps() === ARCADE_COUNT && levelTwo();
}

function hospitalMapExitLine() {
  if (state.won) return HOSPITAL_MAP_COPY.won;
  if (state.ralphReady && !state.ralph) return HOSPITAL_MAP_COPY.ralph;
  const need = 12 - stars();
  if (need > 0) return `The exit wants ${need} more ${need === 1 ? 'star' : 'stars'}. It has standards.`;
  if (stamps() < ARCADE_COUNT) return HOSPITAL_MAP_COPY.stamps;
  if (!levelTwo()) return HOSPITAL_MAP_COPY.levelTwo;
  return HOSPITAL_MAP_COPY.ralph;
}

// ---- Layout ----
function hospitalMapLayout(w, h) {
  w = Math.max(1, Number(w) || 1);
  h = Math.max(1, Number(h) || 1);
  const key = w + 'x' + h;
  if (hospitalMapLayoutMemo.key === key) return hospitalMapLayoutMemo.value;
  const aspect = w / h,
    kind = aspect < 1.1 ? 'portrait' : aspect >= 2.05 ? 'strip' : 'wide',
    plan = HOSPITAL_MAP_PLANS[kind];
  let sx = w / plan.w,
    sy = h / plan.h;
  sx = Math.min(sx, sy * 1.3);
  sy = Math.min(sy, sx * 1.3);
  const k = Math.min(sx, sy),
    ox = (w - plan.w * sx) / 2,
    oy = (h - plan.h * sy) / 2,
    box = r => ({ x: ox + r[0] * sx, y: oy + r[1] * sy, w: r[2] * sx, h: r[3] * sy }),
    pt = q => ({ x: ox + q[0] * sx, y: oy + q[1] * sy });
  const L = {
    kind,
    w,
    h,
    k,
    sx,
    sy,
    ox,
    oy,
    axis: plan.axis,
    font: {
      name: clamp(13.5 * k, 12, 18),
      sub: clamp(10 * k, 11, 13),
      chip: clamp(10.5 * k, 11, 13),
      star: clamp(5.6 * k, 5.5, 7.5)
    },
    wall: 6 * k,
    outer: 9 * k,
    face: 5 * k,
    building: box(plan.building),
    corridor: box(plan.corridor),
    exitZone: box(plan.exitZone),
    daily: box(plan.daily),
    dailyStand: !!plan.dailyStand,
    sign: pt(plan.sign),
    ralph: pt(plan.ralph),
    badge: pt(plan.badge),
    wet: pt(plan.wet),
    floorText: pt(plan.floorText),
    plants: plan.plants.map(q => Object.assign(pt(q), { s: q[2] * k }))
  };
  L.places = plan.places.map(p => hospitalMapPlace(p, box(p.r), L));
  L.exit = hospitalMapExitGap(plan, L);
  L.walls = hospitalMapWalls(L);
  hospitalMapLayoutMemo = { key, value: L };
  return L;
}

function hospitalMapPlace(p, r, L) {
  const pad = L.wall / 2 + 4 * L.k,
    inner = { x: r.x + pad, y: r.y + pad + L.face * 0.6, w: r.w - pad * 2, h: r.h - pad * 2 - L.face * 0.6 },
    at = q => (q ? { x: r.x + q[0] * r.w, y: r.y + q[1] * r.h } : null);
  const place = {
    kind: p.kind,
    id: p.kind === 'room' ? p.id : -1,
    key: p.kind === 'room' ? 'room:' + p.id : p.kind,
    rect: r,
    inner,
    label: p.label || 't',
    door: hospitalMapDoor(p.door, r, L),
    props: (p.props || []).map(q => Object.assign(at([q[1], q[2]]), { type: q[0], s: q[3] * L.k })),
    chipAt: at(p.chip),
    macyAt: at(p.macy),
    moonAt: at(p.moon),
    eyesAt: (p.eyes || []).map(at)
  };
  const plate = hospitalMapPlateBox(place, L);
  place.labelAt = { x: plate.x + plate.pad + L.font.name, y: plate.y + plate.row1 - L.font.name * 0.35 };
  return place;
}

function hospitalMapDoor(spec, r, L) {
  const side = spec[0],
    where = spec[1],
    across = side === 't' || side === 'b',
    len = across ? r.w : r.h,
    scale = across ? L.sx : L.sy,
    open = where === 'open',
    lift = where === 'lift',
    at = typeof where === 'number' ? where * len : len / 2,
    half = open ? len / 2 - 10 * scale : lift ? len / 2 - 8 * scale : Math.min(15 * scale, len / 2 - 4),
    inward = { t: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] }[side];
  return {
    side,
    open,
    lift,
    across,
    at,
    half,
    x: across ? r.x + at : side === 'l' ? r.x : r.x + r.w,
    y: across ? (side === 't' ? r.y : r.y + r.h) : r.y + at,
    nx: inward[0],
    ny: inward[1]
  };
}

function hospitalMapExitGap(plan, L) {
  const b = L.building;
  if (plan.axis === 'x') {
    const y0 = L.oy + plan.exit[0] * L.sy,
      y1 = L.oy + plan.exit[1] * L.sy,
      x = b.x + b.w;
    return { side: 'r', a: { x, y: y0 }, b: { x, y: y1 }, mid: { x, y: (y0 + y1) / 2 }, half: (y1 - y0) / 2 };
  }
  const x0 = L.ox + plan.exit[0] * L.sx,
    x1 = L.ox + plan.exit[1] * L.sx,
    y = b.y + b.h;
  return { side: 'b', a: { x: x0, y }, b: { x: x1, y }, mid: { x: (x0 + x1) / 2, y }, half: (x1 - x0) / 2 };
}

function hospitalMapSides(r) {
  return {
    t: [[r.x, r.y], [r.x + r.w, r.y]],
    b: [[r.x, r.y + r.h], [r.x + r.w, r.y + r.h]],
    l: [[r.x, r.y], [r.x, r.y + r.h]],
    r: [[r.x + r.w, r.y], [r.x + r.w, r.y + r.h]]
  };
}

// Removes the stretch from..to (distance from the segment start) and returns what is left.
function hospitalMapCut(seg, from, to) {
  const [a, b] = seg,
    len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    ux = (b[0] - a[0]) / len,
    uy = (b[1] - a[1]) / len,
    out = [];
  if (from > 0.5) out.push([a, [a[0] + ux * from, a[1] + uy * from]]);
  if (to < len - 0.5) out.push([[a[0] + ux * to, a[1] + uy * to], b]);
  return out;
}

function hospitalMapWalls(L) {
  const segs = [];
  for (const place of L.places) {
    const sides = hospitalMapSides(place.rect),
      d = place.door;
    for (const side of ['t', 'b', 'l', 'r']) {
      const parts = d.side === side ? hospitalMapCut(sides[side], d.at - d.half, d.at + d.half) : [sides[side]];
      for (const s of parts) segs.push({ a: s[0], b: s[1], outer: false });
    }
  }
  const sides = hospitalMapSides(L.building),
    e = L.exit;
  for (const side of ['t', 'b', 'l', 'r']) {
    let parts = [sides[side]];
    if (side === e.side) {
      const base = side === 'r' ? L.building.y : L.building.x,
        from = (side === 'r' ? e.a.y : e.a.x) - base,
        to = (side === 'r' ? e.b.y : e.b.x) - base;
      parts = hospitalMapCut(sides[side], from, to);
    }
    for (const s of parts) segs.push({ a: s[0], b: s[1], outer: true });
  }
  return segs;
}

// The name plate: name, department, then medal stars and grudge flames (rooms only).
function hospitalMapPlateBox(place, L) {
  const f = L.font,
    pad = clamp(6 * L.k, 5, 8),
    compact = place.inner.h < 104,
    rows = place.kind === 'room' && !compact ? 3 : 2,
    row1 = pad + f.name * 0.8,
    row2 = row1 + f.sub * 1.2 + 1,
    row3 = rows === 3 ? row2 + f.star * 1.9 + 2 : 0,
    h = (rows === 3 ? row3 + f.star * 1.2 : row2 + f.sub * 0.3) + pad,
    x = place.inner.x,
    y = place.label === 'b' ? place.inner.y + place.inner.h - h : place.inner.y;
  return { x, y, h, pad, rows, compact, row1, row2, row3 };
}

// The arcade chip in a room tile. Sized from the copy length so draw and hit agree everywhere.
function hospitalMapChip(place, L) {
  if (place.kind !== 'room' || !place.chipAt) return null;
  const cur = state.room,
    id = place.id === 0 && cur === 5 ? 5 : place.id,
    here = id === cur,
    locked = hospitalMapLocked(id),
    game = hospitalMapGame(id),
    size = L.font.chip,
    h = clamp(22 * L.k, 22, 28),
    pad = size * 0.7,
    icon = size * 1.1,
    gap = size * 0.4,
    maxW = place.inner.w * 0.94,
    widthOf = (s, per = 0.58) => pad * 2 + icon + (s ? gap + s.length * size * per : 0);
  let text = here ? (locked ? 'LOCKED' : 'PLAY') : game;
  if (here && !locked && widthOf('PLAY ' + game, 0.5) <= maxW) text = 'PLAY ' + game;
  if (widthOf(text, 0.5) > maxW) text = here ? text.split(' ')[0] : '';
  const w = Math.min(widthOf(text), maxW),
    cx = clamp(place.chipAt.x, place.inner.x + w / 2, place.inner.x + place.inner.w - w / 2),
    cy = clamp(place.chipAt.y, place.inner.y + h / 2, place.inner.y + place.inner.h - h / 2);
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    id,
    here,
    locked,
    text,
    size,
    pad,
    icon,
    gap,
    key: here ? 'room:' + id + ':play' : 'room:' + place.id
  };
}

function hospitalMapMoon(place, L) {
  if (!place.moonAt) return null;
  return { x: place.moonAt.x, y: place.moonAt.y, r: clamp(13 * L.k, 13, 18) };
}

function hospitalMapTile(id) {
  return id === 5 ? 0 : id;
}

// ---- Hit testing ----
function hospitalMapHit(x, y, w, h) {
  const L = hospitalMapLayout(w, h);
  for (const place of L.places) {
    const moon = hospitalMapMoon(place, L);
    if (moon && Math.hypot(x - moon.x, y - moon.y) <= moon.r + 6) return { kind: 'night' };
  }
  for (const place of L.places) {
    const chip = hospitalMapChip(place, L);
    if (!chip || !hospitalMapInRect(chip, x, y, 5)) continue;
    return chip.here ? { kind: 'room', id: chip.id, play: true } : { kind: 'room', id: place.id };
  }
  if (hospitalMapInRect(L.daily, x, y, 4)) return { kind: 'daily' };
  if (hospitalMapInRect(L.exitZone, x, y)) return { kind: 'exit' };
  for (const place of L.places) {
    if (!hospitalMapInRect(place.rect, x, y)) continue;
    if (place.kind === 'room') return { kind: 'room', id: place.id };
    if (place.kind === 'shop') return { kind: 'shop' };
    return null;
  }
  return null;
}

function hospitalMapKey(hit) {
  if (!hit) return '';
  if (hit.kind === 'room') return 'room:' + hit.id + (hit.play ? ':play' : '');
  return hit.kind;
}

function hospitalMapHitFromKey(key) {
  const parts = String(key || '').split(':');
  if (parts[0] === 'room' && parts[1] !== undefined) {
    const hit = { kind: 'room', id: Number(parts[1]) };
    if (parts[2] === 'play') hit.play = true;
    return hit;
  }
  if (['night', 'shop', 'daily', 'exit'].includes(parts[0])) return { kind: parts[0] };
  return null;
}

// ---- Drawing ----
function hospitalMapDraw(g, w, h) {
  if (!g || !(w > 0) || !(h > 0)) return null;
  const L = hospitalMapLayout(w, h),
    t = hospitalMapReduced() ? 0 : hospitalMapClock(),
    base = hospitalMapBase(L);
  if (base) g.drawImage(base, 0, 0, L.w, L.h);
  else hospitalMapDrawBase(g, L);
  hospitalMapDrawLive(g, L, t);
  return L;
}

// The still parts (floors, walls, furniture) render once per size into an offscreen canvas.
function hospitalMapBase(L) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  if (typeof configureCanvas !== 'function') return null;
  const dpr = (typeof viewport !== 'undefined' && viewport.dpr) || 1,
    key = `${L.kind}|${L.w}|${L.h}|${dpr}`;
  if (hospitalMapBaseMemo.key === key) return hospitalMapBaseMemo.canvas;
  const cv = document.createElement('canvas'),
    g = configureCanvas(cv, L.w, L.h);
  hospitalMapDrawBase(g, L);
  hospitalMapBaseMemo = { key, canvas: cv };
  return cv;
}

function hospitalMapDrawBase(g, L) {
  hospitalMapDrawBackdrop(g, L);
  hospitalMapDrawOutside(g, L);
  const b = L.building,
    k = L.k;
  rr(g, b.x + 5 * k, b.y + 12 * k, b.w, b.h, 18 * k, '#04111a66');
  rr(g, b.x, b.y, b.w, b.h, 14 * k, '#2c4f5a');
  hospitalMapDrawCorridor(g, L);
  for (const place of L.places) hospitalMapDrawFloor(g, place, L);
  hospitalMapDrawMats(g, L);
  for (const p of L.plants) plant(g, p.x, p.y, 0.4 * p.s);
  hospitalMapWetSign(g, L.wet.x, L.wet.y, L.k);
  for (const place of L.places) {
    const props = place.props.slice().sort((a, c) => a.y - c.y);
    for (const prop of props) hospitalMapDrawProp(g, prop, place, L);
    if (place.kind === 'lift') hospitalMapDrawLift(g, place, L);
  }
  hospitalMapDrawWalls(g, L);
  for (const place of L.places) hospitalMapDrawDoor(g, place, L);
}

function hospitalMapDrawBackdrop(g, L) {
  rect(g, 0, 0, L.w, L.h, gradient(g, 0, 0, L.w * 0.35, L.h, '#1c3f4e', '#0e2430'));
  const step = 22 * L.k;
  path(
    g,
    p => {
      for (let x = L.ox % step; x < L.w; x += step) {
        p.moveTo(x, 0);
        p.lineTo(x, L.h);
      }
      for (let y = L.oy % step; y < L.h; y += step) {
        p.moveTo(0, y);
        p.lineTo(L.w, y);
      }
    },
    null,
    '#cfeee011',
    1
  );
}

// Past the exit: a sunny scrap of sidewalk. Freedom looks like concrete.
function hospitalMapDrawOutside(g, L) {
  const e = L.exit,
    k = L.k,
    nx = e.side === 'r' ? 1 : 0,
    ny = e.side === 'r' ? 0 : 1,
    reach = 46 * k,
    cx = e.mid.x + nx * reach * 0.55,
    cy = e.mid.y + ny * reach * 0.55;
  glow(g, cx, cy, 64 * k, '#ffe9a833');
  if (nx) rr(g, e.mid.x, e.mid.y - e.half * 1.2, L.w - e.mid.x + 20, e.half * 2.4, 6 * k, '#cdbf9a55');
  else rr(g, e.mid.x - e.half * 1.2, e.mid.y, e.half * 2.4, L.h - e.mid.y + 20, 6 * k, '#cdbf9a55');
  for (let i = 0; i < 4; i++) {
    const along = (i - 1.5) * e.half * 0.9,
      wobble = 6 * k * (i % 2 ? 1 : -1),
      gx = cx + (nx ? wobble : along),
      gy = cy + (nx ? along : wobble);
    path(
      g,
      p => {
        p.moveTo(gx - 3 * k, gy);
        p.lineTo(gx - 1 * k, gy - 5 * k);
        p.lineTo(gx, gy);
        p.lineTo(gx + 2 * k, gy - 6 * k);
        p.lineTo(gx + 3 * k, gy);
      },
      null,
      '#8fcf95aa',
      1.4 * k
    );
  }
}

function hospitalMapDrawCorridor(g, L) {
  const c = L.corridor,
    k = L.k,
    horizontal = L.axis === 'x';
  rr(g, c.x, c.y, c.w, c.h, 3 * k, gradient(g, c.x, c.y, horizontal ? 0 : c.w, horizontal ? c.h : 0, '#eef0da', '#d2dfc8'));
  const step = 24 * k;
  path(
    g,
    p => {
      if (horizontal) {
        for (let x = c.x + step; x < c.x + c.w; x += step) {
          p.moveTo(x, c.y);
          p.lineTo(x, c.y + c.h);
        }
        p.moveTo(c.x, c.y + c.h / 2);
        p.lineTo(c.x + c.w, c.y + c.h / 2);
      } else {
        for (let y = c.y + step; y < c.y + c.h; y += step) {
          p.moveTo(c.x, y);
          p.lineTo(c.x + c.w, y);
        }
        p.moveTo(c.x + c.w / 2, c.y);
        p.lineTo(c.x + c.w / 2, c.y + c.h);
      }
    },
    null,
    '#6f8f8220',
    1
  );
  // Wayfinding stripes run from the elevator to the exit. Follow the mint line home.
  const e = L.exit,
    stripes = [
      [-4.5, '#7fcfae'],
      [4.5, '#f2a28c']
    ];
  for (const [off, col] of stripes) {
    if (horizontal) line(g, [[c.x + 8 * k, c.y + c.h * 0.72 + off * k], [e.mid.x - 6 * k, c.y + c.h * 0.72 + off * k]], col, 2.6 * k);
    else line(g, [[c.x + c.w * 0.28 + off * k, c.y + 8 * k], [c.x + c.w * 0.28 + off * k, e.mid.y - 6 * k]], col, 2.6 * k);
  }
  const len = horizontal ? e.mid.x - c.x : e.mid.y - c.y;
  for (let d = len * 0.45; d < len - 24 * k; d += 34 * k) {
    const x = horizontal ? c.x + d : c.x + c.w * 0.28,
      y = horizontal ? c.y + c.h * 0.72 : c.y + d,
      s = 3.4 * k;
    if (horizontal) line(g, [[x - s, y - s * 1.6], [x + s, y], [x - s, y + s * 1.6]], '#4f9d81', 1.8 * k);
    else line(g, [[x - s * 1.6, y - s], [x, y + s], [x + s * 1.6, y - s]], '#4f9d81', 1.8 * k);
  }
  const size = clamp(11 * k, 11, 15),
    ft = L.floorText;
  g.save();
  g.translate(ft.x, ft.y);
  if (!horizontal) g.rotate(Math.PI / 2);
  hospitalMapText(g, HOSPITAL_MAP_COPY.floor, 0, size * 0.36, size, '#4d7a6c66', horizontal ? 'left' : 'center');
  g.restore();
}

function hospitalMapTheme(place) {
  if (place.kind === 'room') return rooms[place.id].theme;
  if (place.kind === 'station') return '#d9c39f';
  if (place.kind === 'shop') return '#e7a9bb';
  if (place.kind === 'restroom') return '#a9cfd0';
  return '#7d929c';
}

function hospitalMapDrawFloor(g, place, L) {
  const r = place.rect,
    k = L.k,
    theme = hospitalMapTheme(place);
  if (place.kind === 'lift') {
    rr(g, r.x, r.y, r.w, r.h, 3 * k, gradient(g, r.x, r.y, r.w, r.h, '#8ea3ac', '#647a85'));
    return;
  }
  const light = hospitalMapMix(theme, '#f4efd8', 0.42),
    floorFill = gradient(g, r.x, r.y, r.w * 0.4, r.h, light, hospitalMapMix(theme, '#f4efd8', 0.18));
  rr(g, r.x, r.y, r.w, r.h, 4 * k, floorFill);
  const step = (place.kind === 'restroom' ? 13 : 19) * k;
  path(
    g,
    p => {
      for (let x = r.x + step; x < r.x + r.w; x += step) {
        p.moveTo(x, r.y);
        p.lineTo(x, r.y + r.h);
      }
      for (let y = r.y + step; y < r.y + r.h; y += step) {
        p.moveTo(r.x, y);
        p.lineTo(r.x + r.w, y);
      }
    },
    null,
    '#ffffff1c',
    1
  );
  if (place.kind === 'room' && place.id === 2) {
    const c = place.props.find(q => q.type === 'sofa');
    if (c) ellipse(g, c.x, c.y + 4 * k, 46 * c.s, 13 * c.s, '#b7a2c477');
  }
  if (place.kind === 'shop') {
    for (let i = 0; i < 6; i++) {
      const sx = r.x + r.w * (0.12 + ((i * 37) % 76) / 100),
        sy = r.y + r.h * (0.14 + ((i * 53) % 70) / 100);
      heart(g, sx, sy, 0.38 * k, '#ffffff33');
    }
  }
}

// Door mats in the room's color sit in the corridor outside each door.
function hospitalMapDrawMats(g, L) {
  const k = L.k;
  for (const place of L.places) {
    const d = place.door;
    if (d.open || d.lift) continue;
    const depth = 9 * k,
      span = d.half * 1.9,
      cx = d.x - d.nx * (depth / 2 + L.wall / 2 + 1),
      cy = d.y - d.ny * (depth / 2 + L.wall / 2 + 1),
      col = hospitalMapMix(hospitalMapTheme(place), '#ffffff', 0.15);
    if (d.across) rr(g, cx - span / 2, cy - depth / 2, span, depth, 3 * k, col + 'cc');
    else rr(g, cx - depth / 2, cy - span / 2, depth, span, 3 * k, col + 'cc');
  }
}

function hospitalMapDrawWalls(g, L) {
  const pass = (segs, col, width, dy) =>
    path(
      g,
      p => {
        for (const s of segs) {
          p.moveTo(s.a[0], s.a[1] + dy);
          p.lineTo(s.b[0], s.b[1] + dy);
        }
      },
      null,
      col,
      width
    );
  const outer = L.walls.filter(s => s.outer),
    inner = L.walls.filter(s => !s.outer);
  pass(outer, '#29505a', L.outer, L.face * 1.25);
  pass(inner, '#4a7680', L.wall, L.face);
  pass(inner, '#eef1dc', L.wall, 0);
  pass(outer, '#e3e9d1', L.outer, 0);
  pass(outer, '#ffffff33', 1, -L.outer * 0.28);
  // Windows on the outside walls, opposite each door.
  const b = L.building,
    opposite = { t: 'b', b: 't', l: 'r', r: 'l' };
  for (const place of L.places) {
    if (place.kind !== 'room' && place.kind !== 'restroom') continue;
    const r = place.rect,
      side = opposite[place.door.side],
      onEdge =
        (side === 't' && Math.abs(r.y - b.y) < 1) ||
        (side === 'b' && Math.abs(r.y + r.h - b.y - b.h) < 1) ||
        (side === 'l' && Math.abs(r.x - b.x) < 1) ||
        (side === 'r' && Math.abs(r.x + r.w - b.x - b.w) < 1);
    if (!onEdge) continue;
    const seg = hospitalMapSides(r)[side],
      [a, c] = seg,
      mx = (a[0] + c[0]) / 2,
      my = (a[1] + c[1]) / 2,
      across = side === 't' || side === 'b',
      half = (across ? r.w : r.h) * 0.22,
      p0 = across ? [mx - half, my] : [mx, my - half],
      p1 = across ? [mx + half, my] : [mx, my + half];
    line(g, [p0, p1], '#8fcbe0', L.outer * 0.62);
    line(g, [p0, p1], '#e8fbff', 1);
    for (const f of [-0.33, 0.33]) {
      const qx = across ? mx + half * f * 2 : mx,
        qy = across ? my : my + half * f * 2,
        s = L.outer * 0.32;
      line(g, [[qx - (across ? 0 : s), qy - (across ? s : 0)], [qx + (across ? 0 : s), qy + (across ? s : 0)]], '#e3e9d1', 1.6);
    }
  }
}

// Swing doors drawn the floor-plan way: a leaf and its arc.
function hospitalMapDrawDoor(g, place, L) {
  const d = place.door,
    k = L.k,
    ux = d.across ? 1 : 0,
    uy = d.across ? 0 : 1;
  if (d.lift) {
    const a = [d.x - ux * d.half, d.y - uy * d.half],
      b = [d.x + ux * d.half, d.y + uy * d.half],
      seam = 4 * k;
    line(g, [[a[0], a[1] + L.face], [b[0], b[1] + L.face]], '#5f7f88', L.wall * 1.2);
    line(g, [a, b], '#cbd9db', L.wall * 1.2);
    line(g, [[d.x - uy * seam, d.y - ux * seam], [d.x + uy * seam, d.y + ux * seam]], '#5f7f88', 1.4 * k);
    const bx = b[0] - d.nx * 8 * k + ux * 6 * k,
      by = b[1] - d.ny * 8 * k + uy * 6 * k;
    ellipse(g, bx, by, 3 * k, 3 * k, '#ffd36e');
    return;
  }
  if (d.open) return;
  const hx = d.x - ux * d.half,
    hy = d.y - uy * d.half,
    len = d.half * 1.84,
    tx = hx + d.nx * len,
    ty = hy + d.ny * len,
    a0 = Math.atan2(d.ny, d.nx),
    a1 = Math.atan2(uy, ux);
  let diff = a1 - a0;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  g.setLineDash([3 * k, 3 * k]);
  path(g, p => p.arc(hx, hy, len, a0, a1, diff < 0), null, '#2f556066', 1.2 * k);
  g.setLineDash([]);
  line(g, [[hx, hy], [tx, ty]], '#41686f', 3.6 * k);
  line(g, [[hx, hy], [tx, ty]], '#f6f0dc', 1.8 * k);
}

function hospitalMapDrawLift(g, place, L) {
  const r = place.rect,
    k = L.k,
    cx = r.x + r.w / 2,
    cy = r.y + r.h / 2 - L.face * 0.3,
    size = clamp(12 * k, 11, 15);
  path(
    g,
    p => {
      for (let i = 1; i < 4; i++) {
        p.moveTo(r.x + (r.w * i) / 4, r.y + 3 * k);
        p.lineTo(r.x + (r.w * i) / 4, r.y + r.h - 3 * k);
      }
    },
    null,
    '#ffffff1a',
    1
  );
  rr(g, cx - size * 1.1, cy - size * 0.85, size * 2.2, size * 1.7, 4 * k, '#162c38', '#9fb7bd', 1);
  hospitalMapText(g, HOSPITAL_MAP_COPY.lift, cx, cy + size * 0.36, size, '#ffd36e', 'center');
  poly(g, [[cx - size * 0.85, cy + size * 0.1], [cx - size * 0.62, cy - size * 0.3], [cx - size * 0.4, cy + size * 0.1]], '#9fe3b9');
  poly(g, [[cx + size * 0.4, cy - size * 0.1], [cx + size * 0.62, cy + size * 0.3], [cx + size * 0.85, cy - size * 0.1]], '#f2a28c');
}

function hospitalMapWetSign(g, x, y, s) {
  ellipse(g, x + 12 * s, y + 2 * s, 13 * s, 3.6 * s, '#9fd0dc77');
  ellipse(g, x + 15 * s, y + 1 * s, 5 * s, 1.4 * s, '#ffffff66');
  shadow(g, x, y + 1 * s, 12 * s, 3 * s);
  poly(g, [[x - 9 * s, y], [x - 1 * s, y - 25 * s], [x + 1 * s, y - 25 * s], [x + 9 * s, y]], '#ffd84f');
  line(g, [[x - 9 * s, y], [x, y - 25 * s], [x + 9 * s, y]], '#b8902b', 1.2 * s);
  line(g, [[x, y - 17 * s], [x, y - 9 * s]], '#2b3a3f', 2.2 * s);
  ellipse(g, x, y - 5.5 * s, 1.3 * s, 1.3 * s, '#2b3a3f');
}

function hospitalMapDrawProp(g, prop, place, L) {
  const s = prop.s;
  g.save();
  g.translate(prop.x, prop.y);
  g.scale(s, s);
  if (prop.type === 'bed') bed(g, 0, 0, 0.4);
  else if (prop.type === 'iv') ivStand(g, 0, 0, 0.34);
  else if (prop.type === 'scanner') hospitalMapScanner(g);
  else if (prop.type === 'sofa') hospitalMapSofa(g);
  else if (prop.type === 'snax') hospitalMapSnax(g);
  else if (prop.type === 'plant') plant(g, 0, 0, 0.4);
  else if (prop.type === 'counter') hospitalMapCounter(g);
  else if (prop.type === 'gift') hospitalMapGift(g);
  else if (prop.type === 'gel') hospitalMapGel(g);
  else if (prop.type === 'toilet') hospitalMapToilet(g);
  g.restore();
  if (prop.type === 'brakes') hospitalMapSign(g, prop.x, prop.y, ['NO BRAKES'], '#f7d599', '#744e53', L, true);
  if (prop.type === 'brakes2') hospitalMapSign(g, prop.x, prop.y, ['NO', 'BRAKES'], '#f7d599', '#744e53', L, true);
  if (prop.type === 'gel') hospitalMapSign(g, prop.x - 2 * s, prop.y - 40 * s, ['GEL'], '#f1d17f', '#4f6e60', L, false);
  if (prop.type === 'snax') hospitalMapSign(g, prop.x, prop.y - 52 * s, ['SNAX'], '#e3dfbf', '#45606b', L, false);
}

function hospitalMapSign(g, x, y, lines, fill, ink, L, post) {
  const size = clamp(9 * L.k, 11, 12),
    lead = size + 2,
    w = Math.max(...lines.map(t => t.length)) * size * 0.66 + 10,
    h = lines.length * lead + 5;
  if (post) {
    shadow(g, x, y, 8 * L.k, 2.4 * L.k);
    line(g, [[x, y], [x, y - 8 * L.k]], '#6a807f', 2 * L.k);
  }
  const top = y - (post ? 8 * L.k : 0) - h;
  rr(g, x - w / 2, top + 1.5, w, h, 4, '#0b1d2633');
  rr(g, x - w / 2, top, w, h, 4, fill, '#00000026', 1);
  lines.forEach((t, i) => {
    hospitalMapText(g, t, x, top + 2.5 + lead * (i + 0.5) + size * 0.36, size, ink, 'center', w - 6);
  });
}

function hospitalMapScanner(g) {
  g.scale(0.3, 0.3);
  scanner(g, -57, 16);
}

function hospitalMapSofa(g) {
  g.scale(0.42, 0.42);
  sofa(g, -75, 0, 150, '#be8d9c');
}

function hospitalMapSnax(g) {
  shadow(g, 0, 1, 17, 4);
  rr(g, -14, -50, 28, 50, 4, gradient(g, -14, -50, 28, 0, '#8aa0ae', '#5f7787'), '#3d5664', 1);
  rr(g, -11, -46, 18, 30, 2, '#2c4e5d');
  const snacks = ['#e0b383', '#9ac6a3', '#f3a08f'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      rr(g, -9 + col * 8, -43 + row * 9, 6, 6, 1.5, snacks[(row + col) % 3]);
    }
  }
  rr(g, 9, -46, 3, 14, 1, '#d7e8d6');
  rr(g, -11, -12, 18, 6, 2, '#24404d');
}

function hospitalMapCounter(g) {
  ellipse(g, 4, -34, 10, 6, '#3f7a72');
  rr(g, -3, -50, 14, 13, 4, '#5ba597');
  shadow(g, 0, 10, 52, 9);
  path(
    g,
    p => {
      p.moveTo(-46, 0);
      p.quadraticCurveTo(0, -22, 46, 0);
      p.lineTo(46, 9);
      p.quadraticCurveTo(0, -13, -46, 9);
      p.closePath();
    },
    '#b68e76'
  );
  path(
    g,
    p => {
      p.moveTo(-46, 0);
      p.quadraticCurveTo(0, -22, 46, 0);
      p.lineTo(43, -9);
      p.quadraticCurveTo(0, -32, -43, -9);
      p.closePath();
    },
    gradient(g, -40, -30, 80, 30, '#f2dbb0', '#ddb88e'),
    '#a17e6f88',
    1
  );
  g.save();
  g.translate(-16, -15);
  g.scale(0.32, 0.32);
  monitor(g, 0, 0);
  g.restore();
  rr(g, -36, -14, 11, 8, 2, '#f8f3e3', '#9fb4b2', 0.8);
  rr(g, 10, -26, 7, 8, 2, '#f3a08f');
  path(g, p => p.arc(17.5, -22, 2.4, -1.3, 1.3), null, '#f3a08f', 1.2);
  ellipse(g, 30, -13, 5, 3.4, '#f7dc6f');
  ellipse(g, 30, -16, 1.4, 1.4, '#c79a2e');
}

function hospitalMapGift(g) {
  shadow(g, 0, 1, 24, 5);
  rr(g, -20, -64, 40, 64, 6, gradient(g, -20, -64, 40, 10, '#f5b3c3', '#cf7590'), '#8d4a63', 1.2);
  rr(g, -20, -64, 40, 12, 6, '#ffda79');
  heart(g, -7, -63, 0.55, '#e46a7a');
  rr(g, -16, -48, 22, 33, 3, '#203b44');
  heart(g, -14, -45, 0.45, '#ffa48e');
  ellipse(g, 2, -40, 4, 3.5, '#b5da81');
  ellipse(g, 0.5, -41, 0.9, 1.1, '#ffffff');
  ellipse(g, 3.5, -41, 0.9, 1.1, '#ffffff');
  rr(g, -13, -30, 5, 9, 2, '#fbf4e6');
  line(g, [[-13, -25], [-8, -25]], '#de5b66', 1);
  spark(g, 1, -26, '#ffe29b', 0.35);
  rr(g, 9, -48, 8, 18, 2, '#f8efd9');
  for (let i = 0; i < 3; i++) ellipse(g, 13, -44 + i * 5, 1.3, 1.3, '#8d4a63');
  rr(g, 10, -26, 6, 3, 1, '#2a2f3a');
  rr(g, -16, -12, 22, 7, 2, '#5b2f45');
}

function hospitalMapGel(g) {
  shadow(g, 0, 1, 10, 3);
  rr(g, -8, -28, 16, 28, 5, gradient(g, -8, -28, 16, 0, '#ffe39a', '#e8b15e'), '#a9803c', 1);
  rr(g, -3, -34, 6, 7, 2, '#64b4a5');
  line(g, [[0, -34], [6, -37]], '#64b4a5', 2.5);
  ellipse(g, 7.5, -36, 1.6, 2, '#c4f1ff');
  rr(g, -5, -20, 10, 9, 2, '#fff7e0');
}

function hospitalMapToilet(g) {
  shadow(g, 0, 2, 16, 4);
  rr(g, -12, -38, 24, 12, 4, '#f4f6ee', '#9fb4b2', 1);
  ellipse(g, 0, -15, 11, 13, '#9fb4b2');
  ellipse(g, 0, -15, 10, 12, '#f4f6ee');
  ellipse(g, 0, -14, 6.5, 8, '#bfe3e8');
  ellipse(g, 2, -16, 2, 1.4, '#ffffff99');
}

// ---- Live layer: state, animation, feedback ----
function hospitalMapDrawLive(g, L, t) {
  const v = hospitalMapView,
    cur = state.room;
  hospitalMapDrawExit(g, L, t);
  if (cur === 5) hospitalMapDrawNight(g, L, t);
  if (v.hover) hospitalMapHighlight(g, L, v.hover, v.press === v.hover ? 'press' : 'hover');
  const macyPlace = L.places.find(p => p.kind === 'room' && p.id === hospitalMapTile(cur)),
    macy = macyPlace ? macyPlace.macyAt : null;
  L.places.forEach((place, i) => {
    if (place.kind !== 'room') return;
    const info = hospitalMapRoomState(place.id);
    if (info.locked) place.eyesAt.forEach((at, j) => hospitalMapEyes(g, at, L, t, i * 1.3 + j * 2.1, macy));
  });
  for (const place of L.places) hospitalMapDrawPlate(g, place, L, t);
  for (const place of L.places) {
    const chip = hospitalMapChip(place, L);
    if (chip) hospitalMapDrawChip(g, chip, L, t);
    const moon = hospitalMapMoon(place, L);
    if (moon) hospitalMapDrawMoon(g, moon, L, t);
  }
  hospitalMapDrawDaily(g, L, t);
  hospitalMapDrawExitSign(g, L, t);
  if (state.ralphReady && !state.ralph && !state.won) hospitalMapRalph(g, L, t);
  if (state.won) hospitalMapParty(g, L, t);
  hospitalMapBadge(g, L);
  if (macy) hospitalMapMacy(g, macy, L, t, macyPlace);
  if (v.hover) hospitalMapOutline(g, L, v.hover, '#b5e8c5', false);
  if (v.focus) hospitalMapOutline(g, L, v.focus, '#ffda79', true);
  hospitalMapDrawNotice(g, L);
}

function hospitalMapTargetShape(key, L) {
  const hit = hospitalMapHitFromKey(key);
  if (!hit) return null;
  if (hit.kind === 'room') {
    const place = L.places.find(p => p.kind === 'room' && p.id === hospitalMapTile(hit.id));
    if (!place) return null;
    if (!hit.play) return { rect: place.rect, round: 6 * L.k, inset: L.wall / 2 };
    const chip = hospitalMapChip(place, L);
    return chip ? { rect: chip, round: chip.h / 2, inset: -2 } : null;
  }
  if (hit.kind === 'night') {
    const place = L.places.find(p => p.moonAt),
      m = place ? hospitalMapMoon(place, L) : null;
    return m ? { rect: { x: m.x - m.r, y: m.y - m.r, w: m.r * 2, h: m.r * 2 }, round: m.r, inset: -3 } : null;
  }
  if (hit.kind === 'shop') {
    const place = L.places.find(p => p.kind === 'shop');
    return place ? { rect: place.rect, round: 6 * L.k, inset: L.wall / 2 } : null;
  }
  if (hit.kind === 'daily') return { rect: L.daily, round: 5 * L.k, inset: -4 };
  if (hit.kind === 'exit') return { rect: L.exitZone, round: 8 * L.k, inset: 2 };
  return null;
}

function hospitalMapHighlight(g, L, key, mode) {
  const shape = hospitalMapTargetShape(key, L);
  if (!shape) return;
  const r = shape.rect,
    i = shape.inset;
  rr(g, r.x + i, r.y + i, r.w - i * 2, r.h - i * 2, shape.round, mode === 'press' ? '#0b1d2638' : '#ffffff26');
}

function hospitalMapOutline(g, L, key, col, dashed) {
  const shape = hospitalMapTargetShape(key, L);
  if (!shape) return;
  const r = shape.rect,
    i = shape.inset;
  if (dashed) g.setLineDash([6, 4]);
  rr(g, r.x + i, r.y + i, r.w - i * 2, r.h - i * 2, shape.round, null, col, dashed ? 3 : 2);
  if (dashed) g.setLineDash([]);
}

// After dark the home tile goes blue. The bed stays exactly as unmade as before.
function hospitalMapDrawNight(g, L, t) {
  const place = L.places.find(p => p.kind === 'room' && p.id === 0);
  if (!place) return;
  const r = place.rect,
    i = L.wall / 2;
  rr(g, r.x + i, r.y + i, r.w - i * 2, r.h - i * 2, 5 * L.k, '#132651a6');
  const bedProp = place.props.find(q => q.type === 'bed');
  if (bedProp) glow(g, bedProp.x, bedProp.y - 26 * L.k, 40 * L.k, '#9fb8ff33');
  if (bedProp && !hospitalMapReduced()) {
    for (let n = 0; n < 3; n++) {
      const phase = (t * 0.5 + n / 3) % 1,
        size = clamp(11 * L.k * (0.8 + phase * 0.4), 11, 16);
      g.globalAlpha = Math.sin(phase * Math.PI);
      hospitalMapText(g, 'z', bedProp.x + 22 * L.k + phase * 14 * L.k, bedProp.y - 48 * L.k - phase * 22 * L.k, size, '#dfe8ff');
    }
    g.globalAlpha = 1;
  }
}

function hospitalMapEyes(g, at, L, t, phase, macy) {
  const s = L.k,
    blink = !hospitalMapReduced() && (t * 0.9 + phase) % 3.4 < 0.14;
  let lx = Math.sin(t * 0.7 + phase),
    ly = 0;
  if (macy) {
    const dx = macy.x - at.x,
      dy = macy.y - 20 * s - at.y,
      d = Math.hypot(dx, dy) || 1;
    lx = dx / d;
    ly = dy / d;
  }
  glow(g, at.x, at.y, 17 * s, '#e8f27a26');
  ellipse(g, at.x, at.y + 1 * s, 13 * s, 8.5 * s, '#0b1a2266');
  for (const side of [-1, 1]) {
    const ex = at.x + side * 4.6 * s;
    if (blink) line(g, [[ex - 3 * s, at.y], [ex + 3 * s, at.y]], '#f1f7a0', 1.6 * s);
    else {
      ellipse(g, ex, at.y, 3.6 * s, 4.2 * s, '#f1f7a0');
      ellipse(g, ex + lx * 1.3 * s, at.y + ly * 1.2 * s + 0.4 * s, 1.7 * s, 2.6 * s, '#1b2a20');
    }
    line(g, [[ex - side * 3.6 * s, at.y - 6.4 * s], [ex + side * 2.6 * s, at.y - 4.4 * s]], '#0b1a22cc', 1.5 * s);
  }
}

function hospitalMapStar(g, x, y, r, fill, stroke) {
  path(
    g,
    p => {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          d = i % 2 ? r * 0.46 : r;
        if (i) p.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        else p.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      p.closePath();
    },
    fill,
    stroke,
    1
  );
}

const HOSPITAL_MAP_MEDAL_COLORS = ['#21414b14', '#d98f5c', '#b9cbd3', '#ffc93f'],
  HOSPITAL_MAP_MEDAL_EDGES = ['#21414b40', '#8a4f2b', '#53707c', '#a27a12'];

function hospitalMapStars(g, x, y, R, medals) {
  medals.forEach((m, i) => {
    const sx = x + R + i * R * 2.5;
    hospitalMapStar(g, sx, y, R, HOSPITAL_MAP_MEDAL_COLORS[m], HOSPITAL_MAP_MEDAL_EDGES[m]);
  });
  return R * 2.5 * 3;
}

function hospitalMapFlame(g, x, y, s, t, seed) {
  const wob = hospitalMapReduced() ? 0 : Math.sin(t * 9 + seed * 1.7) * 0.9 * s;
  path(
    g,
    p => {
      p.moveTo(x, y);
      p.bezierCurveTo(x - 5.5 * s, y - 1 * s, x - 4.5 * s, y - 8 * s, x + wob, y - 12 * s);
      p.bezierCurveTo(x + 4.5 * s, y - 8 * s, x + 5.5 * s, y - 1 * s, x, y);
    },
    '#ff8a5c'
  );
  path(
    g,
    p => {
      p.moveTo(x, y - 0.5 * s);
      p.bezierCurveTo(x - 2.6 * s, y - 1 * s, x - 2.2 * s, y - 5 * s, x + wob * 0.5, y - 7 * s);
      p.bezierCurveTo(x + 2.2 * s, y - 5 * s, x + 2.6 * s, y - 1 * s, x, y - 0.5 * s);
    },
    '#ffd36e'
  );
}

function hospitalMapPlaceCopy(place) {
  if (place.kind === 'room') {
    const night = place.id === 0 && state.room === 5,
      parts = String(rooms[night ? 5 : place.id].sub || '').split(' / ');
    if (place.id === 0) {
      const tail = night ? parts[1] || parts[0] : parts[0];
      return { name: rooms[0].name, sub: HOSPITAL_MAP_COPY.home, subLong: tail ? HOSPITAL_MAP_COPY.home + ' · ' + tail : '' };
    }
    return { name: rooms[place.id].name, sub: parts[0], subLong: parts.length > 1 ? parts[0] + ' · ' + parts[1] : '' };
  }
  if (place.kind === 'station') return { name: HOSPITAL_MAP_COPY.station[0], sub: HOSPITAL_MAP_COPY.station[1] };
  if (place.kind === 'restroom') return { name: HOSPITAL_MAP_COPY.restroom[0], sub: HOSPITAL_MAP_COPY.restroom[1] };
  if (place.kind === 'shop') return { name: HOSPITAL_MAP_COPY.shop, sub: state.coins + ' COINS' };
  return null;
}

function hospitalMapDrawPlate(g, place, L, t) {
  const copy = hospitalMapPlaceCopy(place);
  if (!copy) return;
  const f = L.font,
    pb = hospitalMapPlateBox(place, L),
    pad = pb.pad,
    k = L.k,
    room = place.kind === 'room',
    info = room ? hospitalMapRoomState(place.id) : null,
    R = f.star,
    starsW = room ? R * 2.5 * 3 - R * 0.5 : 0,
    pips = pb.compact ? 3 : 5,
    flames = info ? Math.min(info.grudge, pips) : 0,
    extra = info && info.grudge > pips ? '+' + (info.grudge - pips) : '',
    flameW = flames ? R * 0.8 + flames * R * 1.9 + (extra ? hospitalMapMeasure(g, extra, f.sub) + 2 : 0) : 0,
    moon = hospitalMapMoon(place, L),
    maxW = (moon ? moon.x - moon.r - 4 * k : place.inner.x + place.inner.w) - place.inner.x,
    textMax = maxW - pad * 2,
    nameW = Math.min(hospitalMapMeasure(g, copy.name, f.name), textMax);
  let sub = copy.sub;
  if (copy.subLong && hospitalMapMeasure(g, copy.subLong, f.sub) <= place.inner.w * 0.5) sub = copy.subLong;
  const subW = Math.min(hospitalMapMeasure(g, sub, f.sub), textMax);
  let w = pb.compact
    ? Math.max(nameW + (starsW ? R + starsW : 0), subW + flameW)
    : Math.max(nameW, subW, starsW + flameW);
  w = Math.min(w + pad * 2, maxW);
  const x = pb.x,
    y = pb.y,
    h = pb.h;
  rr(g, x + 1.5 * k, y + 2.5 * k, w, h, 8 * k, '#0b1d2638');
  rr(g, x, y, w, h, 8 * k, '#f8efd9f4', '#6f9c94', 1);
  hospitalMapText(g, copy.name, x + pad, y + pb.row1, f.name, '#21414b', 'left', textMax);
  hospitalMapText(g, sub, x + pad, y + pb.row2, f.sub, '#4f7a73', 'left', textMax);
  if (!room) return;
  const starY = pb.compact ? y + pb.row1 - f.name * 0.32 : y + pb.row3,
    starX = pb.compact ? x + pad + nameW + R * 0.6 : x + pad,
    drawn = hospitalMapStars(g, starX, starY, R, info.medals);
  if (!flames) return;
  const fy = pb.compact ? y + pb.row2 + 1 : starY + R * 1.05,
    fx = pb.compact ? x + pad + subW + R * 1.4 : starX + drawn + R * 0.4;
  for (let n = 0; n < flames; n++) hospitalMapFlame(g, fx + n * R * 1.9, fy, R / 5.2, t, n + place.id * 3);
  if (extra) hospitalMapText(g, extra, fx + flames * R * 1.9 - R * 0.6, fy, f.sub, '#c2593a');
}

function hospitalMapDrawChip(g, chip, L, t) {
  const k = L.k,
    play = chip.here && !chip.locked,
    pulse = play && !hospitalMapReduced() ? (Math.sin(t * 4) + 1) / 2 : 0,
    cx = chip.x + chip.w / 2,
    cy = chip.y + chip.h / 2;
  if (play) glow(g, cx, cy, chip.w * 0.75, `rgba(255, 218, 121, ${0.22 + 0.22 * pulse})`);
  rr(g, chip.x, chip.y + 2 * k, chip.w, chip.h, chip.h / 2, '#0b1d2655');
  const fill = play ? '#ffda79' : chip.locked ? '#3a2c3c' : '#17313a',
    stroke = play ? '#fff1c3' : chip.locked ? '#ffa48e' : '#6f9c94',
    ink = play ? '#17313a' : chip.locked ? '#ffc4b4' : '#f8efd9';
  rr(g, chip.x, chip.y, chip.w, chip.h, chip.h / 2, fill, stroke, 1.2);
  const ix = chip.x + chip.pad + chip.icon / 2,
    s = chip.icon / 12;
  if (chip.locked) hospitalMapPadlock(g, ix, cy, s, ink);
  else if (play) poly(g, [[ix - 3.6 * s, cy - 4.8 * s], [ix + 4.8 * s, cy], [ix - 3.6 * s, cy + 4.8 * s]], ink);
  else {
    rr(g, ix - 5 * s, cy + 1 * s, 10 * s, 4 * s, 2 * s, '#6f9c94');
    line(g, [[ix, cy + 1.5 * s], [ix - 1.5 * s, cy - 3 * s]], '#b5e8c5', 1.6 * s);
    ellipse(g, ix - 1.5 * s, cy - 3.6 * s, 2.4 * s, 2.4 * s, '#ffa48e');
  }
  if (chip.text) {
    const tx = ix + chip.icon / 2 + chip.gap,
      room = chip.x + chip.w - chip.pad - tx;
    hospitalMapText(g, chip.text, tx, cy + chip.size * 0.36, chip.size, ink, 'left', room);
  }
}

function hospitalMapPadlock(g, x, y, s, col) {
  path(g, p => p.arc(x, y - 1.6 * s, 3.2 * s, Math.PI, 0), null, col, 1.7 * s);
  rr(g, x - 4.8 * s, y - 1.8 * s, 9.6 * s, 7.4 * s, 1.8 * s, col);
  ellipse(g, x, y + 1.2 * s, 1.1 * s, 1.3 * s, '#3a2c3c');
}

function hospitalMapDrawMoon(g, m, L, t) {
  const night = state.room === 5,
    k = L.k,
    face = night ? '#304d8a' : '#22345a';
  if (night) glow(g, m.x, m.y, m.r * 2.6, '#ffe6a35a');
  ellipse(g, m.x + 1 * k, m.y + 2 * k, m.r, m.r, '#0b1d2655');
  ellipse(g, m.x, m.y, m.r, m.r, face);
  path(g, p => p.arc(m.x, m.y, m.r, 0, Math.PI * 2), null, night ? '#ffe6a3' : '#8fa6d0', 1.4);
  ellipse(g, m.x - m.r * 0.1, m.y + m.r * 0.04, m.r * 0.56, m.r * 0.56, '#ffe6a3');
  ellipse(g, m.x + m.r * 0.16, m.y - m.r * 0.12, m.r * 0.5, m.r * 0.5, face);
  spark(g, m.x + m.r * 0.5, m.y - m.r * 0.42, '#fff1c3', m.r / 55);
  const medals = hospitalMapRoomState(5).medals,
    R = L.font.star * 0.72,
    sy = m.y + m.r + R * 1.6;
  medals.forEach((md, i) => {
    hospitalMapStar(g, m.x + (i - 1) * R * 2.3, sy, R, md ? HOSPITAL_MAP_MEDAL_COLORS[md] : '#0b1d2666', md ? '#21414b88' : '#8fa6d0aa');
  });
}

function hospitalMapDrawDaily(g, L, t) {
  const r = L.daily,
    k = L.k,
    pick = hospitalMapDailyPick(),
    played = !!pick && !!state.daily && state.daily.last === pick.date,
    pulse = played || hospitalMapReduced() ? 0 : (Math.sin(t * 3.2) + 1) / 2,
    cx = r.x + r.w / 2,
    size = clamp(10 * k, 11, 13);
  if (L.dailyStand) {
    line(g, [[r.x + 6 * k, r.y + r.h], [r.x + 2 * k, r.y + r.h + 8 * k]], '#6a807f', 2 * k);
    line(g, [[r.x + r.w - 6 * k, r.y + r.h], [r.x + r.w - 2 * k, r.y + r.h + 8 * k]], '#6a807f', 2 * k);
    shadow(g, cx, r.y + r.h + 8 * k, r.w * 0.55, 3 * k);
  }
  if (!played) glow(g, cx, r.y + r.h / 2, r.w * 0.95, `rgba(255, 164, 142, ${0.16 + 0.2 * pulse})`);
  rr(g, r.x - 2 * k, r.y - 2 * k + 2 * k, r.w + 4 * k, r.h + 4 * k, 5 * k, '#0b1d2644');
  rr(g, r.x - 2 * k, r.y - 2 * k, r.w + 4 * k, r.h + 4 * k, 5 * k, '#507d7a');
  rr(g, r.x, r.y, r.w, r.h, 3 * k, '#fbebc6');
  const band = size + 6;
  rr(g, r.x, r.y, r.w, band, 3 * k, '#ffa48e');
  hospitalMapText(g, HOSPITAL_MAP_COPY.daily[0], cx, r.y + band / 2 + size * 0.36, size, '#17313a', 'center', r.w - 4);
  hospitalMapText(g, HOSPITAL_MAP_COPY.daily[1], cx, r.y + r.h - 4 * k, size, '#4d7468', 'center', r.w - 4);
  const py = (r.y + band + r.y + r.h - 4 * k - size) / 2,
    pw = Math.min(r.w * 0.32, 13 * k),
    ph = pw * 0.5;
  g.save();
  g.translate(cx, py);
  g.rotate(-0.5);
  rr(g, -pw, -ph, pw, ph * 2, ph, '#ef8f89');
  rr(g, 0, -ph, pw, ph * 2, ph, '#f8f3e3', '#c9b48f', 0.8);
  g.restore();
  if (played) {
    ellipse(g, r.x + r.w - 4 * k, r.y + band + 4 * k, 6 * k, 6 * k, '#7fcfae');
    line(g, [[r.x + r.w - 7 * k, r.y + band + 4 * k], [r.x + r.w - 4.5 * k, r.y + band + 6.5 * k], [r.x + r.w - 1 * k, r.y + band + 1 * k]], '#17313a', 1.6 * k);
  }
  if (L.dailyStand) return;
  for (const px of [r.x + 5 * k, r.x + r.w - 5 * k]) ellipse(g, px, r.y + 1 * k, 2.2 * k, 2.2 * k, '#e46a7a');
}

function hospitalMapDrawExit(g, L, t) {
  const e = L.exit,
    k = L.k,
    open = !!state.won,
    ux = e.side === 'r' ? 0 : 1,
    uy = e.side === 'r' ? 1 : 0,
    nx = e.side === 'r' ? 1 : 0,
    ny = e.side === 'r' ? 0 : 1,
    pulse = hospitalMapReduced() ? 0.5 : (Math.sin(t * 2.4) + 1) / 2;
  glow(g, e.mid.x + nx * 10 * k, e.mid.y + ny * 10 * k, (open ? 72 : 38) * k, open ? '#fff3b499' : `rgba(255, 243, 180, ${0.14 + 0.1 * pulse})`);
  for (const side of [-1, 1]) {
    const hx = e.mid.x + ux * side * e.half,
      hy = e.mid.y + uy * side * e.half,
      leaf = e.half * 0.97,
      tx = open ? hx + nx * leaf : hx - ux * side * leaf,
      ty = open ? hy + ny * leaf : hy - uy * side * leaf;
    if (open) {
      const a0 = Math.atan2(ny, nx),
        a1 = Math.atan2(-uy * side, -ux * side);
      let diff = a1 - a0;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.setLineDash([3 * k, 3 * k]);
      path(g, p => p.arc(hx, hy, leaf, a0, a1, diff < 0), null, '#fff3b4aa', 1.2 * k);
      g.setLineDash([]);
    }
    line(g, [[hx, hy], [tx, ty]], '#29505a', L.outer * 0.8);
    line(g, [[hx, hy], [tx, ty]], '#d7e6dc', L.outer * 0.42);
    if (!open) {
      const bx = hx - ux * side * leaf * 0.55,
        by = hy - uy * side * leaf * 0.55;
      line(g, [[bx - nx * 3 * k - ux * side * 3 * k, by - ny * 3 * k - uy * side * 3 * k], [bx - nx * 3 * k + ux * side * 3 * k, by - ny * 3 * k + uy * side * 3 * k]], '#e46a7a', 1.6 * k);
    }
  }
}

function hospitalMapDrawExitSign(g, L, t) {
  const s = L.sign,
    k = L.k,
    size = clamp(11 * k, 11, 14),
    pulse = hospitalMapReduced() ? 0.5 : (Math.sin(t * 3) + 1) / 2,
    w = size * 4.1,
    h = size + 8,
    right = L.exit.side === 'r';
  glow(g, s.x, s.y, 26 * k + 6 * pulse * k, `rgba(110, 255, 170, ${0.2 + 0.18 * pulse})`);
  rr(g, s.x - w / 2, s.y - h / 2 + 2 * k, w, h, 4 * k, '#0b1d2655');
  rr(g, s.x - w / 2, s.y - h / 2, w, h, 4 * k, '#1e9c63', '#c9ffd9', 1.2);
  hospitalMapText(g, HOSPITAL_MAP_COPY.exit, s.x - size * 0.45, s.y + size * 0.36, size, '#f2fff3', 'center');
  const ax = s.x + w / 2 - size * 0.6,
    a = size * 0.3;
  if (right) poly(g, [[ax - a, s.y - a], [ax + a, s.y], [ax - a, s.y + a]], '#f2fff3');
  else poly(g, [[ax - a, s.y - a], [ax + a, s.y - a], [ax, s.y + a]], '#f2fff3');
}

// The exit's status: stars to go, Ralph, or freedom.
function hospitalMapBadge(g, L) {
  const b = L.badge,
    size = clamp(10.5 * L.k, 11, 13);
  let text = stars() + '/12',
    fill = '#17313a',
    ink = '#ffda79',
    star = true;
  if (state.won) {
    text = 'FREE!';
    fill = '#b5e8c5';
    ink = '#17313a';
    star = false;
  } else if (state.ralphReady && !state.ralph) {
    text = 'RALPH';
    fill = '#ffa48e';
    ink = '#17313a';
    star = false;
  }
  const tw = text.length * size * 0.62,
    w = tw + size * 1.2 + (star ? size * 1.2 : 0),
    h = size + 9;
  rr(g, b.x - w / 2, b.y - h / 2 + 2, w, h, h / 2, '#0b1d2655');
  rr(g, b.x - w / 2, b.y - h / 2, w, h, h / 2, fill, '#f8efd9aa', 1);
  const tx = b.x - (star ? size * 0.55 : 0);
  hospitalMapText(g, text, tx, b.y + size * 0.36, size, ink, 'center', tw + 4);
  if (star) hospitalMapStar(g, tx + tw / 2 + size * 0.75, b.y, size * 0.48, '#ffd36e', null);
}

// Ralph has a crown and a policy. The policy is NOPE.
function hospitalMapRalph(g, L, t) {
  const r = L.ralph,
    s = 0.56 * L.k,
    size = clamp(10.5 * L.k, 11, 13);
  gremlin(g, r.x, r.y, s, 1, t);
  const bob = Math.sin(t * 3.4) * 2.8 * s,
    cy = r.y + bob - 45 * s;
  g.save();
  g.translate(r.x + 1 * s, cy);
  g.rotate(-0.12);
  g.scale(s * 0.9, s * 0.9);
  poly(g, [[-15, 2], [-16, -11], [-9, -5], [-3, -14], [3, -5], [9, -13], [16, -4], [15, 2]], '#f7dc6f');
  rr(g, -15, -1, 30, 4, 1.5, '#f0c94d');
  ellipse(g, 0, -4, 2.4, 2.4, '#e46a7a');
  g.restore();
  const bw = size * 3.6,
    bh = size + 8,
    bx = r.x - bw - 24 * s,
    by = r.y - 40 * s - bh;
  rr(g, bx, by, bw, bh, bh / 2, '#f8efd9', '#17313a', 1.2);
  poly(g, [[bx + bw - 1, by + bh * 0.35], [bx + bw + 8, by + bh * 0.75], [bx + bw - 1, by + bh * 0.7]], '#f8efd9');
  hospitalMapText(g, HOSPITAL_MAP_COPY.nope, bx + bw / 2, by + bh / 2 + size * 0.36, size, '#17313a', 'center', bw - 6);
}

// Discharged: bunting over the door and confetti that never has to be swept up.
function hospitalMapParty(g, L, t) {
  const z = L.exitZone,
    c = L.corridor,
    k = L.k,
    horizontal = L.axis === 'x',
    cols = ['#b5e8c5', '#ffa48e', '#ffda79', '#c9b0ec'],
    a = horizontal ? [z.x + z.w * 0.3, c.y + 3 * k] : [c.x + 3 * k, z.y + z.h * 0.18],
    b = horizontal ? [z.x + z.w * 0.3, c.y + c.h - 3 * k] : [c.x + c.w - 3 * k, z.y + z.h * 0.18],
    n = 6;
  const sag = (u, axisOff) => (horizontal ? [a[0] + Math.sin(u * Math.PI) * 9 * k, axisOff] : [axisOff, a[1] + Math.sin(u * Math.PI) * 9 * k]);
  path(
    g,
    p => {
      for (let i = 0; i <= 12; i++) {
        const u = i / 12,
          q = sag(u, horizontal ? a[1] + (b[1] - a[1]) * u : a[0] + (b[0] - a[0]) * u);
        if (i) p.lineTo(q[0], q[1]);
        else p.moveTo(q[0], q[1]);
      }
    },
    null,
    '#f8efd9',
    1.2 * k
  );
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n,
      q = sag(u, horizontal ? a[1] + (b[1] - a[1]) * u : a[0] + (b[0] - a[0]) * u),
      f = 6 * k;
    if (horizontal) poly(g, [[q[0], q[1] - f * 0.6], [q[0] + f * 1.3, q[1]], [q[0], q[1] + f * 0.6]], cols[i % 4]);
    else poly(g, [[q[0] - f * 0.6, q[1]], [q[0], q[1] + f * 1.3], [q[0] + f * 0.6, q[1]]], cols[i % 4]);
  }
  for (let i = 0; i < 18; i++) {
    const fx = z.x + (((i * 37) % 100) / 100) * z.w,
      fall = hospitalMapReduced() ? 0 : t * (18 + (i % 5) * 6) * k,
      fy = z.y + ((((i * 53) % 100) / 100) * z.h + fall) % z.h;
    rect(g, fx, fy, 3 * k, 2 * k, cols[i % 4]);
  }
}

function hospitalMapMacy(g, at, L, t, place) {
  const k = L.k,
    phase = hospitalMapReduced() ? 0.4 : (t * 0.9) % 1,
    size = clamp(9.5 * k, 11, 12),
    dir = place.door.nx < 0 || (place.door.across && at.x > place.rect.x + place.rect.w / 2) ? -1 : 1;
  ellipse(g, at.x, at.y, 17 * k, 6.4 * k, '#ffda7940');
  g.globalAlpha = 1 - phase;
  path(g, p => p.ellipse(at.x, at.y, (12 + 14 * phase) * k, (4.6 + 5.4 * phase) * k, 0, 0, Math.PI * 2), null, '#ffda79', 2 * k);
  g.globalAlpha = 1;
  path(g, p => p.ellipse(at.x, at.y, 14 * k, 5.4 * k, 0, 0, Math.PI * 2), null, '#ffe9b0', 1.4 * k);
  girl(g, at.x, at.y, 0.36 * k, 0, dir);
  const tw = size * 2.2,
    th = size + 6,
    ty = at.y - 41 * k - th;
  rr(g, at.x - tw / 2, ty, tw, th, th / 2, '#e46a7a', '#fff1c3', 1);
  poly(g, [[at.x - 3, ty + th - 0.5], [at.x, ty + th + 4], [at.x + 3, ty + th - 0.5]], '#e46a7a');
  hospitalMapText(g, HOSPITAL_MAP_COPY.you, at.x, ty + th / 2 + size * 0.36, size, '#fff8ea', 'center', tw - 4);
}

function hospitalMapDrawNotice(g, L) {
  const v = hospitalMapView;
  if (!v.notice) return;
  const left = v.noticeUntil - hospitalMapClock();
  if (left <= 0) return;
  const size = clamp(12 * L.k, 12, 15),
    maxW = L.w - 24,
    w = Math.min(maxW, hospitalMapMeasure(g, v.notice, size) + 30),
    h = size * 2.3,
    x = L.w / 2 - w / 2,
    y = L.h - h - 12;
  g.globalAlpha = clamp(left / 0.4, 0, 1);
  rr(g, x, y + 3, w, h, h / 2, '#0b1d2666');
  rr(g, x, y, w, h, h / 2, '#f8efd9', '#17313a', 2);
  hospitalMapText(g, v.notice, L.w / 2, y + h / 2 + size * 0.36, size, '#17313a', 'center', w - 24);
  g.globalAlpha = 1;
}

function hospitalMapNotice(text) {
  hospitalMapView.notice = text;
  hospitalMapView.noticeUntil = hospitalMapClock() + 2.8;
  hospitalMapInvalidate();
}

// ---- Actions ----
function hospitalMapActivate(hit) {
  if (!hit) return false;
  hospitalMapSfx('ui');
  if (hit.kind === 'room' && hit.play) return hospitalMapPlay(hit.id);
  if (hit.kind === 'room') {
    if (typeof goRoom === 'function') goRoom(hit.id);
    return true;
  }
  if (hit.kind === 'night') {
    if (typeof goRoom === 'function') goRoom(5);
    return true;
  }
  if (hit.kind === 'shop') {
    if (typeof showShop === 'function') showShop();
    return true;
  }
  if (hit.kind === 'daily') {
    if (!state.started && typeof begin === 'function') begin();
    if (typeof openDaily === 'function') openDaily();
    return true;
  }
  if (hit.kind === 'exit') return hospitalMapExit();
  return false;
}

function hospitalMapPlay(id) {
  if (!state.started && typeof begin === 'function') begin();
  let ok = false;
  if (typeof tryOpenArcade === 'function') ok = !!tryOpenArcade(id);
  else if (typeof openMini === 'function') {
    openMini(id);
    ok = true;
  }
  if (!ok) hospitalMapNotice(typeof ARCADE_LOCKED_TOAST === 'string' ? ARCADE_LOCKED_TOAST : HOSPITAL_MAP_COPY.locked);
  return ok;
}

// The exit only acts when the passport is complete; otherwise it explains itself.
function hospitalMapExit() {
  if (!hospitalMapDischargeReady() || typeof checkDischarge !== 'function') {
    hospitalMapNotice(hospitalMapExitLine());
    return false;
  }
  const before = state.ralphReady;
  checkDischarge();
  if (!state.won) hospitalMapNotice(before ? HOSPITAL_MAP_COPY.ralph : HOSPITAL_MAP_COPY.ralphNew);
  return true;
}

// ---- Accessible button list ----
function hospitalMapMedalWords(id) {
  const names = ['none', 'bronze', 'silver', 'gold'];
  return hospitalMapRoomState(id)
    .medals.map((m, i) => `level ${i + 1} ${names[m]}`)
    .join(', ');
}

function hospitalMapTargets() {
  const out = [],
    cur = state.room;
  for (const r of rooms) {
    if (r.noArcade) continue;
    if (r.id === 5) continue;
    const info = hospitalMapRoomState(r.id);
    let text = `${r.name}${r.id === 0 ? ' (Room 5)' : ''}: ${hospitalMapGame(r.id)}.`;
    if (info.here) text += cur === 5 ? ' You are here, after dark.' : ' You are here.';
    if (info.locked) text += ' Arcade locked until the gremlins are cleared.';
    else if (info.grudge) text += ` Grudge level ${info.grudge}.`;
    out.push({ key: 'room:' + r.id, label: `${text} Medals: ${hospitalMapMedalWords(r.id)}.` });
  }
  out.push({ key: 'night', label: `Your room after dark: ${hospitalMapGame(5)}. Medals: ${hospitalMapMedalWords(5)}.` });
  const lockedHere = hospitalMapLocked(cur);
  out.push({
    key: 'room:' + cur + ':play',
    label: `Play ${hospitalMapGame(cur)} here${lockedHere ? '. Locked until the gremlins are cleared.' : '.'}`
  });
  const pick = hospitalMapDailyPick();
  if (pick) out.push({ key: 'daily', label: `Daily Dose: ${hospitalMapGame(pick.id)}, level ${pick.tier + 1}.` });
  out.push({ key: 'shop', label: `Gift shop. ${state.coins} coins to spend.` });
  out.push({ key: 'exit', label: `Discharge exit. ${hospitalMapDischargeReady() ? 'Ready.' : hospitalMapExitLine()}` });
  return out;
}

function hospitalMapButtonsHtml() {
  return hospitalMapTargets()
    .map(
      it =>
        `<button type="button" data-hmap="${it.key}" aria-label="${hospitalMapEsc(it.label)}">` +
        `${hospitalMapEsc(it.label)}</button>`
    )
    .join('');
}

function hospitalMapListTarget(e) {
  const t = e && e.target;
  return t && typeof t.closest === 'function' ? t.closest('[data-hmap]') : null;
}

function hospitalMapListClick(e) {
  const b = hospitalMapListTarget(e);
  if (b) hospitalMapActivate(hospitalMapHitFromKey(b.dataset.hmap));
}

function hospitalMapListFocus(e) {
  const b = hospitalMapListTarget(e);
  hospitalMapView.focus = b ? b.dataset.hmap : '';
  hospitalMapInvalidate();
}

function hospitalMapListBlur() {
  hospitalMapView.focus = '';
  hospitalMapInvalidate();
}

// ---- Pointer input ----
function hospitalMapPointer(e, type) {
  const v = hospitalMapView;
  if (!v.canvas || !v.w || !v.h) return;
  const r = v.canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * v.w) / Math.max(1, r.width),
    y = ((e.clientY - r.top) * v.h) / Math.max(1, r.height),
    hit = hospitalMapHit(x, y, v.w, v.h),
    key = hospitalMapKey(hit);
  if (type === 'down') {
    v.press = key;
    v.hover = key;
  } else if (type === 'move') v.hover = key;
  else if (type === 'up') {
    const same = !!key && key === v.press;
    v.press = '';
    if (same) hospitalMapActivate(hit);
  } else {
    v.press = '';
    v.hover = '';
  }
  if (v.canvas.style) v.canvas.style.cursor = key ? 'pointer' : 'default';
  hospitalMapInvalidate();
}

// ---- Mounting and the redraw loop ----
function hospitalMapHeightFor(w) {
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
  if (w < 560) return Math.round(clamp(w / 0.6, 420, 760));
  if (vh < 560) return Math.round(clamp(Math.min(w / 2.44, vh - 70), 220, 420));
  return Math.round(clamp(w / 1.7, 300, 640));
}

function hospitalMapVisible(el) {
  if (typeof document !== 'undefined' && document.hidden) return false;
  const d = typeof el.closest === 'function' ? el.closest('dialog') : null;
  if (d && !d.open) return false;
  const r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
  return !!r && r.width > 0;
}

function hospitalMapRender(force) {
  const v = hospitalMapView;
  if (!v.el || !v.canvas || !hospitalMapVisible(v.el)) return false;
  const w = Math.max(240, Math.round(v.el.getBoundingClientRect().width)),
    h = hospitalMapHeightFor(w);
  if (w !== v.w || h !== v.h || !v.g) {
    v.w = w;
    v.h = h;
    if (v.canvas.style) v.canvas.style.height = h + 'px';
    v.g = typeof configureCanvas === 'function' ? configureCanvas(v.canvas, w, h) : v.canvas.getContext('2d');
    v.dirty = true;
  }
  if (!force && !v.dirty) return false;
  hospitalMapDraw(v.g, w, h);
  v.dirty = false;
  return true;
}

function hospitalMapTick(now) {
  const v = hospitalMapView;
  v.raf = 0;
  if (!v.el) return;
  if (!hospitalMapVisible(v.el)) {
    if (v.wait > 0) {
      v.wait--;
      v.raf = requestAnimationFrame(hospitalMapTick) || 0;
    }
    return;
  }
  v.wait = 0;
  if (v.dirty || now - v.last >= 1000 / 30 - 2) {
    v.last = now;
    hospitalMapRender(!hospitalMapReduced());
  }
  v.raf = requestAnimationFrame(hospitalMapTick) || 0;
}

// Keeps redrawing while the map is on screen. A fresh mount gets half a second to become visible.
function hospitalMapStart() {
  const v = hospitalMapView;
  v.wait = 30;
  if (v.raf || typeof requestAnimationFrame !== 'function') return;
  v.raf = requestAnimationFrame(hospitalMapTick) || 0;
}

function hospitalMapInvalidate() {
  const v = hospitalMapView;
  v.dirty = true;
  if (v.el) hospitalMapStart();
}

// The map dialog's header line. The dialog markup ships its own; the map keeps it on the right floor.
function hospitalMapHeader(el) {
  const doc = typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document : null,
    dialog = (el && typeof el.closest === 'function' && el.closest('dialog')) || (doc && doc.getElementById('mapDialog')),
    kicker = dialog && typeof dialog.querySelector === 'function' ? dialog.querySelector('.modal-kicker') : null;
  if (kicker && kicker.textContent !== HOSPITAL_MAP_COPY.header) kicker.textContent = HOSPITAL_MAP_COPY.header;
  return kicker;
}

function mountHospitalMap(el) {
  if (!el) return null;
  const v = hospitalMapView,
    query = sel => (typeof el.querySelector === 'function' ? el.querySelector(sel) : null);
  let cv = query('canvas[data-hospital-map]'),
    list = query('[data-hospital-map-list]');
  if (!cv || !list || v.el !== el || v.canvas !== cv) {
    el.innerHTML = HOSPITAL_MAP_SKELETON;
    cv = query('canvas[data-hospital-map]');
    list = query('[data-hospital-map-list]');
  }
  if (!cv || !list) return null;
  if (v.canvas !== cv) {
    cv.addEventListener('pointerdown', e => hospitalMapPointer(e, 'down'));
    cv.addEventListener('pointermove', e => hospitalMapPointer(e, 'move'));
    cv.addEventListener('pointerup', e => hospitalMapPointer(e, 'up'));
    cv.addEventListener('pointercancel', e => hospitalMapPointer(e, 'cancel'));
    cv.addEventListener('pointerleave', e => hospitalMapPointer(e, 'leave'));
    v.g = null;
    v.w = 0;
    v.h = 0;
  }
  if (v.list !== list) {
    list.addEventListener('click', hospitalMapListClick);
    list.addEventListener('focusin', hospitalMapListFocus);
    list.addEventListener('focusout', hospitalMapListBlur);
  }
  v.el = el;
  v.canvas = cv;
  v.list = list;
  v.hover = '';
  v.press = '';
  hospitalMapHeader(el);
  list.innerHTML = hospitalMapButtonsHtml();
  v.dirty = true;
  hospitalMapRender(true);
  hospitalMapStart();
  return cv;
}
