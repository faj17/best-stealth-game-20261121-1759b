# The Silent Stacks — a stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/faj17/best-stealth-game-20261121-1759b/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/faj17/best-stealth-game-20261121-1759b/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**The Silent Stacks** is a complete, original top-down stealth game set in
the Grand Library at night. Recover nine manuscripts across three rooms and
reach the exit unseen — past night wardens with lantern cones, sentry
lanterns that sweep the halls, and an alarm that locks the building down
when it hits 100.

## How to play

Serve the `game/` folder with any static server and open `index.html` in
desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network. Everything the game loads is a file under
`game/` (system fonts only, no webfonts, no CDN).

- **WASD / arrows** — move. **Shift** — sneak: slower, quieter, half as
  easy to spot.
- **E (hold)** — recover a manuscript beside you (1.2 s channel).
- **Space or click** — toss a coin (3 per room). Guards investigate the
  ping.
- **P** — pause. **M** — mute. **R** — restart the room (or the run from
  the end screens).

## The stealth

- **Vision cones, raycast.** A warden's lantern cone is cut short by
  shelves, so cover is real: break line of sight and you are safe.
- **Suspicion with recovery.** Being seen fills a guard's suspicion
  meter; hiding drains it. At full suspicion the guard chases, barks,
  and the alarm jumps. Lose the chase for 3.5 seconds and the guard
  searches your last-seen spot, then goes back to patrol.
- **Sentry lanterns.** Brass devices that sweep a cone back and forth and
  pour alarm straight into the building while they see you. Time your
  crossing to the sweep.
- **Alarm and lockdown.** The alarm drains while you stay hidden. At 100
  the building locks down for 10 seconds: every guard hunts you and the
  exit seals.
- **Light matters.** Standing in a lamp's pool makes you easier to spot;
  the dark is your friend. Footsteps are audible: your own taps, and a
  guard's steps panned by where he is.
- **Three rooms** — The Reading Room, The Map Gallery, The Vault of Tomes
  — each with its own patrols to learn and routes to plan. Three hearts;
  being caught costs one and drags you back to the door.

## How it works

- `game/index.html` — the page: one canvas, one module script.
- `game/src/main.js` — the loop, input, phases, and the rules that tie
  the systems together.
- `game/src/levels.js` — the three rooms as ASCII maps, plus patrol
  waypoints and lamp/manuscript placement.
- `game/src/player.js` — movement, sneaking, the collect channel, coins.
- `game/src/guards.js` — patrol / suspicious / chase / investigate, the
  suspicion meter, barks, footsteps.
- `game/src/watchers.js` — the sweeping sentry lanterns.
- `game/src/alarm.js` — the building alarm, lockdown, hearts.
- `game/src/loot.js` — manuscripts, the quota, the exit door.
- `game/src/render.js` — canvas drawing: room, raycast cones, lighting,
  HUD, title / win / caught screens.
- `game/src/shots.js` — URL driver for screenshots (`?shot=play`,
  `?shot=chase`, `?shot=sneak`, `?shot=win`).
- `game/src/utils.js` — math, line of sight, seeded decoration.
- `game/src/audio.js` — every sound synthesised in WebAudio; no audio
  files ship with the game.

## Original work

Every name, room, line of code and sound in this game is original, drawn
in code for this entry. No commercial game's names, characters, art,
music or levels are used.
