// audio.js — every sound is synthesised in WebAudio at run time.
// No audio files ship with the game, so the entry has no network request
// and no borrowed asset. All sounds are short and quiet on purpose: a
// stealth game whispers. Created lazily on the first user gesture.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

export function unlockAudio() {
  ensure();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

// One oscillator blip: freq slides to freq2 over `dur` seconds.
function blip(freq, freq2, dur, type, vol, when = 0) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freq2 !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Short filtered-noise burst, used for footsteps on wooden floor.
function noiseBurst(dur, vol, freq, pan = 0) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = src;
  node.connect(f);
  f.connect(g);
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    p.connect(master);
  } else {
    g.connect(master);
  }
  src.start(t0);
}

// The player's own step. Running is louder and quicker than sneaking.
export function stepSound(sneaking, pan = 0) {
  noiseBurst(0.07, sneaking ? 0.05 : 0.11, sneaking ? 500 : 900, pan);
}

// A guard's step, heard only when the guard is near the player.
// Pan is -1 (left) to 1 (right) by the guard's position relative to you.
export function guardStepSound(pan, vol) {
  noiseBurst(0.08, vol, 700, pan);
}

// Manuscript collected: a soft two-note chime.
export function pickupSound() {
  blip(660, 660, 0.12, 'sine', 0.16);
  blip(990, 990, 0.22, 'sine', 0.14, 0.09);
}

// A coin hits the floor and pings: the sound guards investigate.
export function coinSound() {
  blip(2400, 1700, 0.09, 'triangle', 0.12);
  blip(2400, 1700, 0.07, 'triangle', 0.07, 0.1);
}

// A guard grows suspicious: a short questioning blip.
export function suspectSound() {
  blip(420, 620, 0.16, 'square', 0.06);
}

// A guard spots you: a harsh two-tone alarm sting.
export function alarmSound() {
  blip(520, 520, 0.14, 'sawtooth', 0.1);
  blip(392, 392, 0.22, 'sawtooth', 0.1, 0.13);
}

// The exit opens: a warm rising chord.
export function exitOpenSound() {
  blip(523, 523, 0.18, 'sine', 0.12);
  blip(659, 659, 0.18, 'sine', 0.12, 0.1);
  blip(784, 784, 0.3, 'sine', 0.12, 0.2);
}

// Level complete: a short victory phrase. Game over: a low fall.
export function winSound() {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.25, 'sine', 0.12, i * 0.11));
}

export function loseSound() {
  blip(330, 110, 0.7, 'sawtooth', 0.09);
}
