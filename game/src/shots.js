// shots.js — staged scenes for the screenshots. A screenshot must show
// live gameplay, never a menu: each ?shot= value drops the real game into
// a real mid-play state (a guard mid-suspicion, a chase in progress, a
// manuscript half recovered) and lets the loop keep running, so the
// capture is a genuine render of the game's own code, not a mock-up.
//   ?shot=play   level 1, a warden turning suspicious behind the shelves
//   ?shot=chase  level 2, a chase with the alarm half full
//   ?shot=sneak  level 3, sneaking in the dark, recovering a manuscript
//   ?shot=win    the escape screen with a finished run's stats

import { TILE } from './levels.js';

function tile(cx, cy) {
  return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 };
}

export function stageShot(game, name) {
  if (name === 'play') {
    game.phase = 'playing';
    const p = tile(12, 10);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.dir = 0;
    // Same open corridor, 160 px away, line of sight clear: the warden
    // sees the thief and his suspicion climbs while the shot is taken.
    const g = game.guards[0];
    const gp = tile(8, 10);
    g.x = gp.x;
    g.y = gp.y;
    g.dir = Math.atan2(p.y - gp.y, p.x - gp.x);
    g.state = 'suspicious';
    g.suspicion = 45;
    g.lastSeen = { x: p.x, y: p.y };
    g.bark = 'Huh?';
    g.barkT = 5;
    game.level.manuscripts[0].taken = true;
    game.alarm.value = 18;
    game.player.coins = 2;
    game.time = 74;
  } else if (name === 'chase') {
    game.phase = 'playing';
    const p = tile(24, 3);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.dir = -Math.PI / 2;
    // Far enough that the warden cannot reach the thief before the shot,
    // close enough that the red chase cone reads across the room.
    const g = game.guards[1];
    const gp = tile(16, 8);
    g.x = gp.x;
    g.y = gp.y;
    g.dir = Math.atan2(p.y - gp.y, p.x - gp.x);
    g.state = 'chase';
    g.suspicion = 100;
    g.lastSeen = { x: p.x, y: p.y };
    g.bark = 'Stop right there!';
    g.barkT = 5;
    game.level.manuscripts[0].taken = true;
    game.level.manuscripts[1].taken = true;
    game.alarm.value = 55;
    game.time = 203;
  } else if (name === 'sneak') {
    game.phase = 'playing';
    const p = tile(6, 9);
    game.player.x = p.x;
    game.player.y = p.y;
    game.player.dir = Math.PI;
    game.player.sneaking = true;
    const m = game.level.manuscripts[1];
    game.player.channel = 0.6;
    game.player.channelTarget = m;
    game.level.manuscripts[2].taken = true;
    const g = game.guards[2];
    const gp = tile(8, 11);
    g.x = gp.x;
    g.y = gp.y;
    g.dir = Math.PI / 2;
    game.alarm.value = 8;
    game.time = 341;
  } else if (name === 'win') {
    game.phase = 'win';
    game.time = 487;
    game.alarm.timesSpotted = 2;
    game.alarm.timesCaught = 1;
    game.alarm.peak = 82;
  }
  // Anything else leaves the title screen alone.
}
