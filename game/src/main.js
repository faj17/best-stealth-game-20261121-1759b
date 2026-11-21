// main.js — the game loop: input, phases, and the rules that tie the
// systems together. One file owns the state object every other file reads,
// so the dossier outline shows a single spine: load a room, run it,
// count the manuscripts, open the exit.

import { loadLevel, levelCount } from './levels.js';
import { makePlayer, updatePlayer, updateCollect, throwCoin, landedPings, PING_RADIUS } from './player.js';
import { makeGuard, updateGuard, investigatePoint, resetGuards } from './guards.js';
import { updateWatcher } from './watchers.js';
import { makeAlarm, addAlarm, updateAlarm, isLockedDown } from './alarm.js';
import { nearestManuscript, collectedCount, onExit } from './loot.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio, setMuted, isMuted, pickupSound, exitOpenSound, winSound, loseSound } from './audio.js';
import { dist } from './utils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = {
  phase: 'title', // title | playing | paused | leveldone | win | caught
  t: 0, // wall-clock seconds since load, drives every pulse and flicker
  time: 0, // run timer, counts only while playing
  levelIndex: 0,
  level: null,
  player: null,
  guards: [],
  watchers: [],
  alarm: makeAlarm(),
  toast: '',
  toastT: 0,
  levelDoneT: 0,
};

function setToast(text, seconds = 2.5) {
  game.toast = text;
  game.toastT = seconds;
}

// Exposed for the screenshot driver and for debugging in the console:
// window.__game.phase, .alarm.value, .guards[i].state, and so on.
window.__game = game;

const keys = {};
let mouse = { x: 0, y: 0 };

function loadRoom(index) {
  game.levelIndex = index;
  game.level = loadLevel(index);
  game.player = makePlayer(game.level.playerStart);
  game.guards = game.level.guards.map(makeGuard);
  game.watchers = game.level.watchers;
  game.player.coins = 3;
}

function startRun() {
  game.alarm = makeAlarm();
  game.time = 0;
  loadRoom(0);
  game.phase = 'playing';
  setToast('Recover the manuscripts. Stay out of the light.', 3);
}

function restartRoom() {
  const keepAlarm = game.alarm.value;
  const keepHearts = game.alarm.hearts;
  const keepCaught = game.alarm.timesCaught;
  const keepSpotted = game.alarm.timesSpotted;
  loadRoom(game.levelIndex);
  game.alarm.value = keepAlarm;
  game.alarm.hearts = keepHearts;
  game.alarm.timesCaught = keepCaught;
  game.alarm.timesSpotted = keepSpotted;
  game.phase = 'playing';
}

function inputVector() {
  let x = 0;
  let y = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) x += 1;
  if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) y += 1;
  return { x, y };
}

function update(dt) {
  game.t += dt;
  if (game.toastT > 0) game.toastT -= dt;
  if (game.phase === 'leveldone') {
    game.levelDoneT -= dt;
    if (game.levelDoneT <= 0) {
      loadRoom(game.levelIndex + 1);
      game.phase = 'playing';
      setToast('Room ' + (game.levelIndex + 1) + ' — ' + game.level.name, 2.5);
    }
    return;
  }
  if (game.phase !== 'playing') return;
  game.time += dt;

  const p = game.player;
  const level = game.level;
  updatePlayer(p, inputVector(), !!keys['ShiftLeft'] || !!keys['ShiftRight'], dt, level);

  // Collecting: hold E beside a manuscript. Moving away breaks the ring.
  const target = nearestManuscript(level, p);
  if (keys['KeyE'] && target) {
    if (updateCollect(p, target, dt)) {
      target.taken = true;
      pickupSound();
      const n = collectedCount(level);
      setToast(`Manuscript recovered (${n}/${level.quota})`);
      if (n >= level.quota) {
        exitOpenSound();
        setToast('The exit is open — reach it unseen.', 3);
      }
    }
  } else {
    updateCollect(p, null, dt);
  }

  // Coin pings pull guards to the sound.
  for (const ping of landedPings(p)) {
    for (const g of game.guards) {
      if (dist(g.x, g.y, ping.x, ping.y) < PING_RADIUS) investigatePoint(g, ping.x, ping.y);
    }
  }

  // Watchers pour alarm in while they see the thief.
  let watcherAlarm = 0;
  for (const w of game.watchers) watcherAlarm += updateWatcher(w, level, p, dt);
  if (watcherAlarm > 0) addAlarm(game.alarm, watcherAlarm);

  // Guards: patrol, suspicion, chase, and the caught moment.
  const events = [];
  for (const g of game.guards) updateGuard(g, level, p, dt, events);
  for (const ev of events) {
    if (ev.type === 'spotted') {
      game.alarm.timesSpotted++;
      addAlarm(game.alarm, 28);
      setToast('Spotted! Break line of sight!', 2);
    } else if (ev.type === 'caught') {
      game.alarm.timesCaught++;
      game.alarm.hearts--;
      loseSound();
      if (game.alarm.hearts <= 0) {
        game.phase = 'caught';
      } else {
        p.x = level.playerStart.x;
        p.y = level.playerStart.y;
        p.invulnT = 2.5;
        resetGuards(game.guards, level.guards);
        addAlarm(game.alarm, 12);
        setToast('Caught! The wardens drag you back to the door.', 2.5);
      }
    }
  }

  const anyChase = game.guards.some((g) => g.state === 'chase');
  updateAlarm(game.alarm, dt, anyChase);

  // The exit, once open, ends the room — unless the building is locked down.
  if (onExit(level, p)) {
    if (isLockedDown(game.alarm)) {
      setToast('LOCKDOWN — the exit is sealed!', 1.5);
    } else if (game.levelIndex + 1 >= levelCount()) {
      game.phase = 'win';
      winSound();
    } else {
      game.phase = 'leveldone';
      game.levelDoneT = 1.8;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  update(dt);
  render(ctx, game);
  requestAnimationFrame(frame);
}

function canvasPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * 1280,
    y: ((clientY - r.top) / r.height) * 720,
  };
}

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Enter' && game.phase === 'title') startRun();
  if (e.code === 'KeyP' && (game.phase === 'playing' || game.phase === 'paused')) {
    game.phase = game.phase === 'playing' ? 'paused' : 'playing';
  }
  if (e.code === 'KeyM') {
    setMuted(!isMuted());
    setToast(isMuted() ? 'Sound off' : 'Sound on', 1.2);
  }
  if (e.code === 'KeyR' && (game.phase === 'win' || game.phase === 'caught')) startRun();
  else if (e.code === 'KeyR' && (game.phase === 'playing' || game.phase === 'paused')) restartRoom();
  if (e.code === 'Space' && game.phase === 'playing') {
    e.preventDefault();
    const m = canvasPos(mouse.x, mouse.y);
    throwCoin(game.player, m.x, m.y);
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

canvas.addEventListener('mousemove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('click', (e) => {
  unlockAudio();
  if (game.phase === 'title') {
    startRun();
    return;
  }
  if (game.phase !== 'playing') return;
  const m = canvasPos(e.clientX, e.clientY);
  throwCoin(game.player, m.x, m.y);
});

// Boot: load the room behind the title screen, then stage a screenshot
// scene when the URL asks for one (?shot=play, chase, sneak, win).
// Each staged scene lives in its own room, so load that room first.
let last = performance.now();
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot === 'chase') loadRoom(1);
else if (shot === 'sneak' || shot === 'win') loadRoom(2);
else loadRoom(0);
if (shot) stageShot(game, shot);
requestAnimationFrame(frame);
