// player.js — the thief: movement, sneaking, collecting, coin throws.
// Speed is the stealth tradeoff: walking is fast and loud, sneaking is
// slow, quiet and half as easy to spot. The player never outruns a
// chasing guard for long, so the answer is always cover, not speed.

import { clamp, dist } from './utils.js';
import { isSolid } from './levels.js';
import { stepSound, coinSound } from './audio.js';

export const PLAYER_RADIUS = 13;
export const WALK_SPEED = 168;
export const SNEAK_SPEED = 82;
export const COLLECT_TIME = 1.2;

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    dir: 0, // facing angle, radians
    moving: false,
    sneaking: false,
    stepT: 0,
    channel: 0, // 0..1 progress of the manuscript collect channel
    channelTarget: null,
    coins: 3,
    thrown: [], // coins in flight: {x, y, tx, ty, t}
    invulnT: 0, // seconds of grace after being caught
  };
}

// Move the player one step. `input` is {x, y} in -1..1, `sneak` a boolean.
// Returns nothing; the player slides along walls axis by axis.
export function updatePlayer(p, input, sneak, dt, level) {
  p.sneaking = sneak;
  const speed = sneak ? SNEAK_SPEED : WALK_SPEED;
  const len = Math.hypot(input.x, input.y);
  p.moving = len > 0.1;
  if (p.moving) {
    const nx = input.x / len;
    const ny = input.y / len;
    p.dir = Math.atan2(ny, nx);
    moveAxis(p, nx * speed * dt, 0, level);
    moveAxis(p, 0, ny * speed * dt, level);
    // Footsteps: one soft tap per stride, quieter while sneaking.
    p.stepT -= dt;
    if (p.stepT <= 0) {
      stepSound(sneak);
      p.stepT = sneak ? 0.55 : 0.34;
    }
  }
  if (p.invulnT > 0) p.invulnT -= dt;
  // Thrown coins fly to their target, then ping.
  for (const c of p.thrown) {
    if (c.t < 1) {
      c.t += dt / 0.35;
      const t = Math.min(1, c.t);
      c.x = c.fx + (c.tx - c.fx) * t;
      c.y = c.fy + (c.ty - c.fy) * t;
    }
  }
  p.thrown = p.thrown.filter((c) => c.t < 1 || c.ringT > 0);
  for (const c of p.thrown) if (c.t >= 1 && c.ringT > 0) c.ringT -= dt;
}

function moveAxis(p, dx, dy, level) {
  const nx = p.x + dx;
  const ny = p.y + dy;
  const r = PLAYER_RADIUS;
  const corners = [
    [nx - r, ny - r],
    [nx + r, ny - r],
    [nx - r, ny + r],
    [nx + r, ny + r],
  ];
  for (const [cx, cy] of corners) {
    if (isSolid(level, Math.floor(cx / 40), Math.floor(cy / 40))) return;
  }
  p.x = clamp(nx, r, 1280 - r);
  p.y = clamp(ny, r, 720 - r);
}

// Start or continue the manuscript channel. Call every frame with the
// nearest manuscript in reach (or null); returns true while channelling.
export function updateCollect(p, target, dt) {
  if (!target) {
    p.channel = 0;
    p.channelTarget = null;
    return false;
  }
  p.channelTarget = target;
  p.channel += dt / COLLECT_TIME;
  if (p.channel >= 1) {
    p.channel = 0;
    p.channelTarget = null;
    return true; // collected this frame
  }
  return false;
}

// Throw a coin toward (tx, ty). Returns false when no coins are left.
export function throwCoin(p, tx, ty) {
  if (p.coins <= 0) return false;
  p.coins--;
  const d = dist(p.x, p.y, tx, ty);
  const range = Math.min(d, 260);
  const a = Math.atan2(ty - p.y, tx - p.x);
  p.thrown.push({
    fx: p.x,
    fy: p.y,
    x: p.x,
    y: p.y,
    tx: p.x + Math.cos(a) * range,
    ty: p.y + Math.sin(a) * range,
    t: 0,
    ringT: 1.2,
    pinged: false,
  });
  coinSound();
  return true;
}

// The ping a landed coin makes: guards inside PING_RADIUS investigate it.
export const PING_RADIUS = 240;

export function landedPings(p) {
  const out = [];
  for (const c of p.thrown) {
    if (c.t >= 1 && !c.pinged) {
      c.pinged = true;
      out.push({ x: c.tx, y: c.ty });
    }
  }
  return out;
}
