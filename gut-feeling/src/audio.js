// Sound: synthesized effects, a look-ahead step sequencer for music, and the sound preference.
// Everything is generated with Web Audio at runtime (no files, no fetches). Before the first user
// gesture, with sound off, in a hidden tab, or without Web Audio, every call is a silent no-op.
//
// Public API
//   sfx(name, {combo, count, pan, vol})  One designed effect. Unknown names play a generic blip.
//                                        sfx('talk', {voice, count, combo}) is one syllable of a hallway voice.
//   music(name)                          Crossfade to a looped track ('room:0'..'room:6', 'game:0'..'game:5', 'game:pitch',
//                                        'boss', 'title') or a one-shot sting ('result:win', 'result:lose').
//                                        music(null) stops; repeating the current name does nothing.
//   tone(freq, dur, type, vol)           Legacy beep, routed through the same mixer.
//   audio.unlock()                       Create/resume the context. Called on every user gesture.
//   audio.toggle(), audio.setEnabled(on), audio.enabled, audio.volume (0-1)
//
// Signal path
//   sfx layers ──────────────────────(pan)──> sfxBus ─┐
//   track parts (lead/bass/chord/drum) ─> player.out ─> duck ─> musicBus ─┴─> master ─> lowpass ─> compressor ─> out
// Each music player owns its part buses, shared drum filters, an optional echo and a vibrato LFO, so a
// note costs one oscillator (or noise source) plus one pooled gain. Loud effects duck the music by 6 dB.

let audioCtx = null;

const AUDIO_PREFS = 'gut-feeling-audio',
  AUDIO_TICK_MS = 100,
  AUDIO_FADE = 0.6,
  AUDIO_DUCK = 0.5,
  AUDIO_MAX_VOICES = 40,
  AUDIO_HITS = { x: 1, X: 1.35, g: 0.45 },
  AUDIO_DRUMS = ['k', 's', 'h', 'o', 'c', 't', 'clap', 'knock', 'ping', 'beep', 'tick'];

let audioVolume = 0.8,
  audioApplied = true,
  audioResuming = false,
  audioPrimed = false,
  audioSeed = 0x2f6b9a1d,
  audioPlayers = [],
  audioCounting = false,
  audioGroup = null,
  audioMul = 1,
  audioNoiseBuf = null;

const audioWaves = {},
  audioGainPool = [],
  audioLast = {};

const audio = {
  ctx: null,
  track: null,
  timer: null,
  voices: 0,
  // AudioContext time until which music is ducked under a loud effect (internal).
  ducking: 0,
  master: null,
  duckNode: null,
  sfxBus: null,
  get enabled() {
    return !!state.sound;
  },
  set enabled(on) {
    audioSetEnabled(on);
  },
  get volume() {
    return audioVolume;
  },
  set volume(v) {
    audioSetVolume(v);
  },
  get playing() {
    return audioPlayers.some(p => !p.stopping);
  },
  get sounds() {
    return Object.keys(SFX);
  },
  get tracks() {
    return Object.keys(AUDIO_MUSIC);
  },
  unlock: audioUnlock,
  toggle: () => audioSetEnabled(!state.sound),
  setEnabled: audioSetEnabled,
  handleVisibility: audioVisibility,
  checkTracks: audioCheckTracks,
  snapshot: () => ({
    track: audio.track,
    state: audioCtx ? audioCtx.state : 'none',
    voices: audio.voices,
    timer: audio.timer !== null,
    players: audioPlayers.map(p => ({ name: p.name, stopping: p.stopping, step: p.step }))
  })
};

// ---- Preference and lifecycle ----

function audioLoadPrefs() {
  let p = {};
  try {
    p = JSON.parse(localStorage.getItem(AUDIO_PREFS) || '{}') || {};
  } catch {}
  const old = typeof saved === 'object' && saved ? saved : {};
  if (typeof p.sound === 'boolean') state.sound = p.sound;
  else if (typeof old.sound === 'boolean') state.sound = old.sound;
  else state.sound = true;
  const v = Number.isFinite(p.volume) ? p.volume : Number.isFinite(old.volume) ? old.volume : 0.8;
  audioVolume = clamp(v, 0, 1);
  state.volume = audioVolume;
  audioApplied = !!state.sound;
}

function audioSavePrefs(full = true) {
  try {
    localStorage.setItem(AUDIO_PREFS, JSON.stringify({ sound: !!state.sound, volume: audioVolume }));
  } catch {}
  if (full && typeof save === 'function') save();
}

// The header button starts as "Sound off" in the template; keep it truthful about the preference.
function audioSyncButton() {
  const b = typeof $ === 'function' ? $('soundBtn') : null;
  if (!b) return;
  const on = !!state.sound;
  b.innerHTML = `<svg><use href="#i-${on ? 'sound' : 'mute'}"/></svg><span>Sound ${on ? 'on' : 'off'}</span>`;
  b.setAttribute('aria-label', `Turn sound ${on ? 'off' : 'on'}`);
  b.title = on ? 'Sound on' : 'Sound off';
}

function audioSetEnabled(on) {
  state.sound = !!on;
  audioApply();
  audioSavePrefs();
  audioSyncButton();
  if (state.sound) audioUnlock();
  return state.sound;
}

function audioSetVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  audioVolume = clamp(n, 0, 1);
  state.volume = audioVolume;
  if (audioCtx && state.sound) audioRamp(audio.master.gain, audioVolume, 0.03);
  audioSavePrefs(false);
}

// Code that flips state.sound directly (the old header toggle) is noticed here and applied.
function audioSync() {
  if (!!state.sound === audioApplied) return;
  audioApply();
  audioSavePrefs();
}

function audioApply() {
  audioApplied = !!state.sound;
  if (!audioCtx) return;
  if (audioApplied) {
    audioRamp(audio.master.gain, audioVolume, 0.03);
    audioResume();
    audioReconcile(false);
    return;
  }
  audioRamp(audio.master.gain, 0, 0.02);
  audioStopTimer();
  // Let the fade finish, then suspend so a muted phone can idle.
  audioLater(() => {
    if (audioCtx && !state.sound && audioCtx.state === 'running') audioSettle(audioCtx.suspend());
  }, 150);
}

function audioHidden() {
  return typeof document !== 'undefined' && !!document.hidden;
}

function audioLive() {
  audioSync();
  return (
    !!audioCtx && audioApplied && !audioHidden() && (audioCtx.state === 'running' || audioResuming)
  );
}

function audioCreate() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return false;
  try {
    audioCtx = new AC({ latencyHint: 'interactive' });
  } catch {
    try {
      audioCtx = new AC();
    } catch {
      audioCtx = null;
      return false;
    }
  }
  const ctx = audioCtx;
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.master.gain.value = state.sound ? audioVolume : 0;
  const air = ctx.createBiquadFilter();
  air.type = 'lowpass';
  air.frequency.value = 9500;
  air.Q.value = 0.5;
  const squash = ctx.createDynamicsCompressor();
  squash.threshold.value = -16;
  squash.knee.value = 10;
  squash.ratio.value = 4;
  squash.attack.value = 0.004;
  squash.release.value = 0.2;
  const musicBus = ctx.createGain();
  musicBus.gain.value = 0.5;
  audio.duckNode = ctx.createGain();
  audio.sfxBus = ctx.createGain();
  audio.sfxBus.gain.value = 1;
  audio.duckNode.connect(musicBus);
  musicBus.connect(audio.master);
  audio.sfxBus.connect(audio.master);
  audio.master.connect(air);
  air.connect(squash);
  squash.connect(ctx.destination);
  // iOS can interrupt the context (calls, Siri); pick the music back up when it runs again.
  ctx.onstatechange = () => {
    if (ctx.state === 'running') audioReconcile(false);
  };
  audioApplied = !!state.sound;
  return true;
}

function audioUnlock() {
  audioSync();
  if (!state.sound) return false;
  if (!audioCtx && !audioCreate()) return false;
  if (audioCtx.state !== 'running') audioResume();
  if (!audioPrimed) audioPrime();
  audioReconcile(false);
  return true;
}

// iOS Safari unlocks Web Audio only once a sound starts inside a gesture: play one silent sample.
function audioPrime() {
  try {
    const s = audioCtx.createBufferSource();
    s.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate || 44100);
    s.connect(audioCtx.destination);
    s.onended = () => audioUnplug(s);
    s.start(0);
    audioPrimed = true;
  } catch {}
}

function audioResume() {
  if (!audioCtx || audioHidden() || typeof audioCtx.resume !== 'function') return;
  audioResuming = true;
  audioSettle(audioCtx.resume(), () => {
    audioResuming = false;
  });
}

function audioVisibility() {
  if (!audioCtx) return;
  if (audioHidden()) {
    audioStopTimer();
    if (audioCtx.state === 'running') audioSettle(audioCtx.suspend());
    return;
  }
  if (!state.sound) return;
  audioResume();
  audioReconcile(false);
}

function audioListen() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  // Capture phase, so the context exists before any game handler plays its first sound.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'])
    document.addEventListener(type, audioUnlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', audioVisibility);
}

// ---- Small helpers ----

function audioSettle(promise, done) {
  if (promise && typeof promise.then === 'function') promise.then(done, done);
  else if (done) done();
}

function audioLater(fn, ms) {
  return typeof setTimeout === 'function' ? setTimeout(fn, ms) : null;
}

function audioStopTimer() {
  if (audio.timer !== null && typeof clearTimeout === 'function') clearTimeout(audio.timer);
  audio.timer = null;
}

function audioUnplug(node, target) {
  try {
    if (target) node.disconnect(target);
    else node.disconnect();
  } catch {}
}

// Freeze a param at its current value so new automation starts from where it is.
function audioHold(param, t) {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t);
    return;
  }
  const v = param.value;
  param.cancelScheduledValues(t);
  param.setValueAtTime(v, t);
}

function audioRamp(param, value, timeConstant) {
  const now = audioCtx.currentTime;
  audioHold(param, now);
  param.setTargetAtTime(value, now, timeConstant);
}

// Private xorshift so audio never consumes the game's (test-seeded) Math.random.
function audioRand() {
  audioSeed ^= audioSeed << 13;
  audioSeed ^= audioSeed >>> 17;
  audioSeed ^= audioSeed << 5;
  return (audioSeed >>> 0) / 4294967296;
}

const audioJitter = amount => 1 + (audioRand() * 2 - 1) * amount,
  audioSemi = n => 2 ** (n / 12),
  audioFreq = midi => 440 * 2 ** ((midi - 69) / 12),
  audioMod = (n, m) => ((n % m) + m) % m,
  audioCycle = (bars, i) => (Array.isArray(bars) ? bars[i % bars.length] : bars);

// ---- Voices ----

function audioGain(dest) {
  const g = audioGainPool.pop() || audioCtx.createGain();
  g.connect(dest);
  return g;
}

function audioFreeGain(g) {
  audioUnplug(g);
  g.gain.cancelScheduledValues(0);
  g.gain.value = 0;
  if (audioGainPool.length < 48) audioGainPool.push(g);
}

function audioFilter(type, f, q, t) {
  const n = audioCtx.createBiquadFilter();
  n.type = type;
  n.frequency.setValueAtTime(f, t);
  n.Q.value = q;
  return n;
}

function audioWave(w) {
  if (w === 'sine' || w === 'triangle' || w === 'sawtooth') return null;
  if (audioWaves[w]) return audioWaves[w];
  const n = 32,
    real = new Float32Array(n),
    imag = new Float32Array(n),
    duty = { square: 0.5, pulse25: 0.25, pulse12: 0.125 }[w];
  if (duty) {
    // Band-limited pulse with a gentle top-end rolloff: chiptune colour without the ice-pick.
    for (let k = 1; k < n; k++) real[k] = (2 * Math.sin(Math.PI * k * duty)) / (Math.PI * k) / (1 + (k / 18) ** 2);
  } else {
    const partials = AUDIO_PARTIALS[w] || [0, 1];
    for (let k = 0; k < partials.length && k < n; k++) imag[k] = partials[k];
  }
  audioWaves[w] = audioCtx.createPeriodicWave(real, imag);
  return audioWaves[w];
}

const AUDIO_PARTIALS = {
  organ: [0, 1, 0.55, 0.35, 0.22, 0, 0.12, 0, 0.08],
  bell: [0, 1, 0.08, 0.42, 0, 0.22, 0, 0.1]
};

function audioSetWave(o, w) {
  const wave = audioWave(w);
  if (wave) o.setPeriodicWave(wave);
  else o.type = w;
}

function audioNoiseBuffer() {
  if (audioNoiseBuf) return audioNoiseBuf;
  const rate = audioCtx.sampleRate || 44100,
    buf = audioCtx.createBuffer(1, rate, rate),
    data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = audioRand() * 2 - 1;
  audioNoiseBuf = buf;
  return buf;
}

// Attack to v, optional hold, then an exponential fall to silence at t + dur. Returns the stop time.
function audioEnvelope(param, t, p) {
  const v = Math.max(0.0002, p.v * audioMul),
    a = p.a || 0.004,
    hold = p.hold || 0,
    end = t + Math.max(p.dur, a + hold + 0.02);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(v, t + a);
  if (hold) param.setValueAtTime(v, t + a + hold);
  param.exponentialRampToValueAtTime(0.0001, end);
  return end + 0.01;
}

// Disconnect a finished voice and return its gain to the pool.
function audioWatch(src, g, filt, detune, vib) {
  const counted = audioCounting,
    group = audioGroup;
  if (counted) audio.voices++;
  if (group) group.n++;
  src.onended = () => {
    if (counted) audio.voices = Math.max(0, audio.voices - 1);
    audioUnplug(src);
    if (filt) audioUnplug(filt);
    if (vib) audioUnplug(vib, detune);
    audioFreeGain(g);
    if (group) {
      group.n--;
      if (group.n === 0) audioUnplug(group.node);
    }
  };
}

// Pitched layer: {w, f, f2, slide, dur, v, a, hold, cut, cut2, ft, q}.
function audioOsc(t, dest, p) {
  const o = audioCtx.createOscillator(),
    g = audioGain(dest),
    f = Math.max(1, p.f);
  audioSetWave(o, p.w || 'triangle');
  o.frequency.setValueAtTime(f, t);
  if (p.f2 && p.f2 !== p.f) o.frequency.exponentialRampToValueAtTime(Math.max(1, p.f2), t + (p.slide || p.dur));
  let filt = null;
  if (p.cut) {
    filt = audioFilter(p.ft || 'lowpass', p.cut, p.q || 0.7, t);
    if (p.cut2) filt.frequency.exponentialRampToValueAtTime(p.cut2, t + p.dur);
    o.connect(filt);
    filt.connect(g);
  } else o.connect(g);
  const end = audioEnvelope(g.gain, t, p);
  audioWatch(o, g, filt);
  o.start(t);
  o.stop(end);
}

// Noise layer: {ft, f, f2, q, dur, v, a, hold}. Without ft it feeds dest directly (a shared filter).
function audioNoise(t, dest, p) {
  const s = audioCtx.createBufferSource(),
    g = audioGain(dest);
  s.buffer = audioNoiseBuffer();
  s.loop = true;
  let filt = null;
  if (p.ft) {
    filt = audioFilter(p.ft, p.f || 1000, p.q || 1, t);
    if (p.f2 && p.f2 !== p.f) filt.frequency.exponentialRampToValueAtTime(p.f2, t + p.dur);
    s.connect(filt);
    filt.connect(g);
  } else s.connect(g);
  const end = audioEnvelope(g.gain, t, p);
  audioWatch(s, g, filt);
  s.start(t, audioRand() * 0.5);
  s.stop(end);
}

// ---- Sound effects ----
// play(t, o, d): t is the start time, o has combo/count (numbers) and j (a small random detune), d is
// the destination. Layer volumes are multiplied by gain (a measured balance trim) and opts.vol.
// gap: minimum seconds between repeats of the same name. duck: dips the music.

const SFX = {
  blip: {
    gain: 2.1,
    play(t, o, d) {
      audioOsc(t, d, { w: 'triangle', f: 720, f2: 620, dur: 0.07, v: 0.1 });
    }
  },
  ui: {
    gain: 2.1,
    play(t, o, d) {
      audioOsc(t, d, { w: 'triangle', f: 1040, f2: 880, dur: 0.06, v: 0.09 });
      audioNoise(t, d, { ft: 'highpass', f: 5000, dur: 0.015, v: 0.04 });
    }
  },
  select: {
    gain: 2.1,
    play(t, o, d) {
      audioOsc(t, d, { w: 'pulse25', f: 660, dur: 0.05, v: 0.06 });
      audioOsc(t + 0.05, d, { w: 'pulse25', f: 990, dur: 0.09, v: 0.06 });
    }
  },
  back: {
    gain: 2.1,
    play(t, o, d) {
      audioOsc(t, d, { w: 'pulse25', f: 740, f2: 700, dur: 0.05, v: 0.055 });
      audioOsc(t + 0.05, d, { w: 'triangle', f: 494, dur: 0.1, v: 0.08 });
    }
  },
  hit: {
    gap: 0.03,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 1500 * o.j, f2: 500, q: 1.1, dur: 0.08, v: 0.32 });
      audioOsc(t, d, { w: 'triangle', f: 260 * o.j, f2: 85, dur: 0.1, v: 0.3 });
    }
  },
  swing: {
    gain: 2.5,
    play(t, o, d) {
      const c = clamp(o.combo, 0, 4);
      audioNoise(t, d, { ft: 'bandpass', f: 700 * (1 + 0.25 * c), f2: 2600 * (1 + 0.25 * c), q: 1.8, dur: 0.14, v: 0.16, a: 0.03 });
      audioOsc(t, d, { w: 'triangle', f: 190 * audioSemi(2 * c), f2: 300 * audioSemi(2 * c), dur: 0.09, v: 0.05 });
    }
  },
  jump: {
    gain: 2.2,
    play(t, o, d) {
      audioOsc(t, d, { w: 'pulse25', f: 280, f2: 640, slide: 0.1, dur: 0.14, v: 0.07 });
      audioNoise(t, d, { ft: 'highpass', f: 3000, dur: 0.03, v: 0.03 });
    }
  },
  leap: {
    gain: 2.6,
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sawtooth', f: 160, f2: 1000, slide: 0.32, dur: 0.36, v: 0.07, cut: 2600 });
      audioNoise(t, d, { ft: 'bandpass', f: 600, f2: 3000, q: 1.5, dur: 0.34, v: 0.12, a: 0.15 });
    }
  },
  dash: {
    play(t, o, d) {
      audioNoise(t, d, { ft: 'highpass', f: 900, f2: 4500, dur: 0.14, v: 0.14, a: 0.02 });
      audioOsc(t, d, { w: 'sine', f: 170, f2: 60, dur: 0.1, v: 0.18 });
    }
  },
  hurt: {
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'square', f: 380, f2: 110, slide: 0.2, dur: 0.28, v: 0.12, cut: 1800 });
      audioNoise(t, d, { ft: 'lowpass', f: 2400, f2: 300, dur: 0.2, v: 0.22 });
      audioOsc(t, d, { w: 'sine', f: 150, f2: 60, dur: 0.2, v: 0.2 });
    }
  },
  coin: {
    gain: 2.4,
    play(t, o, d) {
      audioOsc(t, d, { w: 'pulse25', f: 988, dur: 0.07, v: 0.065 });
      audioOsc(t + 0.065, d, { w: 'pulse25', f: 1319, dur: 0.22, v: 0.065 });
    }
  },
  pickup: {
    gain: 1.6,
    play(t, o, d) {
      [523, 659, 784].forEach((f, i) => audioOsc(t + i * 0.05, d, { w: 'triangle', f, dur: 0.1, v: 0.11 }));
      audioOsc(t + 0.15, d, { w: 'triangle', f: 1047, dur: 0.18, v: 0.09 });
    }
  },
  eat: {
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 1000, q: 2.5, dur: 0.05, v: 0.22 });
      audioNoise(t + 0.1, d, { ft: 'bandpass', f: 800, q: 2.5, dur: 0.05, v: 0.2 });
      audioOsc(t + 0.19, d, { w: 'sine', f: 220, f2: 440, slide: 0.12, dur: 0.15, v: 0.18 });
    }
  },
  enemyDie: {
    play(t, o, d) {
      audioOsc(t, d, { w: 'square', f: 820 * o.j, f2: 150, slide: 0.2, dur: 0.22, v: 0.08, cut: 3200 });
      audioNoise(t, d, { ft: 'bandpass', f: 2200, f2: 500, dur: 0.12, v: 0.22 });
      audioOsc(t, d, { w: 'sine', f: 130, f2: 45, dur: 0.16, v: 0.25 });
    }
  },
  split: {
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 380, f2: 760, dur: 0.1, v: 0.18 });
      audioOsc(t + 0.07, d, { w: 'sine', f: 470, f2: 940, dur: 0.11, v: 0.16 });
      audioNoise(t, d, { ft: 'lowpass', f: 1500, dur: 0.05, v: 0.08 });
    }
  },
  blob: {
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 280 * o.j, f2: 110, dur: 0.14, v: 0.22 });
      audioNoise(t, d, { ft: 'lowpass', f: 900, f2: 250, dur: 0.1, v: 0.12 });
    }
  },
  throw: {
    gain: 2.8,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 800, f2: 2600, q: 1.4, dur: 0.13, v: 0.15, a: 0.03 });
      audioOsc(t, d, { w: 'triangle', f: 300, f2: 440, dur: 0.06, v: 0.06 });
    }
  },
  bounce: {
    gain: 1.4,
    gap: 0.03,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 520 * o.j, f2: 360 * o.j, dur: 0.07, v: 0.16 });
      audioNoise(t, d, { ft: 'highpass', f: 3500, dur: 0.012, v: 0.04 });
    }
  },
  explode: {
    duck: true,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'lowpass', f: 3500, f2: 150, dur: 0.75, v: 0.5 });
      audioOsc(t, d, { w: 'sine', f: 120, f2: 30, slide: 0.5, dur: 0.55, v: 0.5 });
      audioNoise(t, d, { ft: 'bandpass', f: 500, q: 0.8, dur: 0.3, v: 0.2 });
    }
  },
  shot: {
    gain: 0.85,
    gap: 0.035,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 2600 * o.j, f2: 700, q: 0.9, dur: 0.1, v: 0.3 });
      audioOsc(t, d, { w: 'square', f: 200 * o.j, f2: 55, slide: 0.07, dur: 0.09, v: 0.13, cut: 1700 });
      audioNoise(t, d, { ft: 'highpass', f: 6000, dur: 0.015, v: 0.06 });
    }
  },
  reload: {
    gain: 2,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 2700, q: 5, dur: 0.03, v: 0.2 });
      audioOsc(t, d, { w: 'square', f: 160, f2: 120, dur: 0.05, v: 0.05, cut: 900 });
      audioNoise(t + 0.12, d, { ft: 'bandpass', f: 1800, q: 5, dur: 0.035, v: 0.2 });
      audioNoise(t + 0.2, d, { ft: 'bandpass', f: 3400, q: 6, dur: 0.02, v: 0.12 });
    }
  },
  slice: {
    gain: 1.3,
    gap: 0.02,
    play(t, o, d) {
      const s = audioSemi(clamp(o.combo, 0, 12));
      audioNoise(t, d, { ft: 'highpass', f: 2800, f2: 7000, dur: 0.09, v: 0.17, a: 0.01 });
      audioOsc(t, d, { w: 'triangle', f: 640 * s, f2: 1280 * s, slide: 0.05, dur: 0.08, v: 0.055 });
    }
  },
  bomb: {
    duck: true,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'lowpass', f: 3000, f2: 120, dur: 1, v: 0.55 });
      audioOsc(t, d, { w: 'sine', f: 95, f2: 28, slide: 0.7, dur: 0.8, v: 0.55 });
      audioOsc(t, d, { w: 'sawtooth', f: 150, f2: 60, dur: 0.35, v: 0.08, cut: 700 });
      audioNoise(t + 0.05, d, { ft: 'bandpass', f: 900, f2: 300, q: 3, dur: 0.25, v: 0.2 });
    }
  },
  combo: {
    gain: 2,
    play(t, o, d) {
      const base = 523 * audioSemi(clamp((o.count || 3) - 3, 0, 12));
      [0, 4, 7, 12].forEach((n, i) => audioOsc(t + i * 0.045, d, { w: 'pulse25', f: base * audioSemi(n), dur: 0.11, v: 0.06 }));
      audioOsc(t + 0.18, d, { w: 'triangle', f: base * 2, dur: 0.2, v: 0.07 });
    }
  },
  fever: {
    gain: 2,
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 300, f2: 1200, slide: 0.5, dur: 0.6, v: 0.1 });
      for (const f of [523, 659, 784, 1047]) audioOsc(t + 0.3, d, { w: 'pulse25', f, dur: 0.45, v: 0.03 });
      audioNoise(t, d, { ft: 'highpass', f: 6000, dur: 0.55, v: 0.05, a: 0.3 });
    }
  },
  drip: {
    gain: 1.6,
    gap: 0.04,
    play(t, o, d) {
      const s = audioSemi(clamp(o.count, 0, 16));
      audioOsc(t, d, { w: 'sine', f: 620 * s, f2: 1500 * s, slide: 0.045, dur: 0.13, v: 0.16 });
      audioOsc(t + 0.07, d, { w: 'sine', f: 1500 * s, f2: 1700 * s, dur: 0.06, v: 0.04 });
    }
  },
  catch: {
    gain: 1.8,
    play(t, o, d) {
      audioOsc(t, d, { w: 'triangle', f: 660 * o.j, dur: 0.09, v: 0.14 });
      audioNoise(t, d, { ft: 'bandpass', f: 3000, q: 2, dur: 0.025, v: 0.07 });
    }
  },
  pump: {
    play(t, o, d) {
      audioNoise(t, d, { ft: 'lowpass', f: 650, f2: 200, dur: 0.1, v: 0.16 });
      audioOsc(t, d, { w: 'sine', f: 150, f2: 90, dur: 0.09, v: 0.14 });
    }
  },
  wave: {
    gain: 1.8,
    duck: true,
    play(t, o, d) {
      [440, 554, 659].forEach((f, i) => audioOsc(t + i * 0.11, d, { w: 'pulse25', f, dur: 0.1, v: 0.06, cut: 2200 }));
      audioOsc(t, d, { w: 'triangle', f: 220, dur: 0.35, v: 0.1 });
    }
  },
  clear: {
    gain: 1.6,
    duck: true,
    play(t, o, d) {
      [523, 659, 784, 1047].forEach((f, i) => audioOsc(t + i * 0.07, d, { w: 'pulse25', f, dur: 0.13, v: 0.065 }));
      audioOsc(t + 0.28, d, { w: 'triangle', f: 1047, dur: 0.4, v: 0.09 });
      audioNoise(t + 0.2, d, { ft: 'highpass', f: 6000, dur: 0.35, v: 0.03, a: 0.1 });
    }
  },
  win: {
    gain: 1.3,
    duck: true,
    play(t, o, d) {
      for (const f of [523, 659, 784]) audioOsc(t, d, { w: 'pulse25', f, dur: 0.13, v: 0.045 });
      for (const f of [698, 880, 1047]) audioOsc(t + 0.15, d, { w: 'pulse25', f, dur: 0.35, v: 0.045 });
      audioOsc(t, d, { w: 'triangle', f: 131, dur: 0.5, v: 0.16 });
    }
  },
  lose: {
    gain: 1.3,
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sawtooth', f: 200, f2: 98, slide: 0.5, dur: 0.6, v: 0.09, cut: 900 });
      audioOsc(t, d, { w: 'triangle', f: 98, f2: 62, slide: 0.5, dur: 0.55, v: 0.16 });
    }
  },
  countdown: {
    gain: 2.1,
    play(t, o, d) {
      audioOsc(t, d, { w: 'triangle', f: 660, dur: 0.1, v: 0.14 });
      audioNoise(t, d, { ft: 'highpass', f: 4500, dur: 0.015, v: 0.05 });
    }
  },
  go: {
    gain: 1.6,
    play(t, o, d) {
      audioOsc(t, d, { w: 'pulse25', f: 1047, dur: 0.28, v: 0.06 });
      audioOsc(t, d, { w: 'triangle', f: 523, dur: 0.3, v: 0.14 });
      audioNoise(t, d, { ft: 'highpass', f: 2000, f2: 7000, dur: 0.22, v: 0.05, a: 0.05 });
    }
  },
  stun: {
    gain: 1.3,
    play(t, o, d) {
      audioOsc(t, d, { w: 'square', f: 220, dur: 0.2, v: 0.05, cut: 1500, hold: 0.08 });
      audioOsc(t, d, { w: 'square', f: 233, dur: 0.2, v: 0.05, cut: 1500, hold: 0.08 });
      audioOsc(t + 0.12, d, { w: 'triangle', f: 1568, dur: 0.07, v: 0.05 });
      audioOsc(t + 0.2, d, { w: 'triangle', f: 1760, dur: 0.07, v: 0.05 });
    }
  },
  shield: {
    gain: 1.4,
    play(t, o, d) {
      audioOsc(t, d, { w: 'triangle', f: 400, f2: 1200, slide: 0.2, dur: 0.3, v: 0.09 });
      audioOsc(t, d, { w: 'triangle', f: 404, f2: 1212, slide: 0.2, dur: 0.3, v: 0.07 });
      audioNoise(t, d, { ft: 'highpass', f: 5000, dur: 0.2, v: 0.03 });
    }
  },
  trap: {
    gain: 1.4,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 3500, q: 3, dur: 0.025, v: 0.2 });
      audioOsc(t, d, { w: 'square', f: 170, f2: 80, dur: 0.12, v: 0.1, cut: 1300 });
    }
  },
  miss: {
    gain: 1.6,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sawtooth', f: 180, f2: 95, slide: 0.18, dur: 0.22, v: 0.07, cut: 900 });
      audioOsc(t, d, { w: 'triangle', f: 92, dur: 0.2, v: 0.12 });
    }
  },
  headshot: {
    gain: 1.5,
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 1760, f2: 1720, dur: 0.4, v: 0.1, a: 0.002 });
      audioOsc(t, d, { w: 'sine', f: 2640, dur: 0.22, v: 0.035, a: 0.002 });
      audioNoise(t, d, { ft: 'bandpass', f: 1300, f2: 300, dur: 0.14, v: 0.26 });
    }
  },
  boss: {
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sawtooth', f: 85, f2: 70, dur: 1, v: 0.12, cut: 900, hold: 0.4 });
      audioOsc(t, d, { w: 'square', f: 55, dur: 1.1, v: 0.08, cut: 400, hold: 0.5 });
      audioNoise(t, d, { ft: 'lowpass', f: 700, f2: 180, dur: 0.9, v: 0.22, a: 0.1 });
    }
  },
  bossHit: {
    duck: true,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 1100 * o.j, f2: 300, dur: 0.16, v: 0.38 });
      audioOsc(t, d, { w: 'square', f: 150, f2: 65, dur: 0.18, v: 0.12, cut: 1500 });
      audioOsc(t, d, { w: 'sine', f: 95, f2: 42, dur: 0.22, v: 0.35 });
    }
  },
  bossDie: {
    duck: true,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sawtooth', f: 620, f2: 55, slide: 1.2, dur: 1.3, v: 0.09, cut: 2000, hold: 0.6 });
      for (let i = 0; i < 3; i++)
        audioNoise(t + 0.2 + i * 0.4, d, { ft: 'lowpass', f: 2600, f2: 150, dur: 0.5, v: 0.38 * (1 - 0.2 * i) });
      audioOsc(t, d, { w: 'sine', f: 75, f2: 28, slide: 1, dur: 1.2, v: 0.4 });
    }
  },
  wallSplat: {
    duck: true,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'lowpass', f: 1900, f2: 250, dur: 0.32, v: 0.45 });
      audioOsc(t, d, { w: 'sine', f: 170, f2: 52, dur: 0.24, v: 0.35 });
      audioNoise(t + 0.03, d, { ft: 'bandpass', f: 700, q: 2, dur: 0.16, v: 0.16 });
    }
  },
  organ: {
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 320, f2: 140, slide: 0.26, dur: 0.32, v: 0.2 });
      audioNoise(t, d, { ft: 'lowpass', f: 650, dur: 0.22, v: 0.14 });
      audioOsc(t + 0.08, d, { w: 'sine', f: 540, f2: 260, dur: 0.16, v: 0.08 });
    }
  },
  squelch: {
    gain: 1.3,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 400, f2: 1700, q: 3, dur: 0.13, v: 0.3 });
      audioNoise(t + 0.1, d, { ft: 'bandpass', f: 1600, f2: 450, q: 3, dur: 0.14, v: 0.26 });
      audioOsc(t, d, { w: 'sine', f: 190, f2: 105, dur: 0.22, v: 0.15 });
    }
  },
  ricochet: {
    gain: 1.6,
    gap: 0.03,
    play(t, o, d) {
      audioOsc(t, d, { w: 'sine', f: 2500 * o.j, f2: 800, slide: 0.3, dur: 0.33, v: 0.09 });
      audioNoise(t, d, { ft: 'highpass', f: 3200, dur: 0.02, v: 0.08 });
    }
  },
  powerup: {
    gain: 1.6,
    play(t, o, d) {
      [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) =>
        audioOsc(t + i * 0.035, d, { w: 'pulse25', f, dur: 0.08, v: 0.05 })
      );
      audioOsc(t + 0.25, d, { w: 'triangle', f: 784, dur: 0.35, v: 0.1 });
      audioNoise(t + 0.15, d, { ft: 'highpass', f: 6500, dur: 0.3, v: 0.03, a: 0.1 });
    }
  },
  lock: {
    gain: 1.6,
    play(t, o, d) {
      audioOsc(t, d, { w: 'square', f: 140, dur: 0.08, v: 0.07, cut: 900, hold: 0.04 });
      audioOsc(t + 0.11, d, { w: 'square', f: 140, dur: 0.08, v: 0.07, cut: 900, hold: 0.04 });
      audioNoise(t, d, { ft: 'bandpass', f: 2000, q: 5, dur: 0.02, v: 0.12 });
    }
  },
  unlock: {
    gain: 1.6,
    play(t, o, d) {
      audioNoise(t, d, { ft: 'bandpass', f: 2600, q: 4, dur: 0.02, v: 0.15 });
      audioNoise(t + 0.07, d, { ft: 'bandpass', f: 1700, q: 4, dur: 0.02, v: 0.12 });
      audioOsc(t + 0.12, d, { w: 'triangle', f: 784, dur: 0.1, v: 0.1 });
      audioOsc(t + 0.2, d, { w: 'triangle', f: 1175, dur: 0.25, v: 0.1 });
    }
  },
  daily: {
    gain: 1.5,
    play(t, o, d) {
      [1047, 1319, 1568, 2093].forEach((f, i) => audioOsc(t + i * 0.08, d, { w: 'bell', f, dur: 0.45, v: 0.07 }));
      audioOsc(t, d, { w: 'sine', f: 523, dur: 0.7, v: 0.07, a: 0.02 });
    }
  }
};

// ---- Hallway voices ----
// sfx('talk', {voice, count, combo}): one syllable of speech per typed chunk in a hallway conversation.
// voice picks the speaker, count walks a little contour so a sentence sounds like talking, and combo
// nudges the pitch in semitones so two nurses never sound like twins. Unknown voices use the nurse.
// Optional per voice: jitter (extra random pitch spread), range (scales the contour), vib (a detuned
// second layer that beats like a light vibrato).
const AUDIO_TALK_VOICES = {
  dad: { w: 'triangle', f: 128, dur: 0.08, v: 0.16, cut: 1100, sub: 0.55, lift: 0.95 },
  brother: { w: 'pulse25', f: 238, dur: 0.045, v: 0.055, cut: 1900, lift: 1.04 },
  grandma: { w: 'sine', f: 340, dur: 0.085, v: 0.13, wobble: 0.06, lift: 0.97 },
  grandpa: { w: 'sawtooth', f: 102, dur: 0.11, v: 0.06, cut: 650, sub: 0.6, lift: 0.93 },
  cousin: { w: 'pulse25', f: 430, dur: 0.045, v: 0.045, cut: 3400, lift: 1.06 },
  doctor: { w: 'triangle', f: 196, dur: 0.06, v: 0.12, cut: 1500, lift: 0.98 },
  nurse: { w: 'triangle', f: 300, dur: 0.055, v: 0.12, cut: 2400, lift: 1.05 },
  ensure: { w: 'square', f: 392, dur: 0.05, v: 0.075, cut: 2800, lift: 1.12, loud: 1.5 },
  macy: { w: 'triangle', f: 285, dur: 0.05, v: 0.12, cut: 2600, lift: 1.03 },
  // Rowdy the Ram: bright and bouncy, muffled by a big foam head. A hop up on every syllable, a wide
  // random spread, a narrow contour, and a lowpass near 1.8 kHz. The hallway paces him at about 14 a second.
  rowdy: { w: 'pulse25', f: 255, dur: 0.06, v: 0.075, cut: 1800, lift: 1.16, jitter: 0.2, range: 0.4, vib: 0.018 }
};

const AUDIO_TALK_CONTOUR = [0, 3, 5, 2, 7, 4, 1, 5];

SFX.talk = {
  gain: 1.6,
  gap: 0.035,
  play(t, o, d) {
    const v = AUDIO_TALK_VOICES[o.voice] || AUDIO_TALK_VOICES.nurse,
      step = AUDIO_TALK_CONTOUR[audioMod(Math.floor(o.count), AUDIO_TALK_CONTOUR.length)] * (v.range || 1),
      f = v.f * audioSemi(step + clamp(o.combo, -7, 7)) * o.j * (v.jitter ? audioJitter(v.jitter) : 1),
      level = v.v * (v.loud || 1);
    audioOsc(t, d, { w: v.w, f, f2: f * v.lift, dur: v.dur, v: level, a: 0.006, cut: v.cut });
    if (v.vib)
      audioOsc(t, d, { w: 'triangle', f: f * (1 + v.vib), f2: f * v.lift * (1 - v.vib), dur: v.dur, v: level * 0.35, cut: v.cut });
    if (v.sub) audioOsc(t, d, { w: 'sine', f: f / 2, dur: v.dur, v: level * v.sub });
    if (v.wobble)
      audioOsc(t + v.dur * 0.35, d, { w: v.w, f: f * (1 + v.wobble), f2: f * (1 - v.wobble), dur: v.dur * 0.75, v: level * 0.6 });
    audioNoise(t, d, { ft: 'bandpass', f: Math.min(7000, f * 7), q: 2, dur: 0.018, v: 0.025 });
  }
};

const audioOwn = name => typeof name === 'string' && Object.prototype.hasOwnProperty.call(SFX, name);

function sfx(name, opts = {}) {
  if (!audioLive()) return;
  const key = audioOwn(name) ? name : 'blip',
    def = SFX[key],
    now = audioCtx.currentTime,
    o = opts && typeof opts === 'object' ? opts : {};
  if (now - (audioLast[key] ?? -1) < (def.gap ?? 0.025)) return;
  if (audio.voices >= AUDIO_MAX_VOICES) return;
  const vol = Number.isFinite(o.vol) ? clamp(o.vol, 0, 2) : 1;
  if (vol <= 0) return;
  audioLast[key] = now;
  const t = now + 0.005,
    x = {
      combo: Number(o.combo) || 0,
      count: Number(o.count) || 0,
      j: audioJitter(0.035),
      voice: typeof o.voice === 'string' ? o.voice : ''
    };
  let dest = audio.sfxBus;
  audioGroup = null;
  if (Number.isFinite(o.pan) && o.pan !== 0 && typeof audioCtx.createStereoPanner === 'function') {
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = clamp(o.pan, -1, 1);
    pan.connect(audio.sfxBus);
    dest = pan;
    audioGroup = { node: pan, n: 0 };
  }
  audioCounting = true;
  audioMul = vol * (def.gain || 1);
  try {
    def.play(t, x, dest);
  } catch {
    // A failed layer must never break the game loop.
  } finally {
    if (audioGroup && audioGroup.n === 0) audioUnplug(audioGroup.node);
    audioCounting = false;
    audioMul = 1;
    audioGroup = null;
  }
  if (def.duck) audioDuck(t);
}

function audioDuck(t) {
  const g = audio.duckNode.gain;
  audioHold(g, t);
  g.setTargetAtTime(AUDIO_DUCK, t, 0.012);
  g.setTargetAtTime(1, t + 0.15, 0.08);
  audio.ducking = t + 0.15;
}

// Legacy beep: one soft layer through the mixer, so leftover calls still sit in the mix.
function tone(freq = 440, dur = 0.08, type = 'triangle', vol = 0.03) {
  if (!audioLive() || audio.voices >= AUDIO_MAX_VOICES) return;
  const f = Math.max(20, Number(freq) || 440),
    d = clamp(Number(dur) || 0.08, 0.02, 2),
    w = type === 'square' ? 'pulse25' : ['sine', 'sawtooth', 'triangle'].includes(type) ? type : 'triangle';
  audioCounting = true;
  try {
    audioOsc(audioCtx.currentTime + 0.005, audio.sfxBus, {
      w,
      f,
      f2: f * 0.94,
      dur: d + 0.04,
      v: clamp(Number(vol) || 0.03, 0, 0.2) * 3.2,
      cut: w === 'sawtooth' ? 2400 : 0
    });
  } catch {
  } finally {
    audioCounting = false;
  }
}

// ---- Music data ----
// Bars are 16 sixteenth-note steps. In lead/bass/arp lines a character is a scale step:
//   0-9 up from the reference, a-g one to seven steps below it, A-E ten to fourteen, '-' holds, '.' rests.
// Lead steps count from the key root, bass steps from the bar's chord root, and arp characters pick
// chord tones (0 root, 1 third, 2 fifth, 3 the root an octave up...). Pad: 'x' strikes the chord.
// Drums: x hit, X accent, g ghost. A part may be one bar (repeated) or an array cycled per bar.
// chords: one chord root per bar, as a scale step; a section is as many bars as it has chords.

const AUDIO_SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  miyako: [0, 1, 5, 7, 8],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// oct: octave offset; a/d/s/r: attack, decay, sustain level (0 = percussive), release; v: peak gain.
const AUDIO_INST = {
  tri: { w: 'triangle', oct: 1, a: 0.012, d: 0.3, s: 0.55, r: 0.12, v: 0.2, vib: true },
  pulse: { w: 'pulse25', oct: 1, a: 0.006, d: 0.2, s: 0.45, r: 0.08, v: 0.075, vib: true },
  square: { w: 'square', oct: 1, a: 0.006, d: 0.25, s: 0.5, r: 0.08, v: 0.07, vib: true },
  organ: { w: 'organ', oct: 1, a: 0.015, d: 0.4, s: 0.7, r: 0.1, v: 0.09, vib: true },
  bell: { w: 'bell', oct: 1, a: 0.003, d: 0.8, s: 0, r: 0.2, v: 0.13 },
  pluck: { w: 'pulse12', oct: 1, a: 0.003, d: 0.3, s: 0, r: 0.08, v: 0.12, cut: 4200, cutEnd: 700 },
  wobble: { w: 'triangle', oct: 1, a: 0.06, d: 0.6, s: 0.7, r: 0.3, v: 0.19, vib: true },
  theremin: { w: 'sine', oct: 1, a: 0.1, d: 0.5, s: 0.8, r: 0.35, v: 0.15, vib: true, glide: 0.1 },
  kazoo: { w: 'sawtooth', oct: 1, a: 0.02, d: 0.2, s: 0.75, r: 0.06, v: 0.1, vib: true, glide: 0.03 },
  trombone: { w: 'sawtooth', oct: 0, a: 0.05, d: 0.3, s: 0.9, r: 0.25, v: 0.16, vib: true, glide: 0.07, cut: 450, cutPeak: 1500 },
  arp: { w: 'pulse12', oct: 0, a: 0.003, d: 0.12, s: 0.15, r: 0.05, v: 0.05 },
  bass: { w: 'triangle', oct: -1, a: 0.006, d: 0.25, s: 0.75, r: 0.06, v: 0.3 },
  bassPulse: { w: 'pulse25', oct: -1, a: 0.004, d: 0.15, s: 0.5, r: 0.05, v: 0.11 },
  tuba: { w: 'square', oct: -1, a: 0.012, d: 0.14, s: 0.35, r: 0.06, v: 0.13, cut: 1100, cutEnd: 350 },
  drone: { w: 'triangle', oct: -1, a: 0.8, d: 1.2, s: 0.8, r: 1, v: 0.2 },
  keys: { w: 'square', oct: 0, a: 0.01, d: 0.45, s: 0.25, r: 0.15, v: 0.03 },
  pad: { w: 'triangle', oct: 0, a: 0.35, d: 1.2, s: 0.8, r: 0.6, v: 0.07 },
  stab: { w: 'pulse25', oct: 0, a: 0.004, d: 0.1, s: 0.2, r: 0.05, v: 0.04 }
};

// level: output trim from offline renders, so tracks sit near -22 dB RMS (after dark quieter, boss
// louder). breathe: on every other pass the lead sits out the first section, so a loop is heard as 32+ bars.
const AUDIO_SONGS = {
  // Home base: a lazy F-major shuffle with brushes and a music-box answer.
  home: {
    bpm: 92,
    level: 1.25,
    shuffle: 0.5,
    root: 53,
    scale: 'major',
    inst: { lead: 'tri', bass: 'bass', pad: 'keys', arp: 'bell' },
    mix: { lead: 0.85, bass: 0.9, chord: 0.7, drum: 0.55 },
    breathe: true,
    form: ['A', 'A2', 'B', 'A'],
    kits: {
      soft: { k: 'x.......x.......', s: '....g.......g...', h: 'g.g.g.g.g.g.g.g.' },
      lift: { k: 'x.......x.....g.', s: '....g.......g.g.', h: 'g.g.g.g.g.g.g.g.' }
    },
    sections: {
      A: {
        chords: [0, 5, 3, 4],
        drums: 'soft',
        lead: ['4.4.5.4.2---0...', '5-4-2-1-2-------', '3-3-5-3-0---1...', '1-2-4---2-1-a---'],
        bass: ['0.......4.......', '0.......4.......', '0.......4.......', '0...4...6...7...'],
        pad: 'x-------x-------'
      },
      A2: {
        chords: [0, 5, 3, 4],
        drums: 'soft',
        lead: ['4.4.5.4.2---0...', '5-4-2-1-2-------', '3-5-7-5-3---2...', '1-------4---a---'],
        bass: ['0.......4.......', '0.......4.......', '0.......4.......', '0...4...6...7...'],
        pad: 'x-------x-------',
        arp: '....3.......2...'
      },
      B: {
        chords: [3, 2, 1, 4],
        drums: 'lift',
        lead: ['7---5---3---5-7-', '6---4---2---4-6-', '5---3---1---3-5-', '4-------3-2-1---'],
        bass: ['0...4...0...4...', '0...4...0...4...', '0...4...0...4...', '0...4...6...7...'],
        pad: 'x-----x---x-----'
      }
    }
  },
  // Ward rooms: a curious D-dorian groove. Each room reskins it (see AUDIO_MUSIC).
  ward: {
    bpm: 116,
    level: 1.75,
    swing: 0.1,
    root: 50,
    scale: 'dorian',
    inst: { lead: 'pulse', bass: 'bassPulse', pad: 'keys', arp: 'arp' },
    breathe: true,
    form: ['A', 'A2', 'B', 'A3'],
    kits: {
      groove: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xg' },
      fill: {
        k: 'x.....x...x.....',
        s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x.....x.xgxX'],
        h: 'x.x.x.x.x.x.x.xg'
      },
      open: { k: 'x.......x.......', s: '....x.......x..g', h: '..x...x...x.....', o: '..............x.' }
    },
    sections: {
      A: {
        chords: [0, 3, 0, 6],
        drums: 'groove',
        lead: ['4..4.2.04..5.4..', '3-2-1-2-3-------', '4..4.2.04..5.7..', '6-5-4-2-1-------'],
        bass: '0.7.0.7.0.7.0.7.',
        pad: '....x.......x...'
      },
      A2: {
        chords: [0, 3, 0, 6],
        drums: 'fill',
        lead: ['4..4.2.04..5.4..', '3-5-7-5-3-2-1---', '4..4.2.04..5.7..', '6---7---9-------'],
        bass: '0.7.0.7.0.7.0.7.',
        pad: '....x.......x...',
        arp: '0.1.2.3.2.1.2.1.'
      },
      B: {
        chords: [2, 6, 3, 4],
        drums: 'open',
        lead: ['9---7---6---7---', '6---4---1---4---', '5---3---1---3-5-', '4-------6---4---'],
        bass: '0..0.7.00..0.7.4',
        pad: 'x-------x-------',
        arp: '0.1.2.3.2.1.2.1.'
      },
      A3: {
        chords: [0, 3, 0, 6],
        drums: 'fill',
        lead: ['4..4.2.04..5.4..', '3-2-1-2-3-------', '4..4.2.04..5.7..', '6---7---9-------'],
        bass: '0.7.0.7.0.7.0.7.',
        pad: '....x.......x...'
      }
    }
  },
  // After dark: E phrygian, a ticking clock, a drone, a heartbeat, and a theremin that mostly waits.
  dark: {
    bpm: 66,
    level: 0.8,
    root: 52,
    scale: 'phrygian',
    inst: { lead: 'theremin', bass: 'drone', pad: 'pad', arp: 'bell' },
    mix: { lead: 0.8, bass: 0.8, chord: 0.55, drum: 0.6 },
    echo: { steps: 3, fb: 0.4, mix: 0.35 },
    vib: { rate: 4.6, depth: 22 },
    form: ['A', 'B', 'A2', 'B2'],
    kits: {
      clock: { tick: 'X...x...X...x...' },
      heart: { tick: 'X...x...X...x...', k: ['x..g............', '................'] }
    },
    sections: {
      A: {
        chords: [0, 1, 0, 1],
        drums: 'clock',
        lead: ['................', '....4-------3---', '................', '....1-----------'],
        bass: '0---------------',
        pad: 'x---------------'
      },
      B: {
        chords: [5, 3, 1, 0],
        drums: 'heart',
        lead: ['7-------........', '5-----4-------..', '....1-----2-----', '0---------------'],
        bass: '0---------------',
        pad: 'x---------------'
      },
      A2: {
        chords: [0, 1, 0, 1],
        drums: 'clock',
        lead: ['........4---5---', '4-------........', '................', '1---0-----------'],
        bass: '0---------------',
        pad: 'x---------------',
        arp: ['0...1...2.......', '................']
      },
      B2: {
        chords: [5, 3, 1, 0],
        drums: 'heart',
        lead: ['7-------........', '5-----4-------..', '....1-----2-----', 'b-------0-------'],
        bass: '0---------------',
        pad: 'x---------------',
        arp: ['................', '2...1...0.......']
      }
    }
  },
  // Drip or Die: a steady A-minor pulse with a heart-monitor beep. Calm enough to time taps against.
  iv: {
    bpm: 100,
    level: 1.45,
    root: 57,
    scale: 'minor',
    inst: { lead: 'tri', bass: 'bassPulse', pad: 'keys', arp: 'arp' },
    breathe: true,
    form: ['A', 'B', 'A2', 'B2'],
    kits: {
      monitor: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.', beep: 'x.......x.......' },
      pulse: { k: 'x..g....x..g....', s: '........x.......', h: 'g.x.g.x.g.x.g.x.', beep: 'x.......x.......' }
    },
    sections: {
      A: {
        chords: [0, 5, 2, 6],
        drums: 'monitor',
        lead: ['4-------2---4---', '5-------4---2---', '4---2---0---2---', '1-----------....'],
        bass: '0.0.0.0.0.0.0.0.',
        pad: 'x-------x-------'
      },
      B: {
        chords: [3, 0, 5, 4],
        drums: 'pulse',
        lead: ['3---5---7-------', '7---6---4-------', '5---4---2---0---', '1---------------'],
        bass: '0.0.0.0.0.0.4.4.',
        pad: 'x-------x-------'
      },
      A2: {
        chords: [0, 5, 2, 6],
        drums: 'monitor',
        lead: ['4-------2---4---', '5-------4---2---', '4---2---0---2---', '1---a---1---4---'],
        bass: '0.0.0.0.0.0.0.0.',
        pad: 'x-------x-------',
        arp: '0.1.2.1.0.1.2.1.'
      },
      B2: {
        chords: [3, 0, 5, 4],
        drums: 'pulse',
        lead: ['3---5---7-------', '7---6---4-------', '5---4---2---0---', '1-------4-------'],
        bass: '0.0.0.0.0.0.4.4.',
        pad: 'x-------x-------',
        arp: '0.1.2.1.0.1.2.1.'
      }
    }
  },
  // Loud Donut Pinball (the MRI): floaty E-flat lydian, slow vibrato, bell sparkles with echo.
  magnet: {
    bpm: 84,
    level: 0.77,
    root: 51,
    scale: 'lydian',
    inst: { lead: 'wobble', bass: 'bass', pad: 'pad', arp: 'bell' },
    echo: { steps: 3, fb: 0.38, mix: 0.3 },
    vib: { rate: 3.2, depth: 14 },
    form: ['A', 'B', 'A2', 'B2'],
    kits: {
      float: { k: 'x.........x.....', s: '........g.......', h: '..g...g...g...g.' },
      air: { h: '..g...g...g...g.' }
    },
    sections: {
      A: {
        chords: [0, 1, 0, 1],
        drums: 'float',
        lead: ['4-------3-------', '2-------1---2---', '4---5---7-------', '8-------5-------'],
        bass: '0-------4-------',
        pad: 'x---------------',
        arp: '0.1.2.3.4.3.2.1.'
      },
      B: {
        chords: [5, 4, 1, 1],
        drums: 'float',
        lead: ['7-------6---4---', '5-------4---3---', '2-------3---5---', '1---------------'],
        bass: '0-------4-------',
        pad: 'x---------------',
        arp: '0.1.2.3.4.3.2.1.'
      },
      A2: {
        chords: [0, 1, 0, 1],
        drums: 'float',
        lead: ['7-------6-------', '5-------4---5---', '7---8---9-------', '8---------------'],
        bass: '0-------4-------',
        pad: 'x---------------',
        arp: '0.1.2.3.4.3.2.1.'
      },
      B2: {
        chords: [5, 4, 1, 1],
        drums: 'air',
        lead: ['7-------6---4---', '5-------4---3---', '2-------3---5---', '1---------------'],
        bass: '0---------------',
        pad: 'x---------------',
        arp: '0.2.4.2.0.2.4.2.'
      }
    }
  },
  // Brick Rebellion: bouncy G major, octave-hopping bass and a lead that leaps like a ball.
  bricks: {
    bpm: 128,
    level: 1.95,
    swing: 0.08,
    root: 55,
    scale: 'major',
    inst: { lead: 'pulse', bass: 'bassPulse', pad: 'stab', arp: 'arp' },
    form: ['A', 'A2', 'B', 'A2'],
    kits: {
      bounce: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      fill: {
        k: 'x.....x...x.....',
        s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......xgxX'],
        h: 'x.x.x.x.x.x.x.x.'
      },
      clap: { k: 'x.......x.......', clap: '....x.......x...', h: '..x...x...x.....', o: '..............x.' }
    },
    sections: {
      A: {
        chords: [0, 4, 5, 3],
        drums: 'bounce',
        lead: ['4.7.4.2.4...0...', '4.8.4.1.4...a...', '5.9.5.2.4...2...', '3.2.1.0.1...4...'],
        bass: '0.7.0.7.0.7.0.7.',
        pad: '..x...x...x...x.'
      },
      A2: {
        chords: [0, 4, 5, 3],
        drums: 'fill',
        lead: ['4.7.4.2.4...0...', '4.8.4.1.4...a...', '5.9.5.2.4...2...', '3.2.1.2.0-------'],
        bass: '0.7.0.7.0.7.0.7.',
        pad: '..x...x...x...x.'
      },
      B: {
        chords: [3, 4, 2, 5],
        drums: 'clap',
        lead: ['2-3-4-----7-----', '6-----5-4-------', '4-5-6-----9-----', '7-----6-5-------'],
        bass: '0.0.7.0.0.0.7.4.',
        pad: 'x-------x-------',
        arp: '0.2.1.2.0.2.1.2.'
      }
    }
  },
  // Gurney Grand Prix: driving E minor, four on the floor, a heroic square lead.
  race: {
    bpm: 150,
    level: 1.45,
    root: 52,
    scale: 'minor',
    inst: { lead: 'square', bass: 'bassPulse', pad: 'keys', arp: 'arp' },
    form: ['A', 'A2', 'B', 'B2'],
    kits: {
      drive: { k: 'x...x...x...x...', s: '....x.......x...', h: 'g.x.g.x.g.x.g.x.' },
      push: {
        k: 'x...x...x...x...',
        s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x...x.x.xxXX'],
        h: 'g.x.g.x.g.x.g.x.',
        c: ['x...............', '................', '................', '................']
      }
    },
    sections: {
      A: {
        chords: [0, 5, 2, 6],
        drums: 'drive',
        lead: ['0-2-4-7-----4---', '5-----4-2-------', '2-4-6-9-----6---', '8-----7-6-------'],
        bass: '0.0.0.0.0.0.7.4.',
        pad: 'x-------x-------'
      },
      A2: {
        chords: [0, 5, 2, 6],
        drums: 'drive',
        lead: ['0-2-4-7-----4---', '5-----4-2-------', '2-4-6-9-----6---', '8-7-6-4-6-------'],
        bass: '0.0.0.0.0.0.7.4.',
        pad: 'x-------x-------'
      },
      B: {
        chords: [3, 0, 5, 6],
        drums: 'push',
        lead: ['7-----5---3-----', '4-----2---0-----', '5-4-5-7---5-----', '6-------8-------'],
        bass: '0.0.7.0.0.0.7.0.',
        pad: 'x-------x-------',
        arp: '0.1.2.3.0.1.2.3.'
      },
      B2: {
        chords: [3, 0, 5, 6],
        drums: 'push',
        lead: ['7-----5---3-----', '4-----2---0-----', '5-4-5-7---5-----', '6---7---8---9---'],
        bass: '0.0.7.0.0.0.7.0.',
        pad: 'x-------x-------',
        arp: '0.1.2.3.0.1.2.3.'
      }
    }
  },
  // Gel Yeah!: frantic koto plucks on a Japanese "in" scale, busy hats, taiko hits.
  slice: {
    bpm: 166,
    level: 1.2,
    root: 50,
    scale: 'miyako',
    chordTones: [0, 7, 12],
    inst: { lead: 'pluck', bass: 'bassPulse', pad: 'stab', arp: 'arp' },
    mix: { drum: 0.7 },
    form: ['A', 'B', 'A2', 'B2'],
    kits: {
      dash: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'XgxgXgxgXgxgXgxg' },
      taiko: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'XgxgXgxgXgxgXgxg', t: 'x.......x.x.....' },
      crash: {
        k: 'x..x..x.x..x..x.',
        s: '....x.......x...',
        h: 'XgxgXgxgXgxgXgxg',
        c: ['x...............', '................', '................', '................'],
        t: '........x.x.....'
      }
    },
    sections: {
      A: {
        chords: [0, 0, 4, 3],
        drums: 'dash',
        lead: ['5.5.3.4.5...3...', '2.3.4.3.2...0...', '4.5.6.5.4...2...', '3.4.3.2.3-------'],
        bass: '0.0.5.0.0.0.5.0.',
        pad: '..x...x...x...x.'
      },
      B: {
        chords: [2, 4, 0, 1],
        drums: 'taiko',
        lead: ['7-6-5-4-5-------', '6-5-4-3-4-------', '5.5.5.3.5.6.7...', '6-------5-------'],
        bass: '0.0.5.0.0.0.5.0.',
        arp: '0.1.2.1.0.1.2.1.'
      },
      A2: {
        chords: [0, 0, 4, 3],
        drums: 'taiko',
        lead: ['5.5.3.4.5...3...', '2.3.4.3.2...0...', '4.5.6.5.4...2...', '3.4.3.2.3-------'],
        bass: '0.0.5.0.0.0.5.0.',
        pad: '..x...x...x...x.'
      },
      B2: {
        chords: [2, 4, 0, 1],
        drums: 'crash',
        lead: ['7-6-5-4-5-------', '6-5-4-3-4-------', '5.5.5.3.5.6.7...', '6-------5-------'],
        bass: '0.0.5.0.0.0.5.0.',
        arp: '0.1.2.1.0.1.2.1.'
      }
    }
  },
  // Bedside Blaster: tense F-sharp phrygian, heartbeat kick, a theremin that won't sit still.
  blaster: {
    bpm: 104,
    level: 1.1,
    root: 54,
    scale: 'phrygian',
    inst: { lead: 'theremin', bass: 'bassPulse', pad: 'pad', arp: 'arp' },
    vib: { rate: 5, depth: 18 },
    echo: { steps: 3, fb: 0.3, mix: 0.25 },
    form: ['A', 'A2', 'B', 'A3'],
    kits: {
      stalk: { k: 'x..g....x..g....', h: 'g.g.g.g.g.g.g.g.' },
      creep: { k: 'x..g....x..g....', s: '........x.......', h: 'g.g.g.g.g.g.g.g.' },
      hunt: { k: 'x..g..x.x..g....', s: '....x.......x...', h: 'gggxgggxgggxgggx' }
    },
    sections: {
      A: {
        chords: [0, 0, 1, 0],
        drums: 'stalk',
        lead: ['0-------b-------', '0-------1-------', '1-------0---b---', '0---------------'],
        bass: '0.0.0.0.0.0.1.0.'
      },
      A2: {
        chords: [0, 0, 1, 0],
        drums: 'creep',
        lead: ['0-------b-------', '0-------1-------', '1-------0---b---', '0---------------'],
        bass: '0.0.0.0.0.0.1.0.',
        pad: 'x---------------',
        arp: '0..1..2..1..0...'
      },
      B: {
        chords: [5, 1, 3, 4],
        drums: 'hunt',
        lead: ['5-------4-------', '3-------1---3---', '5---3---2---3---', '4---------------'],
        bass: '0.0.0.0.0.0.0.0.',
        pad: 'x---------------'
      },
      A3: {
        chords: [0, 0, 1, 0],
        drums: 'hunt',
        lead: ['0-------b-------', '0-------1-------', '1-------0---b---', '0---------------'],
        bass: '0.0.0.0.0.0.1.0.',
        pad: 'x---------------'
      }
    }
  },
  // Ralph: an oom-pah villain polka in D harmonic minor, kazoo lead, tuba bass, a run up to the top.
  boss: {
    bpm: 144,
    level: 2.2,
    swing: 0.05,
    root: 50,
    scale: 'harmonic',
    inst: { lead: 'kazoo', bass: 'tuba', pad: 'stab', arp: 'arp' },
    leadFilter: { type: 'bandpass', f: 1100, q: 1.4 },
    vib: { rate: 6, depth: 16 },
    mix: { lead: 1.1, bass: 0.9, chord: 0.7, drum: 0.75 },
    form: ['A', 'B', 'A', 'C'],
    kits: {
      stomp: {
        k: 'x.......x.......',
        s: '....x.......x...',
        h: 'x.x.x.x.x.x.x.x.',
        c: ['x...............', '................', '................', '................']
      },
      rumble: {
        k: 'x.......x.......',
        s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x...xxxxXXXX'],
        h: 'x.x.x.x.x.x.x.x.',
        t: ['................', '................', '................', 'x.x.x.x.........']
      }
    },
    sections: {
      A: {
        chords: [0, 4, 0, 4],
        drums: 'stomp',
        lead: ['0.2.4.7.6.7.4...', '6---4---1---6---', '0.2.4.7.9.8.7...', '6-------4-------'],
        bass: '0.......4.......',
        pad: '....x.......x...'
      },
      B: {
        chords: [3, 0, 4, 0],
        drums: 'stomp',
        lead: ['3-5-7-A-9---7---', '9-8-7-4-7-------', '8-6-4-1-6-------', '7---7.7.0-------'],
        bass: '0.......4.......',
        pad: '....x.......x...'
      },
      C: {
        chords: [5, 3, 4, 4],
        drums: 'rumble',
        lead: ['5-----4-5-----7-', 'A-----9-7-------', '8.8.8.8.6.6.4.4.', '1-2-3-4-5-6-7-8-'],
        bass: ['0.......4.......', '0.......4.......', '0...0...4...4...', '0.0.0.0.0.0.0.0.'],
        pad: ['....x.......x...', '....x.......x...', '....x.......x...', 'x...x...x...x...']
      }
    }
  },
  // Result stings: two bars, then silence.
  win: {
    bpm: 140,
    level: 1.3,
    root: 48,
    scale: 'major',
    loop: false,
    inst: { lead: 'pulse', bass: 'bass', pad: 'keys', arp: 'bell' },
    form: ['W'],
    sections: {
      W: {
        chords: [4, 0],
        drums: {
          s: ['ggggxxxxxxxxXXXX', '................'],
          k: 'x...............',
          c: ['................', 'x...............']
        },
        lead: ['4.4.4.7-----5-6-', '7---------------'],
        bass: ['0...0...0...0.0.', '0---------------'],
        pad: ['................', 'x---------------'],
        arp: ['................', '0.1.2.3.4.5.6...']
      }
    }
  },
  // Sad trombone: wah, wah, wah, waaah.
  lose: {
    bpm: 96,
    level: 2.2,
    root: 52,
    scale: 'chromatic',
    loop: false,
    inst: { lead: 'trombone', bass: 'bass', pad: 'pad' },
    leadFilter: { type: 'lowpass', f: 1400, q: 0.5 },
    vib: { rate: 5.5, depth: 30, delay: 1.4 },
    mix: { lead: 1.2 },
    form: ['L'],
    sections: {
      L: {
        chords: [0, 0],
        lead: ['3--2--1--0------', '---.............']
      }
    }
  }
};

// Public track names. Rooms 1-4 share the ward song with their own key, lead, tempo and percussion.
const AUDIO_MUSIC = {
  'room:0': { base: 'home' },
  'room:1': { base: 'ward', perc: { kind: 'knock', pattern: 'x..x..x..x..x...' } },
  'room:2': { base: 'ward', transpose: -2, lead: 'organ', arp: null, tempo: 0.9, swing: 0, shuffle: 0.35 },
  'room:3': { base: 'ward', transpose: 3, lead: 'square', tempo: 1.08 },
  'room:4': {
    base: 'ward',
    transpose: 5,
    lead: 'bell',
    echo: true,
    perc: { kind: 'ping', pattern: ['x...............', '................'] }
  },
  'room:5': { base: 'dark' },
  'game:0': { base: 'iv' },
  'game:1': { base: 'magnet' },
  'game:2': { base: 'bricks' },
  'game:3': { base: 'race' },
  'game:4': { base: 'slice' },
  'game:5': { base: 'blaster' },
  // Fastpitch Fever: Brick Rebellion's bounce on a ballpark organ, with the crowd clapping the charge.
  'game:pitch': {
    base: 'bricks',
    transpose: 2,
    lead: 'organ',
    tempo: 1.04,
    perc: { kind: 'clap', pattern: ['................', '................', '................', 'x.x.x...x.x.x...'] }
  },
  boss: { base: 'boss' },
  'result:win': { base: 'win' },
  'result:lose': { base: 'lose' }
};

// ---- Hallway and title tracks ----
// The hallway: a G-major stroll with a walking bass, warm keys and a bell that says hi to everyone.
AUDIO_SONGS.hallway = {
  bpm: 104,
  level: 1.3,
  shuffle: 0.3,
  root: 55,
  scale: 'major',
  inst: { lead: 'tri', bass: 'bass', pad: 'keys', arp: 'bell' },
  mix: { lead: 0.8, bass: 0.85, chord: 0.65, drum: 0.5 },
  breathe: true,
  form: ['A', 'B', 'A2', 'C'],
  kits: {
    stroll: { k: 'x.......x.......', s: '....g.......g...', h: 'g.g.g.g.g.g.g.g.' },
    clap: { k: 'x.......x.....g.', clap: '....x.......x...', h: 'g.g.g.g.g.g.g.g.' }
  },
  sections: {
    A: {
      chords: [0, 5, 3, 4],
      drums: 'stroll',
      lead: ['4-2-0-2-4---4---', '5-4-2-4-5-------', '3-4-5-7-5---4---', '2-------1-2-4---'],
      bass: '0...2...4...2...',
      pad: 'x-------x-------'
    },
    B: {
      chords: [3, 0, 1, 4],
      drums: 'stroll',
      lead: ['7---5---3---5---', '4---2---0---2-4-', '5---4---3---1---', '2-3-4-------....'],
      bass: '0...2...4...2...',
      pad: 'x-------x-------',
      arp: '....2.......1...'
    },
    A2: {
      chords: [0, 5, 3, 4],
      drums: 'stroll',
      lead: ['4-2-0-2-4---7---', '8-7-5-4-5-------', '3-4-5-7-9---8---', '7-------........'],
      bass: '0...2...4...2...',
      pad: 'x-------x-------',
      arp: '0.1.2.3.2.1.2.1.'
    },
    C: {
      chords: [5, 3, 0, 4],
      drums: 'clap',
      lead: ['5---7---9-------', '8---7---5-------', '7-5-4-2-4-------', '1-------2---4---'],
      bass: '0...4...0...4...',
      pad: 'x---x---x---x---'
    }
  }
};

// The title screen: the main theme. Sixteen bars of bright G-major chiptune, A/B/A/B, with a rising
// arpeggio hook and a hospital PA chime (ding, dong, dong on the bell) at the top of every loop.
AUDIO_SONGS.title = {
  bpm: 128,
  level: 1.7,
  root: 55,
  scale: 'major',
  inst: { lead: 'pulse', bass: 'bassPulse', pad: 'stab', arp: 'bell' },
  mix: { lead: 0.85, bass: 0.85, chord: 0.6, drum: 0.7 },
  form: ['A', 'B', 'A2', 'B2'],
  kits: {
    top: {
      k: 'x.....x...x.....',
      s: '....x.......x...',
      h: 'x.x.x.x.x.x.x.x.',
      c: ['x...............', '................', '................', '................']
    },
    groove: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xg' },
    fill: {
      k: 'x.....x...x.....',
      s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x.....x.xgxX'],
      h: 'x.x.x.x.x.x.x.x.'
    }
  },
  sections: {
    A: {
      chords: [0, 4, 5, 3],
      drums: 'top',
      lead: ['0-2-4-7-----4-5-', '6-5-4-----2-4---', '5-4-2-0-----2-4-', '3---2---1-------'],
      bass: '0.7.0.7.0.7.0.7.',
      pad: '..x...x...x...x.',
      arp: ['5...4...3.......', '................', '................', '................']
    },
    B: {
      chords: [3, 0, 5, 4],
      drums: 'groove',
      lead: ['7-7-8-9---7-----', '8-7-4-7---4-----', '9-8-7-5-7---4---', '4---6---8---6---'],
      bass: '0...0.7.0...4.7.',
      pad: 'x-------x-------'
    },
    A2: {
      chords: [0, 4, 5, 3],
      drums: 'groove',
      lead: ['0-2-4-7-----4-5-', '6-5-4-----2-4---', '5-4-2-0-----2-4-', '3-2-1-2-4-------'],
      bass: '0.7.0.7.0.7.0.7.',
      pad: '..x...x...x...x.',
      arp: '....3.......4...'
    },
    B2: {
      chords: [3, 0, 5, 4],
      drums: 'fill',
      lead: ['7-7-8-9---7-----', '8-7-4-7---4-----', '9-8-7-5-7---4---', '4---6---8-7-6-4-'],
      bass: '0...0.7.0...4.7.',
      pad: 'x-------x-------'
    }
  }
};

AUDIO_MUSIC['room:6'] = { base: 'hallway' };
AUDIO_MUSIC.title = { base: 'title' };
// The send-off (src/discharge.js): the main theme a step up and a touch slower on a warm triangle lead,
// with the whole floor clapping on two and four.
AUDIO_MUSIC.discharge = {
  base: 'title',
  transpose: 2,
  lead: 'tri',
  tempo: 0.94,
  perc: { kind: 'clap', pattern: '....x.......x...' }
};

// ---- The dream (src/dream.js) ----
// music('dream'): the title hook at half speed, tuned 30 cents flat, under a slow, deep vibrato and a
// long feedback echo that stands in for reverb. The chorus is pure data: the bass part doubles the lead
// note for note (each bass step is the lead's step minus that bar's chord root) on dreamDouble, a sine
// pitched 1.012 octaves up, so the two voices sit 14 cents apart and beat against each other.
AUDIO_INST.dreamLead = { w: 'triangle', oct: 1, a: 0.09, d: 0.8, s: 0.7, r: 0.7, v: 0.17, vib: true };
AUDIO_INST.dreamDouble = { w: 'sine', oct: 1.012, a: 0.14, d: 0.9, s: 0.75, r: 0.8, v: 0.15, vib: true };
AUDIO_INST.dreamPad = { w: 'triangle', oct: 0, a: 0.9, d: 1.6, s: 0.8, r: 1.2, v: 0.05 };

AUDIO_SONGS.dream = {
  bpm: 66,
  level: 1.2,
  root: 54.7,
  scale: 'major',
  inst: { lead: 'dreamLead', bass: 'dreamDouble', pad: 'dreamPad', arp: 'bell' },
  mix: { lead: 0.8, bass: 0.7, chord: 0.6, drum: 0.35 },
  leadFilter: { type: 'lowpass', f: 2400, q: 0.4 },
  echo: { steps: 3, fb: 0.58, mix: 0.45 },
  vib: { rate: 0.85, depth: 24 },
  form: ['A', 'B', 'A2'],
  kits: {
    drift: { k: ['x..g............', '................'], ping: ['................', '........x.......'] }
  },
  sections: {
    A: {
      chords: [0, 4, 5, 3],
      drums: 'drift',
      lead: ['0-2-4-7-----4-5-', '6-5-4-----2-4---', '5-4-2-0-----2-4-', '3---2---1-------'],
      bass: ['0-2-4-7-----4-5-', '2-1-0-----b-0---', '0-a-c-e-----c-a-', '0---a---b-------'],
      pad: 'x---------------',
      arp: ['........3.......', '................', '........3.......', '................']
    },
    B: {
      chords: [3, 0, 5, 4],
      drums: 'drift',
      lead: ['7-7-8-9---7-----', '8-7-4-7---4-----', '9-8-7-5-7---4---', '4---6---8---6---'],
      bass: ['4-4-5-6---4-----', '8-7-4-7---4-----', '4-3-2-0-2---a---', '0---2---4---2---'],
      pad: 'x---------------'
    },
    A2: {
      chords: [0, 4, 5, 3],
      drums: 'drift',
      lead: ['0-2-4-7-----4-5-', '6-5-4-----2-4---', '5-4-2-0-----2-4-', '3-------2-------'],
      bass: ['0-2-4-7-----4-5-', '2-1-0-----b-0---', '0-a-c-e-----c-a-', '0-------a-------'],
      pad: 'x---------------',
      arp: ['................', '........3.......', '................', '0...1...2...3...']
    }
  }
};

AUDIO_MUSIC.dream = { base: 'dream' };

// sfx('dreamIn'): falling asleep, a soft whoosh that sinks while a music box tumbles down.
// sfx('dreamOut'): waking up, the same whoosh rising and a quick climb back up the bells.
SFX.dreamIn = {
  gain: 1.4,
  play(t, o, d) {
    audioNoise(t, d, { ft: 'bandpass', f: 2600, f2: 380, q: 0.9, dur: 1.3, v: 0.1, a: 0.45 });
    [1568, 1319, 1047, 880, 659].forEach((f, i) =>
      audioOsc(t + 0.12 + i * 0.13, d, { w: 'bell', f: f * 0.985, dur: 0.9, v: 0.05 })
    );
    audioOsc(t, d, { w: 'sine', f: 520, f2: 260, slide: 1.1, dur: 1.2, v: 0.06, a: 0.3 });
  }
};

SFX.dreamOut = {
  gain: 1.4,
  play(t, o, d) {
    audioNoise(t, d, { ft: 'bandpass', f: 420, f2: 3000, q: 0.9, dur: 0.9, v: 0.1, a: 0.3 });
    [659, 880, 1047, 1319].forEach((f, i) => audioOsc(t + 0.1 + i * 0.07, d, { w: 'bell', f, dur: 0.5, v: 0.05 }));
    audioOsc(t, d, { w: 'sine', f: 260, f2: 560, slide: 0.7, dur: 0.8, v: 0.06, a: 0.2 });
  }
};

function audioDegree(ch) {
  const i = '0123456789'.indexOf(ch);
  if (i >= 0) return i;
  const low = 'abcdefg'.indexOf(ch);
  if (low >= 0) return -1 - low;
  const high = 'ABCDE'.indexOf(ch);
  return high >= 0 ? 10 + high : null;
}

function audioSemis(scale, step) {
  return scale[audioMod(step, scale.length)] + 12 * Math.floor(step / scale.length);
}

// Turn a song into per-step event lists once; players share the result.
function audioCompile(song) {
  const scale = AUDIO_SCALES[song.scale],
    bars = [];
  for (const key of song.form) {
    const sec = song.sections[key];
    for (let b = 0; b < sec.chords.length; b++) bars.push({ sec, b });
  }
  const total = bars.length * 16,
    steps = Array.from({ length: total }, () => []),
    chordOf = bars.map(({ sec, b }) => sec.chords[b]),
    semis = step => audioSemis(scale, step),
    tones = root =>
      song.chordTones ? song.chordTones.map(x => semis(root) + x) : [semis(root), semis(root + 2), semis(root + 4)],
    line = part => bars.map(({ sec, b }) => (sec[part] ? audioCycle(sec[part], b) : '................')).join('');
  for (const part of ['lead', 'bass', 'arp']) {
    const text = line(part);
    for (let i = 0; i < total; i++) {
      const step = audioDegree(text[i]);
      if (step === null) continue;
      let len = 1;
      while (text[i + len] === '-') len++;
      const chord = chordOf[Math.floor(i / 16)];
      let note;
      if (part === 'lead') note = semis(step);
      else if (part === 'bass') note = semis(chord + step);
      else {
        const t = tones(chord);
        note = t[audioMod(step, t.length)] + 12 * Math.floor(step / t.length);
      }
      steps[i].push({ part, note, len, vel: i % 4 === 0 ? 1 : 0.85 });
    }
  }
  const pads = line('pad');
  for (let i = 0; i < total; i++) {
    if (pads[i] !== 'x') continue;
    let len = 1;
    while (pads[i + len] === '-') len++;
    steps[i].push({ part: 'pad', notes: tones(chordOf[Math.floor(i / 16)]), len, vel: 1 });
  }
  bars.forEach(({ sec, b }, bar) => {
    const kit = typeof sec.drums === 'string' ? song.kits[sec.drums] : sec.drums;
    if (!kit) return;
    for (const kind of Object.keys(kit)) {
      const pat = audioCycle(kit[kind], b);
      for (let s = 0; s < 16; s++) {
        const vel = AUDIO_HITS[pat[s]];
        if (vel) steps[bar * 16 + s].push({ part: 'drum', kind, len: 1, vel });
      }
    }
  });
  return { total, steps };
}

// Data lint for tests and anyone editing the songs: returns a list of problems (empty when clean).
function audioCheckTracks() {
  const problems = [],
    bars = v => [].concat(v ?? []),
    melodic = /^[0-9a-gA-E.-]{16}$/,
    chord = /^[x.-]{16}$/,
    hits = /^[xXg.]{16}$/;
  for (const [id, song] of Object.entries(AUDIO_SONGS)) {
    if (!AUDIO_SCALES[song.scale]) problems.push(`${id}: unknown scale ${song.scale}`);
    for (const inst of Object.values(song.inst)) if (inst && !AUDIO_INST[inst]) problems.push(`${id}: unknown instrument ${inst}`);
    for (const key of song.form) {
      const sec = song.sections[key];
      if (!sec) {
        problems.push(`${id}: missing section ${key}`);
        continue;
      }
      for (const part of ['lead', 'bass', 'arp'])
        for (const bar of bars(sec[part])) if (!melodic.test(bar)) problems.push(`${id}.${key}.${part}: "${bar}"`);
      for (const bar of bars(sec.pad)) if (!chord.test(bar)) problems.push(`${id}.${key}.pad: "${bar}"`);
      const kit = typeof sec.drums === 'string' ? song.kits?.[sec.drums] : sec.drums;
      if (typeof sec.drums === 'string' && !kit) problems.push(`${id}.${key}: missing kit ${sec.drums}`);
      for (const [kind, pat] of Object.entries(kit || {})) {
        if (!AUDIO_DRUMS.includes(kind)) problems.push(`${id}.${key}: unknown drum ${kind}`);
        for (const bar of bars(pat)) if (!hits.test(bar)) problems.push(`${id}.${key}.${kind}: "${bar}"`);
      }
    }
  }
  for (const [name, spec] of Object.entries(AUDIO_MUSIC)) {
    if (!AUDIO_SONGS[spec.base]) problems.push(`${name}: unknown song ${spec.base}`);
    for (const inst of [spec.lead, spec.arp]) if (inst && !AUDIO_INST[inst]) problems.push(`${name}: unknown instrument ${inst}`);
    if (spec.perc && !AUDIO_DRUMS.includes(spec.perc.kind)) problems.push(`${name}: unknown drum ${spec.perc.kind}`);
    for (const bar of bars(spec.perc?.pattern)) if (!hits.test(bar)) problems.push(`${name}.perc: "${bar}"`);
  }
  return problems;
}

// ---- Sequencer ----

function music(name = null) {
  const next = typeof name === 'string' && name ? name : null;
  if (next === audio.track) return;
  audio.track = next;
  audioReconcile(true);
}

// Make the players match audio.track: fade out anything else, start the track if it is missing.
// Stings start only when music() asks for them, never when sound comes back later.
function audioReconcile(allowSting) {
  if (!audioLive()) return;
  const now = audioCtx.currentTime;
  let live = null;
  for (const p of audioPlayers) {
    if (p.stopping) continue;
    if (!live && p.name === audio.track) live = p;
    else audioFadeOut(p, now);
  }
  const spec = audio.track && Object.prototype.hasOwnProperty.call(AUDIO_MUSIC, audio.track) ? AUDIO_MUSIC[audio.track] : null;
  if (!live && spec && (allowSting || AUDIO_SONGS[spec.base].loop !== false)) {
    try {
      audioPlayers.push(audioMakePlayer(audio.track, spec, now));
    } catch {}
  }
  if (audio.timer === null && audioPlayers.length) audioTick();
}

function audioMakePlayer(name, spec, now) {
  const ctx = audioCtx,
    song = AUDIO_SONGS[spec.base],
    stepDur = 60 / (song.bpm * (spec.tempo || 1)) / 4,
    mix = { lead: 0.8, bass: 0.85, chord: 0.6, drum: 0.75, ...song.mix },
    vib = { rate: 5.5, depth: 7, ...song.vib };
  song.compiled ??= audioCompile(song);
  const p = {
    name,
    song,
    comp: song.compiled,
    step: 0,
    stepDur,
    next: now + 0.06,
    lookahead: clamp(stepDur * 16, 0.3, 1.5),
    swing: spec.swing ?? song.swing ?? 0,
    shuffle: spec.shuffle ?? song.shuffle ?? 0,
    root: song.root + (spec.transpose || 0),
    inst: {
      lead: spec.lead || song.inst.lead,
      bass: song.inst.bass,
      pad: song.inst.pad,
      arp: spec.arp === undefined ? song.inst.arp : spec.arp
    },
    perc: spec.perc || null,
    loop: song.loop !== false,
    glide: {},
    nodes: [],
    stopping: false,
    stopAt: 0
  };
  const keep = n => {
    p.nodes.push(n);
    return n;
  };
  const level = song.level || 1;
  p.out = keep(ctx.createGain());
  p.out.gain.setValueAtTime(p.loop ? 0 : level, now);
  if (p.loop) p.out.gain.linearRampToValueAtTime(level, now + AUDIO_FADE);
  p.out.connect(audio.duckNode);
  const bus = (level, f) => {
    const g = keep(ctx.createGain()),
      filt = keep(ctx.createBiquadFilter());
    g.gain.value = level;
    filt.type = f.type;
    filt.frequency.value = f.f;
    filt.Q.value = f.q;
    g.connect(filt);
    filt.connect(p.out);
    return [g, filt];
  };
  const lead = bus(mix.lead, song.leadFilter || { type: 'lowpass', f: 3600, q: 0.5 });
  p.leadIn = lead[0];
  p.bassIn = bus(mix.bass, { type: 'lowpass', f: 1100, q: 0.6 })[0];
  p.chordIn = bus(mix.chord, { type: 'lowpass', f: 1900, q: 0.5 })[0];
  p.drum = keep(ctx.createGain());
  p.drum.gain.value = mix.drum;
  p.drum.connect(p.out);
  p.hat = keep(audioFilter('highpass', 7200, 0.7, now));
  p.hat.connect(p.drum);
  p.snare = keep(audioFilter('bandpass', 1900, 0.8, now));
  p.snare.connect(p.drum);
  if (song.echo || spec.echo) {
    const e = { steps: 3, fb: 0.35, mix: 0.3, ...song.echo },
      delay = keep(ctx.createDelay(2)),
      fb = keep(ctx.createGain()),
      damp = keep(audioFilter('lowpass', 2400, 0.5, now)),
      wet = keep(ctx.createGain());
    delay.delayTime.value = Math.min(1.9, e.steps * stepDur);
    fb.gain.value = e.fb;
    wet.gain.value = e.mix;
    lead[1].connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(wet);
    wet.connect(p.out);
  }
  p.lfo = keep(ctx.createOscillator());
  p.lfo.frequency.value = vib.rate;
  p.vib = keep(ctx.createGain());
  p.vib.gain.setValueAtTime(vib.delay ? 0 : vib.depth, now);
  if (vib.delay) {
    p.vib.gain.setValueAtTime(0, now + vib.delay);
    p.vib.gain.linearRampToValueAtTime(vib.depth, now + vib.delay + 0.4);
  }
  p.lfo.connect(p.vib);
  p.lfo.start(now);
  return p;
}

function audioFadeOut(p, now) {
  p.stopping = true;
  p.stopAt = now + AUDIO_FADE + 0.1;
  audioHold(p.out.gain, now);
  p.out.gain.linearRampToValueAtTime(0, now + AUDIO_FADE);
}

function audioDispose(p) {
  try {
    p.lfo.stop();
  } catch {}
  for (const n of p.nodes) audioUnplug(n);
}

// The only recurring work: every ~100 ms, schedule each live player up to a bar ahead.
function audioTick() {
  audio.timer = null;
  if (!audioLive()) return;
  const now = audioCtx.currentTime;
  for (const p of audioPlayers) if (!p.stopping) audioSchedule(p, now);
  audioPlayers = audioPlayers.filter(p => {
    if (!p.stopping || now < p.stopAt) return true;
    audioDispose(p);
    return false;
  });
  if (audioPlayers.length) audio.timer = audioLater(audioTick, AUDIO_TICK_MS);
}

function audioSchedule(p, now) {
  const total = p.comp.total;
  if (p.next < now - 0.05) {
    // The timer stalled (a long frame or a throttled tab): skip ahead rather than bunch notes up.
    const behind = Math.ceil((now - p.next) / p.stepDur);
    p.step += behind;
    p.next += behind * p.stepDur;
  }
  const horizon = now + p.lookahead;
  while (p.next < horizon) {
    if (!p.loop && p.step >= total) {
      p.stopping = true;
      p.stopAt = p.next + 2.5;
      return;
    }
    const i = p.step % total;
    try {
      audioStep(p, i, p.next + audioSwing(p, i % 16));
    } catch {}
    p.step++;
    p.next += p.stepDur;
  }
}

// swing delays odd sixteenths; shuffle delays the off-beat eighths (0.67 is a full triplet feel).
function audioSwing(p, s) {
  let o = 0;
  if (s % 2 === 1) o += p.swing;
  if (s % 4 === 2) o += p.shuffle;
  if (s % 4 === 3) o += p.shuffle * 0.5;
  return o * p.stepDur;
}

function audioStep(p, i, t) {
  const bar = Math.floor(i / 16),
    pass = Math.floor(p.step / p.comp.total),
    resting = p.song.breathe && pass % 2 === 1 && bar < 4;
  for (const e of p.comp.steps[i]) {
    const dur = e.len * p.stepDur;
    if (e.part === 'drum') audioDrum(p, e.kind, t, e.vel * audioJitter(0.08));
    else if (e.part === 'pad') {
      if (p.inst.pad) for (const n of e.notes) audioNote(p, p.inst.pad, p.chordIn, t, p.root + n, dur, e.vel);
    } else if (e.part === 'arp') {
      if (p.inst.arp) audioNote(p, p.inst.arp, p.chordIn, t, p.root + e.note, dur, e.vel);
    } else if (e.part === 'bass') audioNote(p, p.inst.bass, p.bassIn, t, p.root + e.note, dur, e.vel);
    else if (!resting) audioNote(p, p.inst.lead, p.leadIn, t, p.root + e.note, dur, e.vel);
  }
  if (p.perc) {
    const vel = AUDIO_HITS[audioCycle(p.perc.pattern, bar)[i % 16]];
    if (vel) audioDrum(p, p.perc.kind, t, vel);
  }
}

// One music note: oscillator (optional glide, filter sweep, shared vibrato) into a pooled gain.
function audioNote(p, name, dest, t, midi, dur, vel) {
  const I = AUDIO_INST[name];
  if (!I) return;
  const o = audioCtx.createOscillator(),
    g = audioGain(dest),
    f = audioFreq(midi + 12 * I.oct),
    from = I.glide ? p.glide[name] : 0;
  audioSetWave(o, I.w);
  o.frequency.setValueAtTime(from || f, t);
  if (from && from !== f) o.frequency.exponentialRampToValueAtTime(f, t + I.glide);
  if (I.glide) p.glide[name] = f;
  let filt = null;
  if (I.cut) {
    filt = audioFilter('lowpass', I.cut, 1, t);
    if (I.cutPeak) {
      filt.frequency.exponentialRampToValueAtTime(I.cutPeak, t + 0.12);
      filt.frequency.setTargetAtTime(I.cut * 1.5, t + 0.12, 0.2);
    } else filt.frequency.setTargetAtTime(I.cutEnd, t, I.d / 3);
    o.connect(filt);
    filt.connect(g);
  } else o.connect(g);
  const peak = I.v * vel;
  let end;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + I.a);
  if (I.s) {
    const gate = t + Math.max(dur * 0.92, I.a + 0.02);
    g.gain.setTargetAtTime(peak * I.s, t + I.a, I.d / 3);
    g.gain.setTargetAtTime(0, gate, I.r / 3);
    end = gate + I.r * 2.2;
  } else {
    g.gain.setTargetAtTime(0, t + I.a, I.d / 3);
    end = t + I.a + I.d * 2.2;
  }
  const vib = I.vib ? p.vib : null;
  if (vib) vib.connect(o.detune);
  audioWatch(o, g, filt, o.detune, vib);
  o.start(t);
  o.stop(end);
}

function audioDrum(p, kind, t, vel) {
  const d = p.drum;
  if (kind === 'k') {
    audioOsc(t, d, { w: 'sine', f: 150, f2: 42, slide: 0.12, dur: 0.3, v: 0.55 * vel, a: 0.002 });
    audioNoise(t, d, { ft: 'highpass', f: 1800, dur: 0.012, v: 0.05 * vel });
  } else if (kind === 's') {
    audioNoise(t, p.snare, { dur: 0.16, v: 0.32 * vel });
    audioOsc(t, d, { w: 'triangle', f: 210, f2: 150, dur: 0.08, v: 0.12 * vel });
  } else if (kind === 'h') audioNoise(t, p.hat, { dur: 0.045, v: 0.1 * vel });
  else if (kind === 'o') audioNoise(t, p.hat, { dur: 0.22, v: 0.08 * vel });
  else if (kind === 'c') audioNoise(t, d, { ft: 'highpass', f: 3500, dur: 1.3, v: 0.12 * vel });
  else if (kind === 't') audioOsc(t, d, { w: 'sine', f: 150, f2: 72, slide: 0.18, dur: 0.32, v: 0.4 * vel, a: 0.003 });
  else if (kind === 'clap') {
    audioNoise(t, p.snare, { dur: 0.02, v: 0.22 * vel });
    audioNoise(t + 0.012, p.snare, { dur: 0.02, v: 0.22 * vel });
    audioNoise(t + 0.024, p.snare, { dur: 0.14, v: 0.22 * vel });
  } else if (kind === 'knock') {
    audioOsc(t, d, { w: 'square', f: 72, f2: 60, dur: 0.09, v: 0.12 * vel, cut: 520 });
    audioNoise(t, d, { ft: 'lowpass', f: 900, dur: 0.04, v: 0.1 * vel });
  } else if (kind === 'ping') audioOsc(t, p.leadIn, { w: 'sine', f: audioFreq(p.root + 24), dur: 1, v: 0.07 * vel });
  else if (kind === 'beep') audioOsc(t, d, { w: 'sine', f: audioFreq(p.root + 24), dur: 0.1, v: 0.05 * vel, hold: 0.05 });
  else if (kind === 'tick') {
    audioNoise(t, d, { ft: 'highpass', f: 6000, dur: 0.018, v: 0.1 * vel });
    audioOsc(t, d, { w: 'sine', f: vel > 1.2 ? 2400 : 2000, dur: 0.025, v: 0.02 * vel });
  }
}

// ---- Startup ----
audioLoadPrefs();
audioSyncButton();
audioListen();
