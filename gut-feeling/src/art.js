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

function girl(g, x, y, scale = 1, pose = 0, dir = 1, inv = false, groundShadow = true) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  const walk = Math.sin(pose),
    bounce = pose ? Math.abs(walk) * 1.7 : Math.sin(time * 2.3) * 0.45;
  if (groundShadow) shadow(g, 0, 2, 19, 5);
  if (inv) g.globalAlpha = 0.64 + 0.36 * Math.sin(time * 18);
  g.translate(0, -bounce);
  // The ponytail follows the stride instead of stepping between sprite frames.
  const tail = dir * (21 + Math.sin(time * 4.1 + pose * 0.35) * 3);
  path(
    g,
    p => {
      p.moveTo(dir * 11, -77);
      p.bezierCurveTo(dir * 33, -83, dir * 23, -50, tail, -41);
      p.bezierCurveTo(tail + dir * 15, -27, dir * 15, -30, dir * 13, -45);
      p.bezierCurveTo(dir * 11, -56, dir * 26, -70, dir * 11, -72);
    },
    gradient(g, 0, -80, 28, 50, '#704c3e', '#3c2830'),
    '#352a31',
    1.2
  );
  // The stride and sleeves move independently.
  for (let i = 0; i < 2; i++) {
    let side = i ? 1 : -1,
      step = side * walk * 5;
    line(
      g,
      [
        [side * 6, -26],
        [side * 7 + step * 0.27, -13],
        [side * 7 + step, 0]
      ],
      i ? '#33475e' : '#28394d',
      7
    );
    line(g, [[side * 7 + step, -6], [side * 7 + step, -1]], '#f3bb99', 5);
    rr(g, side * 7 + step - 6, -2, 15, 7, 3, '#f6f3de', '#61777f', 0.8);
    line(g, [[side * 7 + step - 4, 3], [side * 7 + step + 7, 3]], '#86b7b4', 1.5);
  }
  for (let side of [-1, 1]) {
    let swing = -side * walk * 3;
    path(
      g,
      p => {
        p.moveTo(side * 11, -48);
        p.quadraticCurveTo(side * 19, -38, side * 17 + swing, -28);
      },
      null,
      '#4caaa2',
      8
    );
    ellipse(g, side * 17 + swing, -26, 3.3, 4.4, '#e8ac8b');
    if (side === 1) line(g, [[side * 15 + swing, -30], [side * 20 + swing, -29]], '#ecf4e8', 2);
  }
  rr(g, -13, -51, 27, 28, 8, gradient(g, -13, -50, 26, 25, '#a5e2c9', '#5bb9ac'), '#398c88', 1.1);
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
  line(g, [[-8, -28], [9, -28]], '#3e9d96', 1);
  spark(g, 2, -38, '#e5e5ac', 0.55);
  line(g, [[-8, -42], [-7, -30]], '#bcf0d344', 1.5);
  rr(g, -3, -57, 8, 9, 3, '#dca17f');
  // Hair cap, face, eyebrows, brown eyes and a little patient optimism.
  ellipse(g, 0, -68, 15, 17, '#493039');
  ellipse(g, 1, -65, 12.7, 14.4, gradient(g, -10, -76, 22, 25, '#ffdab3', '#e9ad8c'));
  ellipse(g, -11, -63, 3.3, 4.6, '#e8ae8b');
  ellipse(g, 12, -63, 3.1, 4.4, '#efb997');
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
  const blink = time % 5.2 > 5.04;
  for (let ex of [-4.8, 6]) {
    if (blink)
      line(g, [[ex - 2.5, -65], [ex + 2.5, -65]], '#543c34', 1.2);
    else {
      ellipse(g, ex, -65, 2.5, 3.5, '#fff8e9');
      ellipse(g, ex + 0.5, -64.8, 1.65, 2.7, '#735037');
      ellipse(g, ex + 0.8, -64.5, 0.85, 1.8, '#322c31');
      ellipse(g, ex, -66, 0.65, 0.85, '#ffffff');
    }
    line(g, [[ex - 2.4, -70], [ex + 2, -70.5]], '#654636', 1.1);
  }
  ellipse(g, -6.5, -59, 3, 1.5, '#ef9e8b55');
  ellipse(g, 9, -59, 2.5, 1.4, '#ef9e8b55');
  path(
    g,
    p => {
      p.moveTo(-1, -55);
      p.quadraticCurveTo(3, -52.3, 6, -55);
    },
    null,
    '#a7645d',
    1
  );
  ellipse(g, dir * 15, -77, 3.4, 3.2, '#f1abbd');
  g.restore();
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
  for (let i = 0; i < 6; i++) {
    let side = i % 2 ? 1 : -1,
      yy = -30 - Math.floor(i / 2) * 12;
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

function windowArt(g, x, y, w = 190, h = 100) {
  rr(g, x - 8, y - 7, w + 16, h + 19, 8, '#3c74804d');
  rr(g, x - 4, y - 3, w + 8, h + 6, 6, '#edf0db');
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
  line(g, [[x + w / 2, y + 2], [x + w / 2, y + h]], '#edf0db', 7);
  line(g, [[x + 1, y + h * 0.48], [x + w - 1, y + h * 0.48]], '#edf0db', 5);
  rr(g, x - 13, y + h, w + 26, 9, 4, '#e3e9d0');
  for (let side of [-1, 1]) {
    let xx = side < 0 ? x - 24 : x + w + 5;
    rr(g, xx, y - 7, 20, h + 12, 5, gradient(g, xx, y, 20, 0, '#64a89d', '#a9d1b4'));
    line(g, [[xx + 7, y], [xx + 7, y + h - 2]], '#c2e4c055', 2);
  }
}

function poster(g, x, y, kind = 0) {
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

// The full room illustration. Use roomBg() in frame code; it caches this per room.
function roomIllustration(g, id) {
  const themes = ['#82bcad', '#7bb6c7', '#b6a0bb', '#c7b18e', '#91bda7'];
  floor(g, 1000, 625, themes[id]);
  if (id === 0) {
    windowArt(g, 370, 21, 214, 102);
    poster(g, 782, 32, 0);
    rr(g, 176, 32, 181, 62, 10, '#e6ecd0', '#638e82', 1);
    label(g, 'MACY’S ROOM', 267, 58, 17, '#476c66', 'center');
    label(g, 'GREMLINS NOT FOUND', 267, 79, 9, '#6d8b7a', 'center');
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
    rr(g, 103, 25, 225, 72, 12, '#eef0d7', '#74a4a5', 1);
    label(g, id === 1 ? 'MAGNETIC PERSONALITY' : 'COMPUTED TOMFOOLERY', 215, 53, 12, '#496f80', 'center');
    label(g, id === 1 ? 'NO METAL. NO CHILL.' : 'THE DONUT STRIKES BACK', 215, 75, 10, '#648a88', 'center');
    poster(g, 809, 28, 1);
    rr(g, 370, 345, 240, 132, 18, '#4d97a536');
    for (let yy = 360; yy < 466; yy += 26)
      line(g, [[386, yy], [594, yy]], '#b4ddc753', 2);
    rr(g, 45, 205, 113, 47, 8, '#396d83');
    label(g, id === 1 ? 'SCAN IN PROGRESS' : 'NO BRAKES', 101, 233, 10, '#e0efc7', 'center');
  }
  if (id === 2) {
    windowArt(g, 425, 22, 191, 101);
    poster(g, 118, 28, 1);
    rr(g, 697, 22, 191, 76, 10, gradient(g, 700, 24, 0, 70, '#75849b', '#3e607b'));
    rr(g, 704, 28, 177, 61, 6, '#25495f');
    label(g, 'MOVIE NIGHT', 793, 52, 14, '#e6cfad', 'center');
    label(g, 'NOW SHOWING: YOU VS. GUT', 793, 74, 8, '#acd8c7', 'center');
    rr(g, 272, 285, 459, 221, 28, '#8c89a941');
    rr(g, 282, 290, 440, 206, 25, gradient(g, 282, 290, 420, 200, '#b5a8c3', '#a395b6'));
    rr(g, 297, 306, 410, 174, 20, null, '#e2d3d87a', 2);
  }
  if (id === 4) {
    rr(g, 103, 24, 221, 69, 11, '#eef0d3');
    label(g, 'ULTRA-SUSPICIOUS', 213, 53, 14, '#557d76', 'center');
    label(g, 'NOW WITH 30% MORE GEL', 213, 75, 10, '#6d8c78', 'center');
    windowArt(g, 535, 24, 155, 91);
    poster(g, 802, 28, 1);
    rr(g, 390, 305, 290, 172, 28, '#8fb7a44a');
    ellipse(g, 535, 387, 99, 45, '#b6d3b244');
  }
  // Broad window light and gentle edge shadows create depth without a noisy texture.
  poly(g, [[365, 155], [590, 155], [730, 462], [477, 462]], '#fff5be19');
  rr(g, 907, 29, 70, 126, 7, '#628f9a');
  rr(g, 914, 35, 56, 117, 5, gradient(g, 915, 35, 55, 115, '#a3c9c7', '#779fa9'));
  rr(g, 924, 46, 35, 45, 5, '#d7e8d6');
  rr(g, 928, 50, 27, 37, 3, gradient(g, 928, 50, 0, 37, '#88bdca', '#bed9ce'));
  rr(g, 950, 111, 8, 4, 2, '#f8d38f');
  rr(g, 885, 167, 89, 35, 9, '#4f8e83');
  label(g, 'MAP →', 929, 190, 13, '#e2edc8', 'center');
  rr(g, 906, 9, 73, 15, 5, '#cde1bb');
  label(g, 'ADVENTURE', 943, 20, 8, '#547e74', 'center');
}

// Only moving actors are redrawn as geometry. Cache the lit room background once per room.
const roomImages = new Map();

function roomBg(g, id) {
  // Room 5 is the home room after dark: the cached room 0 art plus a night tint.
  const base = id === 5 ? 0 : id;
  let cv = roomImages.get(base);
  if (!cv) {
    cv = document.createElement('canvas');
    const cg = configureCanvas(cv, 1000, 625);
    roomIllustration(cg, base);
    roomImages.set(base, cv);
  }
  g.drawImage(cv, 0, 0, 1000, 625);
  if (id === 5) {
    rect(g, 0, 0, 1000, 625, '#162a5266');
    label(g, 'LIGHTS OUT. GREMLINS IN.', 500, 130, 18, '#dee8c9', 'center');
  }
}

// Furniture per room: draw order follows y, and box is the collision rectangle.
const roomProps = [
  [
    { y: 282, box: [95, 176, 131, 105], draw: g => bed(g, 162, 270, 1.05) },
    {
      y: 265,
      box: [282, 210, 62, 48],
      draw: g => {
        cabinet(g, 265, 259, 85);
        monitor(g, 305, 179);
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
        label(g, 'DONUT II', 483, 65, 12, '#fbe1a9', 'center');
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
  girl(g, x, y - 35 * s, 0.8 * s, 0, 1);
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

function softball(g, x, y, r = 10) {
  ellipse(g, x, y, r, r, '#fff1bf');
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
