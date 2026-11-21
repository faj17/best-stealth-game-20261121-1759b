// watchers.js — the sentry lanterns: brass devices bolted to the shelves
// that sweep a cone of light back and forth. They never chase and never
// sleep, so they are the puzzle of each room: time your crossing to the
// sweep, or stay in the dark between their passes. Being seen by one
// pours alarm straight into the building.

import { dist, angleTo, angleDiff, hasLineOfSight } from './utils.js';
import { blocksSight, isLit } from './levels.js';

export const WATCHER_RANGE = 215;
export const WATCHER_HALF_ANGLE = 0.52; // ~30 degrees each side
export const WATCHER_ALARM_RATE = 26; // alarm points per second, while seen

// One tick. Returns the alarm gained this frame (0 when the thief is not
// in the sweep).
export function updateWatcher(w, level, player, dt) {
  w.sweepT += dt;
  w.angle = w.baseAngle + Math.sin(w.sweepT * 0.55) * w.sweep;
  const d = dist(w.x, w.y, player.x, player.y);
  w.seeing = false;
  if (d > WATCHER_RANGE) return 0;
  if (angleDiff(w.angle, angleTo(w.x, w.y, player.x, player.y)) > WATCHER_HALF_ANGLE) return 0;
  if (!hasLineOfSight(w.x, w.y, player.x, player.y, (tx, ty) => blocksSight(level, tx, ty))) return 0;
  let rate = WATCHER_ALARM_RATE * (1 - (d / WATCHER_RANGE) * 0.5);
  if (player.sneaking) rate *= 0.6;
  if (isLit(level, player.x, player.y)) rate *= 1.25;
  w.seeing = true;
  return rate * dt;
}
