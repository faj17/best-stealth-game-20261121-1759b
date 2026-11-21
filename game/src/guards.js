// guards.js — the night wardens: patrols you can learn, suspicion that
// gives you a chance to recover, and a chase you can break with cover.
// A guard is a small state machine: patrol -> suspicious -> chase ->
// investigate -> patrol. Suspicion rises only while the thief is seen
// inside the lantern cone; it falls while hidden, so a near miss costs
// alarm, not the run.

import { clamp, dist, angleTo, angleDiff, turnToward, hasLineOfSight } from './utils.js';
import { blocksSight, isLit } from './levels.js';
import { guardStepSound, suspectSound, alarmSound } from './audio.js';

export const GUARD_VIEW_RANGE = 195;
export const GUARD_VIEW_HALF_ANGLE = 0.66; // ~38 degrees each side
export const GUARD_PATROL_SPEED = 72;
export const GUARD_CHASE_SPEED = 158;
export const GUARD_RADIUS = 14;
export const CATCH_RADIUS = 26;

export function makeGuard(def) {
  const wps = def.waypoints;
  return {
    x: def.spawn.x,
    y: def.spawn.y,
    dir: 0,
    waypoints: wps,
    wpi: 0,
    state: 'patrol', // patrol | suspicious | chase | investigate
    suspicion: 0, // 0..100, 100 means the thief is spotted
    lastSeen: null, // {x, y} where the thief was last seen
    loseT: 0, // seconds since the thief was last seen, while chasing
    lookT: 0, // seconds spent looking around an investigated spot
    bark: '', // text bubble above the guard, '' when silent
    barkT: 0,
    stepT: 0,
    pauseT: 0, // brief stop at each patrol waypoint
  };
}

function seesPlayer(g, level, player) {
  const d = dist(g.x, g.y, player.x, player.y);
  if (d > GUARD_VIEW_RANGE) return 0;
  if (angleDiff(g.dir, angleTo(g.x, g.y, player.x, player.y)) > GUARD_VIEW_HALF_ANGLE) return 0;
  if (!hasLineOfSight(g.x, g.y, player.x, player.y, (tx, ty) => blocksSight(level, tx, ty))) return 0;
  // Closer, standing and lit is easier to spot; sneaking in the dark is not.
  let rate = 62 * (1 - (d / GUARD_VIEW_RANGE) * 0.65);
  if (player.sneaking) rate *= 0.5;
  else if (player.moving) rate *= 1.25;
  if (isLit(level, player.x, player.y)) rate *= 1.3;
  else rate *= 0.85;
  return rate; // suspicion points per second
}

function say(g, text, seconds) {
  g.bark = text;
  g.barkT = seconds;
}

function moveToward(g, tx, ty, speed, dt, level, player) {
  const d = dist(g.x, g.y, tx, ty);
  if (d < 2) return true;
  const a = angleTo(g.x, g.y, tx, ty);
  g.dir = turnToward(g.dir, a, 5 * dt);
  const step = Math.min(d, speed * dt);
  const nx = g.x + Math.cos(a) * step;
  const ny = g.y + Math.sin(a) * step;
  // Guards walk around shelves: try x then y, like the player does.
  if (!hitsWall(level, nx, g.y)) g.x = nx;
  if (!hitsWall(level, g.x, ny)) g.y = ny;
  g.stepT -= dt;
  if (g.stepT <= 0) {
    g.stepT = 0.42;
    // Footsteps tell you where a guard is: louder and panned by distance.
    const pd = dist(g.x, g.y, player.x, player.y);
    if (pd < 300) guardStepSound(clamp((g.x - player.x) / 280, -1, 1), clamp(0.14 * (1 - pd / 300), 0.02, 0.14));
  }
  return d <= 4;
}

function hitsWall(level, x, y) {
  const r = GUARD_RADIUS;
  for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    const tx = Math.floor(cx / 40);
    const ty = Math.floor(cy / 40);
    if (tx < 0 || ty < 0 || tx >= 32 || ty >= 18) return true;
    if (level.grid[ty][tx] === '#' || level.grid[ty][tx] === 'd') return true;
  }
  return false;
}

// One tick. Returns an event object when something notable happens:
// {type:'spotted'} the first frame a guard fully spots the thief,
// {type:'caught'} a guard reaches the thief.
export function updateGuard(g, level, player, dt, events) {
  if (g.barkT > 0) {
    g.barkT -= dt;
    if (g.barkT <= 0) g.bark = '';
  }
  const seen = seesPlayer(g, level, player);
  if (seen > 0) {
    g.suspicion = clamp(g.suspicion + seen * dt, 0, 100);
    g.lastSeen = { x: player.x, y: player.y };
    g.loseT = 0;
    if (g.state === 'patrol' && g.suspicion > 30) {
      g.state = 'suspicious';
      say(g, 'Huh?', 1.4);
      suspectSound();
    }
  } else {
    g.suspicion = clamp(g.suspicion - 26 * dt, 0, 100);
    if (g.state === 'suspicious' && g.suspicion <= 0) g.state = 'patrol';
  }

  if (g.state === 'patrol') {
    if (g.pauseT > 0) {
      g.pauseT -= dt;
      g.dir = turnToward(g.dir, g.dir + 0.6 * dt, 2 * dt);
    } else {
      const wp = g.waypoints[g.wpi];
      const arrived = moveToward(g, wp.x, wp.y, GUARD_PATROL_SPEED, dt, level, player);
      if (arrived) {
        g.wpi = (g.wpi + 1) % g.waypoints.length;
        g.pauseT = 0.9; // look around at the end of each leg: learnable
      }
    }
    if (g.suspicion >= 100) {
      g.state = 'chase';
      say(g, "Stop right there!", 1.6);
      alarmSound();
      events.push({ type: 'spotted', guard: g });
    }
  } else if (g.state === 'suspicious') {
    // Freeze, stare at the last-seen spot: your chance to slip away.
    if (g.lastSeen) g.dir = turnToward(g.dir, angleTo(g.x, g.y, g.lastSeen.x, g.lastSeen.y), 3.5 * dt);
    if (g.suspicion >= 100) {
      g.state = 'chase';
      say(g, "Stop right there!", 1.6);
      alarmSound();
      events.push({ type: 'spotted', guard: g });
    }
  } else if (g.state === 'chase') {
    if (seen > 0) {
      moveToward(g, player.x, player.y, GUARD_CHASE_SPEED, dt, level, player);
    } else {
      g.loseT += dt;
      if (g.lastSeen) moveToward(g, g.lastSeen.x, g.lastSeen.y, GUARD_CHASE_SPEED, dt, level, player);
      if (g.loseT > 3.5) {
        g.state = 'investigate';
        g.lookT = 0;
      }
    }
    if (dist(g.x, g.y, player.x, player.y) < CATCH_RADIUS && player.invulnT <= 0) {
      events.push({ type: 'caught', guard: g });
    }
  } else if (g.state === 'investigate') {
    if (g.lastSeen) {
      const arrived = moveToward(g, g.lastSeen.x, g.lastSeen.y, GUARD_PATROL_SPEED * 1.4, dt, level, player);
      if (arrived) {
        g.lookT += dt;
        g.dir += 2.2 * dt; // scan the room before giving up
        if (g.lookT > 2.2) {
          g.state = 'patrol';
          g.suspicion = 0;
          g.lastSeen = null;
        }
      }
    } else {
      g.state = 'patrol';
    }
    if (g.suspicion >= 100) {
      g.state = 'chase';
      say(g, "Stop right there!", 1.6);
      alarmSound();
      events.push({ type: 'spotted', guard: g });
    }
  }
}

// A coin ping pulls every guard in earshot to the sound.
export function investigatePoint(g, x, y) {
  if (g.state === 'chase') return;
  g.lastSeen = { x, y };
  g.state = 'investigate';
  g.lookT = 0;
  say(g, 'What was that?', 1.4);
}

// Reset all guards to their patrol after the thief is caught.
export function resetGuards(guards, defs) {
  guards.forEach((g, i) => {
    g.x = defs[i].spawn.x;
    g.y = defs[i].spawn.y;
    g.wpi = 0;
    g.state = 'patrol';
    g.suspicion = 0;
    g.lastSeen = null;
    g.bark = '';
    g.barkT = 0;
  });
}
