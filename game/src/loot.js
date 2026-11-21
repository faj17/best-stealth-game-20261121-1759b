// loot.js — the manuscripts and the exit door.
// Each room hides three manuscripts. The exit stays sealed until every
// one is recovered: the quota is the reason to cross the room instead of
// sprinting for the door. A manuscript is collected by standing beside it
// and holding E; the channel ring shows the 1.2 seconds it takes, and
// moving away breaks it.

import { dist } from './utils.js';
import { COLLECT_TIME } from './player.js';

export const COLLECT_RADIUS = 46;
export const EXIT_RADIUS = 30;

export function nearestManuscript(level, player) {
  let best = null;
  let bestD = COLLECT_RADIUS;
  for (const m of level.manuscripts) {
    if (m.taken) continue;
    const d = dist(player.x, player.y, m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

export function collectedCount(level) {
  return level.manuscripts.filter((m) => m.taken).length;
}

export function quotaMet(level) {
  return collectedCount(level) >= level.quota;
}

export function exitIsOpen(level) {
  return quotaMet(level);
}

// True when the thief stands on the open exit. The door must be open:
// stepping on a sealed exit does nothing.
export function onExit(level, player) {
  if (!exitIsOpen(level)) return false;
  return dist(player.x, player.y, level.exit.x, level.exit.y) < EXIT_RADIUS;
}

export { COLLECT_TIME };
