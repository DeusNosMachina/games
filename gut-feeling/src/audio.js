// Sound. tone() is the raw WebAudio beep; it plays only while state.sound is on (header toggle).
// New code should call sfx(name) so a later audio pass can restyle every effect in one place.
let audioCtx = null;

// Reserved for the audio pass (music track, mixer state). Nothing reads it yet.
const audio = { enabled: false, music: null };

function tone(freq = 440, dur = 0.08, type = 'triangle', vol = 0.03) {
  if (!state.sound) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let o = audioCtx.createOscillator(),
      a = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    a.gain.setValueAtTime(vol, audioCtx.currentTime);
    a.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(a);
    a.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {}
}

// Named effects mapped onto today's beeps: one [frequency, seconds, wave, volume] per note.
// A function entry receives sfx()'s opts, e.g. sfx('slice', {combo: 3}).
const SFX = {
  ui: [[520, 0.1]],
  hit: [[230, 0.07]],
  swing: o => [[180 + (o.combo || 0) * 90, 0.1]],
  jump: [[410, 0.08]],
  dash: [[320, 0.08]],
  hurt: [[90, 0.27, 'sawtooth']],
  coin: [[620, 0.15]],
  pickup: [[800, 0.1]],
  eat: [[590, 0.15]],
  enemyDie: [[650, 0.1]],
  split: [[470, 0.12]],
  blob: [[260, 0.08, 'sine']],
  throw: [[310, 0.12]],
  bounce: [[420, 0.05]],
  explode: [[140, 0.18, 'sawtooth']],
  shot: [[110, 0.045, 'sawtooth', 0.025], [330, 0.04, 'sine', 0.018]],
  reload: [[190, 0.09]],
  slice: o => [[500 + Math.min(o.combo || 0, 8) * 60, 0.04]],
  bomb: [[100, 0.25, 'sawtooth']],
  combo: o => [[540 + (o.count || 3) * 30, 0.12]],
  fever: [[760, 0.2, 'sine']],
  drip: o => [[500 + (o.count || 0) * 25, 0.1]],
  catch: [[660, 0.07]],
  pump: [[300, 0.05, 'sine']],
  wave: [[520, 0.12]],
  clear: [[690, 0.2, 'sine']],
  win: [[784, 0.35]],
  lose: [[65, 0.4, 'sawtooth']],
  countdown: [[440, 0.1, 'sine']],
  go: [[660, 0.09, 'sine']],
  stun: [[230, 0.08]],
  shield: [[650, 0.05]],
  trap: [[180, 0.1]],
  miss: [[120, 0.17, 'sawtooth']]
};

// Unknown names are silently ignored.
function sfx(name, opts = {}) {
  const notes = typeof SFX[name] === 'function' ? SFX[name](opts) : SFX[name];
  if (!notes) return;
  for (const n of notes) tone(...n);
}

// Background music hook: no-op until the audio pass fills it in.
function music(name) {}
