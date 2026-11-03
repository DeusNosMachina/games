// Audio engine. Without Web Audio every effect and track is a silent no-op. With a strict recording fake
// AudioContext, the engine unlocks once, layers every effect, rate-limits repeats, pans, ducks and cleans
// up voices; runs one look-ahead scheduler; crossfades, ends stings and stops; pauses for hidden tabs and
// iOS interruptions; persists the sound preference; and never touches the game's seeded Math.random.
const { run, box, nodes, assert } = require('./harness.cjs');

const SOUNDS = [
  'ui', 'hit', 'swing', 'jump', 'dash', 'hurt', 'coin', 'pickup', 'eat', 'enemyDie', 'split', 'blob', 'throw',
  'bounce', 'explode', 'shot', 'reload', 'slice', 'bomb', 'combo', 'fever', 'drip', 'catch', 'pump', 'wave',
  'clear', 'win', 'lose', 'countdown', 'go', 'stun', 'shield', 'trap', 'miss', 'headshot', 'leap', 'boss',
  'bossHit', 'bossDie', 'wallSplat', 'organ', 'squelch', 'ricochet', 'powerup', 'lock', 'unlock', 'daily',
  'select', 'back'
];
const TRACKS = [
  'room:0', 'room:1', 'room:2', 'room:3', 'room:4', 'room:5', 'game:0', 'game:1', 'game:2', 'game:3', 'game:4',
  'game:5', 'game:pitch', 'boss', 'result:win', 'result:lose'
];
const q = JSON.stringify;

// ---- No Web Audio: the harness has no AudioContext, timers or gestures ----
assert.equal(run('state.sound'), true, 'sound defaults on');
assert.equal(run('JSON.stringify(audio.checkTracks())'), '[]', 'song data lint');
for (const name of SOUNDS) assert.ok(run(`audio.sounds.includes(${q(name)})`), `sfx vocabulary is missing ${name}`);
for (const name of TRACKS) assert.ok(run(`audio.tracks.includes(${q(name)})`), `music is missing ${name}`);
for (const name of SOUNDS) run(`sfx(${q(name)}, {combo: 3, count: 7, pan: -0.4, vol: 0.8})`);
run("sfx('no-such-sound'); sfx('toString'); sfx(); sfx('hit', null); tone(440, 0.1); tone()");
for (const name of TRACKS) {
  run(`music(${q(name)})`);
  assert.equal(run('audio.track'), name);
}
run('music(null)');
assert.equal(run('audio.track'), null);
assert.equal(run('audio.unlock()'), false, 'unlock without Web Audio');
assert.equal(run('audioCtx'), null);
assert.equal(run('audio.playing'), false);
console.log(`PASS: ${SOUNDS.length} effects and ${TRACKS.length} tracks are silent no-ops without Web Audio.`);

// ---- A strict fake Web Audio implementation that records every node ----
const fake = { contexts: [], timers: new Map(), nextTimer: 1 };
const OSC_TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);
const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']);
const PARAMS = ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release'];

function finite(v, what) {
  if (!Number.isFinite(v)) throw new TypeError(`${what} must be finite, got ${v}`);
}
function when(t, what) {
  finite(t, what);
  if (t < 0) throw new RangeError(`${what} time is negative`);
}

class FakeParam {
  constructor(value) {
    this._value = value;
  }
  get value() {
    return this._value;
  }
  set value(v) {
    finite(v, 'param.value');
    this._value = v;
  }
  setValueAtTime(v, t) {
    finite(v, 'setValueAtTime');
    when(t, 'setValueAtTime');
    this._value = v;
    return this;
  }
  linearRampToValueAtTime(v, t) {
    finite(v, 'linearRamp');
    when(t, 'linearRamp');
    this._value = v;
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    finite(v, 'exponentialRamp');
    when(t, 'exponentialRamp');
    if (!(v > 0)) throw new RangeError('exponentialRampToValueAtTime needs a positive target');
    this._value = v;
    return this;
  }
  setTargetAtTime(v, t, c) {
    finite(v, 'setTarget');
    when(t, 'setTarget');
    if (!(c >= 0)) throw new RangeError('setTargetAtTime needs a non-negative time constant');
    this._value = v;
    return this;
  }
  cancelScheduledValues(t) {
    when(t, 'cancelScheduledValues');
    return this;
  }
  cancelAndHoldAtTime(t) {
    when(t, 'cancelAndHoldAtTime');
    return this;
  }
}

class FakeNode {
  constructor(ctx, kind) {
    this.context = ctx;
    this.kind = kind;
    this.outputs = new Set();
    this.started = false;
    this.stopped = false;
    this.onended = null;
    this._type = kind === 'oscillator' ? 'sine' : 'lowpass';
    for (const p of PARAMS) this[p] = new FakeParam(p === 'gain' ? 1 : 0);
    ctx.nodes.push(this);
  }
  get type() {
    return this._type;
  }
  set type(v) {
    const allowed = this.kind === 'oscillator' ? OSC_TYPES : FILTER_TYPES;
    if (!allowed.has(v)) throw new TypeError(`invalid ${this.kind} type ${v}`);
    this._type = v;
  }
  connect(dest) {
    if (!(dest instanceof FakeNode || dest instanceof FakeParam)) throw new TypeError('connect() needs a node or param');
    this.outputs.add(dest);
    return dest;
  }
  disconnect(dest) {
    if (dest === undefined) {
      this.outputs.clear();
      return;
    }
    if (!this.outputs.has(dest)) throw new Error('InvalidAccessError: not connected');
    this.outputs.delete(dest);
  }
  setPeriodicWave(wave) {
    if (!wave || !wave.real) throw new TypeError('setPeriodicWave needs a PeriodicWave');
    this.wave = wave;
  }
  start(t = 0) {
    if (this.started) throw new Error('InvalidStateError: start() called twice');
    when(t, 'start');
    this.started = true;
    this.startAt = t;
  }
  stop(t = 0) {
    if (!this.started) throw new Error('InvalidStateError: stop() before start()');
    when(t, 'stop');
    this.stopped = true;
    this.stopAt = t;
    this.context.pending.push(this);
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'suspended';
    this.sampleRate = 8000;
    this.nodes = [];
    this.pending = [];
    this.onstatechange = null;
    this.destination = new FakeNode(this, 'destination');
    fake.contexts.push(this);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode(this, 'gain');
  }
  createOscillator() {
    return new FakeNode(this, 'oscillator');
  }
  createBufferSource() {
    return new FakeNode(this, 'buffer');
  }
  createBiquadFilter() {
    return new FakeNode(this, 'biquad');
  }
  createDynamicsCompressor() {
    return new FakeNode(this, 'compressor');
  }
  createStereoPanner() {
    return new FakeNode(this, 'panner');
  }
  createDelay() {
    return new FakeNode(this, 'delay');
  }
  createBuffer(channels, length, rate) {
    if (!(length >= 1)) throw new Error('NotSupportedError: empty buffer');
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
  }
  createPeriodicWave(real, imag) {
    if (real.length !== imag.length || real.length < 2) throw new Error('IndexSizeError: bad periodic wave');
    return { real, imag };
  }
  // Fire onended for every source whose stop time has passed, like the audio thread would.
  finish() {
    const done = this.pending.filter(n => n.stopAt <= this.currentTime);
    this.pending = this.pending.filter(n => n.stopAt > this.currentTime);
    for (const n of done) if (n.onended) n.onended();
    return done.length;
  }
}

box.window.AudioContext = FakeAudioContext;
box.setTimeout = (fn, ms) => {
  const id = fake.nextTimer++;
  fake.timers.set(id, { fn, ms });
  return id;
};
box.clearTimeout = id => fake.timers.delete(id);
function runTimers() {
  const due = [...fake.timers.values()];
  fake.timers.clear();
  for (const t of due) t.fn();
}
// Advance the audio clock in scheduler-sized steps, firing timers and finished voices as we go.
function play(ctx, seconds) {
  for (let s = 0; s < seconds; s += 0.1) {
    ctx.currentTime += 0.1;
    runTimers();
    ctx.finish();
  }
}
const furthest = ctx => Math.max(...ctx.nodes.filter(n => n.kind === 'oscillator' && n.started).map(n => n.startAt));

// The game's Math.random is seeded by the tests: audio must never draw from it.
run('var audioTestDraws = 0; Math.random = () => { audioTestDraws++; return 0.5; }');

// ---- Unlock ----
assert.equal(run('audio.unlock()'), true);
assert.equal(fake.contexts.length, 1);
const ctx = fake.contexts[0];
assert.equal(ctx.state, 'running');
assert.equal(run('audio.unlock()'), true);
assert.equal(fake.contexts.length, 1, 'a second gesture reuses the context');
assert.ok(ctx.nodes.some(n => n.kind === 'compressor' && n.outputs.has(ctx.destination)), 'compressor feeds the output');
assert.ok(ctx.nodes.some(n => n.kind === 'biquad' && n._type === 'lowpass'), 'master lowpass');
console.log('PASS: unlock creates one context with a lowpass and compressor on the master bus.');

// ---- Effects ----
ctx.currentTime = 1;
let before = ctx.nodes.length;
run("sfx('hit')");
const hitNodes = ctx.nodes.slice(before);
assert.ok(hitNodes.some(n => n.kind === 'oscillator' && n.started && n.stopped), 'hit has a pitched layer');
assert.ok(hitNodes.some(n => n.kind === 'buffer' && n.started && n.stopped), 'hit has a noise layer');
assert.ok(run('audio.voices') >= 2);
before = ctx.nodes.length;
run("sfx('hit')");
assert.equal(ctx.nodes.length, before, 'a repeat inside the retrigger gap is skipped');
for (const name of SOUNDS) {
  ctx.currentTime += 0.5;
  ctx.finish();
  before = ctx.nodes.length;
  run(`sfx(${q(name)}, {combo: 5, count: 9, vol: 0.7})`);
  assert.ok(ctx.nodes.length - before >= 2, `${name} should be a layered sound`);
}
ctx.currentTime += 0.5;
before = ctx.nodes.length;
run("sfx('coin', {pan: -0.7})");
const panner = ctx.nodes.slice(before).find(n => n.kind === 'panner');
assert.ok(panner, 'pan creates a stereo panner');
assert.equal(panner.pan.value, -0.7);
ctx.currentTime += 0.5;
before = ctx.nodes.length;
run("sfx('definitely-not-real')");
assert.ok(ctx.nodes.length > before, 'unknown names fall back to a blip');
ctx.currentTime += 0.5;
run("sfx('swing', null); sfx('slice', {vol: 'loud', pan: 'left', combo: 'many'}); sfx('drip', {count: 1e9})");
before = ctx.nodes.length;
run('tone(440, 0.1); tone(90, 0.27, "sawtooth"); tone(300, 0.05, "square")');
assert.ok(ctx.nodes.length > before, 'legacy tone() plays through the mixer');
ctx.currentTime += 10;
ctx.finish();
assert.equal(run('audio.voices'), 0, 'finished voices are released');
assert.equal(panner.outputs.size, 0, 'the panner is disconnected after its voices end');
ctx.currentTime += 1;
run("sfx('explode')");
assert.ok(run('audio.ducking') > ctx.currentTime, 'loud effects duck the music');
ctx.currentTime += 0.5;
before = ctx.nodes.length;
run("sfx('hit', {vol: 0})");
assert.equal(ctx.nodes.length, before, 'vol 0 is silent');
console.log('PASS: every effect is layered; repeats, pan, volume, ducking, the tone() shim and cleanup work.');

// ---- Music ----
ctx.currentTime += 2;
ctx.finish();
assert.equal(run('audio.timer'), null, 'no scheduler before music');
run("music('room:0')");
assert.equal(run('audio.track'), 'room:0');
assert.equal(run('audio.playing'), true);
const firstTick = run('audio.timer');
assert.notEqual(firstTick, null, 'music starts the scheduler');
assert.ok(furthest(ctx) > ctx.currentTime + 0.5, 'notes are scheduled ahead on the audio clock');
before = ctx.nodes.length;
const timerCount = fake.timers.size;
run("music('room:0')");
assert.equal(ctx.nodes.length, before, 'the current track again is a no-op');
assert.equal(run('audio.timer'), firstTick);
assert.equal(fake.timers.size, timerCount);
play(ctx, 3);
assert.equal(fake.timers.size, 1, 'a single scheduler timer');
assert.ok(furthest(ctx) > ctx.currentTime + 0.3, 'the scheduler stays ahead');
assert.ok(furthest(ctx) < ctx.currentTime + 1.7, 'but no more than a bar ahead');
run("music('game:3')");
let players = run('JSON.stringify(audio.snapshot().players)');
assert.equal(players, q([{ name: 'room:0', stopping: true, step: JSON.parse(players)[0].step }, { name: 'game:3', stopping: false, step: JSON.parse(players)[1].step }]), 'crossfade keeps both briefly');
play(ctx, 1);
assert.equal(run('audio.snapshot().players.map(p => p.name).join()'), 'game:3', 'the old track is disposed after the fade');
for (const name of TRACKS) {
  run(`music(${q(name)})`);
  play(ctx, 4);
  assert.equal(run('audio.track'), name);
}
run("music('room:1')");
play(ctx, 1);
run("music('result:lose')");
assert.equal(run('audio.playing'), true);
play(ctx, 8);
assert.equal(run('audio.playing'), false, 'stings end by themselves');
assert.equal(run('audio.timer'), null, 'and the scheduler stops');
before = ctx.nodes.length;
run("music('result:lose')");
assert.equal(ctx.nodes.length, before, 'a finished sting is not replayed by the same name');
run("music('boss')");
play(ctx, 2);
run('music(null)');
assert.equal(run('audio.playing'), false, 'music(null) stops');
play(ctx, 1);
assert.equal(run('audio.timer'), null);
assert.equal(run('audio.snapshot().players.length'), 0);
console.log(`PASS: one look-ahead scheduler; all ${TRACKS.length} tracks play; crossfade, sting end and stop work.`);

// ---- Hidden tabs and interruptions ----
run("music('room:5')");
play(ctx, 1);
box.document.hidden = true;
run('audio.handleVisibility()');
assert.equal(ctx.state, 'suspended', 'a hidden tab suspends audio');
assert.equal(run('audio.timer'), null, 'and stops the scheduler');
before = ctx.nodes.length;
run("sfx('coin'); music('room:2')");
assert.equal(ctx.nodes.length, before, 'nothing plays while hidden');
box.document.hidden = false;
run('audio.handleVisibility()');
assert.equal(ctx.state, 'running');
assert.notEqual(run('audio.timer'), null, 'the scheduler resumes');
assert.equal(run('audio.snapshot().players.filter(p => !p.stopping).map(p => p.name).join()'), 'room:2', 'with the latest track');
ctx.state = 'interrupted';
run('audio.unlock()');
assert.equal(ctx.state, 'running', 'the next gesture resumes an interrupted context');
console.log('PASS: hidden tabs suspend and resume; interrupted contexts resume on the next gesture.');

// ---- Toggle, legacy toggles, volume, persistence ----
play(ctx, 1);
assert.equal(run('audio.toggle()'), false);
assert.equal(run('state.sound'), false);
assert.equal(run('audio.enabled'), false);
assert.equal(JSON.parse(run('localStorage.getItem("gut-feeling-audio")')).sound, false, 'toggle persists');
assert.ok(nodes.soundBtn.innerHTML.includes('Sound off'), 'the header button reflects the preference');
assert.equal(run('audio.timer'), null, 'muting stops the scheduler');
before = ctx.nodes.length;
run("sfx('coin'); tone(300, 0.1); music('game:1')");
assert.equal(ctx.nodes.length, before, 'silent while off');
assert.equal(run('audio.track'), 'game:1', 'but the requested track is remembered');
runTimers();
assert.equal(ctx.state, 'suspended', 'a muted context suspends after the fade');
assert.equal(run('audio.toggle()'), true);
assert.equal(ctx.state, 'running');
assert.ok(nodes.soundBtn.innerHTML.includes('Sound on'));
assert.equal(run('audio.snapshot().players.filter(p => !p.stopping).map(p => p.name).join()'), 'game:1');
run('state.sound = false');
before = ctx.nodes.length;
run("sfx('coin')");
assert.equal(ctx.nodes.length, before, 'a direct state.sound flip (old header button) mutes');
assert.equal(JSON.parse(run('localStorage.getItem("gut-feeling-audio")')).sound, false, 'and persists');
run('audio.setEnabled(true)');
assert.equal(run('audio.enabled'), true);
run('audio.volume = 0.4');
assert.equal(run('audio.volume'), 0.4);
assert.equal(run('state.volume'), 0.4);
assert.equal(JSON.parse(run('localStorage.getItem("gut-feeling-audio")')).volume, 0.4);
run('audio.volume = 7');
assert.equal(run('audio.volume'), 1, 'volume is clamped');
run('localStorage.setItem("gut-feeling-audio", JSON.stringify({sound: false, volume: 0.3})); audioLoadPrefs()');
assert.equal(run('state.sound'), false, 'the saved preference is read at init');
assert.equal(run('audio.volume'), 0.3);
assert.equal(run('audioTestDraws'), 0, 'audio never draws from Math.random');
console.log('PASS: toggle, legacy toggles, volume and persistence; Math.random untouched.');
