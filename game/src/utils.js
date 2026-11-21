// utils.js — small math and grid helpers shared by every system.
// No game state lives here: pure functions only, so the dossier outline
// reads this file as what it is, a toolbox.

// Clamp a number into [lo, hi].
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Euclidean distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Angle from (ax, ay) to (bx, by), in radians.
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest absolute difference between two angles, in radians.
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Turn `from` toward `to` by at most `step` radians.
export function turnToward(from, to, step) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= step) return to;
  return from + Math.sign(d) * step;
}

// Deterministic PRNG (mulberry32) so a seed always builds the same shelves.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// True when the straight line from (ax, ay) to (bx, by) crosses no tile
// for which `blocksSight(tx, ty)` is true. Samples every 8 px.
export function hasLineOfSight(ax, ay, bx, by, blocksSight) {
  const d = dist(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (blocksSight(Math.floor(x / 40), Math.floor(y / 40))) return false;
  }
  return true;
}

// Format seconds as MM:SS for the HUD timer.
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
