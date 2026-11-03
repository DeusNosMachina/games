// Rowdy the Ram: Ramsey's town and school mascot, cheering for Macy in the hospital hallway.
// Art, copy, and an optional reference brain. Uses art.js primitives and state.js helpers at runtime.
//
// Drawing: drawRowdy(g, x, y, scale, pose, t, opts) puts his feet at (x, y), like girl().
// At scale 1 he stands ROWDY_HEIGHT (86) units tall, horns included; ROWDY_SCALE (1.45) makes him
// a head taller than Macy in the ward (girl() at 1.24). opts.face is 1 (right) or -1 (left);
// opts.prop 'flag' swaps the cheer's front pom-pom for a spirit flag; opts.shadow false skips it;
// opts.poms puts the gallop's poms up (the run-through) and opts.dust kicks dust behind him.
//
// Costume palette, sampled from docs/rowdy-references in the infocus repo (photos 1, 4, 12, 13):
// royal blue jersey shoulders (#0960b3 to #056ac0), athletic gold horns and shorts (#d09219,
// #daa248), white mesh jersey with a blue 77 outlined in grey, taupe fur with darker banding
// (#86735f, #605347), a white blaze and goatee, black nose and gloves, bright blue eyes, a red
// tongue, and tan-and-white high-tops. Ramsey colors: royal blue and gold.

const ROWDY_HEIGHT = 86,
  ROWDY_SCALE = 1.45,
  ROWDY_POSES = ['idle', 'wave', 'cheer', 'jump', 'point', 'flex', 'gallop', 'hug', 'sad', 'spin'];

const ROWDY_COL = {
  fur: '#968877',
  furLight: '#b4a694',
  furDark: '#75685b',
  stripe: '#5e5348',
  edge: '#4a4038',
  muzzle: '#fbf9f3',
  muzzleShade: '#dcd6cb',
  nose: '#1d1b1f',
  mouth: '#6c1020',
  tongue: '#da4a5c',
  iris: '#2471d8',
  irisLight: '#63aff4',
  pupil: '#121116',
  lid: '#1d181b',
  hornGold: '#e4aa2d',
  hornGoldLight: '#f6d26a',
  hornWhite: '#f7f6f0',
  hornBlue: '#2148ad',
  hornBlueDark: '#163380',
  hornEdge: '#3f342d',
  seam: '#3d35316e',
  jersey: '#f7f5ef',
  jerseyShade: '#d6d2c9',
  jerseyEdge: '#98a0a7',
  royal: '#1f67cb',
  royalDark: '#154c9c',
  number: '#1f62c8',
  numberEdge: '#a5abab',
  shorts: '#dfae50',
  shortsDark: '#b98834',
  shoeTan: '#cb9858',
  shoeTanDark: '#a3733d',
  shoeWhite: '#f8f6f0',
  sole: '#2b2a2e',
  glove: '#2a262b',
  gloveLight: '#4d464d',
  pomBlue: '#2a6fd6',
  pomGold: '#f4c645',
  tear: '#8fd3f4'
};

// ---- Pose skeletons ----
// Every pose is built facing right (+x is his front side); drawRowdy mirrors it for face -1.
// Joints are in body units with the feet at (0, 0). dip lowers everything above the knees.

function rowdyShoulder(s, dip) {
  return [s * 12.6, -46 + dip];
}

function rowdyHip(s, dip) {
  return [s * 5.4, -27 + dip];
}

function rowdyStandLegs(P, spread = 0) {
  P.legs = [-1, 1].map(s => ({
    s,
    k: [s * (6 + spread + P.dip * 0.45), -15 + P.dip * 0.55],
    a: [s * (6.8 + spread), -6],
    tilt: 0
  }));
}

function rowdyHandsOnHips(s, dip) {
  return { s, e: [s * 20, -38.2 + dip], h: [s * 12.9, -31.4 + dip], kind: 'mitt' };
}

function rowdyArmsDown(s, dip) {
  return { s, e: [s * 15.3, -37.2 + dip], h: [s * 15.6, -28 + dip], kind: 'mitt' };
}

function rowdyPose(pose, t, opts = {}) {
  const P = {
    lift: 0,
    dip: 0,
    lean: 0,
    spin: 1,
    back: false,
    head: [0.5, -66.5],
    tilt: 0,
    arms: [],
    legs: [],
    mouth: 0.7,
    brows: 'happy',
    eyes: 'open',
    look: [0.5, 0],
    flex: 0,
    prop: null,
    fx: null
  };
  if (pose === 'wave') {
    const w = Math.sin(t * 9);
    P.dip = Math.abs(Math.sin(t * 4.5)) * 0.9;
    P.tilt = 0.09 + Math.sin(t * 2) * 0.03;
    P.mouth = 0.9;
    P.arms = [
      rowdyHandsOnHips(-1, P.dip),
      { s: 1, e: [19.5, -55.5 + P.dip], h: [23.5 + w * 3.4, -68.5 + P.dip - Math.abs(w) * 0.6], kind: 'open' }
    ];
  } else if (pose === 'cheer') {
    const beat = Math.sin(t * 7.5),
      hop = Math.max(0, beat);
    P.lift = hop * 3.4;
    P.dip = (1 - Math.abs(beat)) * 1.3;
    P.tilt = Math.sin(t * 3.75) * 0.07;
    P.mouth = 1;
    P.arms = [-1, 1].map(s => ({
      s,
      e: [s * 18.5, -58 + P.dip],
      h: [s * (23.5 + hop * 1.6), -71.5 - hop * 3 + P.dip],
      kind: 'pom'
    }));
    if (opts.prop === 'flag') P.arms[1].kind = 'flag';
  } else if (pose === 'jump') {
    const c = (t * 1.25) % 1,
      air = Math.sin(c * Math.PI),
      tuck = clamp((air - 0.3) / 0.55, 0, 1);
    P.lift = air * 26;
    P.dip = air < 0.25 ? (1 - air * 4) * 3.4 : 0;
    P.mouth = 1;
    P.tilt = -tuck * 0.06;
    P.arms = [-1, 1].map(s => ({
      s,
      e: [s * 17.5, -57 + P.dip + tuck],
      h: [s * (22 + tuck * 2), -70 - tuck * 3.5 + P.dip],
      kind: 'fist'
    }));
    P.legs = [-1, 1].map(s => ({
      s,
      k: [s * (6 + tuck * 3.4 + P.dip * 0.5), -15 + P.dip * 0.55 - tuck * 9],
      a: [s * (6.8 + tuck * 1.2), -6 - tuck * 12.5],
      tilt: s * tuck * 0.25
    }));
    P.fx = air > 0.45 ? 'rise' : null;
  } else if (pose === 'point') {
    P.dip = Math.abs(Math.sin(t * 3.5)) * 0.6;
    P.lean = 0.04;
    P.tilt = 0.07;
    P.mouth = 0.85;
    P.look = [1, -0.1];
    P.arms = [
      rowdyHandsOnHips(-1, P.dip),
      { s: 1, e: [21, -49.6 + P.dip], h: [29.8 + Math.sin(t * 7) * 0.8, -53.8 + P.dip], kind: 'point' }
    ];
  } else if (pose === 'flex') {
    const pulse = (Math.sin(t * 5) + 1) / 2;
    P.dip = 1.4 + pulse * 0.9;
    P.flex = 0.6 + pulse * 0.4;
    P.mouth = 0.95;
    P.brows = 'fierce';
    P.arms = [-1, 1].map(s => ({
      s,
      e: [s * (21.8 + pulse * 0.8), -47.5 + P.dip],
      h: [s * (20.2 - pulse * 0.6), -60.5 - pulse * 1.8 + P.dip],
      kind: 'fist'
    }));
    rowdyStandLegs(P, 2);
    P.fx = 'sparkle';
  } else if (pose === 'gallop') {
    const ph = t * 10;
    P.lift = Math.abs(Math.sin(ph)) * 3.2;
    P.lean = 0.13;
    P.tilt = Math.sin(ph) * 0.04;
    P.mouth = 1;
    P.look = [1, 0];
    P.legs = [-1, 1].map(s => {
      const sw = Math.sin(ph + (s > 0 ? 0 : Math.PI)),
        up = Math.max(0, Math.cos(ph + (s > 0 ? 0 : Math.PI)));
      return {
        s,
        k: [s * 4.6 + 1.6 + sw * 6.5, -15 - up * 3],
        a: [s * 4.6 + sw * 9, -6 - up * 5.5],
        tilt: sw * 0.35
      };
    });
    P.arms = opts.poms
      ? [-1, 1].map(s => {
          // Run-through: poms up and shaking, out of step with the stride.
          const shake = Math.sin(ph * 1.3 + (s > 0 ? 0 : 2));
          return { s, e: [s * 17.5, -58], h: [s * (21 + shake * 2), -72 - Math.abs(shake) * 3], kind: 'pom' };
        })
      : [-1, 1].map(s => {
          const sw = -Math.sin(ph + (s > 0 ? 0 : Math.PI));
          return {
            s,
            e: [s * 14 + sw * 5.5, -38 - Math.abs(sw) * 1.5],
            h: [s * 12.5 + sw * 10, -33 - Math.max(0, sw) * 5],
            kind: 'fist'
          };
        });
    P.fx = 'lines';
  } else if (pose === 'hug') {
    const a = Math.sin(t * 3);
    P.dip = Math.abs(Math.sin(t * 2.6)) * 0.8;
    P.mouth = 1;
    P.eyes = 'happy';
    P.tilt = Math.sin(t * 1.3) * 0.05;
    P.arms = [-1, 1].map(s => ({
      s,
      e: [s * 22.5, -53 + P.dip],
      h: [s * (31.5 + a * 1.2), -59.5 + P.dip],
      kind: 'open'
    }));
    P.fx = 'hearts';
  } else if (pose === 'sad') {
    P.dip = 2.6;
    P.head = [0.3, -63.4];
    P.tilt = -0.16 + Math.sin(t * 1.4) * 0.03;
    P.mouth = 0.25;
    P.brows = 'sad';
    P.look = [0.2, 0.8];
    P.arms = [-1, 1].map(s => rowdyArmsDown(s, P.dip));
    P.fx = 'tear';
  } else if (pose === 'spin') {
    const ph = t * 7;
    P.spin = Math.sign(Math.cos(ph)) * Math.max(0.3, Math.sqrt(Math.abs(Math.cos(ph))));
    P.back = P.spin < 0;
    P.lift = 1.6;
    P.mouth = 1;
    P.arms = [-1, 1].map(s => ({ s, e: [s * 21, -55], h: [s * 29, -61], kind: 'open' }));
    P.legs = [
      { s: -1, k: [-6.4, -15], a: [-6.8, -6], tilt: 0 },
      { s: 1, k: [9.5, -22], a: [7.4, -14.5], tilt: 0.3 }
    ];
    P.fx = 'swirl';
    P.head = [0, -66.5];
  } else {
    // idle: a bouncy sway with hands on his hips and a head tilt.
    const b = Math.abs(Math.sin(t * 3.4));
    P.dip = (1 - b) * 1.6;
    P.lean = Math.sin(t * 1.7) * 0.04;
    P.tilt = Math.sin(t * 1.7 + 0.8) * 0.1;
    P.mouth = 0.6 + Math.sin(t * 1.3) * 0.12;
    P.arms = [-1, 1].map(s => {
      const arm = rowdyHandsOnHips(s, P.dip);
      arm.e[1] += Math.sin(t * 6.8) * 0.3;
      return arm;
    });
  }
  P.head = [P.head[0], P.head[1] + P.dip];
  if (!P.legs.length) rowdyStandLegs(P);
  P.dust = !!opts.dust;
  return P;
}

// ---- Parts ----

function rowdyLimb(g, pts, w) {
  const C = ROWDY_COL;
  line(g, pts, C.edge, w + 1.5);
  line(g, pts, C.fur, w);
  line(
    g,
    pts.map(p => [p[0] - w * 0.16, p[1] - w * 0.16]),
    '#c1b4a33d',
    w * 0.36
  );
  // Tabby banding, like the costume's arms and legs.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1,
      nx = (-dy / len) * w * 0.4,
      ny = (dx / len) * w * 0.4;
    for (const u of [0.4, 0.74]) {
      const cx = a[0] + dx * u,
        cy = a[1] + dy * u;
      line(
        g,
        [
          [cx - nx, cy - ny],
          [cx + nx * 0.3 + (dx / len) * 0.9, cy + ny * 0.3 + (dy / len) * 0.9]
        ],
        C.stripe,
        0.85
      );
    }
  }
}

function rowdyShoe(g, x, y, tilt, toe) {
  const C = ROWDY_COL;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  // A fur cuff disappears into a tan high-top with a white toe, a white swoosh and a dark sole.
  ellipse(g, 0, -2.6, 3.6, 1.8, C.furDark);
  path(
    g,
    p => {
      p.moveTo(-6.6 + toe * 0.4, 5);
      p.bezierCurveTo(-7, 0.5, -4.8, -3.3, -0.4 + toe * 0.6, -3.3);
      p.bezierCurveTo(4.2 + toe * 0.8, -3.3, 7.4 + toe * 1.4, 0.5, 7 + toe * 1.4, 5);
      p.closePath();
    },
    gradient(g, -6, -3, 10, 8, C.shoeTan, C.shoeTanDark),
    C.edge,
    0.8
  );
  ellipse(g, toe * 1.5, 2.6, 5.6, 2.9, C.shoeWhite);
  path(
    g,
    p => {
      p.moveTo(-5.2 + toe * 0.2, 0.2);
      p.quadraticCurveTo(-2.4, -1.4, 0.8 + toe, -2.6);
    },
    null,
    C.shoeWhite,
    1.1
  );
  ellipse(g, toe * 0.4 - 0.5, -2.7, 3, 0.9, C.shoeWhite);
  rr(g, -7 + toe * 0.4, 4.4, 14.2 + toe * 1.2, 1.9, 0.9, C.sole);
  ellipse(g, toe * 1.5 - 1.6, 1.4, 2, 0.8, '#ffffff99');
  g.restore();
}

function rowdyLeg(g, L, dip) {
  rowdyLimb(g, [rowdyHip(L.s, dip), L.k, L.a], 6);
}

function rowdyShorts(g, P) {
  const C = ROWDY_COL,
    dip = P.dip;
  for (const L of P.legs) {
    const h = rowdyHip(L.s, dip),
      dx = L.k[0] - h[0],
      dy = L.k[1] - h[1],
      len = Math.hypot(dx, dy) || 1,
      ux = dx / len,
      uy = dy / len,
      nx = -uy,
      ny = ux,
      end = [h[0] + ux * 7.4, h[1] + uy * 7.4];
    path(
      g,
      p => {
        p.moveTo(h[0] - ux * 3 + nx * 5.8, h[1] - uy * 3 + ny * 5.8);
        p.lineTo(end[0] + nx * 5.6, end[1] + ny * 5.6);
        p.quadraticCurveTo(end[0] + ux * 0.8, end[1] + uy * 0.8, end[0] - nx * 5.6, end[1] - ny * 5.6);
        p.lineTo(h[0] - ux * 3 - nx * 5.8, h[1] - uy * 3 - ny * 5.8);
        p.closePath();
      },
      gradient(g, h[0] - 5, h[1] - 3, 10, 9, C.shorts, C.shortsDark),
      '#9a7029',
      0.7
    );
    line(g, [[end[0] + nx * 5, end[1] + ny * 5], [end[0] - nx * 5, end[1] - ny * 5]], '#c99a43', 0.7);
  }
  path(
    g,
    p => {
      p.moveTo(-11.8, -33.6 + dip);
      p.lineTo(11.8, -33.6 + dip);
      p.lineTo(12.4, -26.4 + dip);
      p.quadraticCurveTo(0, -24.4 + dip, -12.4, -26.4 + dip);
      p.closePath();
    },
    gradient(g, -10, -34 + dip, 14, 9, C.shorts, C.shortsDark),
    '#9a7029',
    0.7
  );
}

// One jersey "7", always drawn reading left to right whatever the mirror.
function rowdySeven(g, x, y, s, mir) {
  const C = ROWDY_COL,
    pts = [[0, 0], [4.5, 0], [4.5, 1.6], [2.5, 7], [0.7, 7], [2.7, 1.7], [0, 1.7]];
  g.save();
  g.translate(x, y);
  g.scale(mir * s, s);
  g.translate(-2.25, 0);
  path(
    g,
    p => {
      pts.forEach((v, i) => (i ? p.lineTo(...v) : p.moveTo(...v)));
      p.closePath();
    },
    null,
    C.numberEdge,
    1.3
  );
  poly(g, pts, C.number);
  g.restore();
}

function rowdyTorso(g, P, mir) {
  const C = ROWDY_COL;
  g.save();
  g.translate(0, P.dip);
  path(
    g,
    p => {
      p.moveTo(-5, -50.6);
      p.quadraticCurveTo(0, -49.2, 5, -50.6);
      p.quadraticCurveTo(10.6, -50.2, 13.4, -47.4);
      p.lineTo(12.2, -41);
      p.quadraticCurveTo(12.5, -36, 13.1, -30.4);
      p.quadraticCurveTo(0, -28.8, -13.1, -30.4);
      p.quadraticCurveTo(-12.5, -36, -12.2, -41);
      p.lineTo(-13.4, -47.4);
      p.quadraticCurveTo(-10.6, -50.2, -5, -50.6);
      p.closePath();
    },
    gradient(g, -9, -50, 12, 22, C.jersey, C.jerseyShade),
    C.jerseyEdge,
    0.8
  );
  if (P.back) {
    // The back yoke runs straight across the shoulders, and the 77 sits high and big.
    path(
      g,
      p => {
        p.moveTo(-13.4, -47.4);
        p.quadraticCurveTo(-10.6, -50.2, -5, -50.6);
        p.quadraticCurveTo(0, -51, 5, -50.6);
        p.quadraticCurveTo(10.6, -50.2, 13.4, -47.4);
        p.lineTo(12.6, -44);
        p.quadraticCurveTo(0, -45.6, -12.6, -44);
        p.closePath();
      },
      gradient(g, 0, -51, 0, 7, C.royal, C.royalDark)
    );
    rowdySeven(g, -2.9, -42.6, 1.12, mir);
    rowdySeven(g, 2.9, -42.6, 1.12, mir);
  } else {
    for (const s of [-1, 1]) {
      path(
        g,
        p => {
          p.moveTo(s * 4.6, -50.6);
          p.quadraticCurveTo(s * 10.6, -50.2, s * 13.4, -47.4);
          p.lineTo(s * 12.2, -41);
          p.quadraticCurveTo(s * 9.6, -45.2, s * 6.3, -46.6);
          p.quadraticCurveTo(s * 4.8, -48.2, s * 4.6, -50.6);
          p.closePath();
        },
        gradient(g, s * 5, -51, s * 8, 9, C.royal, C.royalDark)
      );
    }
    line(g, [[-3.6, -50.4], [0.6, -46.8], [4.6, -50.4]], C.royal, 1.3);
    rowdySeven(g, -2.3, -42.4, 0.95, mir);
    rowdySeven(g, 3.1, -42.4, 0.95, mir);
  }
  line(g, [[-12.8, -31], [0, -29.6], [12.8, -31]], '#c8c3b9', 0.8);
  g.restore();
}

function rowdyHorn(g, side, u0, u1) {
  const C = ROWDY_COL,
    cx = side * 12.6,
    cy = -8.2,
    th0 = -2.62,
    th1 = 2.5;
  const at = u => {
    const th = th0 + (th1 - th0) * u,
      r = 7.7 - 3.6 * u,
      taper = u > 0.88 ? Math.max(0.14, (1 - u) / 0.12) : 1,
      w = (5.7 - 2.6 * u) * taper,
      ox = Math.cos(th) * side,
      oy = Math.sin(th);
    return { x: cx + ox * r, y: cy + oy * r, ox, oy, w };
  };
  const strip = (a, b) => {
    const n = Math.max(2, Math.ceil((b - a) * 40)),
      outer = [],
      inner = [];
    for (let i = 0; i <= n; i++) {
      const q = at(a + ((b - a) * i) / n);
      outer.push([q.x + q.ox * q.w * 0.5, q.y + q.oy * q.w * 0.5]);
      inner.push([q.x - q.ox * q.w * 0.5, q.y - q.oy * q.w * 0.5]);
    }
    return outer.concat(inner.reverse());
  };
  const bands = [
    [0, 0.4, C.hornGold],
    [0.4, 0.64, C.hornWhite],
    [0.64, 1, C.hornBlue]
  ];
  for (const [a, b, col] of bands) {
    const lo = Math.max(a, u0),
      hi = Math.min(b, u1);
    if (hi > lo) poly(g, strip(lo, hi), col);
  }
  // Highlight along the gold crown and the blue curl, then the stitched seams.
  const glint = [];
  for (let u = Math.max(u0, 0.04); u <= Math.min(u1, 0.38); u += 0.03) {
    const q = at(u);
    glint.push([q.x + q.ox * q.w * 0.22, q.y + q.oy * q.w * 0.22]);
  }
  if (glint.length > 1) line(g, glint, C.hornGoldLight, 1.1);
  const shade = [];
  for (let u = Math.max(u0, 0.66); u <= Math.min(u1, 0.95); u += 0.03) {
    const q = at(u);
    shade.push([q.x - q.ox * q.w * 0.25, q.y - q.oy * q.w * 0.25]);
  }
  if (shade.length > 1) line(g, shade, C.hornBlueDark, 0.9);
  for (let u = 0.07; u < 0.9; u += 0.085) {
    if (u < u0 || u > u1) continue;
    const q = at(u);
    line(
      g,
      [
        [q.x + q.ox * q.w * 0.5, q.y + q.oy * q.w * 0.5],
        [q.x - q.ox * q.w * 0.5, q.y - q.oy * q.w * 0.5]
      ],
      C.seam,
      0.45
    );
  }
  path(
    g,
    p => {
      strip(u0, u1).forEach((v, i) => (i ? p.lineTo(...v) : p.moveTo(...v)));
      p.closePath();
    },
    null,
    C.hornEdge,
    0.7
  );
}

function rowdyEar(g, s) {
  const C = ROWDY_COL;
  path(
    g,
    p => {
      p.moveTo(s * 9.8, -3.6);
      p.quadraticCurveTo(s * 15.6, -3, s * 17.6, 1.8);
      p.quadraticCurveTo(s * 13, 2.4, s * 9.8, 1.2);
      p.closePath();
    },
    C.furDark,
    C.edge,
    0.7
  );
  path(
    g,
    p => {
      p.moveTo(s * 11, -2);
      p.quadraticCurveTo(s * 14.6, -1.6, s * 16, 1.1);
      p.quadraticCurveTo(s * 13, 1.2, s * 11, 0.5);
      p.closePath();
    },
    '#b5a08f'
  );
}

function rowdyHeadShape(p) {
  p.moveTo(0, -13.6);
  p.bezierCurveTo(8.6, -13.8, 11.8, -7, 11.7, -0.5);
  p.bezierCurveTo(11.6, 6, 8.6, 11, 4.5, 12.6);
  p.quadraticCurveTo(0, 13.8, -4.5, 12.6);
  p.bezierCurveTo(-8.6, 11, -11.6, 6, -11.7, -0.5);
  p.bezierCurveTo(-11.8, -7, -8.6, -13.8, 0, -13.6);
  p.closePath();
}

function rowdyTuft(g) {
  const C = ROWDY_COL;
  path(
    g,
    p => {
      p.moveTo(-3.6, -12.4);
      p.quadraticCurveTo(-4.4, -15.6, -3, -17.6);
      p.quadraticCurveTo(-2, -15, -0.6, -14.4);
      p.quadraticCurveTo(-0.2, -18, 1.2, -19.6);
      p.quadraticCurveTo(1.6, -16, 2.4, -14.6);
      p.quadraticCurveTo(3.6, -15.8, 4.6, -16.4);
      p.quadraticCurveTo(4.6, -14, 3.6, -12.2);
      p.closePath();
    },
    C.fur,
    C.edge,
    0.7
  );
  line(g, [[0.4, -13.2], [1, -17.2]], C.furDark, 0.6);
}

function rowdyEye(g, ex, ey, s, sc, P, t) {
  const C = ROWDY_COL,
    blink = t % 3.9 > 3.76;
  if (P.eyes === 'happy') {
    path(
      g,
      p => {
        p.moveTo(ex - 2.5 * sc, ey + 0.8);
        p.quadraticCurveTo(ex, ey - 2.8, ex + 2.5 * sc, ey + 0.8);
      },
      null,
      C.lid,
      1.1
    );
    return;
  }
  if (blink) {
    path(
      g,
      p => {
        p.moveTo(ex - 2.7 * sc, ey - 0.2);
        p.quadraticCurveTo(ex, ey + 1.3, ex + 2.7 * sc, ey - 0.2);
      },
      null,
      C.lid,
      0.9
    );
    return;
  }
  ellipse(g, ex, ey, 2.75 * sc, 2.4, '#fbfbf6');
  const ix = ex + P.look[0] * 0.7 * sc,
    iy = ey + 0.15 + P.look[1] * 0.5;
  ellipse(g, ix, iy, 1.8 * sc, 2, C.iris);
  ellipse(g, ix, iy + 0.7, 1.25 * sc, 0.95, C.irisLight);
  ellipse(g, ix + 0.1, iy, 0.85 * sc, 1, C.pupil);
  ellipse(g, ix - 0.55 * sc, iy - 0.8, 0.6, 0.55, '#ffffff');
  // Eyeliner across the top with a flick at the outer corner.
  line(
    g,
    [
      [ex - 2.95 * sc, ey - 0.3],
      [ex - 1.3 * sc, ey - 2.35],
      [ex + 1.3 * sc, ey - 2.4],
      [ex + 2.95 * sc, ey - 0.6]
    ],
    C.lid,
    0.95
  );
  line(g, [[ex - 2.2 * sc, ey + 1.9], [ex + 2.2 * sc, ey + 1.9]], '#3b313466', 0.4);
}

function rowdyFace(g, P, t) {
  const C = ROWDY_COL,
    f = 1.1;
  // White blaze from the forehead down the nose, widening into the muzzle.
  path(
    g,
    p => {
      p.moveTo(f, -10.2);
      p.quadraticCurveTo(f + 1.3, -4, f + 2.9, -1.2);
      p.quadraticCurveTo(f + 7, 0.4, f + 7.1, 4.4);
      p.quadraticCurveTo(f + 6.6, 7.2, f + 3.6, 6.8);
      p.lineTo(f - 3.6, 6.8);
      p.quadraticCurveTo(f - 6.6, 7.2, f - 7.1, 4.4);
      p.quadraticCurveTo(f - 7, 0.4, f - 2.9, -1.2);
      p.quadraticCurveTo(f - 1.3, -4, f, -10.2);
      p.closePath();
    },
    gradient(g, f - 4, -8, 6, 14, C.muzzle, C.muzzleShade)
  );
  // Goatee under the open mouth, spilling over the collar.
  path(
    g,
    p => {
      p.moveTo(f - 6.2, 5);
      p.quadraticCurveTo(f - 6.8, 9.6, f - 4.4, 11.4);
      p.quadraticCurveTo(f - 3.4, 13, f - 1.6, 12.8);
      p.quadraticCurveTo(f - 0.4, 14, f + 1, 13.4);
      p.quadraticCurveTo(f + 2.8, 13.4, f + 3.8, 12.2);
      p.quadraticCurveTo(f + 6.6, 10, f + 6.6, 5);
      p.closePath();
    },
    C.muzzle,
    '#d3ccc0',
    0.6
  );
  // Eyes and brows. The front-side eye (+x) is a touch bigger: a 3/4 turn toward his facing.
  for (const s of [-1, 1]) {
    const sc = s > 0 ? 1.04 : 0.92,
      ex = f + s * 4.6,
      ey = -2.9;
    rowdyEye(g, ex, ey, s, sc, P, t);
    const inner = ex - s * 2.3,
      outer = ex + s * 3,
      lift = P.brows === 'sad' ? [-5.9, -3.9] : P.brows === 'fierce' ? [-3.9, -5.6] : [-5, -4.5];
    path(
      g,
      p => {
        p.moveTo(inner, ey + lift[0]);
        p.quadraticCurveTo(ex, ey + Math.min(lift[0], lift[1]) - 0.9, outer, ey + lift[1]);
      },
      null,
      C.furDark,
      1.5
    );
  }
  // Nose: big, black and glossy.
  path(
    g,
    p => {
      p.moveTo(f - 3.9, 1);
      p.bezierCurveTo(f - 3.9, -0.9, f + 3.9, -0.9, f + 3.9, 1);
      p.bezierCurveTo(f + 3.9, 2.6, f + 1.3, 3.8, f, 4);
      p.bezierCurveTo(f - 1.3, 3.8, f - 3.9, 2.6, f - 3.9, 1);
      p.closePath();
    },
    C.nose
  );
  ellipse(g, f - 1.1, 0.3, 1.3, 0.5, '#ffffff59');
  // Mouth: open and friendly, red tongue, white lower teeth. Sad is a small round "oh".
  if (P.brows === 'sad') {
    ellipse(g, f, 7.2, 1.9, 1.4, C.mouth);
    ellipse(g, f + 0.2, 7.8, 1.2, 0.6, C.tongue);
  } else {
    const h = 1 + P.mouth * 2.6;
    path(
      g,
      p => {
        p.moveTo(f - 4.4, 5.4);
        p.quadraticCurveTo(f, 6.8, f + 4.4, 5.4);
        p.quadraticCurveTo(f + 3.3, 6.6 + h * 1.15, f, 6.6 + h);
        p.quadraticCurveTo(f - 3.3, 6.6 + h * 1.15, f - 4.4, 5.4);
        p.closePath();
      },
      C.mouth
    );
    ellipse(g, f + 0.5, 6.7 + h * 0.62, 2.5, Math.max(0.5, h * 0.36), C.tongue);
    path(
      g,
      p => {
        p.moveTo(f - 2.6, 6.2 + h * 0.98);
        p.quadraticCurveTo(f, 6.9 + h * 1.08, f + 2.6, 6.2 + h * 0.98);
      },
      null,
      '#f6f2ea',
      0.9
    );
    line(g, [[f - 4.4, 5.4], [f - 5.2, 4.8]], '#5b4f4599', 0.6);
    line(g, [[f + 4.4, 5.4], [f + 5.2, 4.8]], '#5b4f4599', 0.6);
  }
  if (P.fx === 'tear') {
    const k = (t * 1.3) % 1;
    g.globalAlpha = 1 - k * 0.6;
    path(
      g,
      p => {
        const tx = f + 6.6,
          ty = -0.6 + k * 5;
        p.moveTo(tx, ty - 1.6);
        p.quadraticCurveTo(tx + 1.1, ty, tx, ty + 0.9);
        p.quadraticCurveTo(tx - 1.1, ty, tx, ty - 1.6);
      },
      C.tear
    );
    g.globalAlpha = 1;
  }
}

function rowdyHead(g, P, t) {
  const C = ROWDY_COL;
  g.save();
  g.translate(P.head[0], P.head[1]);
  g.rotate(P.tilt);
  for (const s of [-1, 1]) rowdyEar(g, s);
  for (const s of [-1, 1]) rowdyHorn(g, s, 0, P.back ? 1 : 0.66);
  path(g, rowdyHeadShape, gradient(g, -8, -13, 14, 26, C.furLight, C.furDark), C.edge, 0.9);
  // Fur texture on the brow and cheeks.
  line(g, [[-8.4, -8.4], [-6, -10.2]], '#6f62567a', 0.6);
  line(g, [[7.6, -9.2], [9.4, -6.6]], '#6f62567a', 0.6);
  line(g, [[-10.2, 3.6], [-8.6, 5.8]], '#6f62567a', 0.6);
  line(g, [[10.4, 3.2], [9.2, 6]], '#6f62567a', 0.6);
  if (P.back) {
    line(g, [[-4, 6], [0, 9], [4, 6]], '#6f62567a', 0.7);
    rowdyTuft(g);
  } else {
    rowdyFace(g, P, t);
    rowdyTuft(g);
    for (const s of [-1, 1]) rowdyHorn(g, s, 0.56, 1);
  }
  g.restore();
}

function rowdyHand(g, arm, t, mir) {
  const C = ROWDY_COL,
    [hx, hy] = arm.h,
    ang = Math.atan2(arm.h[1] - arm.e[1], arm.h[0] - arm.e[0]);
  if (arm.kind === 'pom') {
    rowdyPom(g, hx + Math.cos(ang) * 2.4, hy + Math.sin(ang) * 2.4, t, arm.s * 3);
    return;
  }
  g.save();
  g.translate(hx, hy);
  g.rotate(ang);
  ellipse(g, -0.6, 0, 2.3, 3.3, C.fur);
  if (arm.kind === 'open') {
    for (let i = 0; i < 4; i++) {
      const a = -0.78 + i * 0.52;
      line(g, [[2 + Math.cos(a) * 2, Math.sin(a) * 2], [2 + Math.cos(a) * 5.9, Math.sin(a) * 5.9]], C.glove, 1.9);
    }
    line(g, [[1.6, 1.8 * arm.s], [2.2, 4.8 * arm.s]], C.glove, 1.9);
    ellipse(g, 2.2, 0, 3.1, 3.2, C.glove);
    ellipse(g, 1.6, -1, 1.3, 0.8, C.gloveLight);
  } else if (arm.kind === 'fist' || arm.kind === 'point' || arm.kind === 'flag') {
    rr(g, -0.6, -3.3, 6.6, 6.6, 2.5, C.glove);
    line(g, [[4.4, -1.8], [4.4, 1.8]], C.gloveLight, 0.6);
    ellipse(g, 1.6, -1.4, 1.4, 0.8, C.gloveLight);
    if (arm.kind === 'point') {
      line(g, [[4.8, -1.6], [9.8, -1.9]], C.glove, 2);
      ellipse(g, 9.5, -2.2, 0.5, 0.35, C.gloveLight);
    }
  } else {
    ellipse(g, 2.3, 0, 3.7, 3.4, C.glove);
    ellipse(g, 1.3, -2.5 * arm.s, 1.5, 1.1, C.glove);
    ellipse(g, 1.6, -1, 1.4, 0.8, C.gloveLight);
  }
  g.restore();
  if (arm.kind === 'flag') rowdyFlag(g, hx + Math.cos(ang) * 2.6, hy + Math.sin(ang) * 2.6, t, arm.s, mir);
}

function rowdyPom(g, x, y, t, seed) {
  const C = ROWDY_COL;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.sin(t * 11 + i * 1.7 + seed) * 0.16,
      len = 7.4 + Math.sin(i * 2.3 + t * 13 + seed) * 1;
    line(g, [[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], i % 2 ? C.pomGold : C.pomBlue, 2.3);
  }
  ellipse(g, x, y, 3.8, 3.8, C.pomGold);
  ellipse(g, x - 0.8, y - 0.9, 1.6, 1.1, '#ffffff66');
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + i * 2.1 + seed;
    ellipse(g, x + Math.cos(a) * 5.4, y + Math.sin(a) * 5.4, 0.55, 0.55, '#fff7d0');
  }
}

function rowdyFlag(g, x, y, t, s, mir) {
  const C = ROWDY_COL,
    wave = Math.sin(t * 8) * 1.4,
    top = y - 22;
  line(g, [[x, y + 3], [x, top]], '#8a6a43', 1.2);
  ellipse(g, x, top, 0.9, 0.9, C.pomGold);
  path(
    g,
    p => {
      p.moveTo(x, top + 0.6);
      p.quadraticCurveTo(x + s * 8, top + 1.4 + wave, x + s * 16, top + 4.2 + wave * 0.6);
      p.quadraticCurveTo(x + s * 8, top + 5.6 - wave * 0.4, x, top + 8.6);
      p.closePath();
    },
    C.royal,
    C.pomGold,
    0.9
  );
  g.save();
  g.translate(x + s * 5.6, top + 6.4 + wave * 0.3);
  g.scale(mir, 1);
  label(g, 'RAMS', 0, 0, 3.6, C.pomGold, 'center');
  g.restore();
}

function rowdyArm(g, arm, P, t, mir) {
  const C = ROWDY_COL,
    sh = rowdyShoulder(arm.s, P.dip),
    dx = arm.e[0] - sh[0],
    dy = arm.e[1] - sh[1],
    len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len;
  rowdyLimb(g, [sh, arm.e, arm.h], 5.6);
  if (P.flex) {
    const bx = sh[0] + dx * 0.78,
      by = sh[1] + dy * 0.78 - 2 * P.flex;
    ellipse(g, bx, by, 3.2, 2.5 * P.flex + 0.4, C.edge);
    ellipse(g, bx, by + 0.2, 2.7, 2.1 * P.flex + 0.3, C.fur);
    ellipse(g, bx - 0.8, by - 0.6, 1.1, 0.6, '#c1b4a366');
  }
  // Raglan sleeve that follows the upper arm, with a white hem stripe like the jersey.
  const start = [sh[0] - ux * 1.4, sh[1] - uy * 1.4],
    end = [sh[0] + ux * 6, sh[1] + uy * 6];
  line(g, [start, end], C.royalDark, 9.2);
  line(g, [start, end], C.royal, 7.9);
  line(g, [[end[0] - uy * 3.7, end[1] + ux * 3.7], [end[0] + uy * 3.7, end[1] - ux * 3.7]], '#ffffffaa', 0.7);
  rowdyHand(g, arm, t, mir);
}

function rowdyFx(g, P, t) {
  if (P.fx === 'sparkle') {
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.6 + i * 0.5) % 1,
        s = i ? 1 : -1;
      g.globalAlpha = Math.sin(k * Math.PI);
      spark(g, s * (24 + i * 3), -66 - k * 6 + P.dip, '#fff1c3', 0.32 + 0.1 * Math.sin(k * Math.PI));
    }
    g.globalAlpha = 1;
  } else if (P.fx === 'hearts') {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.55 + i / 3) % 1;
      g.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      heart(g, -11 + i * 7 + Math.sin(t * 2 + i) * 2, -90 - k * 14, 0.38, i === 1 ? '#5e9cf0' : '#ef8f89');
    }
    g.globalAlpha = 1;
  } else if (P.fx === 'lines') {
    for (let i = 0; i < 3; i++) {
      const k = (t * 3 + i * 0.33) % 1,
        yy = -22 - i * 15;
      g.globalAlpha = 0.55 * (1 - k);
      line(g, [[-18 - k * 10, yy], [-27 - k * 12, yy]], '#ffffff', 1.4);
    }
    g.globalAlpha = 1;
  } else if (P.fx === 'rise') {
    g.globalAlpha = 0.6;
    for (const xx of [-8, 0, 8]) line(g, [[xx, 4 + (xx ? 0 : 2)], [xx, 10 + (xx ? 0 : 2)]], '#ffffff', 1.3);
    g.globalAlpha = 1;
  } else if (P.fx === 'swirl') {
    for (let i = 0; i < 2; i++) {
      path(
        g,
        p => {
          p.ellipse(0, -30 - i * 18, 21 + i * 4, 4.5, 0, t * 9 + i * 2, t * 9 + i * 2 + 2.2);
        },
        null,
        '#ffffffa6',
        1.2
      );
    }
  }
}

// Dust kicked up behind his heels (he faces +x here), on a clock so it never needs randomness.
function rowdyDust(g, t) {
  for (let i = 0; i < 4; i++) {
    const k = (t * 2.4 + i / 4) % 1;
    g.globalAlpha = (1 - k) * 0.5;
    ellipse(g, -8 - k * 24 - i * 2, -1 - k * 7, 2.4 + k * 4.2, 1.8 + k * 3.2, i % 2 ? '#d8cab3' : '#c4b499');
  }
  g.globalAlpha = 1;
}

// Rowdy, feet at (x, y). See the header for scale and opts.
function drawRowdy(g, x, y, scale = 1, pose = 'idle', t = 0, opts = {}) {
  const o = opts && typeof opts === 'object' ? opts : {},
    face = o.face < 0 ? -1 : 1,
    tt = Number.isFinite(t) ? t : 0,
    P = rowdyPose(ROWDY_POSES.includes(pose) ? pose : 'idle', tt, o);
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  if (o.shadow !== false) {
    const k = clamp(1 - P.lift / 60, 0.5, 1);
    shadow(g, 0, 1.5, 20 * k, 5 * k);
  }
  g.translate(0, -P.lift);
  g.scale(face * Math.max(0.14, Math.abs(P.spin)), 1);
  if (P.dust) rowdyDust(g, tt);
  for (const L of P.legs) rowdyLeg(g, L, P.dip);
  for (const L of P.legs) rowdyShoe(g, L.a[0], L.a[1], L.tilt, P.back ? -0.4 : L.s > 0 ? 0.5 : 0.2);
  rowdyShorts(g, P);
  g.save();
  g.translate(0, -27 + P.dip);
  g.rotate(P.lean);
  g.translate(0, 27 - P.dip);
  rowdyTorso(g, P, face);
  rowdyHead(g, P, tt);
  for (const arm of P.arms) rowdyArm(g, arm, P, tt, face);
  g.restore();
  rowdyFx(g, P, tt);
  g.restore();
}

// Speech-box bust centered in an s × s box at (x, y): horns, face, and the blue-and-white shoulders.
function drawRowdyPortrait(g, x, y, s = 44, t) {
  const tt = Number.isFinite(t) ? t : typeof time === 'number' ? time : 0,
    k = s / 44,
    P = rowdyPose('idle', tt);
  P.dip = 0;
  P.tilt = Math.sin(tt * 1.7 + 0.8) * 0.06;
  P.mouth = 0.8;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.beginPath();
  g.rect(-40, -40, 80, 62);
  g.clip();
  g.translate(0, 62.5);
  rowdyTorso(g, P, 1);
  P.head = [0.5, -66.5];
  rowdyHead(g, P, tt);
  g.restore();
}

// ---- Copy ----
// {name} is filled from state.name by rowdyFormat (default Macy). No em-dashes in the house voice.

const ROWDY_LINES = [
  // Ramsey spirit
  'We are... RAMSEY! We are... RAMSEY! Sorry. Hospital voice. We are... ramsey.',
  "Go Rams! That's it. That's the whole speech.",
  'Ramsey, New Jersey: small town, big horns, zero chill.',
  "I'm the only ram in Bergen County with a hall pass to this floor.",
  'Every Ram in Ramsey says hi. I counted. It took a while.',
  "Main Street sends its love. And a bagel. The bagel didn't make it.",
  'Rams never quit. We just take scheduled naps, like you.',
  'Blue and gold, baby. Mostly blue. Some gold. All heart.',
  "Once a Ram, always a Ram. It's in the paperwork.",
  "I've been head-butting bad vibes all day. The vibes are losing.",
  // Freshman year, the high school, the gym, the field, homecoming
  'Freshman year and you already have a mascot making house calls. Legend.',
  'Most freshmen get lost finding the gym. You found a whole new building. Overachiever.',
  'Seniors wish they had a mascot escort. Just saying.',
  'Homecoming is not homecoming until you come home. That is the rule now. I made it.',
  'The gym is too quiet without you. Someone dropped a ball and it echoed for an hour.',
  "Your locker misses you. I asked. It said 'clang.' Very emotional locker.",
  'The field is saving your spot. I told the grass to stay off it.',
  'Ramsey High pep rally, {name} edition. Attendance: one ram. Energy: entire stadium.',
  'The bleachers are practicing your name. They keep squeaking it wrong.',
  'The school store sold out of blue and gold. Coincidence? I bought it all. For you.',
  // Volleyball
  "Dig it. Set it. SPIKE it. Then nap. That's the {name} method.",
  'Best platform on the team. Forearms of steel. Spirit of even more steel.',
  'Volleyball rule: never let it hit the floor. Hospital rule: same, but with jello.',
  'The serve line misses you. Coach told me. Coach got a little misty.',
  'Side out, sickness. Our ball.',
  'That gremlin just got blocked. ROOF! Somebody put it on the jumbotron.',
  'Your jump serve is in the trophy case of my heart. Next to my other jump serve memories.',
  // Softball
  'Batter up! The batter is you. The ball is your gut. Knock it out of the park. Gently.',
  'Softball season is coming and so are you. Keep those cleats warm.',
  "Safe at home! The ump said so. I'm the ump now.",
  'Swing, connect, run. Okay, walk. Okay, rest. Still counts as a base.',
  'Two outs, bottom of the seventh, {name} steps up. The crowd goes wild. The crowd is me.',
  "Rally caps on! I don't have a cap. I have horns. Rally horns!",
  'You throw like a varsity starter and recover like one too. Freshman my hoof.',
  // The hospital floor
  'This floor has the best spirit in the building and I checked all of them.',
  'The nurses are the real MVPs. I gave them foam fingers. They said no foam on the ward.',
  "I tried to start a wave in the cafeteria. One guy stood up. It was the cook. I'll take it.",
  "Hallway rules: no running. I'm galloping. Totally different.",
  'Every beep on this floor is a tiny cheer if you squint.',
  "The elevator dinged when you walked by. That's applause in elevator.",
  "IV pole? More like IV POLE VAULT. It's an event now. You're winning it.",
  "The nurses' station is my home base. Your room is the stadium.",
  'I did a lap of the ward. Three nurses, two doctors and a mop cheered. The mop was loudest.',
  // Mascot life
  "I can't see out of this head. If I'm cheering at a fire extinguisher, let me have it.",
  'It is four thousand degrees in this suit and I would not trade it for anything.',
  "I high-fived a doctor by accident. She high-fived back. We're a team now.",
  "Hydration check! Drink some water. I'll drink some too, through a very small hole.",
  'My horns got stuck in the elevator door. Worth it. Totally worth it.',
  "Somebody asked if I'm a goat. I'm a RAM. Goats wish.",
  "I sweat spirit. That's the official story and I'm sticking to it.",
  'I waved at a mirror for ten minutes. Great guy. Very supportive.',
  "My hands are mittens. My mittens are hands. Don't ask how I text.",
  'The suit smells like victory. Victory needs a wash.',
  'Head too big for the revolving door. I just went around a few extra times. Cardio!',
  // Get well hype
  'Every day you get one day closer to the bleachers. Then the court. Then trouble.',
  'Heal fast, heal strong, heal Ramsey style.',
  'Your gut picked a fight with the wrong freshman.',
  'Rest is a power move. Champions rest. Then they come back and win everything.',
  "You've got a whole town in your corner. Plus one ram in your hallway.",
  "Tough days count double. You're racking up points.",
  'You are getting better and I will not hear otherwise.',
  "If courage were a stat, you'd break the scoreboard.",
  "Bad days don't get a cheer. You get all the cheers.",
  "Ramsey doesn't do quiet. Get loud when you're ready. I'll be loud until then.",
  "Gremlins? On MY floor? Not while you're on the roster.",
  "I'm proud of you. Ram-proud. That's regular proud with horns.",
  'Rams charge forward. You are charging forward too. A little slower. Still counts.',
  'Keep fighting, keep laughing, keep your blanket tucked. Champ.'
];

const ROWDY_GREETS = [
  "THERE she is! Ramsey's own, back in the hallway!",
  'Clear the hallway! Star freshman coming through!',
  "{name}! I saved you a spot at the nurses' station!",
  'Hey hey! Your personal pep rally has arrived.',
  'Ladies and gentlemen and nurses, number one in your hearts: {name}!'
];

const ROWDY_FAREWELLS = [
  "Okay! I'll keep the spirit warm for you.",
  "Go get 'em! I'll be right here. Bouncing.",
  'Bye! That was a great cheer you only half saw!',
  "Rams don't say goodbye. We say Go Rams!",
  "I'll finish that cheer later. It has a big ending. Trust me."
];

// Lines that react to progress; rowdyStateLines picks the ones that fit right now.
const ROWDY_STATE_LINES = {
  noClears: 'No wards cleared yet? Perfect. Every great season starts zero and zero.',
  someClears: '{n} ward clean-ups! The gremlins are filing complaints at the front desk.',
  oneClear: 'One ward clean-up! The gremlins are filing complaints at the front desk.',
  manyClears: '{n} ward clean-ups. At this point the gremlins should just transfer schools.',
  noMedals: 'The arcade has medals with your name on them. Well, not yet. Go fix that.',
  medal: 'A medal! Bronze is just gold that is still warming up.',
  gold: 'Gold medal! I am getting it engraved on my horns.',
  golds: '{n} gold medals! The trophy case called. It needs a bigger trophy case.',
  ralph: "Word on the floor: Ralph is guarding the exit. Ralph has never met Ramsey.",
  ralphDown: 'RALPH. You are going DOWN. Politely. Then not politely.',
  beatRalph: "You beat Ralph! I'd do a backflip but the head would fall off.",
  won: 'You WON. Ramsey is throwing a parade. It is me. I am the parade.',
  wonPapers: 'Discharge papers? That is a diploma in being awesome.'
};

// A cheer is 3 to 5 bubbles, each with the pose he holds while it shows. when: 'ralphReady' runs
// only while Ralph guards the exit (state.ralphReady and not state.ralph); 'won' only after the win.
const ROWDY_CHEERS = [
  {
    id: 'ramsey',
    name: 'R-A-M-S-E-Y',
    bubbles: [
      { text: 'Gimme an R! Gimme an A!', pose: 'cheer' },
      { text: 'Gimme an M! Gimme an S!', pose: 'jump' },
      { text: 'Gimme an E! Gimme a Y!', pose: 'cheer' },
      { text: "What's that spell? RAMSEY!", pose: 'point' },
      { text: 'Louder, for the nurses! RAMSEY!', pose: 'spin' }
    ]
  },
  {
    id: 'get-well',
    name: 'Get well',
    bubbles: [
      { text: "Who's getting better?", pose: 'point' },
      { text: "{name}'s getting better!", pose: 'cheer' },
      { text: "Who's going home?", pose: 'point' },
      { text: "{name}'s going HOME!", pose: 'jump' },
      { text: 'Get well, get well, get WELL!', pose: 'flex' }
    ]
  },
  {
    id: 'two-bits',
    name: 'Two bits',
    bubbles: [
      { text: 'Two bits! Four bits!', pose: 'cheer' },
      { text: 'Six bits! A dollar!', pose: 'jump' },
      { text: 'All for {name}, stand up and holler!', pose: 'hug' },
      { text: "Or lie down and holler. Doctor's orders.", pose: 'wave' }
    ]
  },
  {
    id: 'ralph',
    name: "Ralph's going down",
    when: 'ralphReady',
    bubbles: [
      { text: 'Hey hey, exit guard! Yeah, you!', pose: 'point' },
      { text: "RALPH, you're going DOWN!", pose: 'flex' },
      { text: 'Down like a spike on an open net!', pose: 'jump' },
      { text: 'Ramsey takes the W! Then a nap!', pose: 'cheer' }
    ]
  },
  {
    id: 'spirit',
    name: 'We got spirit',
    bubbles: [
      { text: 'We got spirit, yes we do!', pose: 'cheer' },
      { text: 'We got spirit, how about you?', pose: 'point' },
      { text: "A nurse said 'shh.' That counts as a cheer!", pose: 'hug' }
    ]
  },
  {
    id: 'volleyball',
    name: 'Bump, set, spike',
    bubbles: [
      { text: 'Bump it! Set it!', pose: 'cheer' },
      { text: 'SPIKE IT!', pose: 'jump' },
      { text: '{name} owns the net!', pose: 'flex' },
      { text: 'Gremlins, that was a kill. Look it up.', pose: 'point' }
    ]
  },
  {
    id: 'softball',
    name: 'Batter up',
    bubbles: [
      { text: 'Hey batter batter!', pose: 'point' },
      { text: 'Swing for the fences!', pose: 'spin' },
      { text: 'Round the bases, Ramsey style!', pose: 'gallop' },
      { text: 'Home run, {name}!', pose: 'cheer' }
    ]
  },
  {
    id: 'blue-gold',
    name: 'Blue and gold',
    bubbles: [
      { text: 'Blue and gold!', pose: 'cheer' },
      { text: 'Brave and bold!', pose: 'flex' },
      { text: 'Ramsey Rams never fold!', pose: 'jump' }
    ]
  },
  {
    id: 'gremlins-out',
    name: 'Gremlins out',
    bubbles: [
      { text: 'Gremlins out! Gremlins out!', pose: 'point' },
      { text: 'This hallway is a Ram zone!', pose: 'flex' },
      { text: 'Bring your goo, we bring the GOATs!', pose: 'cheer' },
      { text: 'Rams. We bring the Rams. Wrong animal. Still winning!', pose: 'wave' }
    ]
  },
  {
    id: 'victory',
    name: 'Victory lap',
    when: 'won',
    bubbles: [
      { text: 'Who beat the gut?', pose: 'point' },
      { text: '{name} beat the gut!', pose: 'jump' },
      { text: 'Victory lap! Everybody out of the hallway!', pose: 'gallop' },
      { text: 'Ramsey forever! Go Rams!', pose: 'spin' }
    ]
  }
];

function rowdyFormat(text, st, n) {
  const name = st && typeof st.name === 'string' && st.name.trim() ? st.name.trim() : 'Macy';
  return String(text)
    .replace(/\{name\}/g, name)
    .replace(/\{n\}/g, String(n ?? ''));
}

// Extra lines for the current progress (already formatted).
function rowdyStateLines(st = {}) {
  const L = ROWDY_STATE_LINES,
    out = [],
    clears = (Array.isArray(st.wardClears) ? st.wardClears : []).reduce((a, b) => a + (Number(b) || 0), 0),
    medals = (Array.isArray(st.medals) ? st.medals : []).flat(),
    golds = medals.filter(m => m >= 3).length,
    any = medals.some(m => m > 0);
  if (clears === 0) out.push(L.noClears);
  else if (clears === 1) out.push(L.oneClear);
  else out.push(rowdyFormat(clears >= 4 ? L.manyClears : L.someClears, st, clears));
  if (golds > 1) out.push(rowdyFormat(L.golds, st, golds));
  else if (golds === 1) out.push(L.gold);
  else out.push(any ? L.medal : L.noMedals);
  if (st.won) out.push(L.won, L.wonPapers);
  else if (st.ralph) out.push(L.beatRalph);
  else if (st.ralphReady) out.push(L.ralph, L.ralphDown);
  return out.map(text => rowdyFormat(text, st));
}

// One line to say when Macy talks to him: progress-aware about a third of the time.
function rowdyLine(st = {}) {
  const extra = rowdyStateLines(st);
  if (extra.length && rand(0, 1) < 0.34) return pick(extra);
  return rowdyFormat(pick(ROWDY_LINES), st);
}

function rowdyCheerOk(cheer, st = {}) {
  if (cheer.when === 'ralphReady') return !!st.ralphReady && !st.ralph && !st.won;
  if (cheer.when === 'won') return !!st.won;
  return true;
}

// The next cheer. Ralph's cheer and the victory lap jump the queue half the time they apply.
function rowdyPickCheer(st = {}) {
  const special = ROWDY_CHEERS.filter(c => c.when && rowdyCheerOk(c, st));
  if (special.length && rand(0, 1) < 0.5) return pick(special);
  return pick(ROWDY_CHEERS.filter(c => !c.when));
}

// Seconds a bubble stays up: longer text, longer hold.
function rowdyBubbleTime(text) {
  return clamp(1.1 + String(text).length * 0.035, 1.4, 2.8);
}

// ---- Reference brain (optional) ----
// The hallway may run its own NPC logic from the spec; rowdyTick is a working version of the notes.
// npc: {x, y} plus fields this fills in (mode, pose, face, say...). env: {macy: {x, y} or null,
// entered: true on the frame Macy walks into the hallway, st: state, bounds: [left, right] of the
// hallway (default [80, 3120]), home: [x, y] (default npc.homeX, npc.homeY)}. Returns {text, pose}
// on the frame a new speech bubble starts (play sfx('talk', {voice: 'rowdy'}) then), otherwise null.
//
// He never moves toward Macy. He stays home by the nurses' station, faces her, and cheers on his
// timer. Now and then he does a run-through: a sprint from home to the far end of the hallway, poms
// up, screaming a cheer in bursts, then a jog back home. The first one comes 20 to 40 s after she
// walks in (env.entered), then one every 100 to 160 s while she is in the hallway. His path depends
// only on his home and the bounds, never on where she stands.

const ROWDY_TIMING = {
  autoCheer: [40, 70],
  // true: a timer cheer waits for Macy inside the watch radius. false: he cheers to an empty hallway.
  cheerOnlyWatched: false,
  runFirst: [20, 40],
  runEvery: [100, 160],
  sprintSpeed: 340,
  jogSpeed: 150,
  homeSpeed: 120,
  watchRadius: 260,
  leaveRadius: 300,
  sad: 1,
  recover: 1.6
};

const ROWDY_BOUNDS = [80, 3120];

// Run-through cheers: screamed in order, one burst per stretch of the sprint.
const ROWDY_RUN_CHEERS = [
  ['RAMS!', 'R! A! M! S!', "LET'S GO RAMSEY!"],
  ['WHO ARE WE?', 'RAMS!', 'WHO ARE WE?', 'RAMSEY!'],
  ['HORNS UP!', 'BLUE AND GOLD!', 'GO {name} GO!', 'RAMS!'],
  ['MAKE SOME NOISE!', 'R! A! M! S!', 'ONE, TWO, THREE, RAMSEY!'],
  ['NO RUNNING IN THE HALLWAY!', 'THIS IS GALLOPING!', 'GO RAMS!'],
  ['CODE BLUE AND GOLD!', 'THIS IS NOT A DRILL!', 'IT IS A SPIRIT DRILL!', 'RAMS!'],
  ['{name}! {name}!', "LET'S GO RAMSEY!", 'WE ARE... RAMSEY!']
];

function rowdySay(npc, text, pose, hold) {
  npc.say = text;
  npc.pose = pose;
  npc.timer = hold;
  return { text, pose };
}

function rowdyStartCheer(npc, st) {
  const ralphFirst = st.ralphReady && !st.ralph && !st.won && !npc.ralphCheered;
  npc.cheer = ralphFirst ? ROWDY_CHEERS.find(c => c.id === 'ralph') : rowdyPickCheer(st);
  if (npc.cheer.id === 'ralph') npc.ralphCheered = true;
  npc.bubble = 0;
  npc.mode = 'cheer';
  npc.watched = false;
  npc.lastDist = undefined;
  const b = npc.cheer.bubbles[0],
    text = rowdyFormat(b.text, st);
  return rowdySay(npc, text, b.pose, rowdyBubbleTime(text));
}

// Off he goes: to the end of the hallway farther from home, with a cheer he did not do last time.
function rowdyStartRun(npc, bounds) {
  const T = ROWDY_TIMING,
    [left, right] = bounds,
    far = Math.abs(npc.homeX - left) > Math.abs(right - npc.homeX) ? left : right;
  let i = Math.floor(rand(0, ROWDY_RUN_CHEERS.length)) % ROWDY_RUN_CHEERS.length;
  if (i === npc.runLast) i = (i + 1) % ROWDY_RUN_CHEERS.length;
  npc.runLast = i;
  npc.run = { from: npc.x, to: far, y: npc.homeY, bursts: ROWDY_RUN_CHEERS[i], next: 0 };
  npc.mode = 'run';
  npc.cheer = null;
  npc.say = null;
  npc.timer = 0;
  npc.runs = (npc.runs || 0) + 1;
  npc.nextRun = rand(T.runEvery[0], T.runEvery[1]);
}

// One frame of the sprint: on toward the far end, and the next burst once he reaches its stretch.
function rowdyRunStep(npc, dt, st) {
  const T = ROWDY_TIMING,
    R = npc.run,
    total = Math.abs(R.to - R.from) || 1,
    n = R.bursts.length,
    dx = R.to - npc.x,
    step = T.sprintSpeed * dt;
  npc.pose = 'gallop';
  npc.face = R.to >= R.from ? 1 : -1;
  if (Math.abs(dx) <= step) npc.x = R.to;
  else npc.x += Math.sign(dx) * step;
  npc.y += (R.y - npc.y) * Math.min(1, dt * 6);
  if (npc.timer > 0) {
    npc.timer -= dt;
    if (npc.timer <= 0) npc.say = null;
  }
  if (R.next < n && Math.abs(npc.x - R.from) / total >= R.next / n) {
    const text = rowdyFormat(R.bursts[R.next], st),
      stretch = total / n / T.sprintSpeed;
    R.next++;
    return rowdySay(npc, text, 'gallop', clamp(Math.min(rowdyBubbleTime(text), stretch), 0.6, 2.8));
  }
  if (npc.x === R.to) {
    npc.run = null;
    npc.mode = 'home';
    npc.say = null;
    npc.timer = 0;
  }
  return null;
}

function rowdyTick(npc, dt, env = {}) {
  const T = ROWDY_TIMING,
    st = env.st || {},
    macy = env.macy || null,
    bounds = Array.isArray(env.bounds) && env.bounds.length === 2 ? env.bounds : ROWDY_BOUNDS;
  if (Array.isArray(env.home) && env.home.length === 2) {
    npc.homeX = env.home[0];
    npc.homeY = env.home[1];
  }
  if (npc.homeX === undefined) npc.homeX = npc.x;
  if (npc.homeY === undefined) npc.homeY = npc.y;
  npc.mode ??= 'idle';
  npc.pose ??= 'idle';
  npc.face ??= 1;
  npc.timer ??= 0;
  npc.say ??= null;
  npc.nextCheer ??= rand(T.autoCheer[0], T.autoCheer[1]);
  const d = macy ? Math.hypot(macy.x - npc.x, macy.y - npc.y) : Infinity,
    seeMacy = () => {
      if (macy && Math.abs(macy.x - npc.x) > 2) npc.face = macy.x > npc.x ? 1 : -1;
    };
  // A new visit books the first run-through. The clock only runs while she is in the hallway, and a
  // run that comes due mid-cheer or mid-talk waits for him to be idle at home.
  if (env.entered && macy) npc.nextRun = rand(T.runFirst[0], T.runFirst[1]);
  else if (macy && Number.isFinite(npc.nextRun)) npc.nextRun -= dt;
  if (npc.mode === 'run') {
    if (npc.run) return rowdyRunStep(npc, dt, st);
    npc.mode = 'home';
  }
  if (npc.mode === 'home') {
    const dx = npc.homeX - npc.x,
      dy = npc.homeY - npc.y,
      len = Math.hypot(dx, dy),
      step = T.jogSpeed * dt;
    npc.pose = 'gallop';
    if (Math.abs(dx) > 1) npc.face = dx > 0 ? 1 : -1;
    if (len <= step || len < 2) {
      npc.x = npc.homeX;
      npc.y = npc.homeY;
      npc.mode = 'idle';
      npc.pose = 'idle';
      return null;
    }
    npc.x += (dx / len) * step;
    npc.y += (dy / len) * step;
    return null;
  }
  if (npc.mode === 'cheer') {
    seeMacy();
    if (d <= T.watchRadius) npc.watched = true;
    const leaving = npc.watched && d > T.leaveRadius && d > (npc.lastDist ?? d);
    npc.lastDist = d;
    if (leaving) {
      npc.mode = 'sad';
      npc.say = null;
      npc.pose = 'sad';
      npc.timer = T.sad;
      return null;
    }
    npc.timer -= dt;
    if (npc.timer > 0) return null;
    npc.bubble++;
    if (npc.bubble >= npc.cheer.bubbles.length) {
      npc.mode = 'idle';
      npc.pose = 'idle';
      npc.say = null;
      npc.cheer = null;
      npc.nextCheer = rand(T.autoCheer[0], T.autoCheer[1]);
      return null;
    }
    const b = npc.cheer.bubbles[npc.bubble],
      text = rowdyFormat(b.text, st);
    return rowdySay(npc, text, b.pose, rowdyBubbleTime(text));
  }
  if (npc.mode === 'sad') {
    npc.timer -= dt;
    if (npc.timer > 0) return null;
    npc.mode = 'recover';
    npc.cheer = null;
    npc.nextCheer = rand(T.autoCheer[0], T.autoCheer[1]);
    return rowdySay(npc, rowdyFormat(pick(ROWDY_FAREWELLS), st), 'wave', T.recover);
  }
  if (npc.mode === 'greet' || npc.mode === 'recover' || npc.mode === 'talk') {
    seeMacy();
    npc.timer -= dt;
    if (npc.timer > 0) return null;
    npc.mode = 'idle';
    npc.pose = 'idle';
    npc.say = null;
    return null;
  }
  // Idle: bounce at the nurses' station and face Macy. Off his spot (a talk cut a run short), jog home.
  npc.pose = 'idle';
  if (d < 400) seeMacy();
  if (Math.hypot(npc.x - npc.homeX, npc.y - npc.homeY) > 4) {
    npc.mode = 'home';
    return null;
  }
  if (macy && npc.nextRun <= 0) {
    rowdyStartRun(npc, bounds);
    return rowdyRunStep(npc, 0, st);
  }
  npc.nextCheer -= dt;
  if (npc.nextCheer <= 0) {
    if (T.cheerOnlyWatched && d > T.watchRadius) {
      npc.nextCheer = 0;
      return null;
    }
    return rowdyStartCheer(npc, st);
  }
  return null;
}

// Macy talks to him: one line, a pose to match, and the bubble hold. Interrupts a cheer politely.
function rowdyTalk(npc, st = {}) {
  npc.mode = 'talk';
  npc.cheer = null;
  const text = rowdyLine(st);
  return rowdySay(npc, text, pick(['cheer', 'point', 'flex', 'hug', 'wave']), rowdyBubbleTime(text) + 0.6);
}

// ---- Cast spec for the hallway ----
function rowdyNpcSpec() {
  return {
    // Stable cast id.
    id: 'rowdy',
    // Name plate for his speech bubble.
    name: 'Rowdy the Ram',
    // Speech blips: sfx('talk', { voice: 'rowdy' }) as each bubble starts.
    voice: 'rowdy',
    // Draws him at npc.x, npc.y (feet). Reads npc.pose (one of poses), npc.face (1 or -1),
    // npc.scale (default scale) and npc.prop ('flag' for a spirit flag in the cheer pose).
    // On a run-through (npc.mode 'run') the gallop goes poms up with dust behind.
    draw: (g, npc, t) =>
      drawRowdy(g, npc.x, npc.y, npc.scale || ROWDY_SCALE, npc.pose || 'idle', t, {
        face: npc.face || 1,
        prop: npc.prop,
        poms: npc.mode === 'run',
        dust: npc.mode === 'run'
      }),
    // Speech-box bust in an s × s box centered at (x, y); t optional (falls back to the ward clock).
    portrait: (g, x, y, s, t) => drawRowdyPortrait(g, x, y, s, t),
    // Drawn height in world units at the default scale: bubble anchor is y - height.
    height: Math.round(ROWDY_HEIGHT * ROWDY_SCALE),
    // Default draw scale (Macy is 1.24) and the unscaled design height.
    scale: ROWDY_SCALE,
    baseHeight: ROWDY_HEIGHT,
    // Feet-to-feet footprint radius for collision or spacing, in world units at the default scale.
    radius: 22,
    // Every pose drawRowdy knows.
    poses: ROWDY_POSES.slice(),
    // How he spends his day. He bounces at the nurses' station and never walks toward Macy; runs a
    // random cheer every 40 to 70 s even when nobody is talking to him; 20 to 40 s after she walks in,
    // then every 100 to 160 s, sprints to the far end of the hallway screaming a cheer in bursts and
    // jogs home; and if she walks away mid-cheer he holds 'sad' for a second, then a farewell wave.
    behavior: 'cheer',
    home: 'nurses-station',
    idlePose: 'idle',
    timing: { ...ROWDY_TIMING, autoCheer: ROWDY_TIMING.autoCheer.slice() },
    // General lines (use {name}); format with format(text, state).
    lines: ROWDY_LINES.slice(),
    // Bubble sequences: {id, name, when?, bubbles: [{text, pose}]}; see ROWDY_CHEERS for when.
    cheers: ROWDY_CHEERS.map(c => ({ ...c, bubbles: c.bubbles.map(b => ({ ...b })) })),
    // Welcome lines (the brain no longer uses them; free for the hallway) and walk-away lines.
    greet: ROWDY_GREETS.slice(),
    farewell: ROWDY_FAREWELLS.slice(),
    // Run-through bursts: [[text, ...], ...], screamed in order across the sprint.
    runCheers: ROWDY_RUN_CHEERS.map(c => c.slice()),
    // Helpers: state-aware lines, one talk line, cheer choice and eligibility, {name} fill.
    react: rowdyStateLines,
    line: rowdyLine,
    pickCheer: rowdyPickCheer,
    cheerOk: rowdyCheerOk,
    format: rowdyFormat,
    bubbleTime: rowdyBubbleTime,
    // Optional working brain: tick(npc, dt, env) and talk(npc, state). See rowdyTick.
    tick: rowdyTick,
    talk: rowdyTalk
  };
}
