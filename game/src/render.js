// render.js — everything the judge sees: the room, the cones, the light
// and the HUD, all drawn on one 1280x720 canvas. Vision cones are
// raycast polygons, so a shelf genuinely cuts a cone short. Light is a
// separate offscreen layer: the room is dark, and the thief, the lamps,
// the lanterns and the manuscripts each punch a hole in it, so at a glance
// you can read what is safe (dark) and what is watched (lit).

import { clamp, dist, rng, fmtTime } from './utils.js';
import { TILE, COLS, ROWS, blocksSight } from './levels.js';
import { GUARD_VIEW_RANGE, GUARD_VIEW_HALF_ANGLE } from './guards.js';
import { WATCHER_RANGE, WATCHER_HALF_ANGLE } from './watchers.js';
import { collectedCount, exitIsOpen } from './loot.js';
import { isLockedDown } from './alarm.js';

const W = 1280;
const H = 720;
const HUD_H = 46;

const lightCanvas = document.createElement('canvas');
lightCanvas.width = W;
lightCanvas.height = H;
const lctx = lightCanvas.getContext('2d');

// March rays across a cone and stop each one at the first shelf or wall,
// so the polygon a cone draws is the area its light truly reaches.
function conePolygon(level, x, y, dir, halfAngle, range) {
  const pts = [[x, y]];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const a = dir - halfAngle + (2 * halfAngle * i) / steps;
    let r = range;
    for (let t = 10; t <= range; t += 10) {
      const px = x + Math.cos(a) * t;
      const py = y + Math.sin(a) * t;
      if (blocksSight(level, Math.floor(px / TILE), Math.floor(py / TILE))) {
        r = t;
        break;
      }
    }
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}

function tracePoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, level) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      const c = level.grid[ty][tx];
      if (c === '#' || c === 'd') continue;
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#2b2015' : '#28200f';
      ctx.fillRect(x, y, TILE, TILE);
      // Plank seams.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(x, y + TILE - 0.5);
      ctx.lineTo(x + TILE, y + TILE - 0.5);
      ctx.stroke();
    }
  }
  // A worn red carpet down the middle aisle of every room.
  ctx.fillStyle = 'rgba(122,32,32,0.5)';
  ctx.fillRect(15 * TILE, 0, 2 * TILE, H);
  ctx.fillStyle = 'rgba(200,170,90,0.35)';
  ctx.fillRect(15 * TILE, 0, 2, H);
  ctx.fillRect(17 * TILE - 2, 0, 2, H);
}

function drawShelvesAndDesks(ctx, level) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = level.grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (c === '#') {
        const border = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
        if (border) {
          ctx.fillStyle = '#3a3f4a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#4a505e';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else {
          // A shelf: dark wood with a row of coloured book spines.
          ctx.fillStyle = '#4a2f1c';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#5d3d24';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          const r = rng(tx * 31 + ty * 17 + 7);
          const spineColors = ['#8a2f2f', '#2f5d8a', '#5d8a2f', '#8a6d2f', '#6d2f8a', '#a8a8a8'];
          let sx = x + 4;
          while (sx < x + TILE - 5) {
            const w = 4 + Math.floor(r() * 5);
            ctx.fillStyle = spineColors[Math.floor(r() * spineColors.length)];
            ctx.fillRect(sx, y + 6, w, TILE - 12);
            sx += w + 1;
          }
        }
      } else if (c === 'd') {
        ctx.fillStyle = '#6d4a26';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#8a5f31';
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
        // Papers left on the desk.
        ctx.fillStyle = 'rgba(240,230,200,0.85)';
        ctx.fillRect(x + 10, y + 12, 12, 15);
        ctx.fillRect(x + 22, y + 20, 10, 12);
      }
    }
  }
}

function drawLamps(ctx, level, t) {
  for (const lamp of level.lamps) {
    const flicker = 0.9 + 0.1 * Math.sin(t * 3 + lamp.x);
    ctx.fillStyle = '#3a2f1a';
    ctx.fillRect(lamp.x - 3, lamp.y - 14, 6, 28);
    ctx.fillStyle = `rgba(255, 196, 90, ${0.95 * flicker})`;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y - 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,140,0.9)';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y - 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, level, t) {
  const e = level.exit;
  const open = exitIsOpen(level);
  const pulse = 0.75 + 0.25 * Math.sin(t * 4);
  ctx.fillStyle = open ? '#1d4a2a' : '#3a1d1d';
  ctx.fillRect(e.x - 18, e.y - 18, 36, 36);
  ctx.strokeStyle = open ? `rgba(90,255,140,${pulse})` : 'rgba(255,90,90,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(e.x - 18, e.y - 18, 36, 36);
  ctx.fillStyle = open ? '#5aff8c' : '#ff5a5a';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : 'SEALED', e.x, e.y - 26);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(open ? 'EXIT' : '—', e.x, e.y + 5);
}

function drawManuscripts(ctx, level, t) {
  for (const m of level.manuscripts) {
    if (m.taken) continue;
    const pulse = 0.7 + 0.3 * Math.sin(t * 3.5 + m.x);
    ctx.fillStyle = `rgba(255, 205, 80, ${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 20 + 4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d76e';
    roundRect(ctx, m.x - 9, m.y - 12, 18, 24, 3);
    ctx.fill();
    ctx.fillStyle = '#8a6d1f';
    ctx.fillRect(m.x - 5, m.y - 7, 10, 2);
    ctx.fillRect(m.x - 5, m.y - 1, 10, 2);
    ctx.fillRect(m.x - 5, m.y + 5, 10, 2);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(m.x - 11, m.y - 12, 4, 24);
  }
}

function drawCones(ctx, level, guards, watchers) {
  for (const w of watchers) {
    const pts = conePolygon(level, w.x, w.y, w.angle, WATCHER_HALF_ANGLE, WATCHER_RANGE);
    tracePoly(ctx, pts);
    ctx.fillStyle = w.seeing ? 'rgba(255,80,60,0.30)' : 'rgba(255,220,150,0.16)';
    ctx.fill();
  }
  for (const g of guards) {
    const pts = conePolygon(level, g.x, g.y, g.dir, GUARD_VIEW_HALF_ANGLE, GUARD_VIEW_RANGE);
    tracePoly(ctx, pts);
    ctx.fillStyle =
      g.state === 'chase'
        ? 'rgba(255,60,50,0.34)'
        : g.state === 'suspicious'
          ? 'rgba(255,190,60,0.30)'
          : 'rgba(255,214,120,0.17)';
    ctx.fill();
  }
}

function drawWatchers(ctx, watchers) {
  for (const w of watchers) {
    ctx.fillStyle = '#6d5a1f';
    ctx.beginPath();
    ctx.arc(w.x, w.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.seeing ? '#ff5040' : '#ffd75a';
    ctx.beginPath();
    ctx.arc(w.x + Math.cos(w.angle) * 8, w.y + Math.sin(w.angle) * 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuards(ctx, guards, t) {
  for (const g of guards) {
    // Lantern glow at the guard's chest.
    ctx.fillStyle = 'rgba(255,200,100,0.25)';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 22, 0, Math.PI * 2);
    ctx.fill();
    // Body: a navy uniform with a brass button.
    ctx.fillStyle = '#2b3a67';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8b25a';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 3, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick: the brim of the cap.
    ctx.strokeStyle = '#d8b25a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x + Math.cos(g.dir) * 10, g.y + Math.sin(g.dir) * 10);
    ctx.lineTo(g.x + Math.cos(g.dir) * 17, g.y + Math.sin(g.dir) * 17);
    ctx.stroke();
    // Suspicion arc above the head: the meter the player reads.
    if (g.suspicion > 1) {
      ctx.strokeStyle = g.suspicion > 60 ? '#ff5040' : '#ffc83c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y - 20, 8, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.suspicion) / 100);
      ctx.stroke();
    }
    // State mark: ? while suspicious, ! while chasing.
    if (g.state === 'suspicious' || g.state === 'chase') {
      ctx.fillStyle = g.state === 'chase' ? '#ff5040' : '#ffc83c';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - 30);
    }
    // Bark bubble.
    if (g.bark) {
      ctx.font = '13px Georgia, serif';
      const w = ctx.measureText(g.bark).width + 14;
      ctx.fillStyle = 'rgba(240,235,220,0.95)';
      roundRect(ctx, g.x - w / 2, g.y - 58, w, 20, 9);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.textAlign = 'center';
      ctx.fillText(g.bark, g.x, g.y - 44);
    }
  }
}

function drawPlayer(ctx, game, t) {
  const p = game.player;
  if (p.invulnT > 0 && Math.floor(t * 10) % 2 === 0) return; // blink while safe
  // A faint ring while sneaking: the game tells you your own noise.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(120,220,200,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Hooded figure: dark teal cloak, hood point facing the walk direction.
  ctx.fillStyle = '#2f6f6a';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4a46';
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16);
  ctx.lineTo(p.x + Math.cos(p.dir + 2.5) * 10, p.y + Math.sin(p.dir + 2.5) * 10);
  ctx.lineTo(p.x + Math.cos(p.dir - 2.5) * 10, p.y + Math.sin(p.dir - 2.5) * 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.dir) * 5, p.y + Math.sin(p.dir) * 5, 3, 0, Math.PI * 2);
  ctx.fill();
  // The collect channel: a gold ring closing around the thief.
  if (p.channel > 0) {
    ctx.strokeStyle = '#f5d76e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.channel);
    ctx.stroke();
    ctx.fillStyle = '#f5d76e';
    ctx.font = '12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Recovering…', p.x, p.y - 28);
  }
  // Thrown coins and their fading ping rings.
  for (const c of p.thrown) {
    ctx.fillStyle = '#f5d76e';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (c.t >= 1 && c.ringT > 0) {
      ctx.strokeStyle = `rgba(245,215,110,${clamp(c.ringT, 0, 1)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.tx, c.ty, 24 * (1.2 - c.ringT) + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function punchLight(x, y, r, strength) {
  const g = lctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.globalCompositeOperation = 'destination-out';
  lctx.fillStyle = g;
  lctx.beginPath();
  lctx.arc(x, y, r, 0, Math.PI * 2);
  lctx.fill();
  lctx.globalCompositeOperation = 'source-over';
}

function drawLighting(ctx, game) {
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = 'rgba(3,5,14,0.52)';
  lctx.fillRect(0, 0, W, H);
  const { level, player, guards } = game;
  for (const lamp of level.lamps) punchLight(lamp.x, lamp.y, 150, 0.95);
  punchLight(player.x, player.y, 205, 0.9);
  for (const g of guards) punchLight(g.x, g.y, 95, 0.7);
  for (const m of level.manuscripts) if (!m.taken) punchLight(m.x, m.y, 55, 0.55);
  if (exitIsOpen(level)) punchLight(level.exit.x, level.exit.y, 85, 0.8);
  ctx.drawImage(lightCanvas, 0, 0);
}

function drawHud(ctx, game) {
  const { alarm, level, levelIndex, player } = game;
  ctx.fillStyle = 'rgba(8,10,20,0.92)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#c8a95a';
  ctx.fillRect(0, HUD_H, W, 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Hearts.
  ctx.font = '20px Georgia, serif';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < alarm.hearts ? '#ff5a6e' : 'rgba(255,90,110,0.25)';
    ctx.fillText('♥', 16 + i * 26, 31);
  }
  // Manuscripts and coins.
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(`MANUSCRIPTS ${collectedCount(level)}/${level.quota}`, 104, 30);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillText(`COINS ${player.coins}`, 300, 30);
  // Level name, centred.
  ctx.fillStyle = '#e8dcc0';
  ctx.textAlign = 'center';
  ctx.fillText(`LEVEL ${levelIndex + 1} — ${level.name.toUpperCase()}`, W / 2, 30);
  // Alarm meter and timer, right aligned.
  const ax = W - 300;
  ctx.textAlign = 'left';
  ctx.fillStyle = isLockedDown(alarm) ? '#ff5040' : '#e8dcc0';
  ctx.fillText('ALARM', ax, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(ax + 62, 17, 120, 14);
  ctx.fillStyle = alarm.value > 66 ? '#ff5040' : alarm.value > 33 ? '#ffc83c' : '#5aff8c';
  ctx.fillRect(ax + 62, 17, 120 * clamp(alarm.value / 100, 0, 1), 14);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillText('TIME ' + fmtTime(game.time), W - 96, 30);
  // Objective line under the bar.
  ctx.fillStyle = 'rgba(232,220,192,0.85)';
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  const goal = exitIsOpen(level)
    ? 'The exit is open — reach it unseen.'
    : `Recover ${level.quota - collectedCount(level)} more manuscript${level.quota - collectedCount(level) === 1 ? '' : 's'}, then reach the exit.`;
  ctx.fillText(goal, W / 2, HUD_H + 18);
  // Controls, bottom edge.
  ctx.fillStyle = 'rgba(232,220,192,0.55)';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('WASD move · SHIFT sneak · E collect · SPACE toss coin · P pause · M mute · R restart', W / 2, H - 10);
  // Lockdown banner.
  if (isLockedDown(alarm)) {
    const blink = Math.floor(game.t * 4) % 2 === 0;
    ctx.fillStyle = blink ? 'rgba(255,60,50,0.9)' : 'rgba(180,20,20,0.9)';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(`LOCKDOWN — ${Math.ceil(alarm.lockdownT)}s`, W / 2, HUD_H + 46);
  }
  // Toasts.
  if (game.toastT > 0) {
    ctx.fillStyle = `rgba(240,235,220,${clamp(game.toastT, 0, 1)})`;
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText(game.toast, W / 2, HUD_H + 72);
  }
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(4,6,14,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('THE SILENT STACKS', W / 2, 210);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '22px Georgia, serif';
  ctx.fillText('A night in the Grand Library. Recover the manuscripts. Leave unseen.', W / 2, 258);
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = 'rgba(232,220,192,0.85)';
  ctx.fillText('Three rooms. Nine manuscripts. Wardens with lanterns, sentry lights that never sleep.', W / 2, 300);
  ctx.fillText('Sneak in the dark. Toss a coin to pull a guard away. Never let the alarm reach 100.', W / 2, 326);
  ctx.fillStyle = '#c8a95a';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText('WASD move   ·   SHIFT sneak   ·   E collect   ·   SPACE toss coin   ·   P pause   ·   M mute', W / 2, 400);
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 20px Georgia, serif';
  const pulse = 0.7 + 0.3 * Math.sin(game.t * 4);
  ctx.fillStyle = `rgba(245,215,110,${pulse})`;
  ctx.fillText('Press ENTER or click to begin', W / 2, 470);
}

function drawWin(ctx, game) {
  ctx.fillStyle = 'rgba(4,10,6,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5aff8c';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('ESCAPED UNSEEN', W / 2, 220);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('All nine manuscripts are yours. The library never knew you were there.', W / 2, 268);
  const rating =
    game.alarm.timesSpotted === 0 && game.alarm.timesCaught === 0
      ? 'SHADOW'
      : game.alarm.timesCaught === 0
        ? 'GHOST'
        : 'BURGLAR';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('Rank: ' + rating, W / 2, 330);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '17px Georgia, serif';
  ctx.fillText(`Time ${fmtTime(game.time)}   ·   Spotted ${game.alarm.timesSpotted}   ·   Caught ${game.alarm.timesCaught}   ·   Peak alarm ${Math.round(game.alarm.peak)}`, W / 2, 380);
  ctx.fillStyle = 'rgba(232,220,192,0.8)';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('Press R to play again', W / 2, 440);
}

function drawCaught(ctx, game) {
  ctx.fillStyle = 'rgba(14,4,4,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a6e';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('CAUGHT!', W / 2, 240);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('The wardens found you in the stacks.', W / 2, 290);
  ctx.fillStyle = 'rgba(232,220,192,0.85)';
  ctx.font = '16px Georgia, serif';
  ctx.fillText('Press R to try the room again', W / 2, 350);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4,6,14,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = '16px Georgia, serif';
  ctx.fillText('Press P to resume', W / 2, H / 2 + 40);
}

function drawLevelDone(ctx, game) {
  ctx.fillStyle = 'rgba(4,6,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5aff8c';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOM CLEAR', W / 2, H / 2 - 10);
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '18px Georgia, serif';
  ctx.fillText('The next door opens…', W / 2, H / 2 + 30);
}

export function render(ctx, game) {
  ctx.clearRect(0, 0, W, H);
  const t = game.t;
  drawFloor(ctx, game.level);
  drawShelvesAndDesks(ctx, game.level);
  drawLamps(ctx, game.level, t);
  drawExit(ctx, game.level, t);
  drawManuscripts(ctx, game.level, t);
  drawCones(ctx, game.level, game.guards, game.watchers);
  drawWatchers(ctx, game.watchers);
  drawGuards(ctx, game.guards, t);
  drawPlayer(ctx, game, t);
  if (game.phase === 'playing' || game.phase === 'paused' || game.phase === 'leveldone') {
    drawLighting(ctx, game);
  }
  drawHud(ctx, game);
  if (game.phase === 'title') drawTitle(ctx, game);
  else if (game.phase === 'win') drawWin(ctx, game);
  else if (game.phase === 'caught') drawCaught(ctx, game);
  else if (game.phase === 'paused') drawPaused(ctx);
  else if (game.phase === 'leveldone') drawLevelDone(ctx, game);
}
