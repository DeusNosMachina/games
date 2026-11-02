// DOM wiring: shop, difficulty, dialogs, arcade (fullscreen) mode, touch controls, keyboard, and startup.

// ---- Gift shop and difficulty ----
// Priced so the shop lasts about twenty runs: roughly 2,900 coins in all.
const upgrades = [
  {
    id: 'slippers',
    name: 'Turbo grippy socks',
    price: 140,
    desc: 'Dash cooldown drops from 2 seconds to 1.25. Traction: questionable.'
  },
  {
    id: 'pillow',
    name: 'The orthopedic overreactor',
    price: 210,
    desc: 'Longer pillow reach. Easier blob deflections. Still technically bedding.'
  },
  {
    id: 'bag',
    name: 'Deluxe dignity bubble',
    price: 180,
    desc: 'The barf-bag shield lasts 3.4 seconds instead of 2.5. Luxury, apparently.'
  },
  {
    id: 'thick',
    name: 'Thick skin',
    price: 260,
    desc: 'Longer invulnerability after a hit. Emotional armor sold separately.'
  },
  {
    id: 'snacks',
    name: 'Pocket snacks',
    price: 300,
    desc: 'Carry five nutrients instead of three. The hoodie pocket was always bigger on the inside.'
  },
  {
    id: 'repellent',
    name: 'Ralph repellent',
    price: 340,
    desc: 'The first wave in every ward shows up one gremlin short. Smells like hand sanitizer and spite.'
  },
  {
    id: 'pass',
    name: 'Arcade pass',
    price: 380,
    desc: 'Steady hands runs get a third assist. The arcade calls it accessibility. Ralph calls it cheating.'
  },
  {
    id: 'scrunchie',
    name: 'Lucky scrunchie',
    price: 420,
    desc: 'A sixth heart. Science cannot explain it. Neither can Ralph.'
  }
];

// Wardrobe: looks only. girl() reads what Macy is wearing through macyLook().
const wardrobe = [
  { id: 'look-hoodie', name: 'Varsity hoodie', price: 250, desc: 'Team purple with gold trim. Hospital chic.' },
  {
    id: 'look-scrunchie',
    name: 'Highlighter scrunchie',
    price: 200,
    desc: 'Visible from space. Also from the nurses’ station.'
  },
  {
    id: 'look-socks',
    name: 'Softball stitch socks',
    price: 180,
    desc: 'Red seams, white socks. Ready to slide into second, or into bed.'
  }
];

function drawShopMacy() {
  const g = configureCanvas($('shopMacy'), 96, 124);
  rect(g, 0, 0, 96, 124, '#203b44');
  ellipse(g, 48, 116, 34, 7, '#16303a');
  girl(g, 48, 114, 1.2, 0, 1, false, false);
}

// Macy's portrait, where the page has one (the shop draws its own).
function drawPortrait() {
  if (!$('portrait')) return;
  const g = configureCanvas($('portrait'), 80, 112);
  g.clearRect(0, 0, 80, 112);
  girl(g, 38, 103, 1.23, 0, 1);
}

function shopRow(item, button) {
  return `<div class="shop-item"><div><strong>${item.name}</strong><p>${item.desc}</p></div>${button}</div>`;
}

function showShop() {
  $('shopBalance').innerHTML = `<small class="card-kicker">Pocket money</small><strong>${state.coins}</strong> coins`;
  const upgradeRows = upgrades
    .map(u => {
      const owned = state.upgrades.includes(u.id),
        button =
          `<button class="primary" data-buy="${u.id}" ${owned || state.coins < u.price ? 'disabled' : ''}>` +
          `${owned ? 'Owned ✓' : u.price + ' coins'}</button>`;
      return shopRow(u, button);
    })
    .join('');
  const lookRows = wardrobe
    .map(w => {
      const owned = state.cosmetics.owned.includes(w.id),
        worn = state.cosmetics.worn.includes(w.id),
        button = owned
          ? `<button class="primary ${worn ? '' : 'yellow'}" data-wear="${w.id}" aria-pressed="${worn}">${worn ? 'Wearing ✓' : 'Wear it'}</button>`
          : `<button class="primary" data-buy="${w.id}" ${state.coins < w.price ? 'disabled' : ''}>${w.price} coins</button>`;
      return shopRow(w, button);
    })
    .join('');
  $('shopItems').innerHTML =
    `<h3 class="card-kicker shop-section">Upgrades</h3><div class="shop-grid">${upgradeRows}</div>` +
    `<h3 class="card-kicker shop-section">Wardrobe · looks only</h3><div class="shop-grid">${lookRows}</div>`;
  drawShopMacy();
  modalOpen($('shopDialog'));
}

// Buys an upgrade or a wardrobe item by id. Returns true when coins changed hands.
function buyItem(id) {
  const u = upgrades.find(x => x.id === id),
    w = wardrobe.find(x => x.id === id),
    item = u || w;
  if (!item || state.coins < item.price) return false;
  if (u && state.upgrades.includes(id)) return false;
  if (w && state.cosmetics.owned.includes(id)) return false;
  state.coins -= item.price;
  if (u) {
    state.upgrades.push(id);
    // The scrunchie's sixth heart arrives full.
    if (id === 'scrunchie') state.hp = Math.min(maxHearts(), state.hp + 1);
  } else {
    state.cosmetics.owned.push(id);
    state.cosmetics.worn.push(id);
    drawPortrait();
  }
  save();
  hud();
  sfx('coin');
  return true;
}

function toggleWear(id) {
  if (!state.cosmetics.owned.includes(id)) return;
  const worn = state.cosmetics.worn;
  state.cosmetics.worn = worn.includes(id) ? worn.filter(x => x !== id) : [...worn, id];
  save();
  drawPortrait();
  sfx('ui');
}

function showDifficulty() {
  $('difficultyOptions').innerHTML = difficulties
    .map(
      (d, i) =>
        `<button class="difficulty-option ${state.difficulty === i ? 'selected' : ''}" data-difficulty="${i}">` +
        `<strong>${d.name}</strong><p>${d.desc}</p>` +
        `<small>${d.coins.toFixed(1)}× coin earnings · ${d.misses + 2} IV mistakes · ${i === 0 ? 8 : i === 1 ? 6 : 5} action-game mistakes · ${Math.round(d.window * 100)}% starting IV window</small></button>`
    )
    .join('');
  modalOpen($('difficultyDialog'));
}

$('shopItems').addEventListener('click', e => {
  const buy = e.target.closest('[data-buy]'),
    wear = e.target.closest('[data-wear]');
  if (buy && buyItem(buy.dataset.buy)) showShop();
  if (wear) {
    toggleWear(wear.dataset.wear);
    showShop();
  }
});

$('difficultyOptions').addEventListener('click', e => {
  let b = e.target.closest('[data-difficulty]');
  if (!b || mini.screen === 'play') return;
  state.difficulty = +b.dataset.difficulty;
  save();
  hud();
  $('difficultyDialog').close();
  if (mini.open) showLobby();
  else if (state.started) loadRoom(state.room);
});

$('difficultyBtn').addEventListener('click', showDifficulty);
$('miniDifficulty').addEventListener('click', showDifficulty);
$('shopBtn').addEventListener('click', showShop);

$('approachOptions').addEventListener('click', e => {
  const b = e.target.closest('[data-approach]');
  if (b && !b.disabled && mini.screen === 'lobby') {
    mini.approach = +b.dataset.approach;
    showLobby();
  }
});

$('tierGrid').addEventListener('click', e => {
  let b = e.target.closest('[data-tier]');
  if (!b || b.disabled) return;
  mini.tier = +b.dataset.tier;
  showLobby();
});

// ---- Sound ----
// audio.js owns the engine. Until it offers toggle(), the header button flips state.sound directly.
function uiSoundOn() {
  return typeof audio !== 'undefined' && typeof audio.toggle === 'function' ? !!audio.enabled : !!state.sound;
}

function uiRenderSound() {
  const on = uiSoundOn();
  $('soundBtn').innerHTML = `<svg><use href="#i-${on ? 'sound' : 'mute'}"/></svg><span>Sound ${on ? 'on' : 'off'}</span>`;
  $('soundBtn').setAttribute('aria-label', `Turn sound ${on ? 'off' : 'on'}`);
  $('soundBtn').setAttribute('title', `Sound ${on ? 'on' : 'off'}`);
  $('pauseSound').textContent = `Sound ${on ? 'on' : 'off'}`;
  $('miniSound').textContent = `Sound ${on ? 'on' : 'off'}`;
}

function uiToggleSound() {
  if (typeof audio !== 'undefined' && typeof audio.toggle === 'function') audio.toggle();
  else {
    state.sound = !state.sound;
    if (typeof audio !== 'undefined') audio.enabled = state.sound;
  }
  save();
  uiRenderSound();
  sfx('ui');
}

function uiUnlockAudio() {
  if (typeof audio !== 'undefined' && typeof audio.unlock === 'function') audio.unlock();
}

// ---- Arcade mode (fullscreen) ----
// body.arcade pins the cabinet to the screen and hides the page around it. The Fullscreen API is
// used where it exists (desktop, Android, iPad); iPhone Safari has none for pages, so CSS does the work.
let arcadeFullscreen = false;

// Phones and tablets: a finger is the main pointer. They start in arcade mode.
function isTouchScreen() {
  return matchMedia('(pointer: coarse)').matches;
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestFullscreenSafe() {
  const root = document.documentElement;
  if (!root || fullscreenElement()) return;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(root, { navigationUI: 'hide' });
    arcadeFullscreen = true;
    if (result && result.catch) result.catch(() => (arcadeFullscreen = false));
  } catch {
    arcadeFullscreen = false;
  }
}

function exitFullscreenSafe() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  arcadeFullscreen = false;
  if (fullscreenElement() && exit) {
    try {
      const result = exit.call(document);
      if (result && result.catch) result.catch(() => {});
    } catch {}
  }
}

function inArcade() {
  return document.body.classList.contains('arcade');
}

function renderArcadeButtons() {
  const on = inArcade();
  $('arcadeToggle').innerHTML = on
    ? '<span aria-hidden="true">✕</span><span class="btn-label">Exit</span>'
    : '<svg><use href="#i-expand"/></svg><span class="btn-label">Fullscreen</span>';
  $('arcadeToggle').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Play fullscreen');
  $('fullBtn').setAttribute('aria-pressed', String(on));
  $('pauseFull').textContent = on ? 'Exit fullscreen' : 'Fullscreen';
}

// gesture = true when called from a click or tap, the only time browsers allow real fullscreen.
function enterArcade(gesture = true) {
  document.body.classList.add('arcade');
  if (state.arcade !== true) {
    state.arcade = true;
    save();
  }
  if (gesture) requestFullscreenSafe();
  renderArcadeButtons();
  resize();
}

function exitArcade() {
  document.body.classList.remove('arcade');
  state.arcade = false;
  save();
  exitFullscreenSafe();
  renderArcadeButtons();
  resize();
}

function toggleArcade() {
  if (inArcade()) exitArcade();
  else enterArcade(true);
}

['fullscreenchange', 'webkitfullscreenchange'].forEach(type =>
  document.addEventListener(type, () => {
    // Leaving browser fullscreen (Esc, Android back) leaves arcade mode too.
    if (!fullscreenElement() && arcadeFullscreen && inArcade()) exitArcade();
    resize();
  })
);

// ---- Arcade dialog ----
$('miniStart').addEventListener('click', startMini);
$('miniReadyBtn').addEventListener('click', launchMini);
$('miniGo').addEventListener('click', launchMini);
$('miniPauseBtn').addEventListener('click', pauseMini);
$('miniResume').addEventListener('click', pauseMini);
$('miniSound').addEventListener('click', uiToggleSound);
$('miniBack').addEventListener('click', leaveMini);
$('miniClose').addEventListener('click', leaveMini);
$('resultShare').addEventListener('click', shareResult);

// A tap anywhere on the result screen, except its buttons, skips the medal ceremony to the end.
$('miniResult').addEventListener('pointerdown', e => {
  if (!e.target.closest('button')) ceremonySkip();
});

$('miniRetry').addEventListener('click', () => {
  if (mini.forced && mini.win) {
    mini.forced = false;
    $('miniClose').classList.remove('hidden');
  }
  // A Daily Dose keeps its fixed level; normal runs move up after a win.
  if (mini.win && mini.tier < 2 && !mini.daily) mini.tier++;
  $('miniDialog').classList.remove('gory');
  gore = [];
  showLobby();
});

$('miniDialog').addEventListener('cancel', e => {
  e.preventDefault();
  if (mini.screen === 'outro') return;
  if (['play', 'intro'].includes(mini.screen)) {
    if (!mini.paused) pauseMini();
  } else if (!mini.forced) leaveMini();
});

// ---- Press-to-act buttons ----
// Game buttons act on pointerdown, not click. Phones never turn a tap into a click while another
// finger is down (the thumb on the joystick), and a thumb that rolls a few pixels cancels the click
// too: that is why JUMP needed smashing. The click that can follow a press is ignored; a click with
// no press before it (Enter or Space on a focused button, assistive tech) still acts.
const PRESS_CLICK_MS = 1500;

// The element the latest handled press landed on. A press can change the screen (the beacon opens an
// arcade, a tap ends a phase), and the click that follows must not land on whatever appeared under
// the finger: until the next pointerdown, clicks only reach the pressed element.
let pressTarget = null;

document.addEventListener('pointerdown', () => (pressTarget = null), true);
document.addEventListener(
  'click',
  e => {
    if (!pressTarget || e.detail === 0 || Date.now() - pressTarget.pressedAt > PRESS_CLICK_MS) return;
    if (pressTarget.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  },
  true
);

// Starts a press on el. Returns false for buttons other than the primary one.
function pressStart(el, e) {
  if (e.button > 0) return false;
  e.preventDefault();
  try {
    el.setPointerCapture(e.pointerId);
  } catch {}
  el.pressedAt = Date.now();
  pressTarget = el;
  return true;
}

// True for the click a pointer press already handled.
function pressClick(el, e) {
  return e.detail > 0 && Date.now() - (el.pressedAt || 0) < PRESS_CLICK_MS;
}

// Wires a ward button: it acts on press and shows .pressed until the finger lifts.
function onPress(el, act) {
  el.addEventListener('pointerdown', e => {
    if (!pressStart(el, e)) return;
    el.classList.add('pressed');
    act(e);
  });
  el.addEventListener('click', e => {
    if (!pressClick(el, e)) act(e);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
    el.addEventListener(type, () => el.classList.remove('pressed'))
  );
}

// ---- Arcade touch controls ----
// Every button acts on press. HOLD and FIRE stay pressed until that pointer lifts. Games re-render
// their buttons mid-press, so the press time lives on the row, not on the button.
let miniHoldPointer = null;

$('miniControls').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-action]');
  if (!b || !pressStart(b, e)) return;
  $('miniControls').pressedAt = b.pressedAt;
  b.classList.add('active');
  b.dataset.pointer = String(e.pointerId);
  const a = b.dataset.action;
  if (a === 'hold' || a === 'fire') {
    if (mini.screen !== 'play' || mini.paused) return;
    miniHoldPointer = e.pointerId;
    if (a === 'fire') {
      mini.fireHeld = true;
      miniAction('fire');
    } else mini.held = true;
    return;
  }
  miniAction(a);
});

function releaseMiniHold(e) {
  const id = e && e.pointerId !== undefined ? String(e.pointerId) : null;
  $$('#miniControls .active').forEach(b => {
    if (id === null || b.dataset.pointer === id) b.classList.remove('active');
  });
  if (id !== null && e.pointerId !== miniHoldPointer) return;
  mini.held = false;
  mini.fireHeld = false;
  miniHoldPointer = null;
}

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  $('miniControls').addEventListener(type, releaseMiniHold)
);

$('miniControls').addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.dataset.action === 'hold' || pressClick($('miniControls'), e)) return;
  miniAction(b.dataset.action);
});

$('miniCanvas').addEventListener('pointerdown', e => {
  const def = games[mini.id];
  // Games without pointer hooks (the IV) ignore canvas presses.
  if (!(def.down || def.move || def.up) || mini.screen !== 'play' || mini.paused || arcadePointer !== null)
    return;
  e.preventDefault();
  arcadePointer = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
  arcadeDown(miniPoint(e));
});

$('miniCanvas').addEventListener('pointermove', e => {
  if (e.pointerId === arcadePointer) arcadeMove(miniPoint(e));
});

function releaseArcade(e) {
  if (e.pointerId !== arcadePointer) return;
  arcadeUp(e.type !== 'pointerup');
  arcadePointer = null;
}

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  $('miniCanvas').addEventListener(type, releaseArcade)
);

// ---- Ward touch controls ----
const joystick = $('joystick');

joystick.addEventListener('pointerdown', e => {
  if (joyPointer !== null) return;
  e.preventDefault();
  joyPointer = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  if (!state.started) begin();
  handleJoy(e);
});

function handleJoy(e) {
  if (e.pointerId !== joyPointer) return;
  let r = joystick.getBoundingClientRect(),
    x = e.clientX - r.left - r.width / 2,
    y = e.clientY - r.top - r.height / 2,
    max = r.width * 0.3,
    d = Math.hypot(x, y);
  if (d > max) {
    x = (x / d) * max;
    y = (y / d) * max;
  }
  joy.x = x / max;
  joy.y = y / max;
  $('stick').style.transform = `translate(${x}px,${y}px)`;
}

joystick.addEventListener('pointermove', handleJoy);

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  joystick.addEventListener(type, e => {
    if (e.pointerId === joyPointer) {
      joyPointer = null;
      joy.x = joy.y = 0;
      $('stick').style.transform = 'translate(0,0)';
    }
  })
);

// The attack button hits on press and keeps hitting while held, like holding Space. Dragging it
// aims the follow-up hits; letting go stops.
$('attackBtn').addEventListener('pointerdown', e => {
  if (attackPointer !== null || !pressStart($('attackBtn'), e)) return;
  attackPointer = e.pointerId;
  $('attackBtn').classList.add('pressed');
  if (roomAction('attack')) return;
  attackOrigin = { x: e.clientX, y: e.clientY };
  wardAim = { dx: 0, dy: 0 };
  heldAttack = true;
  attack();
});

$('attackBtn').addEventListener('pointermove', e => {
  if (e.pointerId !== attackPointer || !attackOrigin) return;
  wardAim = { dx: (e.clientX - attackOrigin.x) * 2, dy: (e.clientY - attackOrigin.y) * 2 };
});

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  $('attackBtn').addEventListener(type, e => {
    if (e.pointerId !== attackPointer) return;
    $('attackBtn').classList.remove('pressed');
    attackPointer = null;
    attackOrigin = null;
    wardAim = null;
    heldAttack = false;
  })
);

$('attackBtn').addEventListener('click', e => {
  if (!pressClick($('attackBtn'), e) && !roomAction('attack')) attack();
});

onPress($('jumpBtn'), () => roomAction('jump') || jump());
onPress($('dashBtn'), () => roomAction('dash') || dash());
onPress($('useBtn'), () => roomAction('use') || useItem());
onPress($('touchEat'), eat);

// The weapon strip equips on press; the strip and the canvas both announce the change.
[0, 1, 2].forEach(i =>
  onPress($('wslot' + i), () => {
    equip(i);
    wardWeaponSync();
  })
);

$('rematchBtn').addEventListener('click', () => {
  if (isModal() || state.room === 0 || !encounter.complete) return;
  if (typeof wardRematch === 'function') wardRematch();
  else startEncounter();
});

$('eatBtn').addEventListener('click', eat);
$('hudEat').addEventListener('click', eat);

// ---- Keyboard ----
// Keys whose browser defaults (scrolling, find-as-you-type) are suppressed while playing.
const ARCADE_KEYS = [
  ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 's', 'd', 'w', 'e', 'b', 'escape',
  '1', '2', '3', '4', '5', '6', '7', '8', '9'
];
const WARD_KEYS = [
  ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'w', 'a', 's', 'd', 'e', 'q', 'f', 'enter', 'shift', 'j'
];

// Arcade keys: Escape pauses, E is the assist, everything else goes to the game's key hook.
window.addEventListener('keydown', e => {
  uiUnlockAudio();
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  // The title takes any key except modifiers and browser shortcuts.
  if (titleUp) {
    const shortcut = e.metaKey || e.ctrlKey || e.altKey;
    if (shortcut || ['tab', 'shift', 'control', 'alt', 'meta', 'capslock'].includes(k)) return;
    e.preventDefault();
    if (!e.repeat) startFromTitle();
    return;
  }
  if (mini.open && ['play', 'intro'].includes(mini.screen)) {
    if (ARCADE_KEYS.includes(k)) e.preventDefault();
    if (k === 'escape' && !e.repeat) {
      pauseMini();
      return;
    }
    if (mini.paused || mini.screen === 'intro') return;
    if (k === 'e') {
      if (!e.repeat) miniAction('assist');
      return;
    }
    // Everything else belongs to the game (def.key).
    const def = games[mini.id];
    if (def.key) dailyScoped(() => def.key(k, e));
    return;
  }
  // Any key on the result screen skips the medal ceremony (Escape still leaves through the dialog).
  if (mini.open && mini.screen === 'result' && ceremonySkip()) return;
  if (isModal()) return;
  if (k === 'escape') {
    if (!e.repeat) setWardPause(!state.paused);
    return;
  }
  if (state.paused) return;
  // An extra room (the hallway) gets the first say on Space; held Space then keeps attacking as usual.
  if (k === ' ' && !e.repeat && state.started && roomAction('attack')) {
    e.preventDefault();
    return;
  }
  if (WARD_KEYS.includes(k)) {
    e.preventDefault();
    if (!state.started) begin();
    keys.add(k);
  }
  if (e.repeat) return;
  if (k === 'e' && !roomAction('use')) useItem();
  if (k === 'q' && !roomAction('dash')) dash();
  if ((k === 'shift' || k === 'j') && !roomAction('jump')) jump();
  if (k === 'f') eat();
  if (k === 'm') {
    e.preventDefault();
    openMap();
  }
  if (['1', '2', '3'].includes(k)) equip(+k - 1);
  if (k === 'c') equip((state.item + 1) % 3);
  if (k === 'enter' && !roomAction('enter')) {
    const station = isArcadeRoom(state.room) && rooms[state.room].station;
    if (station && dist(player, { x: station[0], y: station[1] }) < 85) tryOpenArcade();
    else if (station) toast('Find the glowing arcade beacon, or use the Play button.', 2);
  }
});

window.addEventListener('keyup', e => {
  keys.delete(e.key.toLowerCase());
  if (e.key === ' ') {
    if (mini.open) e.preventDefault();
    releaseMiniHold();
  }
});

// Audio needs a user gesture to start on phones and in Safari.
document.addEventListener('pointerdown', uiUnlockAudio, true);
document.addEventListener('click', uiUnlockAudio, true);

// ---- Focus, header buttons, and dialogs ----
function loseFocus() {
  clearHeld();
  if (mini.open && ['play', 'intro'].includes(mini.screen) && !mini.paused) pauseMini();
  else if (state.started && !isModal()) setWardPause(true);
}

window.addEventListener('blur', loseFocus);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) loseFocus();
});

// ---- Touch scheme: tap the room, or the joystick and buttons ----
const CONTROL_NAMES = { tap: 'Tap the room', stick: 'Joystick' };

function renderControls() {
  const tap = tapScheme();
  document.body.classList.toggle('tap-controls', tap);
  document.body.classList.toggle('stick-controls', !tap);
  $('pauseControls').textContent = 'Controls: ' + CONTROL_NAMES[state.controls];
  $$('[data-controls]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.controls === state.controls)));
}

function setControlScheme(scheme) {
  state.controls = scheme === 'stick' ? 'stick' : 'tap';
  save();
  clearHeld();
  renderControls();
  resize();
}

$('pauseControls').addEventListener('click', () => setControlScheme(tapScheme() ? 'stick' : 'tap'));
$('pauseQuit').addEventListener('click', titleQuit);
$('controlsPick').addEventListener('click', e => {
  const b = e.target.closest('[data-controls]');
  if (b) setControlScheme(b.dataset.controls);
});

// Tap the room: a finger on the canvas walks, hits, dashes, jumps and uses the ability (world.js).
// Mice keep the click below.
function roomTouch(e) {
  return e.pointerType !== 'mouse' && e.button <= 0 && tapScheme();
}

canvas.addEventListener('pointerdown', e => {
  if (!roomTouch(e)) return;
  const p = wardPoint(e),
    live = state.started && !state.paused && !isModal();
  // An extra room (the hallway) may claim the tap first, say for a visitor to talk to.
  if (live && roomAction('tap', p)) pressStart(canvas, e);
  else if (wardTouchDown(e.pointerId, e.clientX, e.clientY, p)) pressStart(canvas, e);
});

canvas.addEventListener('pointermove', e => {
  if (wardTouches.has(e.pointerId)) wardTouchMove(e.pointerId, e.clientX, e.clientY, wardPoint(e));
});

['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
  canvas.addEventListener(type, e => wardTouchUp(e.pointerId, e.clientX, e.clientY, type !== 'pointerup'))
);

// A tap on the room resumes from pause; a tap on the beacon opens its arcade. A touch the room
// already handled is not tapped twice.
canvas.addEventListener('click', e => {
  if (pressClick(canvas, e)) {
    canvas.focus({ preventScroll: true });
    return;
  }
  if (state.paused) setWardPause(false);
  else if (state.started && !isModal() && e && e.clientX !== undefined && beaconTapped(wardPoint(e)))
    tryOpenArcade();
  canvas.focus({ preventScroll: true });
});

// ---- Title screen (world.js draws it) ----
// START, any key or any tap. Phones and tablets go fullscreen inside that gesture, the only moment
// browsers allow it, unless the player already said no; the title then irises out and begin() runs.
function startFromTitle() {
  if (!titleUp || titleLeaving > 0) return false;
  if (state.arcade === true || (state.arcade === null && isTouchScreen())) enterArcade(true);
  return titleStart();
}

$('titleScreen').addEventListener('pointerdown', e => {
  if (!titleUp || !pressStart($('titleScreen'), e)) return;
  startFromTitle();
});

$('titleScreen').addEventListener('pointermove', e => titleNudge(e.clientX, e.clientY));

$('titleStart').addEventListener('click', () => startFromTitle());

$('arcadeBtn').addEventListener('click', () => {
  if (!state.started) begin();
  tryOpenArcade();
});

$('mapBtn').addEventListener('click', openMap);
$('helpBtn').addEventListener('click', () => modalOpen($('helpDialog')));
$('fullBtn').addEventListener('click', toggleArcade);
$('arcadeToggle').addEventListener('click', toggleArcade);
$('soundBtn').addEventListener('click', uiToggleSound);

$('pauseBtn').addEventListener('click', () => setWardPause(!state.paused));

$('wardResume').addEventListener('click', () => setWardPause(false));
$('pauseMap').addEventListener('click', openMap);
$('pauseShop').addEventListener('click', showShop);
$('pauseStickers').addEventListener('click', stickerOpenSheet);
$('pauseHelp').addEventListener('click', () => modalOpen($('helpDialog')));
$('pauseSound').addEventListener('click', uiToggleSound);
$('pauseFull').addEventListener('click', toggleArcade);
$('turnHintClose').addEventListener('click', () => $('turnHint').classList.add('hidden'));

$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

$$('dialog').forEach(d =>
  d.addEventListener('close', () => {
    clearHeld();
    if (!isModal()) canvas.focus({ preventScroll: true });
  })
);

// Daily Dose cards (sidebar and map).
function dailyClick(e) {
  if (!e.target.closest('[data-daily]')) return;
  if (!state.started) begin();
  openDaily();
}

$('dailyCard').addEventListener('click', dailyClick);
$('mapDaily').addEventListener('click', dailyClick);

// Sticker sheet: the sidebar card opens it, a tile shows its sticker big, Share makes the card.
$('stickerBtn').addEventListener('click', stickerOpenSheet);
$('stickerGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-sticker]');
  if (b) stickerSelect(b.dataset.sticker);
});
$('stickerShare').addEventListener('click', () => shareSticker());

$('departmentGrid').addEventListener('click', e => {
  let b = e.target.closest('[data-room]');
  if (b) goRoom(+b.dataset.room);
});

// Sidebar weapon cards (the touch strip has its own press handlers above).
$$('.item[data-item]').forEach(b => b.addEventListener('click', () => equip(+b.dataset.item)));

$('saveName').addEventListener('click', () => {
  state.name = $('heroName').value.trim().slice(0, 18) || 'Macy';
  save();
  hud();
  $('helpDialog').close();
  toast((state.name || 'Macy') + ': officially a legend.', 2);
});

let resetPending = false;

$('resetBtn').addEventListener('click', () => {
  if (!resetPending) {
    resetPending = true;
    $('resetBtn').textContent = 'Reset medals, coins and upgrades? Click again.';
    return;
  }
  resetPending = false;
  state.medals = Array.from({ length: ARCADE_COUNT }, () => [0, 0, 0]);
  state.records = Array.from({ length: ARCADE_COUNT }, () => [0, 0, 0]);
  state.hp = 5;
  state.coins = 0;
  state.food = 0;
  state.taken = [];
  state.defeated = [];
  state.upgrades = [];
  state.cosmetics = { owned: [], worn: [] };
  state.won = false;
  state.wardClears = Array.from({ length: ARCADE_COUNT }, () => 0);
  state.recoveries = 0;
  state.evictions = 0;
  state.bestChain = 0;
  state.coinsEarned = 0;
  state.runs = 0;
  state.ralphReady = false;
  state.ralph = false;
  state.briefed = [];
  state.daily = { last: '', best: 0, streak: 0 };
  state.stats = {};
  state.stickers = [];
  stickerPopClear();
  state.started = false;
  document.body.classList.remove('playing');
  state.paused = false;
  save();
  $$('dialog[open]').forEach(d => d.close());
  loadRoom(0);
  hud();
  stickerRenderCard();
  drawPortrait();
  titleShow();
  $('resetBtn').textContent = 'Start a fresh adventure';
});

// ---- Startup ----
// Returning players skip the hero and land on the cabinet with a shorter welcome.
// Returning players: the title greets them (titleWelcomeLine) and the page skips the hero.
function welcomeBack() {
  document.body.classList.add('returning');
}

new ResizeObserver(resize).observe($('stage'));
// Turning the phone re-fits both canvases and flips an arcade run to its portrait canvas, if it has one.
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
// An optional extra room (src/hallway.js) joins rooms and roomProps before anything reads them.
if (typeof hallwayInstall === 'function') hallwayInstall();
buildDepartments();
setupIllustrations();
loadRoom(0);
hud();
stickerRenderCard();
equip(0);
drawPortrait();
uiRenderSound();
renderControls();
if (typeof audio !== 'undefined' && typeof audio.toggle !== 'function') audio.enabled = !!state.sound;
if (state.played) welcomeBack();
// A phone or tablet that chose arcade mode starts in it (CSS only until a tap allows real fullscreen).
if (state.arcade === true && isTouchScreen()) enterArcade(false);
renderArcadeButtons();
resize();
checkDischarge();

// Every visit starts on the title. A save left at zero hearts goes to the recovery after START.
titleShow();

requestAnimationFrame(animateFrame);
