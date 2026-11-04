// Resolution-independent illustration. Coordinates stay fractional all the way to the GPU.
function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function poly(g, pts, col) {
  g.fillStyle = col;
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
  g.closePath();
  g.fill();
}

function ellipse(g, x, y, rx, ry, col) {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  g.fill();
}

function rr(g, x, y, w, h, r, fill, stroke = null, lw = 1) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

function gradient(g, x, y, w, h, a, b) {
  let z = g.createLinearGradient(x, y, x + w, y + h);
  z.addColorStop(0, a);
  z.addColorStop(1, b);
  return z;
}

function path(g, fn, fill, stroke = null, width = 1) {
  g.beginPath();
  fn(g);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }
}

function line(g, pts, col, w = 2) {
  path(g, p => pts.forEach((v, i) => (i ? p.lineTo(...v) : p.moveTo(...v))), null, col, w);
}

function label(g, t, x, y, size = 12, color = '#29434d', align = 'left') {
  g.fillStyle = color;
  g.font = `700 ${size}px "Trebuchet MS", Arial, sans-serif`;
  g.textAlign = align;
  g.fillText(t, x, y);
  g.textAlign = 'left';
}

function spark(g, x, y, col = '#fff1c3', s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  path(
    g,
    p => {
      p.moveTo(0, -10);
      p.quadraticCurveTo(2, -2, 10, 0);
      p.quadraticCurveTo(2, 2, 0, 10);
      p.quadraticCurveTo(-2, 2, -10, 0);
      p.quadraticCurveTo(-2, -2, 0, -10);
    },
    col
  );
  g.restore();
}

function shadow(g, x, y, w = 24, h = 7) {
  ellipse(g, x, y, w, h, '#14374d24');
  ellipse(g, x, y, w * 0.72, h * 0.65, '#14374d17');
}

function heart(g, x, y, s = 1, col = '#ef8f89') {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  path(
    g,
    p => {
      p.moveTo(7, 13);
      p.bezierCurveTo(-9, 3, 1, -6, 7, 1);
      p.bezierCurveTo(13, -6, 23, 3, 7, 13);
    },
    col
  );
  g.restore();
}

function glow(g, x, y, r, col) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, col);
  grd.addColorStop(1, 'transparent');
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function panel(g, x, y, w, h, col = '#244853', edge = '#4d7e83') {
  rr(g, x, y, w, h, Math.min(15, h / 2), gradient(g, x, y, 0, h, col, '#193c4c'), edge, 1.2);
  if (h > 14) line(g, [[x + 12, y + 3], [x + w - 12, y + 3]], '#daf0d31a', 1);
}

// Macy's outfit. girl() reads it on every draw: the shop's wardrobe (state.cosmetics.worn), or
// girlLookOverride while a preview paints a look she has not bought yet.
const MACY_HOODIE = ['#a5e2c9', '#5bb9ac', '#398c88', '#4caaa2', '#3e9d96'],
  MACY_VARSITY = ['#c9b0ec', '#7d5bbd', '#553a8e', '#7a58b8', '#e8c35a'];

let girlLookOverride = null;

function macyLook() {
  if (girlLookOverride) return girlLookOverride;
  const worn = state.cosmetics?.worn || [];
  return {
    hoodie: worn.includes('look-hoodie') ? MACY_VARSITY : MACY_HOODIE,
    scrunchie: worn.includes('look-scrunchie') ? '#f3ec4f' : '#f1abbd',
    socks: worn.includes('look-socks') ? 'stitch' : ''
  };
}

// ---- Macy's poses ----
// An act is { kind, t }: kind names a pose below, t is seconds into it. girl() turns it into a rig of
// small offsets (arms, eyes, mouth, head, a prop). Idles play in the ward when she stands still;
// reactions play on a hit, a cleared wave and a medal; greetings play next to the visitors in the
// hallway (macyGreet in world.js). act.len, when set, stretches a pose to that many seconds.
// With no act, she stands in her plain resting pose.
const MACY_IDLES = ['look', 'ball', 'scrunchie', 'dance', 'yawn', 'iv'],
  MACY_GREETS = ['hug', 'fistbump', 'selfie', 'highfive', 'wave'],
  MACY_POSES = {
    look: 2.6,
    scrunchie: 2.2,
    ball: 2.7,
    yawn: 2.4,
    iv: 2.4,
    dance: 2.8,
    flinch: 0.4,
    pump: 1.3,
    grin: 2.4,
    hug: 2.4,
    fistbump: 1.4,
    selfie: 2.6,
    highfive: 1.2,
    wave: 1.8
  };

// 0 before a, 1 after b, smooth in between.
function macyEase(t, a, b) {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
}

// In over the first inT seconds, out over the last outT.
function macyEnvelope(t, len, inT = 0.3, outT = 0.35) {
  return macyEase(t, 0, inT) * (1 - macyEase(t, len - outT, len));
}

const macyMix = (a, b, k) => a + (b - a) * k;

// A hand position blended from the resting arm (side, no swing) toward a target.
function macyArm(side, k, hx, hy, cx, cy, extra = {}) {
  return {
    x: macyMix(side * 17, hx, k),
    y: macyMix(-28, hy, k),
    cx: macyMix(side * 19, cx, k),
    cy: macyMix(-38, cy, k),
    ...extra
  };
}

// The volleyball bounce: the ball's y at phase p of one bounce (0 and 1 in her hands, 0.5 on the floor).
function macyBallY(p) {
  const s = Math.abs(1 - 2 * p);
  return -6.5 - 26.5 * (2 * s - s * s);
}

function macyRig(act, dir, flip = 1) {
  const kind = act.kind,
    len = act.len > 0 ? act.len : MACY_POSES[kind] || 1,
    t = clamp(Number.isFinite(act.t) ? act.t : 0, 0, len),
    back = -dir,
    rig = { arms: [null, null] };
  if (kind === 'look') {
    const lx = -1.5 * macyEase(t, 0, 0.3) + 3 * macyEase(t, 1, 1.35) - 1.5 * macyEase(t, 2.1, 2.5);
    rig.lookX = lx;
    rig.headDx = lx * 0.75;
    return rig;
  }
  if (kind === 'scrunchie') {
    const k = macyEnvelope(t, len, 0.35, 0.4),
      tug = Math.sin(t * 17) * 0.9 * macyEase(t, 0.4, 0.55) * (1 - macyEase(t, 1.6, 1.75)),
      side = back < 0 ? 0 : 1;
    rig.arms[side] = macyArm(back, k, back * 15.5, -79 + tug, back * 27, -64, { top: true });
    rig.scrunchieDy = tug * 0.8;
    rig.lookX = back * 0.9 * k;
    rig.lookY = -0.7 * k;
    rig.mouth = k > 0.5 ? 'flat' : null;
    return rig;
  }
  if (kind === 'ball') {
    const k = macyEnvelope(t, len, 0.3, 0.35),
      bounces = t > 0.3 && t < 2.16,
      p = bounces ? ((t - 0.3) / 0.62) % 1 : 0,
      ballY = bounces ? macyBallY(p) : -33,
      catchY = -31 + (bounces ? 2.2 * Math.max(0, 1 - Math.abs(1 - 2 * p) * 3) : 0);
    rig.arms[0] = macyArm(-1, k, -5, catchY, -16, -38, { front: true });
    rig.arms[1] = macyArm(1, k, 9, catchY, 18, -38, { front: true });
    rig.lookY = 1.4 * clamp((ballY + 33) / 26.5, 0, 1) * k;
    rig.lookX = -0.3 * k;
    rig.prop = g => {
      g.save();
      g.globalAlpha *= clamp(k * 1.4, 0, 1);
      const squash = bounces && ballY > -8.5 ? 0.8 : 1;
      g.translate(2, ballY + 6.5 * (1 - squash));
      g.scale(1 / squash, squash);
      volleyball(g, 0, 0, 6.5, t * 5);
      g.restore();
    };
    return rig;
  }
  if (kind === 'yawn') {
    const k = macyEnvelope(t, len, 0.45, 0.5),
      open = macyEase(t, 0.3, 0.6) * (1 - macyEase(t, 1.4, 1.75));
    rig.arms[0] = macyArm(-1, k, -9, -99, -25, -72);
    rig.arms[1] = macyArm(1, k, 10, -99, 26, -72);
    rig.sy = 1 + 0.035 * k;
    rig.mouth = open > 0.15 ? 'o' : null;
    rig.mouthSize = open;
    rig.eyes = open > 0.3 ? 'shut' : null;
    rig.browY = -1.2 * open;
    return rig;
  }
  if (kind === 'iv') {
    const k = macyEnvelope(t, len, 0.35, 0.4),
      tap = Math.sin(t * 15) * macyEase(t, 0.8, 0.9) * (1 - macyEase(t, 1.5, 1.6)),
      ok = macyEase(t, 1.65, 1.8) * (1 - macyEase(t, 2.15, 2.3));
    rig.arms[1] = macyArm(1, k, 6, -41, 21, -35, { front: true });
    rig.arms[0] = macyArm(-1, k, tap * 1.2, -43 - Math.abs(tap) * 1.2, -15, -34, { front: true });
    rig.lookX = 0.7 * k;
    rig.lookY = 1.5 * k;
    rig.headDy = 0.9 * k;
    rig.mouth = ok > 0 ? 'smile' : k > 0.5 ? 'flat' : null;
    rig.prop = g => {
      if (k <= 0) return;
      g.save();
      g.globalAlpha *= 0.75 * k;
      path(
        g,
        q => {
          q.moveTo(8, -40);
          q.bezierCurveTo(17, -46, 15, -70, 28, -96);
        },
        null,
        '#e8f4ee',
        1.4
      );
      g.restore();
      if (ok > 0) {
        g.save();
        g.globalAlpha *= ok;
        line(g, [[13, -56], [15.5, -53], [20, -59]], '#7fd6a0', 1.8);
        g.restore();
      }
    };
    return rig;
  }
  if (kind === 'dance') {
    const k = macyEnvelope(t, len, 0.25, 0.3),
      beat = Math.sin(t * Math.PI * 4),
      up = Math.abs(beat);
    rig.walk = beat * 0.75 * k;
    rig.dx = beat * 2 * k;
    rig.dy = -up * 1.6 * k;
    rig.lean = beat * 0.05 * k;
    rig.arms[0] = macyArm(-1, k, -15 + beat * 2, -41 - Math.max(0, -beat) * 5, -21, -44);
    rig.arms[1] = macyArm(1, k, 15 + beat * 2, -41 - Math.max(0, beat) * 5, 21, -44);
    rig.eyes = k > 0.4 ? 'happy' : null;
    rig.mouth = k > 0.4 ? 'smile' : null;
    rig.tail = beat * 4 * k;
    rig.prop = g => {
      for (let i = 0; i < 2; i++) {
        const q = (t * 0.7 + i * 0.5) % 1;
        g.save();
        g.globalAlpha *= k * Math.sin(q * Math.PI);
        // Notes read the right way round in a mirrored frame (flip is its x sign on screen).
        g.translate(back * (18 + q * 8) + i * dir * 30, -84 - q * 22);
        g.scale(flip, 1);
        label(g, i ? '♫' : '♪', 0, 0, 10, '#fff3c4', 'center');
        g.restore();
      }
    };
    return rig;
  }
  if (kind === 'flinch') {
    const k = 1 - macyEase(t, 0.12, len);
    rig.sy = 1 - 0.07 * k;
    rig.dx = back * 2.5 * k;
    rig.lean = back * 0.09 * k;
    rig.arms[0] = macyArm(-1, k, -7, -43, -17, -36, { front: true });
    rig.arms[1] = macyArm(1, k, 8, -44, 18, -36, { front: true });
    rig.eyes = 'squeeze';
    rig.mouth = 'wince';
    return rig;
  }
  if (kind === 'pump') {
    const k = macyEnvelope(t, len, 0.14, 0.28),
      pump = Math.abs(Math.sin(t * 7.5)) * k,
      side = dir < 0 ? 0 : 1;
    rig.arms[side] = macyArm(dir, k, dir * 19, -86 - pump * 7, dir * 26, -58, { fist: true });
    rig.dy = -pump * 3;
    rig.eyes = 'happy';
    rig.mouth = 'grin';
    rig.prop = g => {
      if (pump > 0.6) spark(g, dir * 27, -98 - pump * 6, '#ffe29b', 0.45);
    };
    return rig;
  }
  if (kind === 'hug') {
    // Both arms wrapped forward around whoever is there, eyes shut, a smile, a little rock side to side.
    const k = macyEnvelope(t, len, 0.3, 0.35),
      rock = Math.sin(t * 3.2) * k,
      side = dir < 0 ? 0 : 1;
    rig.arms[side] = macyArm(dir, k, dir * 25, -47 + rock, dir * 24, -54, { front: true });
    rig.arms[1 - side] = macyArm(-dir, k, dir * 21, -50 - rock, dir * 4, -57, { front: true });
    rig.lean = dir * 0.07 * k + rock * 0.02;
    rig.dx = dir * 2 * k;
    rig.headDx = dir * 1.2 * k;
    rig.eyes = k > 0.35 ? 'happy' : null;
    rig.mouth = k > 0.35 ? 'smile' : null;
    rig.prop = g => {
      if (k <= 0.2) return;
      const q = (t * 0.6) % 1;
      g.save();
      g.globalAlpha *= k * Math.sin(q * Math.PI);
      heart(g, dir * 14, -92 - q * 16, 0.32, '#f39aa8');
      g.restore();
    };
    return rig;
  }
  if (kind === 'fistbump') {
    // Punch out, hold the bump, a pop of sparks at the knuckles.
    const k = macyEnvelope(t, len, 0.22, 0.3),
      side = dir < 0 ? 0 : 1,
      pop = macyEase(t, 0.22, 0.3) * (1 - macyEase(t, 0.45, 0.65));
    rig.arms[side] = macyArm(dir, k, dir * 31, -46, dir * 22, -47, { front: true, fist: true });
    rig.lean = dir * 0.04 * k;
    rig.lookX = dir * 0.8 * k;
    rig.mouth = k > 0.4 ? 'grin' : null;
    rig.prop = g => {
      if (pop <= 0) return;
      g.save();
      g.globalAlpha *= pop;
      spark(g, dir * 37, -52, '#ffe29b', 0.4);
      spark(g, dir * 37, -40, '#ffffff', 0.3);
      g.restore();
    };
    return rig;
  }
  if (kind === 'selfie') {
    // Phone up high in the back hand, peace sign by her cheek, the big grin, and one flash.
    const k = macyEnvelope(t, len, 0.3, 0.35),
      side = dir < 0 ? 0 : 1,
      flash = macyEase(t, 1, 1.06) * (1 - macyEase(t, 1.12, 1.4)),
      px = -dir * 21,
      py = -97;
    rig.arms[1 - side] = macyArm(-dir, k, px, py + 6, -dir * 26, -70, { top: true });
    rig.arms[side] = macyArm(dir, k, dir * 16, -63, dir * 23, -46, { front: true, peace: k > 0.5 });
    rig.headDx = -dir * 1.4 * k;
    rig.lookX = -dir * 0.6 * k;
    rig.lookY = -1 * k;
    rig.eyes = flash > 0.3 ? 'squeeze' : null;
    rig.mouth = k > 0.3 ? 'grin' : null;
    rig.prop = g => {
      if (k <= 0) return;
      g.save();
      g.globalAlpha *= clamp(k * 1.5, 0, 1);
      g.translate(px, py);
      g.rotate(-dir * 0.18);
      rr(g, -4.2, -7, 8.4, 14, 2, '#2c3442', '#11161f', 0.8);
      ellipse(g, -dir * 1.6, -4.6, 1, 1, '#7b8aa0');
      ellipse(g, 0, 6.2, 3.3, 3.6, '#e8ac8b');
      g.restore();
      if (flash > 0) {
        g.save();
        g.globalAlpha *= flash;
        ellipse(g, px, py - 2, 13, 13, '#ffffffaa');
        spark(g, px, py - 2, '#ffffff', 0.6);
        g.restore();
      }
    };
    return rig;
  }
  if (kind === 'highfive') {
    // Open hand up high, a smack at the top, then down.
    const k = macyEnvelope(t, len, 0.2, 0.3),
      side = dir < 0 ? 0 : 1,
      smack = macyEase(t, 0.2, 0.28) * (1 - macyEase(t, 0.4, 0.6));
    rig.arms[side] = macyArm(dir, k, dir * 23, -94 - smack * 2, dir * 25, -66, { front: true, open: true });
    rig.dy = -smack * 2;
    rig.lookX = dir * 0.6 * k;
    rig.lookY = -1.2 * k;
    rig.eyes = smack > 0.3 ? 'happy' : null;
    rig.mouth = k > 0.3 ? 'grin' : null;
    rig.prop = g => {
      if (smack <= 0) return;
      g.save();
      g.globalAlpha *= smack;
      spark(g, dir * 26, -106, '#fff3c4', 0.5);
      g.restore();
    };
    return rig;
  }
  if (kind === 'wave') {
    // Hand up, side to side.
    const k = macyEnvelope(t, len, 0.25, 0.3),
      side = dir < 0 ? 0 : 1,
      w = Math.sin(t * 10) * k;
    rig.arms[side] = macyArm(dir, k, dir * (22 + w * 4), -86 - Math.abs(w), dir * 24, -62, { front: true, open: true });
    rig.lookX = dir * 0.5 * k;
    rig.mouth = k > 0.3 ? 'smile' : null;
    rig.eyes = k > 0.5 && t % 1.2 > 0.8 ? 'happy' : null;
    return rig;
  }
  if (kind === 'grin') {
    const k = macyEnvelope(t, len, 0.25, 0.35),
      side = dir < 0 ? 0 : 1,
      ting = macyEase(t, 0.45, 0.6) * (1 - macyEase(t, 0.8, 1));
    rig.arms[side] = macyArm(dir, k, dir * 17, -58, dir * 25, -40, { front: true, peace: k > 0.6 });
    rig.lookX = -0.5;
    rig.lookY = 0.3;
    rig.mouth = 'grin';
    rig.wink = t > 1.2 && t < 1.65;
    rig.prop = g => {
      if (ting > 0) spark(g, 10, -54, '#ffffff', 0.35 * ting);
    };
    return rig;
  }
  return rig;
}

// One posed arm: shoulder (sx) to hand, the hand, and the IV tape on her right wrist.
function macyDrawArm(g, side, a, hood, sx = side * 11) {
  path(
    g,
    p => {
      p.moveTo(sx, -48);
      p.quadraticCurveTo(a.cx, a.cy, a.x, a.y);
    },
    null,
    hood[3],
    8
  );
  if (a.fist) {
    ellipse(g, a.x, a.y - 1.5, 4, 4, '#e8ac8b');
    line(g, [[a.x - 2.2, a.y - 3], [a.x + 2.2, a.y - 3]], '#c98c70', 0.8);
  } else if (a.open) {
    // An open palm, fingers fanned up, thumb out to the side.
    for (let i = 0; i < 4; i++) {
      const fx = a.x - 2.4 + i * 1.6;
      line(g, [[fx, a.y - 1], [fx + (i - 1.5) * 0.7, a.y - 6.6 + Math.abs(i - 1.5) * 0.7]], '#e8ac8b', 1.7);
    }
    line(g, [[a.x - 2.6, a.y + 1], [a.x - 5.2, a.y - 1.6]], '#e8ac8b', 1.7);
    ellipse(g, a.x, a.y + 0.6, 3.4, 3.6, '#e8ac8b');
  } else ellipse(g, a.x, a.y + 2, 3.3, 4.4, '#e8ac8b');
  if (a.peace) {
    line(g, [[a.x - 1, a.y - 1], [a.x - 2.6, a.y - 8]], '#e8ac8b', 2.2);
    line(g, [[a.x + 1, a.y - 1], [a.x + 2.4, a.y - 8]], '#e8ac8b', 2.2);
  }
  if (side === 1) line(g, [[a.x - 2, a.y - 2], [a.x + 3, a.y - 1]], '#ecf4e8', 2);
}

// Jersey digits as strokes in a unit box (0..1 across, 0..1 down), so a number stays crisp at any
// size and never goes through the font engine.
const MACY_DIGITS = {
  0: p => {
    p.moveTo(0.86, 0.5);
    p.ellipse(0.5, 0.5, 0.36, 0.5, 0, 0, Math.PI * 2);
  },
  1: p => {
    p.moveTo(0.28, 0.2);
    p.lineTo(0.55, 0);
    p.lineTo(0.55, 1);
  },
  2: p => {
    p.moveTo(0.12, 0.27);
    p.bezierCurveTo(0.16, -0.06, 0.9, -0.06, 0.86, 0.3);
    p.quadraticCurveTo(0.8, 0.52, 0.12, 1);
    p.lineTo(0.9, 1);
  },
  3: p => {
    p.moveTo(0.14, 0.1);
    p.quadraticCurveTo(0.86, -0.06, 0.76, 0.3);
    p.quadraticCurveTo(0.66, 0.47, 0.38, 0.48);
    p.quadraticCurveTo(0.96, 0.5, 0.84, 0.8);
    p.quadraticCurveTo(0.68, 1.08, 0.12, 0.9);
  },
  4: p => {
    p.moveTo(0.7, 1);
    p.lineTo(0.7, 0);
    p.lineTo(0.08, 0.68);
    p.lineTo(0.92, 0.68);
  },
  5: p => {
    p.moveTo(0.86, 0);
    p.lineTo(0.22, 0);
    p.lineTo(0.16, 0.45);
    p.quadraticCurveTo(0.92, 0.3, 0.86, 0.72);
    p.quadraticCurveTo(0.76, 1.06, 0.12, 0.92);
  },
  6: p => {
    p.moveTo(0.8, 0.06);
    p.quadraticCurveTo(0.14, 0.06, 0.16, 0.68);
    p.ellipse(0.5, 0.7, 0.34, 0.3, 0, Math.PI, Math.PI * 3);
  },
  7: p => {
    p.moveTo(0.1, 0);
    p.lineTo(0.9, 0);
    p.lineTo(0.36, 1);
  },
  8: p => {
    p.moveTo(0.79, 0.26);
    p.ellipse(0.5, 0.26, 0.29, 0.25, 0, 0, Math.PI * 2);
    p.moveTo(0.86, 0.74);
    p.ellipse(0.5, 0.74, 0.36, 0.26, 0, 0, Math.PI * 2);
  },
  9: p => {
    p.moveTo(0.84, 0.32);
    p.ellipse(0.5, 0.32, 0.34, 0.3, 0, 0, Math.PI * 2);
    p.moveTo(0.84, 0.34);
    p.quadraticCurveTo(0.86, 0.94, 0.2, 0.96);
  }
};

// Macy's jersey number (state.jersey, 22 by default), centered on (x, y), size tall, outlined so it
// reads on either hoodie.
function macyNumber(g, x, y, size, ink, edge, rot = 0) {
  vectorDigits(g, String(Number.isInteger(state.jersey) ? state.jersey : 22), x, y, size, ink, edge, rot);
}

// Any run of digits in the jersey's vector style, centered on (x, y), size tall. edge null skips
// the outline.
function vectorDigits(g, text, x, y, size, ink, edge = null, rot = 0) {
  const digits = String(text).split(''),
    w = size * 0.62,
    gap = size * 0.14,
    total = digits.length * w + (digits.length - 1) * gap;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.translate(-total / 2, -size / 2);
  const trace = p => {
    digits.forEach((d, i) => {
      const draw = MACY_DIGITS[d];
      if (!draw) return;
      p.save();
      p.translate(i * (w + gap), 0);
      p.scale(w, size);
      draw(p);
      p.restore();
    });
  };
  // Scaling inside the path keeps the stroke width uniform: the path is built scaled, then stroked
  // in the unscaled space.
  if (edge) path(g, p => trace(p), null, edge, size * 0.3);
  path(g, p => trace(p), null, ink, size * 0.15);
  g.restore();
}

// ---- Turning ----
// A character's facing is a number in [-1, 1]: 1 is her right-facing side view, -1 the left, 0 straight
// at the camera. The art never squashes a sprite through zero width: facingView picks one of three
// hand-drawn views (side, three-quarter, front) and the sign mirrors it. facingStep turns a
// { body, head, tail, tailV } record toward a side: the head gets there first (FACING_HEAD_SECONDS),
// the body follows (FACING_BODY_SECONDS), and the tail (a ponytail) springs after the body, overshoots
// a little and settles. Reversing mid-turn just heads back from wherever each part is.
const FACING_BODY_SECONDS = 0.22,
  FACING_HEAD_SECONDS = 0.15,
  FACING_TAIL_K = 700,
  FACING_TAIL_C = 24;

function facingView(f) {
  const a = Math.abs(Number.isFinite(f) ? f : 1);
  return a >= 0.7 ? 'side' : a >= 0.25 ? 'three' : 'front';
}

function facingSign(f, fallback = 1) {
  return f > 0 ? 1 : f < 0 ? -1 : fallback < 0 ? -1 : 1;
}

function facingNew(dir) {
  const d = dir < 0 ? -1 : 1;
  return { body: d, head: d, tail: d, tailV: 0 };
}

function facingStep(T, dir, dt) {
  const to = dir < 0 ? -1 : 1,
    d = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1),
    move = (v, secs) => {
      const now = Number.isFinite(v) ? clamp(v, -1, 1) : to,
        r = (2 / secs) * d;
      return now + clamp(to - now, -r, r);
    };
  T.head = move(T.head, FACING_HEAD_SECONDS);
  T.body = move(T.body, FACING_BODY_SECONDS);
  if (!Number.isFinite(T.tail)) T.tail = T.body;
  if (!Number.isFinite(T.tailV)) T.tailV = 0;
  for (let left = d; left > 1e-6; ) {
    const h = Math.min(left, 1 / 120);
    T.tailV += (FACING_TAIL_K * (T.body - T.tail) - FACING_TAIL_C * T.tailV) * h;
    T.tail = clamp(T.tail + T.tailV * h, -1.35, 1.35);
    left -= h;
  }
  return T;
}

// Macy's head per view, in her own frame facing +x. fx shifts the features, eyes are [x, width],
// ears lists the ears drawn, bangs picks the fringe.
const MACY_HEADS = {
  side: { face: 1, eyes: [[-4.8, 1], [6, 1]], look: 0.5, mouth: 0, cheeks: [-6.5, 9], ears: [-1, 1], bangs: 'swoop' },
  three: { face: 0.6, eyes: [[-5, 1], [5.6, 0.96]], look: 0.3, mouth: -0.6, cheeks: [-6.8, 8.4], ears: [-1, 1], bangs: 'swoop' },
  front: { face: 0, eyes: [[-5.3, 1], [5.3, 1]], look: 0, mouth: -2.5, cheeks: [-7.6, 7.6], ears: [-1, 1], bangs: 'part' }
};

// The jersey number, upright whatever the mirror (flip is the frame's x sign).
function macyNumberAt(g, x, y, size, ink, edge, rot, flip) {
  g.save();
  g.translate(x, y);
  g.scale(flip, 1);
  macyNumber(g, 0, 0, size, ink, edge, rot);
  g.restore();
}

// The ponytail in a frame facing +x (so it trails toward -x), drawn by view. swing pushes the tip out
// (the overshoot as it settles), extra is a pose's own sway.
function macyPonytail(g, view, pose, swing, extra) {
  const fill = gradient(g, -28, -80, 28, 50, '#704c3e', '#3c2830'),
    sway = Math.sin(time * 4.1 + pose * 0.35) * 3;
  if (view === 'front') {
    // Straight at the camera: it hangs down her back and peeks out behind one shoulder.
    const tx = -20.5 - sway * 0.4 - swing * 10 - extra * 0.5;
    path(
      g,
      p => {
        p.moveTo(-5, -81);
        p.bezierCurveTo(-19, -84, -24, -68, tx, -53);
        p.bezierCurveTo(tx + 1, -47, -12, -48, -8, -60);
        p.closePath();
      },
      fill,
      '#352a31',
      1.2
    );
    return;
  }
  if (view === 'three') {
    // Mid-turn it swings out to the side, higher and wider.
    const tx = -(27 + sway) - swing * 18 - extra;
    path(
      g,
      p => {
        p.moveTo(-9, -78);
        p.bezierCurveTo(-30, -87, -31, -62, tx, -52);
        p.bezierCurveTo(tx - 9, -38, -19, -42, -14, -53);
        p.bezierCurveTo(-12, -61, -24, -71, -9, -73);
      },
      fill,
      '#352a31',
      1.2
    );
    return;
  }
  const tail = -(21 + sway) - swing * 24 - extra;
  path(
    g,
    p => {
      p.moveTo(-11, -77);
      p.bezierCurveTo(-33, -83, -23, -50, tail, -41);
      p.bezierCurveTo(tail - 15, -27, -15, -30, -13, -45);
      p.bezierCurveTo(-11, -56, -26, -70, -11, -72);
    },
    fill,
    '#352a31',
    1.2
  );
}

// One leg, sock and sneaker. The sneaker points +x, or at the camera in the front view.
function macyLeg(g, look, view, side, legWalk, i) {
  const hip = view === 'three' ? side * 5 + 1 : side * 6,
    foot = view === 'three' ? side * 5.5 + 1.5 : side * 7,
    step = side * legWalk * (view === 'front' ? 2.5 : 5);
  line(g, [[hip, -26], [foot + step * 0.27, -13], [foot + step, 0]], i ? '#33475e' : '#28394d', 7);
  if (look.socks) {
    // Softball-stitch socks: white with two red seams.
    line(g, [[foot + step, -9], [foot + step, -1]], '#fbf4e6', 5.5);
    line(g, [[foot + step - 2.6, -6.5], [foot + step + 2.6, -6.5]], '#de5b66', 1.4);
    line(g, [[foot + step - 2.6, -3.6], [foot + step + 2.6, -3.6]], '#de5b66', 1.4);
  } else line(g, [[foot + step, -6], [foot + step, -1]], '#f3bb99', 5);
  if (view === 'front') {
    rr(g, foot + step - 5, -2, 10, 7, 3.4, '#f6f3de', '#61777f', 0.8);
    line(g, [[foot + step - 3.4, 3], [foot + step + 3.4, 3]], '#86b7b4', 1.5);
  } else {
    const w = view === 'three' ? 13 : 15;
    rr(g, foot + step - 6, -2, w, 7, 3, '#f6f3de', '#61777f', 0.8);
    line(g, [[foot + step - 4, 3], [foot + step + w - 8, 3]], '#86b7b4', 1.5);
  }
}

// A resting arm with the walk's swing: shoulder (sx), elbow bend (cx), hand (hx).
function macyRestArm(g, hood, sx, cx, hx, swing, tape) {
  path(
    g,
    p => {
      p.moveTo(sx, -48);
      p.quadraticCurveTo(cx, -38, hx + swing, -28);
    },
    null,
    hood[3],
    8
  );
  ellipse(g, hx + swing, -26, 3.3, 4.4, '#e8ac8b');
  if (tape) line(g, [[hx - 2 + swing, -30], [hx + 3 + swing, -29]], '#ecf4e8', 2);
}

// The hoodie body by view, in her frame facing +x. flip is that frame's x sign on screen (numbers).
function macyTorso(g, hood, view, flip) {
  if (view === 'front') {
    rr(g, -13.5, -51, 27, 28, 8, gradient(g, -13, -50, 26, 25, hood[0], hood[1]), hood[2], 1.1);
    path(
      g,
      p => {
        p.moveTo(-8.5, -48);
        p.quadraticCurveTo(0, -40.5, 8.5, -48);
      },
      null,
      '#e1f0d9',
      2.2
    );
    line(g, [[-9, -28], [9, -28]], hood[4], 1);
    line(g, [[-6, -31], [6, -31]], hood[4] + '88', 1);
    line(g, [[-9, -42], [-8, -30]], '#bcf0d344', 1.5);
    macyNumberAt(g, 0, -37.6, 4.2, '#fbfff4', hood[2], 0, flip);
    return;
  }
  if (view === 'three') {
    rr(g, -11, -51, 23, 28, 8, gradient(g, -11, -50, 22, 25, hood[0], hood[1]), hood[2], 1.1);
    path(
      g,
      p => {
        p.moveTo(-5, -48);
        p.quadraticCurveTo(2.5, -41, 10, -48);
      },
      null,
      '#e1f0d9',
      2.2
    );
    line(g, [[-6, -28], [10, -28]], hood[4], 1);
    spark(g, 0.5, -38, '#e5e5ac', 0.5);
    line(g, [[-7, -42], [-6, -30]], '#bcf0d344', 1.5);
    macyNumberAt(g, 6.4, -36.6, 3.6, '#fbfff4', hood[2], 0, flip);
    return;
  }
  rr(g, -13, -51, 27, 28, 8, gradient(g, -13, -50, 26, 25, hood[0], hood[1]), hood[2], 1.1);
  path(
    g,
    p => {
      p.moveTo(-8, -48);
      p.quadraticCurveTo(0, -41, 9, -48);
    },
    null,
    '#e1f0d9',
    2.2
  );
  line(g, [[-8, -28], [9, -28]], hood[4], 1);
  spark(g, 2, -38, '#e5e5ac', 0.55);
  line(g, [[-8, -42], [-7, -30]], '#bcf0d344', 1.5);
  // Jersey 22: big on the back shoulder, small on the front of the chest.
  macyNumberAt(g, -7.2, -43.8, 5.4, '#fbfff4', hood[2], -0.12 * flip, flip);
  macyNumberAt(g, 8.4, -36.4, 3.6, '#fbfff4', hood[2], 0, flip);
}

// Her head by view, in a frame facing +x.
function macyHead(g, look, rig, view, tug) {
  const H = MACY_HEADS[view] || MACY_HEADS.side;
  // From the front the scrunchie peeks over her head from behind.
  if (view === 'front') {
    ellipse(g, -10.5, -81 + tug, 4, 3.6, look.scrunchie);
    ellipse(g, -10, -82 + tug, 1.6, 1.2, '#ffffff66');
  }
  ellipse(g, 0, -68, 15, 17, '#493039');
  ellipse(g, H.face, -65, 12.7, 14.4, gradient(g, -10, -76, 22, 25, '#ffdab3', '#e9ad8c'));
  if (H.ears.includes(-1)) ellipse(g, view === 'front' ? -11.5 : -11, -63, 3.3, 4.6, '#e8ae8b');
  if (H.ears.includes(1)) ellipse(g, view === 'front' ? 11.5 : 12, -63, view === 'front' ? 3.3 : 3.1, 4.4, '#efb997');
  if (H.bangs === 'part')
    path(
      g,
      p => {
        p.moveTo(-14.5, -66);
        p.bezierCurveTo(-17, -89, 17, -89, 14.5, -66);
        p.bezierCurveTo(11, -70, 6, -76, 0, -77.5);
        p.bezierCurveTo(-6, -76, -11, -70, -14.5, -66);
        p.closePath();
      },
      gradient(g, -10, -83, 28, 20, '#76513f', '#4b3035')
    );
  else
    path(
      g,
      p => {
        p.moveTo(-14, -68);
        p.bezierCurveTo(-17, -89, 18, -92, 16, -68);
        p.bezierCurveTo(9, -68, 6, -77, 1, -77);
        p.bezierCurveTo(-1, -69, -8, -73, -10, -62);
        p.lineTo(-13, -61);
        p.closePath();
      },
      gradient(g, -10, -83, 28, 20, '#76513f', '#4b3035')
    );
  path(
    g,
    p => {
      p.moveTo(-10, -78);
      p.quadraticCurveTo(1, -87, 11, -78);
    },
    null,
    '#a577515e',
    2
  );
  macyFace(g, rig, H);
  if (view !== 'front') {
    ellipse(g, -15 + (view === 'three' ? 1.5 : 0), -77 + tug, 4, 3.6, look.scrunchie);
    ellipse(g, -15.6 + (view === 'three' ? 1.5 : 0), -78 + tug, 1.6, 1.2, '#ffffff66');
  }
}

// act (optional): { kind, t } plays a pose from MACY_POSES. Every other caller draws her as always.
// dir is her facing: 1 right, -1 left, anything between is mid-turn (0 is straight at the camera).
// turn (optional): { head, tail } facings for a turn in progress (world.js passes player.facing):
// the head leads the body and the ponytail lags it. Both default to dir.
function girl(g, x, y, scale = 1, pose = 0, dir = 1, inv = false, groundShadow = true, act = null, turn = null) {
  const look = macyLook(),
    hood = look.hoodie,
    fb = Number.isFinite(dir) ? clamp(dir, -1, 1) : 1,
    fh = turn && Number.isFinite(turn.head) ? clamp(turn.head, -1, 1) : fb,
    ft = turn && Number.isFinite(turn.tail) ? clamp(turn.tail, -1.35, 1.35) : fb,
    bs = facingSign(fb, facingSign(fh)),
    hs = facingSign(fh, bs),
    ts = facingSign(ft, bs),
    view = facingView(fb),
    headView = facingView(fh),
    tailView = facingView(ft),
    rig = act && MACY_POSES[act.kind] ? macyRig(act, 1, bs) : null;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  const walk = Math.sin(pose),
    bounce = pose ? Math.abs(walk) * 1.7 : Math.sin(time * 2.3) * 0.45;
  if (groundShadow) shadow(g, 0, 2, 19, 5);
  if (inv) g.globalAlpha = 0.64 + 0.36 * Math.sin(time * 18);
  g.translate(0, -bounce);
  // Everything below is drawn facing +x and mirrored by her side: a mirror, never a squash.
  g.scale(bs, 1);
  if (rig) {
    g.translate(rig.dx || 0, rig.dy || 0);
    if (rig.lean) g.rotate(rig.lean);
    if (rig.sy) g.scale(1 / Math.sqrt(rig.sy), rig.sy);
  }
  // The ponytail trails behind the way it is facing, which lags the body a beat.
  g.save();
  g.scale(bs * ts, 1);
  macyPonytail(g, tailView, pose, Math.max(0, Math.abs(ft) - 1), (rig && rig.tail ? rig.tail : 0) * -bs * ts);
  g.restore();
  // The stride and sleeves move independently.
  const legWalk = rig && rig.walk !== undefined ? rig.walk : walk;
  for (let i = 0; i < 2; i++) macyLeg(g, look, view, i ? 1 : -1, legWalk, i);
  // Shoulders by view. Three-quarters on, the far arm (+x) tucks behind her and the near one crosses
  // in front.
  const shoulder = side => (view === 'three' ? side * 9 - (side < 0 ? 0 : 1) : view === 'front' ? side * 12 : side * 11);
  for (let side of [-1, 1]) {
    const arm = rig && rig.arms[side < 0 ? 0 : 1];
    if (arm) {
      if (!arm.front && !arm.top) macyDrawArm(g, side, arm, hood, shoulder(side));
      continue;
    }
    const swing = -side * walk * 3;
    if (view === 'three') {
      if (side > 0) macyRestArm(g, hood, 8, 12, 11, swing * 0.6, false);
    } else if (view === 'front') macyRestArm(g, hood, side * 12, side * 19.5, side * 18, swing * 0.4, side > 0);
    else macyRestArm(g, hood, side * 11, side * 19, side * 17, swing, side > 0);
  }
  macyTorso(g, hood, view, bs);
  if (view === 'three' && !(rig && rig.arms[0])) macyRestArm(g, hood, -7, -14, -12, walk * 3, true);
  if (rig)
    for (let side of [-1, 1]) {
      const arm = rig.arms[side < 0 ? 0 : 1];
      if (arm && arm.front) macyDrawArm(g, side, arm, hood, shoulder(side));
    }
  rr(g, view === 'front' ? -4 : -3, -57, 8, 9, 3, '#dca17f');
  // The head turns on its own and gets there first.
  g.save();
  if (rig && (rig.headDx || rig.headDy)) g.translate(rig.headDx || 0, rig.headDy || 0);
  g.scale(bs * hs, 1);
  macyHead(g, look, rig, headView, rig && rig.scrunchieDy ? rig.scrunchieDy : 0);
  g.restore();
  if (rig) {
    for (let side of [-1, 1]) {
      const arm = rig.arms[side < 0 ? 0 : 1];
      if (arm && arm.top) macyDrawArm(g, side, arm, hood, shoulder(side));
    }
    if (rig.prop) rig.prop(g);
  }
  g.restore();
}

// Eyes, brows, cheeks and mouth, in the head's frame facing +x. rig null is her resting face. H is the
// head view's layout (MACY_HEADS).
function macyFace(g, rig, H = MACY_HEADS.side) {
  const plain = !rig,
    R = rig || {},
    lx = R.lookX || 0,
    ly = R.lookY || 0,
    browY = R.browY || 0,
    blink = !R.eyes && !R.wink && time % 5.2 > 5.04,
    m = H.mouth;
  for (const [ex, k] of H.eyes) {
    const eyes = R.wink && ex > 0 ? 'happy' : R.eyes;
    if (plain && blink) line(g, [[ex - 2.5 * k, -65], [ex + 2.5 * k, -65]], '#543c34', 1.2);
    else if (eyes === 'shut' || blink)
      path(
        g,
        p => {
          p.moveTo(ex - 2.5 * k, -65.4);
          p.quadraticCurveTo(ex, -63.6, ex + 2.5 * k, -65.4);
        },
        null,
        '#543c34',
        1.2
      );
    else if (eyes === 'happy')
      path(
        g,
        p => {
          p.moveTo(ex - 2.5 * k, -64.2);
          p.quadraticCurveTo(ex, -67.4, ex + 2.5 * k, -64.2);
        },
        null,
        '#543c34',
        1.3
      );
    else if (eyes === 'squeeze') {
      const s = ex < 0 ? 1 : -1;
      line(g, [[ex - 2.4 * s, -66.6], [ex + 2 * s, -65], [ex - 2.4 * s, -63.4]], '#543c34', 1.2);
    } else {
      ellipse(g, ex, -65, 2.5 * k, 3.5, '#fff8e9');
      ellipse(g, ex + H.look + lx, -64.8 + ly, 1.65 * k, 2.7, '#735037');
      ellipse(g, ex + H.look * 1.6 + lx, -64.5 + ly, 0.85 * k, 1.8, '#322c31');
      ellipse(g, ex + lx * 0.6, -66 + ly * 0.6, 0.65, 0.85, '#ffffff');
    }
    const tilt = R.eyes === 'squeeze' ? (ex < 0 ? 1.2 : -1.2) : 0;
    line(g, [[ex - 2.4, -70 + browY + tilt], [ex + 2, -70.5 + browY - tilt]], '#654636', 1.1);
  }
  const rosy = R.mouth === 'grin' || R.eyes === 'happy';
  ellipse(g, H.cheeks[0], -59, 3, 1.5, rosy ? '#ef9e8b88' : '#ef9e8b55');
  ellipse(g, H.cheeks[1], -59, 2.5, 1.4, rosy ? '#ef9e8b88' : '#ef9e8b55');
  const mouth = R.mouth;
  if (mouth === 'o') {
    const o = clamp(R.mouthSize || 0, 0, 1);
    ellipse(g, 2.5 + m, -54.5, 1.4 + 1.3 * o, 1.2 + 2.6 * o, '#7a3b3f');
    ellipse(g, 2.5 + m, -53.4 + o, 1 + 0.6 * o, 0.7 + 0.6 * o, '#e58a8a');
  } else if (mouth === 'grin') {
    path(
      g,
      p => {
        p.moveTo(-2.2 + m, -56);
        p.quadraticCurveTo(2.5 + m, -48.6, 7.4 + m, -56);
        p.closePath();
      },
      '#7a3b3f'
    );
    path(
      g,
      p => {
        p.moveTo(-1.6 + m, -55.7);
        p.lineTo(6.8 + m, -55.7);
        p.quadraticCurveTo(2.5 + m, -53.9, -1.6 + m, -55.7);
      },
      '#fffaf0'
    );
  } else if (mouth === 'wince') line(g, [[-1 + m, -54.4], [1.2 + m, -55.4], [3.4 + m, -54.4], [5.6 + m, -55.4]], '#a7645d', 1);
  else if (mouth === 'flat') line(g, [[0 + m, -54.6], [5 + m, -54.9]], '#a7645d', 1);
  else if (mouth === 'smile')
    path(
      g,
      p => {
        p.moveTo(-1.6 + m, -55.6);
        p.quadraticCurveTo(2.8 + m, -51.2, 7 + m, -55.6);
      },
      null,
      '#a7645d',
      1.2
    );
  else
    path(
      g,
      p => {
        p.moveTo(-1 + m, -55);
        p.quadraticCurveTo(3 + m, -52.3, 6 + m, -55);
      },
      null,
      '#a7645d',
      1
    );
}

function gremlin(g, x, y, s = 1, type = 0, t = 0) {
  const cols = [
    ['#b5da81', '#61967c', '#e3efb9'],
    ['#dda9d1', '#8b689e', '#ffe0e5'],
    ['#efbe77', '#ba7b70', '#ffe9ae'],
    ['#80d5ec', '#548cae', '#d9f6ff']
  ][type % 4];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 2, 20, 6);
  const b = Math.sin(t * 3.4) * 2.8;
  g.translate(0, b);
  g.scale(1 + Math.sin(t * 3.4) * 0.025, 1 - Math.sin(t * 3.4) * 0.035);
  for (let side of [-1, 1]) {
    path(
      g,
      p => {
        p.moveTo(side * 13, -29);
        p.quadraticCurveTo(side * 24, -45, side * 31, -37);
        p.quadraticCurveTo(side * 28, -19, side * 13, -16);
      },
      cols[0],
      cols[1],
      1.3
    );
    path(
      g,
      p => {
        p.moveTo(side * 18, -28);
        p.lineTo(side * 26, -35);
        p.quadraticCurveTo(side * 25, -24, side * 18, -23);
      },
      '#eeb5b188'
    );
    line(g, [[side * 15, -17], [side * 24, -9 + Math.sin(t * 4 + side) * 2]], cols[1], 5);
    ellipse(g, side * 10, -1, 7, 4.5, cols[1]);
  }
  path(
    g,
    p => {
      p.moveTo(-18, -9);
      p.bezierCurveTo(-23, -38, -10, -43, 0, -39);
      p.bezierCurveTo(17, -45, 25, -22, 18, -6);
      p.quadraticCurveTo(0, 2, -18, -9);
    },
    gradient(g, -13, -40, 30, 37, cols[0], cols[1]),
    '#355a6022',
    1.5
  );
  ellipse(g, -7, -27, 8, 9, '#fff9e8');
  ellipse(g, 8, -27, 8, 9, '#fff9e8');
  ellipse(g, -5.5, -25, 3.4, 5, '#324452');
  ellipse(g, 6, -25, 3.4, 5, '#324452');
  ellipse(g, -6.5, -27, 1.1, 1.5, '#fff');
  ellipse(g, 5, -27, 1.1, 1.5, '#fff');
  line(g, [[-15, -34], [-2, -31]], cols[1], 3);
  line(g, [[2, -32], [16, -35]], cols[1], 3);
  path(
    g,
    p => {
      p.moveTo(-8, -14);
      p.quadraticCurveTo(2, -6, 12, -16);
      p.quadraticCurveTo(4, -2, -8, -14);
    },
    '#65394e'
  );
  rr(g, 3, -11, 9, 5, 2, '#ef929d');
  poly(g, [[-5, -14], [-1, -13], [-2, -9]], '#fff3cd');
  ellipse(g, -9, -18, 3.8, 1.5, '#e6ac8e55');
  ellipse(g, 9, -18, 3.8, 1.5, '#e6ac8e55');
  path(
    g,
    p => {
      p.moveTo(-5, -38);
      p.quadraticCurveTo(1, -50, 5, -38);
    },
    cols[0],
    cols[1],
    1
  );
  g.restore();
}

function plant(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 1, 20, 6);
  path(
    g,
    p => {
      p.moveTo(-15, -25);
      p.lineTo(15, -25);
      p.lineTo(11, -2);
      p.quadraticCurveTo(0, 5, -11, -2);
      p.closePath();
    },
    gradient(g, -15, -25, 30, 20, '#f3c19b', '#ba7f75')
  );
  ellipse(g, 0, -25, 16, 5, '#eec09b');
  ellipse(g, 0, -25, 12, 3, '#745a56');
  line(g, [[0, -25], [0, -68]], '#478e79', 3);
  // The leaves nod a little, each pot on its own beat (still under reduced motion).
  const nod = reduced ? 0 : Math.sin(time * 1.1 + x * 0.013 + y * 0.007) * 0.05;
  for (let i = 0; i < 6; i++) {
    let side = i % 2 ? 1 : -1,
      yy = -30 - Math.floor(i / 2) * 12;
    if (nod) {
      g.save();
      g.translate(0, yy);
      g.rotate(nod * side * (1 + Math.floor(i / 2) * 0.4));
      g.translate(0, -yy);
    }
    path(
      g,
      p => {
        p.moveTo(0, yy);
        p.bezierCurveTo(side * 31, yy + 4, side * 35, yy - 19, side * 27, yy - 21);
        p.quadraticCurveTo(side * 5, yy - 21, 0, yy);
      },
      i % 2 ? '#82be91' : '#4e9d82'
    );
    line(g, [[0, yy], [side * 25, yy - 16]], '#bad9a457', 1);
    if (nod) g.restore();
  }
  g.restore();
}

function bed(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 11, 77, 16);
  for (let xx of [-57, 57]) {
    ellipse(g, xx, 12, 7, 7, '#3c596e');
    ellipse(g, xx, 12, 3, 3, '#a7c5c9');
    line(g, [[xx, 5], [xx, 11]], '#96b0b8', 5);
  }
  rr(g, -69, -133, 138, 139, 12, gradient(g, -60, -140, 110, 140, '#e2efdf', '#8aadb0'), '#638f9c', 2);
  rr(g, -61, -125, 122, 119, 10, '#f9f4df');
  rr(g, -55, -121, 110, 34, 11, gradient(g, 0, -120, 0, 33, '#fffcf0', '#d8e6d5'));
  path(
    g,
    p => {
      p.moveTo(-45, -113);
      p.quadraticCurveTo(0, -107, 46, -114);
    },
    null,
    '#e3e8d7',
    2
  );
  path(
    g,
    p => {
      p.moveTo(-59, -85);
      p.quadraticCurveTo(0, -94, 59, -84);
      p.lineTo(59, -15);
      p.quadraticCurveTo(0, -6, -59, -16);
      p.closePath();
    },
    gradient(g, -59, -90, 115, 80, '#9ddac7', '#5daaa9')
  );
  path(
    g,
    p => {
      p.moveTo(-57, -84);
      p.quadraticCurveTo(0, -89, 57, -83);
      p.lineTo(57, -70);
      p.quadraticCurveTo(0, -76, -57, -69);
      p.closePath();
    },
    '#c2e6cf'
  );
  path(
    g,
    p => {
      p.moveTo(-39, -69);
      p.bezierCurveTo(-43, -50, -37, -30, -41, -17);
    },
    null,
    '#e0f1d85c',
    3
  );
  path(
    g,
    p => {
      p.moveTo(41, -70);
      p.quadraticCurveTo(46, -39, 41, -16);
    },
    null,
    '#428e9366',
    2
  );
  line(g, [[-67, -60], [-67, -16]], '#ebf2df', 5);
  line(g, [[67, -60], [67, -16]], '#c3dad2', 5);
  rr(g, -71, -12, 142, 17, 7, gradient(g, 0, -15, 0, 20, '#d8e8d9', '#8eafb3'), '#658e9c', 1.2);
  g.restore();
}

function ivStand(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 1, 25, 5);
  line(g, [[0, -140], [0, -6]], '#a3c3c7', 4);
  line(g, [[1, -139], [1, -8]], '#f0f1dc', 1);
  line(g, [[-22, -132], [22, -132]], '#cfdfd8', 4);
  path(
    g,
    p => {
      p.moveTo(18, -132);
      p.quadraticCurveTo(19, -120, 15, -120);
    },
    null,
    '#cdded1',
    2
  );
  rr(g, 7, -120, 23, 37, 5, '#e7f1dccc', '#bbd5c9', 1);
  rr(g, 10, -108, 17, 22, 3, '#edcb80');
  line(g, [[13, -116], [13, -111]], '#fffef0', 2);
  path(
    g,
    p => {
      p.moveTo(18, -82);
      p.bezierCurveTo(21, -51, 43, -78, 37, -35);
    },
    null,
    '#d8e9cf',
    2
  );
  rr(g, -17, -76, 34, 29, 6, '#386e7b', '#b0cbd0', 1.5);
  rr(g, -12, -71, 24, 16, 3, '#acd9bb');
  label(g, '88', 0, -59, 11, '#296465', 'center');
  ellipse(g, -7, -51, 2, 2, '#f4cf90');
  line(g, [[-19, 0], [0, -5], [19, 0]], '#b6cfcb', 3);
  for (let xx of [-20, 20]) ellipse(g, xx, 1, 4, 3, '#456775');
  g.restore();
}

function cabinet(g, x, y, w = 110) {
  shadow(g, x + w / 2, y + 8, w * 0.55, 9);
  rr(g, x + 4, y - 79, w - 8, 85, 5, gradient(g, x, y - 70, w, 70, '#d5ab88', '#a87d73'));
  rr(g, x - 2, y - 87, w + 4, 14, 5, gradient(g, x, y - 87, 0, 14, '#f7dbb2', '#cfaa8f'));
  for (let dy of [-68, -33]) {
    rr(g, x + 9, y + dy, w - 18, 29, 4, gradient(g, x, y + dy, w, 30, '#e3bd98', '#cda081'), '#a9806d55', 1);
    line(g, [[x + w / 2 - 10, y + dy + 10], [x + w / 2 + 10, y + dy + 10]], '#567a7c', 3);
  }
  for (let xx of [x + 10, x + w - 10]) line(g, [[xx, y + 2], [xx, y + 10]], '#6a807f', 5);
}

function monitor(g, x, y) {
  line(g, [[x, y - 18], [x, y + 7]], '#678d98', 6);
  rr(g, x - 23, y + 4, 46, 6, 3, '#9dbebd');
  monitorScreen(g, x, y);
}

// The same vitals monitor on a wall arm (Macy's room, where the cabinet holds the E-Type).
function wallMonitor(g, x, y) {
  rr(g, x - 11, y + 1, 22, 9, 3, '#7e9ea6', '#5e7f88', 1);
  line(g, [[x, y - 18], [x, y + 3]], '#678d98', 5);
  monitorScreen(g, x, y);
  // Her heart rate, the same 88 the IV pump shows. The monitor is very proud of it.
  vectorDigits(g, '88', x + 22, y - 53, 7, '#ffe29b');
}

// A wall-mounted blood pressure unit: dial, cuff basket, coiled hose. (x, y) is the dial's center.
function bpCuffArt(g, x, y, coils = 5) {
  rr(g, x - 17, y - 18, 34, 58, 6, '#2a4b5222');
  rr(g, x - 16, y - 20, 32, 56, 6, '#dfe8dc', '#7e9ea6', 1);
  ellipse(g, x, y, 12.5, 12.5, '#5e7f88');
  ellipse(g, x, y, 11, 11, '#fbfbf2');
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * 1.25 + (i / 11) * Math.PI * 1.5;
    line(g, [[x + Math.cos(a) * 8.4, y + Math.sin(a) * 8.4], [x + Math.cos(a) * 10, y + Math.sin(a) * 10]], '#7e9ea6', 0.8);
  }
  line(g, [[x, y], [x + 6.4, y - 4.6]], '#d9534f', 1.4);
  ellipse(g, x, y, 1.6, 1.6, '#2f3a40');
  rr(g, x - 12, y + 16, 24, 16, 4, '#3e7cc1');
  rr(g, x - 10, y + 18, 20, 5, 2, '#5e97d6');
  path(
    g,
    p => {
      p.moveTo(x + 6, y + 31);
      for (let i = 0; i < coils; i++) p.quadraticCurveTo(x + 15, y + 34 + i * 6, x + 6, y + 37 + i * 6);
    },
    null,
    '#3a3f45',
    1.6
  );
}

function monitorScreen(g, x, y) {
  rr(g, x - 35, y - 65, 72, 49, 7, gradient(g, x, y - 65, 0, 50, '#82a6ac', '#4a7284'), '#c3d5cf', 1.5);
  rr(g, x - 30, y - 60, 62, 35, 4, '#153b50');
  path(
    g,
    p => {
      p.moveTo(x - 26, y - 41);
      p.lineTo(x - 15, y - 41);
      p.lineTo(x - 10, y - 47);
      p.lineTo(x - 5, y - 32);
      p.lineTo(x + 1, y - 53);
      p.lineTo(x + 7, y - 41);
      p.lineTo(x + 26, y - 41);
    },
    null,
    '#b5e7be',
    1.8
  );
  ellipse(g, x + 23, y - 20, 2, 2, '#a5e2b9');
}

// opts (optional): { daypart } paints the Paramus view for that time of day instead of the generic
// city; { curtains: false } leaves the curtains for the caller (Macy's room sways them).
function windowArt(g, x, y, w = 190, h = 100, opts = null) {
  rr(g, x - 8, y - 7, w + 16, h + 19, 8, '#3c74804d');
  rr(g, x - 4, y - 3, w + 8, h + 6, 6, '#edf0db');
  if (opts && opts.daypart) paramusView(g, x + 3, y + 4, w - 6, h - 7, opts.daypart);
  else {
    rr(g, x + 3, y + 4, w - 6, h - 7, 3, gradient(g, x, y, 0, h, '#83c8dc', '#e2e7c4'));
    ellipse(g, x + w - 32, y + 27, 15, 15, '#ffedba');
    for (let i = 0; i < 3; i++) {
      let cx = x + 26 + i * 55;
      ellipse(g, cx, y + 24 + (i % 2) * 17, 17, 5, '#ffffff70');
      ellipse(g, cx + 9, y + 22 + (i % 2) * 17, 12, 7, '#ffffff70');
    }
    for (let i = 0; i < 5; i++) {
      let xx = x + 10 + (i * w) / 5;
      rr(g, xx, y + h - 30 - (i % 2) * 9, w / 5 - 8, 30 + (i % 2) * 9, 3, '#7ba6a5');
      for (let j = 0; j < 3; j++) rr(g, xx + 5 + j * 8, y + h - 23 - (i % 2) * 9, 3, 6, 1, '#cfdfbd');
    }
  }
  line(g, [[x + w / 2, y + 2], [x + w / 2, y + h]], '#edf0db', 7);
  line(g, [[x + 1, y + h * 0.48], [x + w - 1, y + h * 0.48]], '#edf0db', 5);
  rr(g, x - 13, y + h, w + 26, 9, 4, '#e3e9d0');
  if (opts && opts.curtains === false) return;
  for (let side of [-1, 1]) curtainArt(g, side < 0 ? x - 24 : x + w + 5, y - 7, h + 12);
}

// One curtain panel, top-left at (x, y).
function curtainArt(g, x, y, h) {
  rr(g, x, y, 20, h, 5, gradient(g, x, y + 7, 20, 0, '#64a89d', '#a9d1b4'));
  line(g, [[x + 7, y + 7], [x + 7, y + h - 9]], '#c2e4c055', 2);
}

function poster(g, x, y, kind = 0, s = 1) {
  if (s !== 1) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    poster(g, 0, 0, kind);
    g.restore();
    return;
  }
  rr(g, x - 4, y - 4, 62, 77, 4, '#507d7a');
  rr(g, x, y, 54, 69, 2, '#fbebc6');
  if (kind === 0) {
    plant(g, x + 27, y + 34, 0.4);
    label(g, 'HANG IN', x + 27, y + 49, 8, '#4d7468', 'center');
    label(g, 'THERE-ish', x + 27, y + 60, 8, '#4d7468', 'center');
  } else {
    heart(g, x + 13, y + 10, 2, '#e9a69b');
    label(g, 'GOOD', x + 27, y + 49, 9, '#4d7468', 'center');
    label(g, 'VIBES', x + 27, y + 61, 9, '#4d7468', 'center');
  }
}

function brick(g, x, y, col = '#e19a83', s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  rr(g, 0, -9, 21, 13, 3, col, '#36596844', 0.8);
  rr(g, 1, 0, 19, 4, 2, '#18364d22');
  for (let xx of [5, 15]) {
    ellipse(g, xx, -10, 4, 2.5, col);
    line(g, [[xx - 2, -11], [xx + 2, -11]], '#fff4d666', 1);
  }
  g.restore();
}

function sofa(g, x, y, w = 170, col = '#bc8f9e') {
  shadow(g, x + w / 2, y + 6, w * 0.55, 13);
  for (let xx of [x + 17, x + w - 17]) line(g, [[xx, y - 2], [xx, y + 9]], '#5a666c', 6);
  rr(g, x + 5, y - 93, w - 10, 77, 18, col, '#665b7566', 1.5);
  for (let i = 0; i < 2; i++)
    rr(g, x + 15 + (i * (w - 30)) / 2, y - 83, (w - 36) / 2, 53, 13, '#ffffff19', '#ffffff18', 1);
  rr(g, x + 6, y - 37, w - 12, 37, 10, gradient(g, x, y - 40, 0, 45, col, '#8c6e83'));
  rr(g, x + 10, y - 41, w - 20, 22, 8, col);
  line(g, [[x + w / 2, y - 37], [x + w / 2, y - 21]], '#624d6d33', 1);
  for (let xx of [x - 3, x + w - 16]) rr(g, xx, y - 59, 20, 54, 9, col, '#695c6e44', 1);
  for (let i = 0; i < 2; i++) {
    g.save();
    g.translate(x + (i ? w - 38 : 38), y - 54);
    g.rotate(i ? 0.13 : -0.15);
    rr(g, -17, -15, 34, 29, 7, i ? '#b7d7ad' : '#f5d2ae', '#fff1cf55', 1);
    g.restore();
  }
}

function table(g, x, y, w = 120, h = 55) {
  shadow(g, x + w / 2, y + h + 15, w * 0.52, 10);
  for (let xx of [x + 13, x + w - 13]) line(g, [[xx, y + h - 1], [xx, y + h + 22]], '#8f7d75', 7);
  rr(g, x, y + 7, w, h, 12, '#b68e76');
  rr(g, x, y, w, h, 12, gradient(g, x, y, 0, h, '#edd1a3', '#d6ad85'), '#a17e6f55', 1);
  line(g, [[x + 14, y + 7], [x + w - 14, y + 7]], '#fff0cd77', 2);
}

function scanner(g, x, y) {
  g.save();
  g.translate(x, y);
  shadow(g, 57, 96, 130, 24);
  rr(g, -40, -143, 191, 188, 39, gradient(g, -40, -140, 190, 180, '#f0f1df', '#92b9c0'), '#5f8c9d', 1.5);
  ellipse(g, 57, -54, 70, 79, '#87adb7');
  ellipse(g, 57, -55, 62, 71, gradient(g, 0, -100, 110, 100, '#b1d5ce', '#6497aa'));
  ellipse(g, 57, -55, 49, 58, gradient(g, 0, -100, 90, 120, '#1d415b', '#4a7f91'));
  ellipse(g, 57, -53, 38, 47, '#244e65');
  path(g, p => p.ellipse(57, -55, 58, 67, -0.12, Math.PI, Math.PI * 1.85), null, '#e6f1d9', 4);
  rr(g, 17, -19, 81, 121, 10, '#799eab');
  rr(g, 10, -28, 94, 108, 11, gradient(g, 0, -30, 0, 110, '#edf2dd', '#aecbc5'), '#8aadb2', 1);
  rr(g, 18, -23, 78, 27, 9, '#fbf8e8');
  rr(g, 20, 5, 74, 68, 8, '#bedbd0');
  rr(g, 28, 84, 58, 23, 6, '#6d97a6');
  rr(g, 17, 102, 79, 9, 4, '#567f94');
  rr(g, -23, -102, 13, 13, 4, '#7bcbb1');
  rr(g, 121, -101, 12, 7, 3, '#f3c882');
  label(g, 'BRRR 3000', 57, -118, 10, '#597f8e', 'center');
  g.restore();
}

function floor(g, w, h, theme) {
  rect(g, 0, 0, w, h, gradient(g, 0, 145, 0, 480, '#c5d8c4', '#a0c4b9'));
  rect(g, 0, 0, w, 153, gradient(g, 0, 0, 0, 160, theme, '#c3d4be'));
  rr(g, 0, 129, w, 12, 2, '#edf1d8');
  rect(g, 0, 141, w, 12, '#527f8744');
  for (let yy = 155; yy < h; yy += 58)
    line(g, [[0, yy], [w, yy]], '#487c7920', 1);
  for (let xx = 0; xx < w; xx += 80)
    line(g, [[xx, 155], [xx, h]], '#487c7920', 1);
  rect(g, 0, 153, 19, h, '#376b7850');
  rect(g, 981, 153, 19, h, '#244c6550');
  rect(g, 0, h - 22, w, 22, gradient(g, 0, h - 22, 0, 22, '#67989b', '#2c586c'));
}

// Wall signs start at WALL_SIGN_TOP so the hearts and pocket-money cards (sized in world.js to
// stay above that line) never cover them. Windows and doors may sit higher; they carry no text.
const WALL_SIGN_TOP = 68;

function wallSign(g, x, w, title, sub, titleColor = '#476c66', subColor = '#6d8b7a') {
  rr(g, x, WALL_SIGN_TOP, w, 54, 10, '#e9eed3', '#6f9c94', 1);
  label(g, title, x + w / 2, WALL_SIGN_TOP + 24, 14, titleColor, 'center');
  label(g, sub, x + w / 2, WALL_SIGN_TOP + 43, 9, subColor, 'center');
}

// ---- Macy's room, accurately ----
// Where the wall pieces live (room coordinates). world.js draws what moves: the TV picture and its
// glow, the get-well cards, the swaying curtains, dust motes, the nurse behind the door glass.
const ROOM_TVS = {
    0: { x: 620, y: 24, w: 170, h: 100 },
    2: { x: 660, y: 20, w: 180, h: 106 }
  },
  ROOM_WINDOWS = {
    0: { x: 370, y: 21, w: 214, h: 102 },
    2: { x: 425, y: 22, w: 191, h: 101 },
    4: { x: 535, y: 24, w: 155, h: 91 }
  },
  ROOM_SIGN = { title: 'MACY · ROOM 10', floor: '7TH FLOOR', sub: 'GREMLINS NOT FOUND' },
  WALL_BOARD = { x: 86, y: 66, w: 162, h: 62 },
  ROOM_DOOR_GLASS = { x: 928, y: 50, w: 27, h: 37 },
  ROOM_SHAFT = [[365, 155], [590, 155], [730, 462], [477, 462]],
  // The light switch on the wall between the get-well board and the vitals monitor (its center), right
  // over the gap between the bed and the nightstand.
  LIGHT_SWITCH = { x: 257, y: 101 };

// The switch plate: the toggle up with the lights on, down with them out, and a glow-in-the-dark dot so
// she can find it at night. Drawn live (world.js) because rooms 0 and 5 share one wall.
function lightSwitchArt(g, x, y, off, t = 0) {
  rr(g, x - 7, y - 12, 16, 27, 4, '#2a4b5226');
  rr(g, x - 8, y - 14, 16, 27, 4, off ? '#9aa6b8' : '#f6f3e6', off ? '#5e6a80' : '#a9b3a7', 1);
  rr(g, x - 3.5, y - 8, 7, 15, 3, off ? '#7d899c' : '#e3ded0');
  rr(g, x - 3, off ? y - 1 : y - 8, 6, 8, 2.5, off ? '#c3cbd8' : '#ffffff', off ? '#6d788c' : '#9aa59a', 1);
  for (const dy of [-11, 10]) ellipse(g, x, y + dy, 0.9, 0.9, off ? '#6d788c' : '#b5bdb2');
  if (!off) return;
  const pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 2.4);
  g.globalAlpha = 0.35 * pulse;
  ellipse(g, x, y + 19, 6, 6, '#9dffb0');
  g.globalAlpha = 1;
  ellipse(g, x, y + 19, 2, 2, '#c9ffd4');
}

// The time of day from the real clock: what Macy would see out of a 7th-floor window right now.
function roomDaypart(h = new Date().getHours()) {
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

// A cheap stable hash in [0, 1) for scattering things the same way every time.
function roomHash(i, j = 0) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const PARAMUS_SKY = {
  morning: { top: '#9fd2e6', low: '#fbe0c2', haze: '#b9c9cf', trees: '#6aa277', near: '#d8c9b4', roof: '#a3907c' },
  afternoon: { top: '#7cc3dc', low: '#e0ecca', haze: '#a8c1c9', trees: '#5d9a6c', near: '#d4c6b0', roof: '#9a8876' },
  dusk: { top: '#594985', low: '#f2a26f', haze: '#7d6487', trees: '#4c5a58', near: '#9d8a8a', roof: '#6f5d66' },
  night: { top: '#0f1940', low: '#2f3768', haze: '#2a3260', trees: '#18243a', near: '#3a4258', roof: '#2a3044' }
};

// The view from 7 West: Bergen County trees, Paramus rooftops and a mall, Route 17, and Manhattan
// standing on the horizon fifteen miles off. x, y, w, h is the glass.
function paramusView(g, x, y, w, h, part) {
  const P = PARAMUS_SKY[part] || PARAMUS_SKY.afternoon,
    night = part === 'night',
    horizon = y + h * 0.66;
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, 3);
  g.clip();
  rect(g, x, y, w, h, gradient(g, x, y, 0, h * 0.75, P.top, P.low));
  if (night) {
    for (let i = 0; i < 22; i++) rect(g, x + roomHash(i, 4) * w, y + roomHash(i, 5) * h * 0.5, 1.2, 1.2, '#fff6dd');
    ellipse(g, x + w * 0.8, y + 17, 11, 11, '#f6efd21c');
    ellipse(g, x + w * 0.8, y + 17, 6.5, 6.5, '#f6efd2');
    ellipse(g, x + w * 0.8 - 2, y + 15.5, 1.4, 1.4, '#e1d5b2');
  } else {
    const sun = {
      morning: [x + w * 0.16, y + h * 0.38, 11, '#fff3c8'],
      afternoon: [x + w - 30, y + 22, 13, '#ffedba'],
      dusk: [x + w * 0.74, y + h * 0.6, 14, '#ffc477']
    }[part];
    ellipse(g, sun[0], sun[1], sun[2] * 2, sun[2] * 2, sun[3] + '33');
    ellipse(g, sun[0], sun[1], sun[2], sun[2], sun[3]);
    for (let i = 0; i < 3; i++) {
      const cx = x + 24 + i * w * 0.27,
        cy = y + 16 + (i % 2) * 13,
        col = part === 'dusk' ? '#f6b8a666' : '#ffffff70';
      ellipse(g, cx, cy, 15, 4.5, col);
      ellipse(g, cx + 8, cy - 2, 10, 6, col);
    }
  }
  // Manhattan on the horizon: a low ridge of towers, the Empire State and One World Trade.
  const sx = x + w * 0.4,
    sw = w * 0.52;
  for (let i = 0; i < 16; i++) {
    const bx = sx + (i / 16) * sw,
      bh = 4 + roomHash(i, 9) * 9;
    rect(g, bx, horizon - bh, sw / 16 + 0.6, bh + 2, P.haze);
  }
  const esb = sx + sw * 0.34,
    wtc = sx + sw * 0.8;
  rect(g, esb - 3, horizon - 16, 6, 18, P.haze);
  rect(g, esb - 2, horizon - 20, 4, 5, P.haze);
  rect(g, esb - 1, horizon - 23, 2, 4, P.haze);
  line(g, [[esb, horizon - 23], [esb, horizon - 29]], P.haze, 0.9);
  poly(g, [[wtc - 3.5, horizon + 1], [wtc + 3.5, horizon + 1], [wtc + 1.4, horizon - 25], [wtc - 1.4, horizon - 25]], P.haze);
  line(g, [[wtc, horizon - 25], [wtc, horizon - 32]], P.haze, 0.8);
  if (night) {
    for (let i = 0; i < 14; i++) rect(g, sx + roomHash(i, 12) * sw, horizon - 2 - roomHash(i, 13) * 11, 1, 1, '#ffe7a3cc');
    ellipse(g, wtc, horizon - 32, 1, 1, '#ff6b5e');
    ellipse(g, esb, horizon - 29, 0.9, 0.9, '#ff6b5e');
  }
  // Bergen County: a long line of treetops.
  for (let i = 0; i < 14; i++)
    ellipse(g, x + (i / 13) * w, horizon + 4 - roomHash(i, 21) * 3, 7 + roomHash(i, 22) * 5, 6, P.trees);
  // Paramus: a mall the size of a small country, a few rooftops, Route 17.
  const my = horizon + 6;
  rect(g, x + w * 0.06, my, w * 0.36, 12, P.near);
  rect(g, x + w * 0.06, my - 2, w * 0.36, 3, P.roof);
  rr(g, x + w * 0.17, my + 2, w * 0.14, 5, 1, night ? '#ffd98a' : '#e85d5d');
  label(g, 'MALL', x + w * 0.24, my + 6.3, 4.4, night ? '#7a4a2a' : '#fff5e2', 'center');
  for (let i = 0; i < 3; i++) {
    const hx = x + w * (0.52 + i * 0.15),
      hy = my + 3 + (i % 2) * 2;
    rect(g, hx, hy, 14, 9, P.near);
    poly(g, [[hx - 2, hy], [hx + 7, hy - 6], [hx + 16, hy]], P.roof);
    rect(g, hx + 4, hy + 3, 3, 3, night ? '#ffd98a' : '#8fb4c4');
  }
  if (night) for (let i = 0; i < 6; i++) rect(g, x + w * 0.08 + i * w * 0.055, my + 3.5, 2, 2, '#ffd98aaa');
  const road = y + h - 7;
  rect(g, x, road, w, 7, night ? '#20263a' : '#8d8f8a');
  for (let i = 0; i < 9; i++) rect(g, x + 4 + i * (w / 9), road + 3, w / 18, 0.8, '#f3e9c2aa');
  for (let i = 0; i < 6; i++) {
    const cx = x + roomHash(i, 31) * w,
      lane = i % 2;
    if (part === 'dusk' || night) {
      ellipse(g, cx, road + 1.8 + lane * 3, 1.1, 0.8, lane ? '#fff2c2' : '#ff6b5e');
      ellipse(g, cx + 3, road + 1.8 + lane * 3, 1.1, 0.8, lane ? '#fff2c2' : '#ff6b5e');
    } else rr(g, cx, road + 0.8 + lane * 3, 5, 2.2, 1, ['#d9534f', '#3e7cc1', '#f2f2f2', '#2f3a40'][i % 4]);
  }
  g.restore();
}

// LEGO water lilies: a pad with studs and a flower of pointed petals. (x, y) sits on the sill.
function legoLily(g, x, y, s = 1, petal = '#f08db5', tip = '#ffd3e5', bud = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  ellipse(g, 0, -1.6, 13, 3.4, '#357f43');
  ellipse(g, 0, -2.4, 12, 2.4, '#55a957');
  poly(g, [[1, -2.4], [11, -4.6], [12.4, -1.4]], '#357f43');
  for (const sx of [-8, -4.5, -1, 5]) {
    ellipse(g, sx, -2.6, 1.4, 0.8, '#7fcb71');
    ellipse(g, sx, -3, 1.1, 0.45, '#a6e294');
  }
  if (bud) {
    path(
      g,
      p => {
        p.moveTo(-1, -3);
        p.quadraticCurveTo(-5, -9, 0, -15);
        p.quadraticCurveTo(5, -9, 1, -3);
        p.closePath();
      },
      petal
    );
    path(
      g,
      p => {
        p.moveTo(0, -14.5);
        p.quadraticCurveTo(2.4, -10, 0.6, -4);
      },
      null,
      tip,
      1
    );
    g.restore();
    return;
  }
  const leaf = (rot, len, wid, col, tipCol) => {
    g.save();
    g.translate(0, -4);
    g.rotate(rot);
    path(
      g,
      p => {
        p.moveTo(0, 0);
        p.quadraticCurveTo(wid, -len * 0.5, 0, -len);
        p.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
      },
      col
    );
    path(
      g,
      p => {
        p.moveTo(0, -len * 0.55);
        p.quadraticCurveTo(wid * 0.55, -len * 0.78, 0, -len);
        p.quadraticCurveTo(-wid * 0.55, -len * 0.78, 0, -len * 0.55);
      },
      tipCol
    );
    g.restore();
  };
  for (const r of [-1.25, -0.62, 0, 0.62, 1.25]) leaf(r, 9.5, 3.4, petal, tip);
  for (const r of [-0.32, 0.32]) leaf(r, 7, 3, tip, '#ffffff');
  ellipse(g, 0, -5.4, 2.3, 1.2, '#f5d35a');
  ellipse(g, 0, -5.8, 1.4, 0.5, '#fff0a0');
  g.restore();
}

// Hospital door sign beside Macy's door.
function roomSign(g, x, y, w, h) {
  rr(g, x + 2, y + 3, w, h, 9, '#2a4b5233');
  rr(g, x, y, w, h, 9, '#e9eed3', '#6f9c94', 1);
  rr(g, x + 4, y + 4, w - 8, 19, 6, '#476c66');
  label(g, ROOM_SIGN.title, x + w / 2, y + 18, 11.5, '#f3f6e4', 'center');
  label(g, ROOM_SIGN.floor, x + w / 2, y + 35, 10, '#476c66', 'center');
  label(g, ROOM_SIGN.sub, x + w / 2, y + 47, 7.2, '#6d8b7a', 'center');
}

// A small brass plaque: VALLEY HOSPITAL.
function valleyPlaque(g, x, y, w = 76, h = 14) {
  rr(g, x + 1, y + 2, w, h, 3, '#2a4b5230');
  rr(g, x, y, w, h, 3, gradient(g, x, y, 0, h, '#ecd38c', '#b88f46'), '#8a6a33', 0.8);
  ellipse(g, x + 4, y + h / 2, 1.1, 1.1, '#8a6a33');
  ellipse(g, x + w - 4, y + h / 2, 1.1, 1.1, '#8a6a33');
  label(g, 'VALLEY HOSPITAL', x + w / 2, y + h / 2 + 2.4, 6.8, '#4a3a1c', 'center');
}

// The TV's bezel and soundbar (static). The picture goes in the inset rectangle (tvScreenRect).
function tvBezel(g, tv) {
  rr(g, tv.x + 3, tv.y + 5, tv.w, tv.h, 7, '#1d3a4626');
  rr(g, tv.x, tv.y, tv.w, tv.h, 6, '#1b222c', '#0d1218', 1.2);
  rr(g, tv.x + 5, tv.y + 5, tv.w - 10, tv.h - 10, 2, '#0b1220');
  rr(g, tv.x + tv.w * 0.3, tv.y + tv.h + 3, tv.w * 0.4, 5, 2.5, '#283039');
  ellipse(g, tv.x + tv.w / 2, tv.y + tv.h - 2.5, 1, 0.8, '#d8e6ee55');
}

const tvScreenRect = tv => ({ x: tv.x + 5, y: tv.y + 5, w: tv.w - 10, h: tv.h - 10 });

// The cork board above the bed. The cards on it are drawn live (world.js) from state.cards.
function wallBoard(g) {
  const b = WALL_BOARD;
  rr(g, b.x + 2, b.y + 3, b.w, b.h, 6, '#2a4b5226');
  rr(g, b.x, b.y, b.w, b.h, 6, '#9c7a58');
  rr(g, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 3, gradient(g, b.x, b.y, b.w, b.h, '#d4ad82', '#c19468'));
  for (let i = 0; i < 40; i++)
    rect(g, b.x + 6 + roomHash(i, 41) * (b.w - 12), b.y + 6 + roomHash(i, 42) * (b.h - 12), 1.2, 1.2, '#a57a5266');
}

// The full room illustration. Use roomBg() in frame code; it caches this per room and time of day.
// part is the daypart ('morning', 'afternoon', 'dusk', 'night'); curtains false leaves the window
// curtains to world.js, which sways them.
function roomIllustration(g, id, part = 'afternoon', curtains = true) {
  const themes = ['#82bcad', '#7bb6c7', '#b6a0bb', '#c7b18e', '#91bda7'],
    win = ROOM_WINDOWS[id],
    view = win ? { daypart: part, curtains } : null;
  floor(g, 1000, 625, themes[id]);
  if (id === 0) {
    windowArt(g, win.x, win.y, win.w, win.h, view);
    legoLily(g, 392, 123, 1.05);
    legoLily(g, 420, 123.5, 0.82, '#f7f4ee', '#ffd6e4');
    legoLily(g, 566, 123, 0.9, '#f08db5', '#ffd3e5', true);
    wallBoard(g);
    wallMonitor(g, 302, 136);
    tvBezel(g, ROOM_TVS[0]);
    roomSign(g, 798, 66, 102, 52);
    valleyPlaque(g, 811, 121);
    rr(g, 386, 274, 250, 170, 21, '#7f859f30');
    rr(g, 392, 278, 238, 160, 18, gradient(g, 400, 280, 220, 150, '#b9adc7', '#a29dbb'));
    rr(g, 404, 290, 214, 136, 12, null, '#ded5da88', 2);
    ellipse(g, 510, 358, 55, 31, '#dfd3d132');
    rr(g, 48, 482, 125, 67, 10, '#70a1a0');
    rr(g, 46, 477, 129, 20, 8, '#b8d5b8');
    label(g, 'BLANKET FORT', 110, 519, 10, '#e6efcd', 'center');
    label(g, 'NO JERKS', 110, 536, 9, '#d6e6c3', 'center');
  }
  if (id === 1 || id === 3) {
    wallSign(
      g,
      590,
      205,
      id === 1 ? 'MAGNETIC PERSONALITY' : 'COMPUTED TOMFOOLERY',
      id === 1 ? 'NO METAL. NO CHILL.' : 'THE DONUT STRIKES BACK',
      '#496f80',
      '#648a88'
    );
    poster(g, 818, WALL_SIGN_TOP, 1, 0.78);
    rr(g, 370, 345, 240, 132, 18, '#4d97a536');
    for (let yy = 360; yy < 466; yy += 26)
      line(g, [[386, yy], [594, yy]], '#b4ddc753', 2);
    rr(g, 45, 205, 113, 47, 8, '#396d83');
    label(g, id === 1 ? 'SCAN IN PROGRESS' : 'NO BRAKES', 101, 233, 10, '#e0efc7', 'center');
  }
  if (id === 2) {
    windowArt(g, win.x, win.y, win.w, win.h, view);
    poster(g, 330, WALL_SIGN_TOP, 1, 0.78);
    tvBezel(g, ROOM_TVS[2]);
    rr(g, 694, 129, 112, 13, 4, '#3e607b');
    label(g, 'MOVIE NIGHT · YOU VS. GUT', 750, 138.5, 7, '#e6cfad', 'center');
    rr(g, 272, 285, 459, 221, 28, '#8c89a941');
    rr(g, 282, 290, 440, 206, 25, gradient(g, 282, 290, 420, 200, '#b5a8c3', '#a395b6'));
    rr(g, 297, 306, 410, 174, 20, null, '#e2d3d87a', 2);
  }
  if (id === 4) {
    wallSign(g, 276, 221, 'ULTRA-SUSPICIOUS', 'NOW WITH 30% MORE GEL', '#557d76', '#6d8c78');
    windowArt(g, win.x, win.y, win.w, win.h, view);
    poster(g, 810, WALL_SIGN_TOP, 1, 0.78);
    bpCuffArt(g, 755, 84);
    rr(g, 390, 305, 290, 172, 28, '#8fb7a44a');
    ellipse(g, 535, 387, 99, 45, '#b6d3b244');
  }
  // Broad window light and gentle edge shadows create depth without a noisy texture. Its color
  // follows the clock: warm in the morning, gold at dusk, a faint blue at night.
  const shaft = { morning: '#fff1c61c', afternoon: '#fff5be19', dusk: '#ffcf9a22', night: '#c9d8ff10' }[part];
  poly(g, ROOM_SHAFT, shaft || '#fff5be19');
  rr(g, 907, 29, 70, 126, 7, '#628f9a');
  rr(g, 914, 35, 56, 117, 5, gradient(g, 915, 35, 55, 115, '#a3c9c7', '#779fa9'));
  rr(g, 924, 46, 35, 45, 5, '#d7e8d6');
  rr(g, 928, 50, 27, 37, 3, gradient(g, 928, 50, 0, 37, '#88bdca', '#bed9ce'));
  rr(g, 950, 100, 8, 4, 2, '#f8d38f');
  rr(g, 885, 167, 89, 35, 9, '#4f8e83');
  label(g, 'MAP →', 929, 190, 13, '#e2edc8', 'center');
  rr(g, 906, 114, 73, 15, 5, '#cde1bb');
  label(g, 'ADVENTURE', 943, 125, 8, '#547e74', 'center');
}

// Only moving actors are redrawn as geometry. Cache the lit room background once per room, and again
// when the real clock moves into a new part of the day (the windows follow it).
const roomImages = new Map();

// Curtains sway in rooms with windows unless motion is reduced; then they are part of the cache.
const roomSwayCurtains = id => !reduced && id !== 5 && !!ROOM_WINDOWS[id];

function roomBg(g, id) {
  // A wide extra room (the hallway) paints itself through hallwayRoomBg(g) when that exists, cached at
  // its own width; without it, a plain floor in the room's theme.
  const w = (rooms[id] && rooms[id].width) || 1000;
  if (w > 1000) {
    let wide = roomImages.get(id);
    if (!wide) {
      wide = document.createElement('canvas');
      const wg = configureCanvas(wide, w, 625);
      if (typeof hallwayRoomBg === 'function') hallwayRoomBg(wg);
      else floor(wg, w, 625, rooms[id].theme || '#82bcad');
      roomImages.set(id, wide);
    }
    g.drawImage(wide, 0, 0, w, 625);
    return;
  }
  // Room 5 is the home room after dark: room 0's art at night, tinted, with its own cache.
  const part = id === 5 ? 'night' : roomDaypart();
  let cv = roomImages.get(id);
  if (!cv || cv.daypart !== part) {
    if (!cv) {
      cv = document.createElement('canvas');
      roomImages.set(id, cv);
    }
    const cg = configureCanvas(cv, 1000, 625);
    roomIllustration(cg, id === 5 ? 0 : id, part, !roomSwayCurtains(id));
    if (id === 5) {
      rect(cg, 0, 0, 1000, 625, '#162a5266');
      label(cg, 'LIGHTS OUT. GREMLINS IN.', 500, 150, 18, '#dee8c9', 'center');
    }
    cv.daypart = part;
  }
  g.drawImage(cv, 0, 0, 1000, 625);
}

// Furniture per room: draw order follows y, and box is the collision rectangle.
const roomProps = [
  [
    { y: 282, box: [95, 176, 131, 105], draw: g => bed(g, 162, 270, 1.05) },
    {
      y: 265,
      box: [282, 210, 62, 48],
      draw: g => {
        // The vitals monitor lives on the wall now; the cabinet is the E-Type's showroom.
        cabinet(g, 265, 259, 85);
        etype(g, 307, 170);
      }
    },
    { y: 284, box: [54, 238, 30, 34], draw: g => ivStand(g, 69, 278, 0.86) },
    { y: 285, box: [771, 209, 160, 76], draw: g => sofa(g, 771, 278, 160, '#db927a') },
    { y: 235, box: [685, 211, 30, 20], draw: g => plant(g, 699, 226, 1.04) },
    {
      y: 388,
      box: [795, 326, 118, 59],
      draw: g => {
        table(g, 795, 326, 118, 49);
        brick(g, 809, 341, '#80ae9f', 1.2);
        brick(g, 852, 352, '#d68c7c', 1.1);
        brick(g, 836, 333, '#e1bd70', 1);
        rect(g, 880, 335, 20, 27, '#f4e4bf');
        label(g, '101', 889, 351, 7, '#627c72', 'center');
      }
    },
    {
      y: 556,
      box: [835, 510, 100, 40],
      draw: g => {
        rect(g, 829, 508, 115, 37, '#b58274');
        rect(g, 829, 499, 115, 12, '#d6a58b');
        label(g, 'LOOT & LAUNDRY', 886, 531, 9, '#f5dfb5', 'center');
        plant(g, 949, 560, 0.7);
      }
    }
  ],
  [
    { y: 302, box: [387, 166, 188, 129], draw: g => scanner(g, 429, 197) },
    {
      y: 294,
      box: [111, 236, 116, 50],
      draw: g => {
        cabinet(g, 110, 282, 119);
        monitor(g, 166, 200);
        rect(g, 123, 209, 37, 5, '#3b606c');
      }
    },
    {
      y: 280,
      box: [776, 206, 118, 68],
      draw: g => {
        cabinet(g, 776, 269, 118);
        rect(g, 797, 177, 70, 25, '#e3d7af');
        label(g, 'EARPLUGS', 832, 194, 10, '#59797a', 'center');
      }
    },
    {
      y: 448,
      box: [52, 400, 54, 43],
      draw: g => {
        rect(g, 50, 396, 59, 39, '#729299');
        rect(g, 47, 381, 65, 15, '#abc0b5');
        rect(g, 52, 435, 7, 13, '#476978');
        rect(g, 100, 435, 7, 13, '#476978');
      }
    }
  ],
  [
    { y: 290, box: [89, 207, 190, 73], draw: g => sofa(g, 90, 279, 190, '#be8d9c') },
    { y: 289, box: [731, 207, 190, 73], draw: g => sofa(g, 731, 279, 190, '#88b2a1') },
    {
      y: 388,
      box: [405, 322, 170, 57],
      draw: g => {
        table(g, 405, 322, 170, 55);
        brick(g, 425, 339, '#83b9a7', 1.3);
        brick(g, 478, 352, '#e0a087', 1.2);
        brick(g, 517, 339, '#dfbd78', 1.3);
        rect(g, 451, 325, 42, 12, '#f4e6c7');
      }
    },
    {
      y: 460,
      box: [54, 396, 83, 58],
      draw: g => {
        rect(g, 50, 327, 90, 126, '#72899a');
        rect(g, 56, 333, 78, 113, '#a2b4af');
        rect(g, 61, 341, 67, 72, '#3d6170');
        for (let yy = 351; yy < 410; yy += 20)
          for (let xx = 69; xx < 126; xx += 18) {
            rect(g, xx, yy, 10, 13, (xx + yy) % 3 ? '#e0b383' : '#9ac6a3');
          }
        rect(g, 69, 422, 42, 10, '#2c4d5d');
        label(g, 'SNAX', 93, 321, 12, '#e3dfbf', 'center');
      }
    },
    {
      y: 560,
      box: [831, 498, 90, 54],
      draw: g => {
        ellipse(g, 874, 528, 59, 31, '#7b7e91');
        ellipse(g, 874, 516, 52, 38, '#aba5b8');
        ellipse(g, 872, 507, 34, 22, '#bdb4c2');
        plant(g, 942, 481, 0.9);
      }
    },
    { y: 243, box: [326, 213, 32, 20], draw: g => plant(g, 341, 232, 1) }
  ],
  [
    {
      y: 305,
      box: [380, 167, 188, 130],
      draw: g => {
        scanner(g, 424, 200);
        label(g, 'DONUT II', 481, 112, 12, '#fbe1a9', 'center');
      }
    },
    {
      y: 300,
      box: [100, 230, 115, 60],
      draw: g => {
        cabinet(g, 100, 285, 115);
        monitor(g, 155, 201);
      }
    },
    {
      y: 300,
      box: [783, 235, 110, 55],
      draw: g => {
        cabinet(g, 780, 285, 115);
        rect(g, 800, 184, 73, 22, '#f7d599');
        label(g, 'NO BRAKES', 837, 199, 10, '#744e53', 'center');
      }
    },
    {
      y: 520,
      box: [70, 450, 80, 60],
      draw: g => {
        bed(g, 110, 510, 0.65);
        plant(g, 922, 500, 0.9);
      }
    }
  ],
  [
    {
      y: 290,
      box: [110, 160, 130, 125],
      draw: g => {
        bed(g, 175, 277, 1.05);
        ivStand(g, 90, 280, 0.85);
      }
    },
    {
      y: 310,
      box: [340, 235, 120, 65],
      draw: g => {
        cabinet(g, 339, 296, 123);
        monitor(g, 399, 215);
        rect(g, 440, 210, 13, 30, '#f1d17f');
        label(g, 'GEL', 446, 228, 6, '#587568', 'center');
      }
    },
    { y: 285, box: [756, 205, 170, 73], draw: g => sofa(g, 756, 278, 170, '#7faf95') },
    {
      y: 490,
      box: [835, 430, 80, 50],
      draw: g => {
        table(g, 832, 430, 91, 45);
        plant(g, 880, 423, 0.6);
      }
    }
  ]
];

// After dark, room 5 keeps the home-base furniture and collisions.
roomProps.push(roomProps[0]);

// Sweep bar: mint band = good, gold center = precision bonus.
function drawTimingBar(g, x, y, w, value, target, band) {
  rr(g, x, y, w, 37, 16, '#0c2c3b', '#6c969a', 1);
  rr(g, x + (target - band / 2) * w, y + 2, band * w, 33, 6, '#96ceac');
  rr(g, x + (target - band * 0.14) * w, y + 2, band * 0.28 * w, 33, 3, '#f4e6ad');
  line(g, [[x + value * w, y - 5], [x + value * w, y + 43]], '#ffe0a1', 4);
  ellipse(g, x + value * w, y - 5, 5, 5, '#ffe0a1');
}

function miniBed(g, x, y, s = 1) {
  bed(g, x, y, s);
  // A medal grin (macyCelebrate) shows here too: the result screen paints this bedside scene.
  const grin = player.pose === 'grin' ? { kind: 'grin', t: player.poseT } : null;
  girl(g, x, y - 35 * s, 0.8 * s, 0, 1, false, true, grin);
  path(
    g,
    p => {
      p.moveTo(x - 55 * s, y - 77 * s);
      p.quadraticCurveTo(x, y - 87 * s, x + 55 * s, y - 76 * s);
      p.lineTo(x + 55 * s, y - 15 * s);
      p.quadraticCurveTo(x, y - 6 * s, x - 55 * s, y - 15 * s);
      p.closePath();
    },
    gradient(g, x, y - 80 * s, 0, 70 * s, '#a5e1c7', '#61afa9')
  );
  path(
    g,
    p => {
      p.moveTo(x - 53 * s, y - 76 * s);
      p.quadraticCurveTo(x, y - 83 * s, x + 53 * s, y - 76 * s);
    },
    null,
    '#d1edd7',
    11 * s
  );
  path(
    g,
    p => {
      p.moveTo(x - 36 * s, y - 64 * s);
      p.quadraticCurveTo(x - 30 * s, y - 44 * s, x - 36 * s, y - 19 * s);
    },
    null,
    '#c3ead45c',
    2 * s
  );
}

// Wide 800 × 450 backdrop (the IV game).
function miniBackdrop(g, top, glowColor, title) {
  rect(g, 0, 0, 800, 450, gradient(g, 0, 0, 800, 450, top, '#142e46'));
  glow(g, 390, 190, 390, glowColor);
  for (let i = 0; i < 8; i++) {
    let x = 55 + i * 110,
      y = 90 + (i % 3) * 95;
    ellipse(g, x, y, 43, 43, '#d5ede306');
  }
  // The HUD pills sit over this top edge on small screens, so a game may pass no title and draw none.
  if (!title) return;
  label(g, title, 24, 29, 11, '#a2cacb');
  label(g, 'LEVEL ' + (mini.tier + 1), 776, 29, 11, '#b8d8cf', 'right');
}

// Square 600 × 600 backdrop shared by the gesture games.
function arcadeBackdrop(g, top, glowColor, title) {
  rect(g, 0, 0, 600, 600, gradient(g, 0, 0, 600, 600, top, '#122c40'));
  glow(g, 300, 220, 370, glowColor);
  for (let y = 65; y < 600; y += 32)
    line(g, [[20, y], [580, y]], '#d1ecdc08', 1);
  label(g, title, 24, 28, 12, '#b5d4cf');
  label(g, 'L' + (mini.tier + 1), 576, 28, 12, '#efdab0', 'right');
}

// A softball is yellow (optic yellow, the real thing); white with red stitches is a baseball.
function softball(g, x, y, r = 10) {
  ellipse(g, x, y, r, r, '#f0e34a');
  g.save();
  g.translate(x, y);
  g.rotate(time * 3);
  path(
    g,
    p => {
      p.moveTo(-r * 0.6, -r * 0.7);
      p.quadraticCurveTo(r * 0.1, 0, -r * 0.6, r * 0.7);
      p.moveTo(r * 0.6, -r * 0.7);
      p.quadraticCurveTo(-r * 0.1, 0, r * 0.6, r * 0.7);
    },
    null,
    '#d98180',
    1.3
  );
  g.restore();
}

function nutrient(g, x, y, type, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 1, 12, 4);
  if (type === 'pudding') {
    path(
      g,
      p => {
        p.moveTo(-12, -22);
        p.lineTo(12, -22);
        p.lineTo(8, -2);
        p.quadraticCurveTo(0, 3, -8, -2);
        p.closePath();
      },
      gradient(g, -12, -20, 24, 20, '#edc497', '#bd8e75')
    );
    ellipse(g, 0, -22, 13, 4, '#fff0cd');
    ellipse(g, 0, -22, 9, 2, '#dcae7f');
    heart(g, -4, -17, 0.6, '#fff0ce');
  } else {
    rr(
      g,
      -9,
      -29,
      18,
      29,
      6,
      gradient(
        g,
        -9,
        -30,
        18,
        28,
        type === 'juice' ? '#ffe39a' : '#fff1d5',
        type === 'juice' ? '#e8b15e' : '#d1c7a6'
      ),
      '#638f8d55',
      1
    );
    rr(g, -6, -34, 12, 8, 3, '#c9e6d3');
    rr(g, -8, -19, 16, 12, 3, '#64b4a5');
    heart(g, -4, -17, 0.6, '#eff2ce');
    line(g, [[-5, -24], [-5, -21]], '#fff9e5', 2);
  }
  g.restore();
}

// A room's snack cart, feet at (x, y): a little steel cart with a tray of nutrients when stocked and a
// BACK SOON tent when not. vending: the lounge's SNAX machine (drawn with the room) gets a FREE SNACK
// sticker and a glowing treat in its slot instead. t animates the glow.
function snackCartArt(g, x, y, stocked, t = 0, vending = false, wait = 0) {
  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  if (vending) {
    // The machine's slot sits at (69..111, 422..432); the sticker goes on the glass.
    g.save();
    g.translate(x + 33, y - 128);
    g.rotate(0.12);
    rr(g, -24, -8, 48, 16, 4, stocked ? '#ffe066' : '#d9d2c4', '#5b4a37', 1);
    label(g, stocked ? 'FREE SNACK' : 'SOLD OUT', 0, 3.5, 7.5, stocked ? '#5b3a12' : '#7a6a5a', 'center');
    g.restore();
    if (stocked) {
      g.globalAlpha = 0.35 + 0.35 * pulse;
      ellipse(g, x - 5, y - 47, 24, 9, '#fff3b0');
      g.globalAlpha = 1;
      nutrient(g, x - 5, y - 42, 'juice', 0.55);
      spark(g, x + 14, y - 60, '#fff0ad', 0.35 + 0.15 * pulse);
    }
    return;
  }
  shadow(g, x, y + 1, 34, 7);
  // Wheels, legs and shelves.
  for (const dx of [-21, 21]) {
    ellipse(g, x + dx, y - 3, 4.5, 4.5, '#3d5560');
    ellipse(g, x + dx, y - 3, 1.8, 1.8, '#9fb1b9');
  }
  for (const dx of [-25, 24]) rect(g, x + dx, y - 50, 3, 46, '#8fa3ab');
  rr(g, x - 28, y - 16, 56, 6, 2, '#c9d6dc', '#6d828c', 1);
  rr(g, x - 30, y - 52, 60, 7, 2.5, gradient(g, x - 30, y - 52, 0, 7, '#eef4f5', '#b8c7cd'), '#6d828c', 1);
  // The handle.
  line(g, [[x + 26, y - 50], [x + 36, y - 62]], '#8fa3ab', 3);
  rr(g, x + 32, y - 66, 10, 5, 2.5, '#e07a6a');
  // Juice boxes on the bottom shelf.
  for (const [dx, col] of [[-19, '#ffcf7a'], [-8, '#a7d9b4'], [3, '#f3a69c']]) {
    rr(g, x + dx, y - 27, 9, 11, 2, col, '#6b5a4a55', 0.8);
    line(g, [[x + dx + 6, y - 27], [x + dx + 8, y - 31]], '#ffffffcc', 1.2);
  }
  // The plate on the front.
  rr(g, x - 17, y - 44, 34, 9, 2, '#244d53');
  label(g, 'SNACKS', x, y - 37.5, 6.5, '#ffe29b', 'center');
  if (stocked) {
    g.globalAlpha = 0.3 + 0.3 * pulse;
    ellipse(g, x, y - 56, 30, 10, '#fff3b0');
    g.globalAlpha = 1;
    nutrient(g, x - 9, y - 52, 'pudding', 0.75);
    nutrient(g, x + 10, y - 52, 'shake', 0.7);
    spark(g, x + 22, y - 82, '#fff0ad', 0.35 + 0.15 * pulse);
  } else {
    // A paper tent: back soon, in minutes.
    poly(g, [[x - 14, y - 52], [x - 2, y - 72], [x + 10, y - 52]], '#fff6e0');
    line(g, [[x - 2, y - 72], [x - 2, y - 52]], '#d8cdb5', 1);
    label(g, 'BACK', x - 2, y - 60, 6, '#7a6a5a', 'center');
    label(g, wait > 1 ? wait + ' MIN' : 'SOON', x - 2, y - 54, 5.5, '#7a6a5a', 'center');
  }
}

function vomitArt(g, x, y, dir, t, s = 1) {
  if (t <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  let amount = Math.min(1, t * 4);
  ellipse(g, dir * 10, -61, 4, 4, '#4f6948');
  const end = dir * (62 + 15 * Math.sin(time * 15));
  path(
    g,
    p => {
      p.moveTo(dir * 13, -59);
      p.bezierCurveTo(dir * 39, -67, dir * 50, -15, end, 10);
    },
    null,
    '#92ba55',
    9 * amount
  );
  path(
    g,
    p => {
      p.moveTo(dir * 14, -60);
      p.bezierCurveTo(dir * 41, -62, dir * 48, -16, end, 8);
    },
    null,
    '#d3df7e',
    3.5 * amount
  );
  for (let i = 0; i < 11; i++) {
    let q = (i / 11 + time * 1.6) % 1,
      px = dir * (16 + q * 82),
      py = -58 + q * q * 72;
    ellipse(
      g,
      px,
      py + Math.sin(q * 14 + time * 12) * 5,
      2.5 + (1 - q) * 2,
      3.5 + (1 - q) * 2,
      i % 2 ? '#b5d16c' : '#82a94e'
    );
  }
  ellipse(g, dir * 79, 13, 30, 7, '#8da84b');
  ellipse(g, dir * 76, 11, 19, 3.5, '#c0d279');
  g.restore();
}

// ---- Macy's things ----
// A volleyball: white, gold and royal blue panels (Ramsey colors). spin turns the seams.
function volleyball(g, x, y, r = 7, spin = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  ellipse(g, 0, 0, r, r, '#fbf7ea');
  path(
    g,
    p => {
      p.moveTo(-r * 0.95, -r * 0.2);
      p.quadraticCurveTo(-r * 0.1, -r * 0.55, r * 0.55, -r * 0.82);
      p.quadraticCurveTo(r * 0.2, -r * 1.05, -r * 0.35, -r * 0.92);
      p.quadraticCurveTo(-r * 0.85, -r * 0.62, -r * 0.95, -r * 0.2);
    },
    '#f2c43f'
  );
  path(
    g,
    p => {
      p.moveTo(r * 0.98, r * 0.05);
      p.quadraticCurveTo(r * 0.2, r * 0.25, -r * 0.35, r * 0.92);
      p.quadraticCurveTo(r * 0.3, r * 1.02, r * 0.75, r * 0.62);
      p.quadraticCurveTo(r * 1.02, r * 0.35, r * 0.98, r * 0.05);
    },
    '#2a63c9'
  );
  path(
    g,
    p => {
      p.moveTo(-r * 0.95, -r * 0.2);
      p.quadraticCurveTo(-r * 0.1, -r * 0.55, r * 0.55, -r * 0.82);
      p.moveTo(r * 0.98, r * 0.05);
      p.quadraticCurveTo(r * 0.2, r * 0.25, -r * 0.35, r * 0.92);
      p.moveTo(-r * 0.2, -r * 0.35);
      p.quadraticCurveTo(r * 0.1, r * 0.1, r * 0.15, r * 0.2);
    },
    null,
    '#8a8a80',
    Math.max(0.5, r * 0.09)
  );
  path(g, p => p.arc(0, 0, r, 0, Math.PI * 2), null, '#6d6d66', Math.max(0.5, r * 0.08));
  g.restore();
}

// The LEGO Jaguar E-Type on Macy's cabinet: British racing green, the long bonnet, a fastback,
// chrome bumpers and wire wheels, on a studded display base. Cached as a sprite; (x, y) is the
// middle of the base's underside.
let etypeSprite = null;

function etype(g, x, y, s = 1) {
  if (!etypeSprite) {
    etypeSprite = document.createElement('canvas');
    const eg = configureCanvas(etypeSprite, 76, 32);
    eg.translate(38, 28);
    etypeArt(eg);
  }
  g.drawImage(etypeSprite, x - 38 * s, y - 28 * s, 76 * s, 32 * s);
}

function etypeArt(g) {
  ellipse(g, 0, 2.6, 36, 2.6, '#00000026');
  rr(g, -36, -1.2, 72, 3.6, 1.2, '#3a3f45');
  for (const sx of [-34, -31, -28, 28, 31, 34]) ellipse(g, sx, -1.2, 1.2, 0.6, '#5a626b');
  g.translate(0, -1.6);
  const green = gradient(g, 0, -24, 0, 20, '#2f8a57', '#0b3d23');
  path(
    g,
    p => {
      p.moveTo(-32, -8);
      p.quadraticCurveTo(-33.4, -12, -30, -14);
      p.bezierCurveTo(-25, -20, -17, -23.6, -11, -23.9);
      p.quadraticCurveTo(-6, -24.2, -3, -22.4);
      p.lineTo(3, -16.2);
      p.bezierCurveTo(14, -16.8, 26, -15.8, 31.5, -11.6);
      p.quadraticCurveTo(34.2, -9.6, 33.2, -7);
      p.lineTo(30, -5.4);
      p.lineTo(-30, -5.4);
      p.closePath();
    },
    green,
    '#082a18',
    0.8
  );
  // The bonnet's power bulge and the louvres, in a highlight.
  path(
    g,
    p => {
      p.moveTo(5, -17.2);
      p.bezierCurveTo(15, -17.6, 25, -16.4, 30.4, -12.6);
    },
    null,
    '#79c99788',
    1.1
  );
  for (const lx of [10, 12.5, 15]) line(g, [[lx, -14.4], [lx + 1.6, -14.6]], '#06301a', 0.6);
  // Glass and chrome window frame.
  path(
    g,
    p => {
      p.moveTo(-22.5, -17.2);
      p.bezierCurveTo(-18.5, -21.4, -13, -22.6, -6, -22);
      p.lineTo(0.8, -16.9);
      p.closePath();
    },
    gradient(g, -22, -22, 20, 6, '#cfeef6', '#8cc3d4'),
    '#eef3f5',
    0.8
  );
  line(g, [[-8.4, -22.1], [-8.9, -17]], '#eef3f5', 0.9);
  line(g, [[-1.4, -15.8], [-2.2, -7.2]], '#06301a', 0.6);
  ellipse(g, -4.5, -13.4, 1.2, 0.4, '#d9e2e6');
  // Covered headlamp, the oval mouth, bumpers, tail lamp, twin exhausts.
  ellipse(g, 27.8, -12.2, 3.6, 1.8, '#e3f4f8');
  path(g, p => p.ellipse(27.8, -12.2, 3.6, 1.8, -0.2, 0, Math.PI * 2), null, '#f4f7f8', 0.6);
  ellipse(g, 32.6, -8.6, 1.1, 1.9, '#0b1f15');
  line(g, [[32, -8.6], [33.4, -8.6]], '#e6ecef', 0.6);
  line(g, [[29.6, -6.3], [33.8, -7.2]], '#f1f4f6', 1.3);
  line(g, [[-33.2, -8.7], [-28.6, -7.2]], '#f1f4f6', 1.3);
  ellipse(g, -31.4, -11, 1, 1.3, '#e04a3d');
  line(g, [[-27, -4.9], [-33.4, -4.4]], '#c9d1d5', 0.9);
  line(g, [[-27, -3.8], [-33.2, -3.3]], '#aab3b8', 0.9);
  // Wire wheels: dark arches, tyres, chrome rims, a fan of spokes, knock-off spinners.
  for (const wx of [-19, 20]) {
    ellipse(g, wx, -6.4, 7.8, 7.4, '#062214');
    ellipse(g, wx, -6.2, 6.2, 6.2, '#1c1c1f');
    ellipse(g, wx, -6.2, 4.7, 4.7, '#cfd6da');
    ellipse(g, wx, -6.2, 4, 4, '#7d878d');
    path(
      g,
      p => {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          p.moveTo(wx + Math.cos(a) * 0.9, -6.2 + Math.sin(a) * 0.9);
          p.lineTo(wx + Math.cos(a + 0.35) * 4.2, -6.2 + Math.sin(a + 0.35) * 4.2);
        }
      },
      null,
      '#eef2f4',
      0.45
    );
    ellipse(g, wx, -6.2, 1.3, 1.3, '#f5f7f8');
    line(g, [[wx - 1.6, -6.2], [wx + 1.6, -6.2]], '#aeb8bd', 0.6);
  }
}

// ---- Get-well cards ----
const CARD_PAPERS = ['#fff6e0', '#fde4ea', '#e6f3d6', '#dfeefb', '#f2e8ff', '#fff1c9'],
  CARD_PINS = ['#e5534b', '#3e8ed0', '#f2c14e', '#5bb98c'];

function cardSeed(card) {
  const s = String((card && card.who) || '') + '|' + String((card && card.name) || '');
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// "Addie, Stella and Pepper" fits on a card as "Addie +2".
function cardShortName(name) {
  const text = String(name || '').trim();
  const parts = text.split(/\s*,\s*|\s+and\s+|\s*&\s*/).filter(Boolean);
  let short = parts.length > 1 ? parts[0] + ' +' + (parts.length - 1) : text;
  if (short.length > 10) short = short.slice(0, 9) + '…';
  return short || 'A friend';
}

// The doodle on the front of a card, about 14 by 12 around (x, y) at s = 1, keyed by who sent it.
function cardDoodle(g, who, x, y, s = 1, paper = '#fff6e0') {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const k = String(who || '').toLowerCase();
  if (k === 'dad') {
    rr(g, -5, -3.5, 8, 9, 1.6, '#f4efe6', '#7a5a4a', 0.8);
    path(g, p => p.ellipse(3.4, 1, 2.3, 2.6, 0, -1.4, 1.4), null, '#7a5a4a', 0.9);
    ellipse(g, -1, -3.4, 3.6, 0.9, '#6b4632');
    for (const sx of [-2.6, 0.6])
      path(
        g,
        p => {
          p.moveTo(sx, -5.2);
          p.quadraticCurveTo(sx - 1.4, -6.6, sx, -8);
          p.quadraticCurveTo(sx + 1.4, -9.4, sx, -10.6);
        },
        null,
        '#b9a89a',
        0.7
      );
  } else if (k === 'brother') {
    ellipse(g, -5, 2.3, 2.6, 3, '#3d4552');
    ellipse(g, 5, 2.3, 2.6, 3, '#3d4552');
    rr(g, -7, -3, 14, 7, 3.4, '#4a5363');
    rect(g, -5.6, -0.9, 3.4, 1.1, '#d9dde2');
    rect(g, -4.45, -2.05, 1.1, 3.4, '#d9dde2');
    ellipse(g, 3.4, -0.9, 0.9, 0.9, '#ef6b6b');
    ellipse(g, 5, 0.4, 0.9, 0.9, '#6bb8ef');
  } else if (k === 'mimi') {
    ellipse(g, 0, 0, 6, 6, '#c98c4a');
    ellipse(g, -0.3, -0.3, 5.3, 5.3, '#dfa864');
    ellipse(g, 5, -3.8, 2.4, 2.4, paper);
    for (const [cx, cy] of [[-2.6, -2], [1.4, -2.4], [-1, 1.6], [2.4, 1.8], [-3.4, 1.2]])
      ellipse(g, cx, cy, 0.9, 0.8, '#5a3622');
  } else if (k === 'dodo') {
    path(
      g,
      p => {
        p.moveTo(-6, 1.2);
        p.quadraticCurveTo(-5.6, -5, 1.6, -4.6);
        p.quadraticCurveTo(6.2, -3.8, 5.6, 1.2);
        p.closePath();
      },
      '#7d6a55'
    );
    ellipse(g, 4.4, 1.4, 4.4, 1.4, '#5e4e3f');
    ellipse(g, -0.6, -4.4, 0.9, 0.6, '#5e4e3f');
    for (const tx of [-3.4, -0.8, 1.8]) line(g, [[tx, -3.6], [tx + 0.8, 0.8]], '#9a876f', 0.5);
  } else if (k === 'presley' || k === 'norah') {
    volleyball(g, k === 'presley' ? -1 : 0, 0.4, 5.6, 0.5);
    if (k === 'presley') {
      // Presley's ponytail, flicking off the top of the ball like it is hers.
      path(
        g,
        p => {
          p.moveTo(2.6, -4.6);
          p.bezierCurveTo(7.4, -7.6, 8.6, -1.4, 6.4, 2.6);
          p.quadraticCurveTo(6, -1, 3.8, -3.2);
          p.closePath();
        },
        '#7a4c36'
      );
      ellipse(g, 3.2, -4.4, 1.5, 1.2, '#f08db5');
    }
  } else if (k === 'taylor') {
    ellipse(g, 0, 1.2, 5.2, 5.2, '#eef06a');
    path(
      g,
      p => {
        p.moveTo(-3.2, -2.4);
        p.quadraticCurveTo(-1, 1.2, -3.2, 5.4);
        p.moveTo(3.2, -2.4);
        p.quadraticCurveTo(1, 1.2, 3.2, 5.4);
      },
      null,
      '#d9534f',
      0.8
    );
    // A graduation cap on top: board, band, tassel.
    poly(g, [[-5.6, -4.6], [0, -7.4], [5.6, -4.6], [0, -2]], '#2c2f38');
    rr(g, -2.6, -4, 5.2, 2.2, 0.6, '#2c2f38');
    line(g, [[0, -4.7], [3.8, -3.6], [4, -0.8]], '#f2c14e', 0.6);
  } else if (k === 'casey') {
    // A wiffle ball: white, with the row of oval holes.
    ellipse(g, 0, 0, 5.8, 5.8, '#fbfbf6');
    path(g, p => p.arc(0, 0, 5.8, 0, Math.PI * 2), null, '#b8b8ae', 0.6);
    for (const [hx, hy, rx] of [[-2.8, -1.8, 1.2], [0, -2.6, 1.4], [2.8, -1.8, 1.2]]) ellipse(g, hx, hy, rx, 0.8, '#8b8f94');
    for (const hx of [-2.2, 2.2]) ellipse(g, hx, 2.4, 0.9, 0.9, '#c9cbcf');
  } else if (k === 'lori') {
    rr(g, -4.6, -6, 9.2, 12, 1.2, '#b88a5a');
    rr(g, -3.6, -4.6, 7.2, 9.6, 0.6, '#fffdf6');
    rr(g, -2, -7, 4, 2.4, 0.8, '#c9ced3');
    for (const ly of [-2.6, -0.6, 1.4]) line(g, [[-2.4, ly], [2.4, ly]], '#9fb0b8', 0.5);
    line(g, [[-1.6, 3.2], [-0.6, 4.2], [1.8, 2.4]], '#4caf7a', 0.8);
  } else if (k === 'benedetto') {
    // A magnificent mustache, curled at both ends.
    for (const side of [-1, 1])
      path(
        g,
        p => {
          p.moveTo(0, -1.4);
          p.bezierCurveTo(side * 2.6, -3.4, side * 5.4, -1.6, side * 5.6, 0.4);
          p.bezierCurveTo(side * 6.2, 1.6, side * 7.2, 0.8, side * 6.8, -0.6);
          p.bezierCurveTo(side * 6.6, 2.6, side * 2.6, 2.4, 0, 0.4);
          p.closePath();
        },
        '#4a3428'
      );
    ellipse(g, 0, -3.6, 1.5, 1.2, '#e3a88a');
  } else if (k === 'stephanie' || k === 'julez') {
    heart(g, -5.6, -5.4, 0.8, '#ef7f8f');
    rect(g, -0.7, -2.6, 1.4, 4.6, '#ffffff');
    rect(g, -2.3, -1, 4.6, 1.4, '#ffffff');
  } else if (k === 'barb') {
    rr(g, -3, -4.6, 6, 11, 2, '#f4eedf', '#c9bfa8', 0.5);
    rr(g, -2.2, -7.2, 4.4, 2.8, 1, '#2f6fb2');
    rr(g, -3, -1.4, 6, 4, 0.6, '#2f6fb2');
    line(g, [[-2, 0.6], [2, -0.2]], '#f2c14e', 0.7);
  } else if (k === 'rowdy') {
    ellipse(g, 0, 1.6, 3.6, 4.2, '#968877');
    ellipse(g, 0, 3.2, 2, 1.8, '#fbf9f3');
    for (const side of [-1, 1])
      path(
        g,
        p => {
          p.moveTo(side * 1.6, -1.6);
          p.bezierCurveTo(side * 6, -7.6, side * 10, -0.4, side * 6.4, 2.2);
          p.bezierCurveTo(side * 3.8, 3.8, side * 3, 0.4, side * 5, 0);
        },
        null,
        '#e4aa2d',
        2
      );
  } else if (k === 'cats') {
    for (const [px, py, r] of [[-3.2, 1.8, -0.3], [3, -2.6, 0.3]]) {
      g.save();
      g.translate(px, py);
      g.rotate(r);
      ellipse(g, 0, 0.8, 2, 1.6, '#4a3f45');
      for (const [tx, ty] of [[-2, -1.2], [-0.7, -2.1], [0.7, -2.1], [2, -1.2]]) ellipse(g, tx, ty, 0.75, 0.9, '#4a3f45');
      g.restore();
    }
  } else
    path(
      g,
      p => {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5,
            r = i % 2 ? 2.6 : 6;
          i ? p.lineTo(Math.cos(a) * r, Math.sin(a) * r) : p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        p.closePath();
      },
      '#f2c14e',
      '#d49a22',
      0.6
    );
  g.restore();
}

// A get-well card centered on the origin: paper, a doodle, the sender, a pin. w by h.
function getWellCard(g, card, w = 28, h = 22, pinned = true) {
  const seed = cardSeed(card),
    paper = CARD_PAPERS[seed % CARD_PAPERS.length],
    k = h / 22;
  rr(g, -w / 2 + 1, -h / 2 + 1.6, w, h, 2, '#3b2a1c33');
  rr(g, -w / 2, -h / 2, w, h, 2, paper, '#5b4a3a33', 0.6);
  line(g, [[-w / 2 + 2, -h / 2 + 2], [w / 2 - 2, -h / 2 + 2]], '#ffffffaa', 0.6);
  cardDoodle(g, card && card.who, 0, -h * 0.1, 0.92 * k, paper);
  label(g, cardShortName(card && card.name), 0, h / 2 - 2.4 * k, 5.2 * k, '#5a4a52', 'center');
  if (pinned) {
    ellipse(g, 0, -h / 2 + 1.4, 1.8 * k, 1.8 * k, CARD_PINS[seed % CARD_PINS.length]);
    ellipse(g, -0.5 * k, -h / 2 + 0.9, 0.6 * k, 0.6 * k, '#ffffffaa');
  }
}

// Where a card sits on the board: twelve slots in two rows, each a little askew. Returns
// [{ card, x, y, rot }] oldest first (newest drawn last, on top) plus the stack size for slot 0.
const WALL_CARD_SLOTS = 12;

function wallCardLayout(cards) {
  const list = Array.isArray(cards) ? cards.filter(c => c && typeof c === 'object') : [],
    n = list.length,
    stack = n > WALL_CARD_SLOTS ? n - (WALL_CARD_SLOTS - 1) : 0,
    shown = stack ? list.slice(n - (WALL_CARD_SLOTS - 1)) : list,
    b = WALL_BOARD,
    first = stack ? 1 : 0,
    slots = [];
  shown.forEach((card, i) => {
    const slot = i + first,
      col = slot % 6,
      row = Math.floor(slot / 6);
    slots.push({
      card,
      x: b.x + 19 + col * 25 + (roomHash(slot, 1) - 0.5) * 3,
      y: b.y + 18 + row * 27 + (roomHash(slot, 2) - 0.5) * 3,
      rot: (roomHash(slot, 3) - 0.5) * 0.34
    });
  });
  return { slots, stack, stackCard: stack ? list[stack - 1] : null };
}

// The whole board's cards. Drawn into a cache by world.js and redrawn only when the cards change.
function wallCardsArt(g, cards) {
  const lay = wallCardLayout(cards);
  if (!lay.slots.length) {
    label(g, 'get-well wall', WALL_BOARD.x + WALL_BOARD.w / 2, WALL_BOARD.y + 35, 8, '#8c6a4a99', 'center');
    return lay;
  }
  if (lay.stack) {
    const sx = WALL_BOARD.x + 19,
      sy = WALL_BOARD.y + 18;
    for (let i = 2; i >= 0; i--) {
      g.save();
      g.translate(sx + i * 1.6, sy + i * 1.2);
      g.rotate(-0.12 + i * 0.1);
      if (i) rr(g, -14, -11, 28, 22, 2, CARD_PAPERS[(i * 2) % CARD_PAPERS.length], '#5b4a3a33', 0.6);
      else getWellCard(g, lay.stackCard);
      g.restore();
    }
  }
  for (const s of lay.slots) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.rot);
    getWellCard(g, s.card);
    g.restore();
  }
  // The overflow tag sits on the stack's corner, over everything.
  if (lay.stack) {
    const tx = WALL_BOARD.x + 4,
      ty = WALL_BOARD.y + 3;
    rr(g, tx, ty, 19, 11, 5.5, '#e5534b', '#ffffffdd', 0.9);
    label(g, '+' + lay.stack, tx + 9.5, ty + 8.2, 7.5, '#ffffff', 'center');
  }
  return lay;
}

// ---- The cats at home (the cat cam) ----
// u is the unit (the screen height / 90); (x, y) is where each cat meets the floor.

// Addie, 13, black and white, asleep in the sunbeam. Breathes; one ear twitches now and then.
function catAddie(g, x, y, u, t) {
  const breathe = 1 + 0.04 * Math.sin(t * 1.7),
    tw = t % 4.6,
    twitch = tw < 0.32 ? Math.sin((tw / 0.32) * Math.PI * 2) * 0.55 : 0;
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  ellipse(g, 0, 0.8, 15, 2.4, '#00000022');
  path(
    g,
    p => {
      p.moveTo(11, -2.4);
      p.quadraticCurveTo(5, 3, -9, 0.4);
    },
    null,
    '#25232a',
    3.2
  );
  ellipse(g, -9.4, 0.4, 1.7, 1.5, '#f4f1ea');
  g.save();
  g.translate(0, 0.5);
  g.scale(1, breathe);
  ellipse(g, 1.5, -5.6, 13, 6.6, '#25232a');
  ellipse(g, 3, -8.8, 8, 2, '#3a3740');
  ellipse(g, 5, -2.6, 5.4, 2.4, '#f4f1ea');
  g.restore();
  ellipse(g, -8.6, -4.6, 5.6, 4.6, '#25232a');
  poly(g, [[-12.8, -7.2], [-12.2, -11.4], [-9.6, -8.6]], '#25232a');
  g.save();
  g.translate(-6.4, -8.4);
  g.rotate(twitch);
  poly(g, [[-1.2, 0], [0.4, -4.2], [2.2, -0.2]], '#25232a');
  poly(g, [[-0.4, -0.4], [0.4, -2.8], [1.3, -0.5]], '#e8a0a8');
  g.restore();
  poly(g, [[-9.2, -8.6], [-8.2, -8.6], [-8.4, -4.4], [-9, -4.4]], '#f4f1ea');
  ellipse(g, -9.2, -3, 2.7, 2, '#f4f1ea');
  for (const ex of [-10.9, -7]) {
    path(
      g,
      p => {
        p.moveTo(ex - 1.2, -5.4);
        p.quadraticCurveTo(ex, -4.6, ex + 1.2, -5.4);
      },
      null,
      '#cfc8bd',
      0.6
    );
  }
  ellipse(g, -9.2, -3.8, 0.7, 0.5, '#e8a0a8');
  ellipse(g, -3.6, -0.6, 2.1, 1.2, '#f4f1ea');
  ellipse(g, -0.4, -0.4, 2.1, 1.2, '#f4f1ea');
  const zq = (t % 3.4) / 3.4;
  g.globalAlpha *= Math.sin(zq * Math.PI) * 0.9;
  label(g, 'z', -13 - zq * 3, -12 - zq * 9, 4 + zq * 2.5, '#ffffff', 'center');
  g.restore();
}

// Stella, one, an elegant brown, grey and black tabby. Sits tall, tail curled, grooms a paw.
function catStella(g, x, y, u, t) {
  const cyc = t % 5.4,
    groom = cyc < 2.4 ? macyEnvelope(cyc, 2.4, 0.4, 0.4) : 0,
    lick = groom > 0.6 ? Math.sin(t * 13) : 0,
    blink = groom < 0.1 && t % 6.1 > 5.9;
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  ellipse(g, 0, 0.6, 9.5, 2, '#00000022');
  path(
    g,
    p => {
      p.moveTo(6, -4);
      p.bezierCurveTo(12, 0, 5, 2.6, -7, 0.6);
    },
    null,
    '#7a6a5a',
    3
  );
  for (const tx of [3, -1, -4.5]) line(g, [[tx, -0.6], [tx + 0.6, 1.6]], '#4b3f35', 1);
  path(
    g,
    p => {
      p.moveTo(-6.4, 0);
      p.bezierCurveTo(-8.6, -10, -5.4, -19, 0, -20);
      p.bezierCurveTo(5.4, -19, 8.6, -10, 6.4, 0);
      p.closePath();
    },
    gradient(g, 0, -20, 0, 20, '#9e8e7b', '#76675a')
  );
  for (const [sx, sy] of [[-5.6, -12], [-6.2, -7], [5.6, -12], [6.2, -7]])
    path(
      g,
      p => {
        p.moveTo(sx, sy);
        p.quadraticCurveTo(sx * 0.7, sy - 1.6, sx * 0.45, sy - 0.4);
      },
      null,
      '#4b3f35',
      1.1
    );
  ellipse(g, 0, -10.5, 3.4, 5.4, '#d6c9b5');
  ellipse(g, 2.4, -0.6, 2, 1.3, '#cdbfac');
  const pawX = macyMix(-2.4, -1.6 + lick * 0.4, groom),
    pawY = macyMix(-0.6, -19.8 + Math.abs(lick) * 0.8, groom);
  if (groom > 0.05) line(g, [[-2.6, -9], [pawX, pawY]], '#9a8a77', 2.6);
  const hy = -24 + groom * 1.4;
  g.save();
  g.translate(0, hy);
  g.rotate(-0.22 * groom);
  for (const side of [-1, 1]) {
    poly(g, [[side * 5.6, -2], [side * 4.6, -8.4], [side * 1.6, -4.4]], '#8d7d6a');
    poly(g, [[side * 4.6, -2.8], [side * 4.2, -6.6], [side * 2.4, -4.2]], '#e7b3b0');
  }
  ellipse(g, 0, 0, 6.2, 5.4, '#9e8e7b');
  for (const mx of [-1.6, 0, 1.6]) line(g, [[mx, -4.8], [mx * 0.6, -2.6]], '#4b3f35', 0.7);
  line(g, [[-6, 0.4], [-3.8, 0.2]], '#4b3f35', 0.6);
  line(g, [[6, 0.4], [3.8, 0.2]], '#4b3f35', 0.6);
  ellipse(g, 0, 2.2, 3, 2.2, '#e2d6c4');
  for (const ex of [-2.4, 2.4]) {
    if (groom > 0.4 || blink)
      path(
        g,
        p => {
          p.moveTo(ex - 1.3, -0.6);
          p.quadraticCurveTo(ex, 0.4, ex + 1.3, -0.6);
        },
        null,
        '#3b322b',
        0.6
      );
    else {
      ellipse(g, ex, -0.6, 1.5, 1.1, '#a5d46c');
      ellipse(g, ex, -0.6, 0.35, 0.95, '#1f1d1a');
    }
  }
  ellipse(g, 0, 1.4, 0.8, 0.55, '#e3909c');
  g.restore();
  if (groom > 0.05) {
    ellipse(g, pawX, pawY, 1.9, 1.5, '#cdbfac');
    if (lick > 0.3) ellipse(g, pawX + 1.2, pawY - 0.6, 0.8, 0.5, '#ef8f9c');
  } else ellipse(g, -2.4, -0.6, 2, 1.3, '#cdbfac');
  g.restore();
}

// Pepper's moment: a hand with a treat creeps in from the right, she wiggles, pounces, and the hand
// leaves faster than it came. Then she sits there, a picture of innocence. One cycle is PEPPER_CYCLE s.
const PEPPER_CYCLE = 6.2;

function pepperMoment(t) {
  const c = t % PEPPER_CYCLE;
  return {
    c,
    hand: macyEase(c, 0, 1.2) * (1 - macyEase(c, 1.5, 1.8)),
    treat: c < 1.62,
    crouch: macyEase(c, 0.5, 0.9) * (1 - macyEase(c, 1.35, 1.45)),
    wiggle: c > 0.9 && c < 1.35 ? Math.sin(c * 40) : 0,
    pounce: c > 1.35 && c < 1.85 ? Math.sin(((c - 1.35) / 0.5) * Math.PI) : 0,
    innocent: macyEase(c, 1.95, 2.15) * (1 - macyEase(c, 4.4, 4.7))
  };
}

// The hand with a treat. (x, y) is the treat; the sleeve trails off to the right.
function catHand(g, x, y, u, treat = true) {
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  rr(g, 6, -3.6, 18, 7.2, 2.5, '#7fa7d9');
  rr(g, 5, -3.9, 3, 7.8, 1.2, '#f2f2f2');
  ellipse(g, 2.2, 0, 4.4, 3.3, '#f1c09c');
  ellipse(g, -1.6, -1.1, 2.6, 1.2, '#f1c09c');
  ellipse(g, -1, 1.5, 2, 1, '#e8b08b');
  if (treat) {
    ellipse(g, -4.4, -0.4, 2, 1.4, '#a8642f');
    ellipse(g, -4.9, -0.8, 0.7, 0.4, '#d8955a');
  }
  g.restore();
}

// Pepper, one, a black and white kitten with opinions.
function catPepper(g, x, y, u, m, t) {
  const jump = m.pounce,
    dx = jump * 8 + m.wiggle * 0.5 * m.crouch,
    dy = -jump * 7,
    crouch = m.crouch,
    flick = Math.sin(t * 5) * 1.5;
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  ellipse(g, dx * 0.6, 0.6, 7 - jump * 2, 1.6, '#00000022');
  g.translate(dx, dy);
  path(
    g,
    p => {
      p.moveTo(-4, -4);
      p.quadraticCurveTo(-9.5, -8 - flick, -7.4 + crouch * 2, -14 + crouch * 5);
    },
    null,
    '#1f1d22',
    2.1
  );
  g.save();
  g.translate(0, -4.6);
  g.scale(1 + jump * 0.35, 1 - crouch * 0.28);
  ellipse(g, 0, 0, 6, 5, '#1f1d22');
  ellipse(g, 1.4, 1.2, 3.2, 2.6, '#f6f3ec');
  g.restore();
  if (jump > 0.2) {
    ellipse(g, 7, -7.4, 1.7, 1.1, '#f6f3ec');
    ellipse(g, 7.6, -5, 1.7, 1.1, '#f6f3ec');
  } else {
    ellipse(g, -2, -0.4, 1.6, 1, '#f6f3ec');
    ellipse(g, 2.6, -0.4, 1.6, 1, '#f6f3ec');
  }
  const hx = 1.6 + jump * 1.5,
    hy = -11.6 + crouch * 3.2;
  g.save();
  g.translate(hx, hy);
  for (const side of [-1, 1]) {
    poly(g, [[side * 4.8, -1.6], [side * 4.6, -7.6], [side * 1.4, -3.8]], '#1f1d22');
    poly(g, [[side * 4, -2.4], [side * 3.9, -6], [side * 2.2, -3.6]], '#e8a0a8');
  }
  ellipse(g, 0, 0, 5.4, 4.8, '#1f1d22');
  poly(g, [[-0.7, -4.6], [0.7, -4.6], [1.4, 0], [-1.4, 0]], '#f6f3ec');
  ellipse(g, 0, 2, 2.9, 2.1, '#f6f3ec');
  const big = Math.max(m.innocent, crouch);
  for (const ex of [-2.2, 2.2]) {
    ellipse(g, ex, -0.6, 1.7, 1.9, '#d8e46a');
    ellipse(g, ex + 0.1, -0.5, 0.45 + big * 0.95, 1.2 + big * 0.5, '#151317');
    if (m.innocent > 0.2) {
      ellipse(g, ex - 0.5, -1.3, 0.45, 0.45, '#ffffff');
      ellipse(g, ex + 0.5, -0.1, 0.25, 0.25, '#ffffff');
    }
  }
  ellipse(g, 0, 1.3, 0.7, 0.5, '#e8a0a8');
  if (m.innocent > 0.05) {
    g.save();
    g.globalAlpha *= m.innocent;
    path(g, p => p.ellipse(0, -9, 3.8, 1.1, 0, 0, Math.PI * 2), null, '#ffe58a', 0.8);
    g.restore();
  }
  g.restore();
  g.restore();
}

// ---- The TV ----
// Channel pictures at w by h, drawn in screen-local coordinates (world.js clips and places them).
// Static backdrops are cached per size; the cats, the rally and the cards move on top.
// The fourth channel only exists in the room after dark, and only when src/tvlate.js is in the build.
const TV_CHANNELS = ['CAT CAM', 'RAMS GAME', 'GET WELL', '3 AM'],
  tvStatics = new Map();

function tvStatic(kind, w, h, paint) {
  const key = kind + ':' + Math.round(w) + 'x' + Math.round(h);
  let cv = tvStatics.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    paint(configureCanvas(cv, w, h), w, h);
    tvStatics.set(key, cv);
  }
  return cv;
}

function tvCatRoom(g, w, h) {
  const u = h / 90,
    fy = h * 0.6;
  rect(g, 0, 0, w, fy, gradient(g, 0, 0, 0, fy, '#f2dfc4', '#e2c6a2'));
  rect(g, 0, fy, w, h - fy, gradient(g, 0, fy, 0, h - fy, '#ba895e', '#946546'));
  for (let i = 1; i < 5; i++) line(g, [[0, fy + i * (h - fy) / 5], [w, fy + i * (h - fy) / 5]], '#7f553a44', 0.6);
  rect(g, 0, fy - 2 * u, w, 2.4 * u, '#fff4e2');
  rr(g, w * 0.05, h * 0.08, w * 0.22, h * 0.38, 2 * u, '#fff6e6');
  rr(g, w * 0.05 + 2 * u, h * 0.08 + 2 * u, w * 0.22 - 4 * u, h * 0.38 - 4 * u, u, gradient(g, 0, h * 0.1, 0, h * 0.3, '#a9d9ec', '#e4f2e2'));
  line(g, [[w * 0.16, h * 0.08], [w * 0.16, h * 0.46]], '#fff6e6', 1.4 * u);
  poly(g, [[w * 0.05, h * 0.46], [w * 0.27, h * 0.46], [w * 0.44, h * 0.99], [w * 0.06, h * 0.99]], '#fff3c440');
  ellipse(g, w * 0.5, h * 0.86, w * 0.4, h * 0.1, '#c97b6e');
  ellipse(g, w * 0.5, h * 0.86, w * 0.33, h * 0.075, '#dd9a8a');
  rr(g, w * 0.6, h * 0.24, w * 0.34, h * 0.3, 5 * u, '#86a7b9');
  rr(g, w * 0.62, h * 0.3, w * 0.14, h * 0.15, 3 * u, '#9dbccc');
  rr(g, w * 0.78, h * 0.3, w * 0.14, h * 0.15, 3 * u, '#9dbccc');
  rr(g, w * 0.36, h * 0.1, w * 0.13, h * 0.24, u, '#7c5a3c');
  rr(g, w * 0.36 + 1.4 * u, h * 0.1 + 1.4 * u, w * 0.13 - 2.8 * u, h * 0.24 - 2.8 * u, u, '#2a63c9');
  label(g, String(Number.isInteger(state.jersey) ? state.jersey : 22), w * 0.425, h * 0.27, 8 * u, '#f2c43f', 'center');
}

function tvCatCam(g, w, h, t) {
  const u = h / 90,
    m = pepperMoment(t);
  g.drawImage(tvStatic('cat', w, h, tvCatRoom), 0, 0, w, h);
  catAddie(g, w * 0.22, h * 0.84, u, t);
  catStella(g, w * 0.5, h * 0.88, u, t);
  if (m.hand > 0) catHand(g, w + 6 * u - m.hand * 20 * u, h * 0.74, u, m.treat);
  catPepper(g, w * 0.76, h * 0.88, u, m, t);
  rect(g, 0, h - 9 * u, w, 9 * u, '#10131aa0');
  for (const [nx, name] of [[0.22, 'ADDIE'], [0.5, 'STELLA'], [0.76, 'PEPPER']])
    label(g, name, w * nx, h - 2.6 * u, 5.4 * u, '#fff6e2', 'center');
  ellipse(g, 6 * u, 6 * u, 1.8 * u, 1.8 * u, Math.sin(t * 4) > 0 ? '#ff4d4d' : '#ff4d4d66');
  label(g, 'CAT CAM · HOME', 10 * u, 8 * u, 5.2 * u, '#ffffff', 'left');
}

function tvGym(g, w, h) {
  const u = h / 90;
  rect(g, 0, 0, w, h * 0.42, gradient(g, 0, 0, 0, h * 0.42, '#1b2c54', '#2c4278'));
  for (let i = 0; i < 4; i++) rect(g, 0, h * (0.14 + i * 0.065), w, 1.4 * u, '#3a5490');
  for (let i = 0; i < 40; i++)
    ellipse(g, roomHash(i, 51) * w, h * (0.16 + roomHash(i, 52) * 0.22), 1.3 * u, 1.3 * u, ['#f2c43f', '#2a63c9', '#f4f1ea', '#d9534f'][i % 4]);
  rect(g, 0, h * 0.42, w, h * 0.58, '#c98f52');
  poly(g, [[w * 0.33, h * 0.42], [w * 0.67, h * 0.42], [w * 0.92, h], [w * 0.08, h]], '#e2b06c');
  path(
    g,
    p => {
      p.moveTo(w * 0.33, h * 0.42);
      p.lineTo(w * 0.67, h * 0.42);
      p.lineTo(w * 0.92, h);
      p.moveTo(w * 0.08, h);
      p.lineTo(w * 0.33, h * 0.42);
      p.moveTo(w * 0.25, h * 0.64);
      p.lineTo(w * 0.75, h * 0.64);
      p.moveTo(w * 0.21, h * 0.74);
      p.lineTo(w * 0.79, h * 0.74);
    },
    null,
    '#fbf3e0',
    1.1 * u
  );
  rr(g, w * 0.36, h * 0.08, w * 0.28, h * 0.07, u, '#f2c43f');
  label(g, 'RAMS', w * 0.5, h * 0.14, 5.2 * u, '#1b2c54', 'center');
}

// A volleyball rally in the Ramsey gym, from behind the baseline, with a score bug.
function tvRamsGame(g, w, h, t) {
  const u = h / 90,
    rally = Math.floor(t / 2.8),
    q = (t % 2.8) / 2.8,
    toFar = q < 0.5,
    k = toFar ? q * 2 : 2 - q * 2,
    near = [w * 0.44, h * 0.8],
    far = [w * 0.56, h * 0.47],
    bx = macyMix(near[0], far[0], k),
    by = macyMix(near[1] - 12 * u, far[1] - 8 * u, k) - Math.sin(k * Math.PI) * h * 0.34,
    ramsey = 11 + Math.floor(rally * 0.55) % 15,
    visitors = 9 + Math.floor(rally * 0.4) % 13;
  g.drawImage(tvStatic('gym', w, h, tvGym), 0, 0, w, h);
  for (const [fx, ph] of [[0.4, 0], [0.5, 1], [0.6, 2]]) {
    const px = w * fx,
      py = h * 0.47 + Math.sin(t * 3 + ph) * 0.4 * u,
      s = 0.6 * u;
    rr(g, px - 3 * s, py - 9 * s, 6 * s, 8 * s, 2 * s, '#d9534f');
    ellipse(g, px, py - 11 * s, 2.2 * s, 2.2 * s, '#e9b48f');
  }
  rect(g, w * 0.22, h * 0.5, 1.2 * u, h * 0.16, '#d8dde3');
  rect(g, w * 0.78 - 1.2 * u, h * 0.5, 1.2 * u, h * 0.16, '#d8dde3');
  rect(g, w * 0.22, h * 0.52, w * 0.56, h * 0.07, '#1d1f24aa');
  for (let i = 1; i < 14; i++) rect(g, w * 0.22 + (i * w * 0.56) / 14, h * 0.52, 0.5, h * 0.07, '#ffffff55');
  rect(g, w * 0.22, h * 0.52, w * 0.56, 1.2 * u, '#f4f1ea');
  volleyball(g, bx, by, macyMix(3.6, 2, k) * u, t * 6);
  for (const [fx, ph] of [[0.28, 0], [0.5, 1.3], [0.72, 2.6]]) {
    const px = w * fx + Math.sin(t * 2 + ph) * u,
      py = h * 0.9,
      hit = fx === 0.5 && !toFar && k < 0.15,
      s = u;
    rr(g, px - 4 * s, py - 13 * s, 8 * s, 11 * s, 3 * s, '#2a63c9');
    rect(g, px - 4 * s, py - 5 * s, 8 * s, 3 * s, '#f2c43f');
    ellipse(g, px, py - 15.5 * s, 3 * s, 3 * s, '#6b4a3a');
    line(g, [[px - 3.6 * s, py - 11 * s], [px - 5 * s, py - (hit ? 21 : 6) * s]], '#e9b48f', 1.8 * s);
    line(g, [[px + 3.6 * s, py - 11 * s], [px + 5 * s, py - (hit ? 21 : 6) * s]], '#e9b48f', 1.8 * s);
  }
  rr(g, 3 * u, 3 * u, 58 * u, 18 * u, 2 * u, '#0f1a33e6');
  rect(g, 3 * u, 3 * u, 3 * u, 9 * u, '#f2c43f');
  rect(g, 3 * u, 12 * u, 3 * u, 9 * u, '#d9534f');
  label(g, 'RAMSEY', 9 * u, 10 * u, 5.6 * u, '#f2c43f', 'left');
  label(g, 'VISITORS', 9 * u, 19 * u, 5.6 * u, '#f4f1ea', 'left');
  label(g, String(ramsey), 57 * u, 10 * u, 6 * u, '#ffffff', 'right');
  label(g, String(visitors), 57 * u, 19 * u, 6 * u, '#ffffff', 'right');
  rr(g, w - 18 * u, 3 * u, 15 * u, 7 * u, 2 * u, '#d9534f');
  label(g, 'LIVE', w - 10.5 * u, 8.4 * u, 4.8 * u, '#ffffff', 'center');
  const tick = 'GIRLS VOLLEYBALL · RAMSEY RAMS · GET WELL SOON #' + (Number.isInteger(state.jersey) ? state.jersey : 22) + ' · ',
    tw = tick.length * 2.7 * u,
    off = reduced ? 0 : (t * 14 * u) % tw;
  rect(g, 0, h - 7 * u, w, 7 * u, '#0f1a33e6');
  for (let i = 0; i < 3; i++) label(g, tick, 2 * u - off + i * tw, h - 2 * u, 4.6 * u, '#f2c43f', 'left');
}

function tvCardRoom(g, w, h) {
  const u = h / 90;
  rect(g, 0, 0, w, h, gradient(g, 0, 0, w, h, '#ffd6e0', '#ffe8c4'));
  for (let i = 0; i < 26; i++)
    rr(g, roomHash(i, 61) * w, roomHash(i, 62) * h, 2.4 * u, 1.2 * u, 0.5 * u, ['#f08db5', '#7fcbd6', '#f2c43f', '#9fd38a'][i % 4]);
}

// "Get well Macy": a slow slideshow of the cards, newest first.
// trophy (optional): the Ensure trophy joins the show as its own slide, after the newest card.
function tvCardShow(g, w, h, t, cards, name = 'Macy', trophy = false) {
  const u = h / 90,
    list = Array.isArray(cards) ? cards.filter(c => c && typeof c === 'object') : [],
    n = list.length + (trophy ? 1 : 0);
  g.drawImage(tvStatic('cards', w, h, tvCardRoom), 0, 0, w, h);
  label(g, 'GET WELL ' + String(name || 'Macy').toUpperCase(), w / 2, 11 * u, 8 * u, '#b8456a', 'center');
  heart(g, w / 2 - 50 * u, 4 * u, 0.5 * u, '#ef7f8f');
  heart(g, w / 2 + 43 * u, 4 * u, 0.5 * u, '#ef7f8f');
  if (!n) {
    heart(g, w / 2 - 9 * u, h * 0.32, 1.3 * u, '#ef9aa8');
    label(g, 'NO CARDS YET', w / 2, h * 0.7, 7 * u, '#7a4a5a', 'center');
    label(g, 'THE HALLWAY IS ON IT', w / 2, h * 0.82, 5 * u, '#9a6a7a', 'center');
    return;
  }
  const step = Math.floor(t / 3.6),
    idx = n - 1 - (step % n),
    card = list[idx],
    fade = reduced ? 1 : macyEase(t % 3.6, 0, 0.35),
    cx = w * 0.12,
    cy = h * 0.2,
    cw = w * 0.76,
    ch = h * 0.64;
  if (!card) {
    g.save();
    g.globalAlpha *= fade;
    rr(g, cx, cy, cw, ch, 3 * u, '#2c2333');
    ensureTrophyArt(g, w * 0.32, cy + ch - 3 * u, 0.62 * u);
    label(g, 'THE ENSURE TROPHY', cx + cw * 0.46, cy + 16 * u, 6 * u, '#f2c14e', 'left');
    label(g, 'Refused fifty times.', cx + cw * 0.46, cy + 28 * u, 5 * u, '#f4ecd8', 'left');
    label(g, 'Dietary gave up.', cx + cw * 0.46, cy + 36 * u, 5 * u, '#f4ecd8', 'left');
    g.restore();
    label(g, 'SLIDE ' + (n - idx) + ' OF ' + n, w / 2, h - 3 * u, 4.6 * u, '#9a6a7a', 'center');
    return;
  }
  g.save();
  g.globalAlpha *= fade;
  rr(g, cx + u, cy + 1.6 * u, cw, ch, 3 * u, '#3b2a1c33');
  rr(g, cx, cy, cw, ch, 3 * u, CARD_PAPERS[cardSeed(card) % CARD_PAPERS.length], '#5b4a3a44', 0.8);
  cardDoodle(g, card.who, cx + 16 * u, cy + ch * 0.5, 2.1 * u);
  label(g, 'FROM ' + String(card.name || 'a friend').toUpperCase().slice(0, 26), cx + 32 * u, cy + 10 * u, 5 * u, '#7a4a5a', 'left');
  const words = String(card.text || '').split(/\s+/).filter(Boolean),
    lines = [],
    max = Math.max(8, Math.floor((cw - 36 * u) / (3 * u)));
  for (const word of words) {
    const lastLine = lines[lines.length - 1];
    if (lastLine !== undefined && (lastLine + ' ' + word).length <= max) lines[lines.length - 1] = lastLine + ' ' + word;
    else lines.push(word);
  }
  if (lines.length > 4) {
    lines.length = 4;
    lines[3] = lines[3].slice(0, max - 1) + '…';
  }
  lines.forEach((ln, i) => label(g, ln, cx + 32 * u, cy + 20 * u + i * 7.4 * u, 5.4 * u, '#4a3a42', 'left'));
  g.restore();
  label(g, (trophy ? 'SLIDE ' : 'CARD ') + (n - idx) + ' OF ' + n, w / 2, h - 3 * u, 4.6 * u, '#9a6a7a', 'center');
}

// Static between channels: a cached field of grey specks, slid around while it shows.
let tvNoiseSprite = null;

function tvNoise(g, w, h, t) {
  if (!tvNoiseSprite) {
    tvNoiseSprite = document.createElement('canvas');
    const ng = configureCanvas(tvNoiseSprite, 64, 36);
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 32; x++) {
        const v = Math.floor(roomHash(x, y + 70) * 200) + 40;
        rect(ng, x * 2, y * 2, 2, 2, `rgb(${v},${v},${v})`);
      }
  }
  const ox = (Math.floor(t * 30) % 4) * 8,
    oy = (Math.floor(t * 23) % 3) * 6;
  g.drawImage(tvNoiseSprite, -ox, -oy, w + 32, h + 18);
}

// A soft glow the TV throws on the wall, one cached sprite per channel color.
const TV_GLOW_COLORS = ['#ffe2a8', '#a9d2ff', '#ffc4d6', '#c9b8ff'],
  tvGlows = new Map();

function tvGlowSprite(col) {
  let cv = tvGlows.get(col);
  if (!cv) {
    cv = document.createElement('canvas');
    const gg = configureCanvas(cv, 128, 96);
    const grd = gg.createRadialGradient(64, 48, 6, 64, 48, 62);
    grd.addColorStop(0, col + 'cc');
    grd.addColorStop(0.5, col + '44');
    grd.addColorStop(1, col + '00');
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 128, 96);
    tvGlows.set(col, cv);
  }
  return cv;
}

// ---- The Ensure cult, room side ----
// Barb's bottle from the hallway, same silhouette and colors: chocolate, vanilla, strawberry. (x, y)
// is the bottom center.
const ROOM_ENSURE_BANDS = ['#7a4b33', '#e9d39a', '#ef9fb0'],
  ROOM_ENSURE_CAPS = ['#623c29', '#baa97b', '#bf7f8d'];

function roomBottle(g, x, y, flavor = 0, s = 1, ground = false) {
  const f = ((flavor % 3) + 3) % 3;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (ground) shadow(g, 0, 1, 8, 2.6);
  rr(g, -5, -17, 10, 17, 3, '#f4efe2', '#a59c8a', 0.7);
  rr(g, -5, -12, 10, 7, 1.5, ROOM_ENSURE_BANDS[f]);
  rr(g, -3.4, -21, 6.8, 5, 1.6, ROOM_ENSURE_CAPS[f]);
  line(g, [[-2.6, -15], [-2.6, -3]], '#ffffff88', 1);
  g.restore();
}

// A cardboard six-pack: three bottles behind, three in front, a carrier band. (x, y) bottom center.
function ensureSixPack(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 1, 20, 4);
  for (let i = 0; i < 3; i++) roomBottle(g, -10 + i * 10, -3, i, 0.72);
  for (let i = 0; i < 3; i++) roomBottle(g, -11 + i * 10.5, 0, 2 - i, 0.78);
  rr(g, -17, -9, 34, 9, 2, '#c9a06a', '#9a7448', 0.8);
  rr(g, -6, -15, 12, 7, 3, null, '#9a7448', 1.4);
  line(g, [[-14, -5], [14, -5]], '#e3c08c', 0.8);
  g.restore();
}

// The trophy: one bottle on a tiny pedestal in a glass case, labeled FINE. YOU WIN. (x, y) is the
// bottom center of the stand.
function ensureTrophyArt(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  shadow(g, 0, 2, 30, 6);
  rr(g, -24, -14, 48, 15, 3, '#7a5a40', '#5a3f2c', 1);
  rr(g, -22, -76, 44, 62, 4, '#e6f6fb33', '#9cc7d4', 1.4);
  rr(g, -9, -34, 18, 16, 2, gradient(g, -9, -34, 18, 16, '#ffe08a', '#c9962c'));
  rr(g, -11, -36, 22, 4, 1.5, '#f2c14e');
  roomBottle(g, 0, -36, 0, 1.15);
  rr(g, -20, -12, 40, 9, 2, '#3a2c1c');
  label(g, 'FINE. YOU WIN.', 0, -5.6, 6.2, '#f2c14e', 'center');
  line(g, [[-17, -72], [-12, -60]], '#ffffff66', 1.2);
  line(g, [[15, -72], [17, -66]], '#ffffff44', 1);
  spark(g, 12, -62, '#fff3c4', 0.32);
  g.restore();
}

// The Employee of the Month badge: a tiny gold frame with a star. (x, y) is its bottom center.
function machineBadge(g, x, y) {
  rr(g, x - 8, y - 13, 16, 13, 2.5, '#f2c14e', '#a77a1c', 1);
  rr(g, x - 5.5, y - 10.5, 11, 8, 1.5, '#fff3c4');
  spark(g, x, y - 6.5, '#d49a22', 0.32);
}

// Small portraits for the Employee of the Month frame in the hallway. About 48 by 48 at s = 1,
// centered on (x, y). No text, so they stay crisp at any size.
function drawMachineIcon(g, id, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (id === 'mri' || id === 'ct') {
    const warm = id === 'ct';
    rr(g, -22, -18, 44, 40, 10, gradient(g, -22, -18, 44, 40, '#f0f1df', warm ? '#d8b98e' : '#92b9c0'), '#5f8c9d', 1);
    ellipse(g, 0, -2, 15, 16, warm ? '#c9a06a' : '#87adb7');
    ellipse(g, 0, -2, 11, 12, gradient(g, -11, -14, 22, 24, '#1d415b', '#4a7f91'));
    rr(g, -8, 12, 16, 8, 3, '#edf2dd');
    if (warm) for (const [sx, sy, c] of [[-10, -12, '#f08db5'], [9, -10, '#7fcbd6'], [-12, 6, '#f2c43f'], [11, 7, '#9fd38a']]) rr(g, sx, sy, 3, 1.4, 0.6, c);
    else for (const a of [0.6, 2.2, 3.8]) spark(g, Math.cos(a) * 19, -2 + Math.sin(a) * 19, '#bfe9ff', 0.28);
  } else if (id === 'cuff') {
    g.scale(0.85, 0.85);
    bpCuffArt(g, 0, -14, 2);
  }
  else if (id === 'ultrasound') {
    rr(g, -20, -20, 34, 26, 4, '#4a7284', '#c3d5cf', 1);
    rr(g, -17, -17, 28, 20, 2, '#153b50');
    path(g, p => p.ellipse(-3, -6, 9, 6, 0, Math.PI * 1.1, Math.PI * 1.9), null, '#b5e7be', 1.4);
    rr(g, -8, 6, 14, 14, 3, '#9dbebd');
    rr(g, 12, -4, 7, 18, 3, '#e8e2d4', '#9aa', 0.8);
    rr(g, 13, -10, 5, 7, 2, '#f1d17f');
  } else if (id === 'vending') {
    rr(g, -16, -22, 32, 44, 3, '#72899a');
    rr(g, -13, -19, 20, 30, 2, '#3d6170');
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) rect(g, -11 + c * 6.4, -16 + r * 9, 4, 5, (r + c) % 2 ? '#e0b383' : '#9ac6a3');
    rr(g, 9, -12, 4, 10, 1.5, '#a2b4af');
    rect(g, -11, 14, 16, 4, '#2c4d5d');
  } else if (id === 'pump') {
    line(g, [[0, -24], [0, 22]], '#a3c3c7', 3);
    rr(g, 2, -24, 12, 16, 3, '#e7f1dccc', '#bbd5c9', 0.8);
    rr(g, 4, -19, 8, 9, 2, '#edcb80');
    rr(g, -12, -4, 24, 18, 4, '#386e7b', '#b0cbd0', 1);
    rr(g, -9, -1, 18, 10, 2, '#acd9bb');
    vectorDigits(g, '88', 0, 4, 7, '#296465');
  } else if (id === 'monitor') {
    rr(g, -22, -18, 44, 32, 5, gradient(g, 0, -18, 0, 32, '#82a6ac', '#4a7284'), '#c3d5cf', 1);
    rr(g, -18, -14, 36, 24, 3, '#153b50');
    line(g, [[-15, 0], [-8, 0], [-5, -5], [-2, 6], [2, -9], [5, 0], [8, 0]], '#b5e7be', 1.4);
    vectorDigits(g, '88', 11, -7, 6, '#ffe29b');
    line(g, [[0, 14], [0, 22]], '#678d98', 4);
  } else if (id === 'bed') {
    bed(g, 0, 24, 0.32);
    label(g, 'z', 12, -14, 9, '#5a7f8a', 'center');
  } else if (id === 'etype') etype(g, 0, 10, 0.66);
  else spark(g, 0, 0, '#f2c14e', 1.2);
  g.restore();
}
