// levels.js — the three rooms of the Grand Library, as ASCII maps.
// One character per 40 px tile. Legend:
//   '#' shelf or wall — blocks movement and sight (real cover)
//   'd' desk — blocks movement only, you can be seen over it
//   'L' lamp — a pool of warm light (being lit makes you easier to spot)
//   'P' where the thief starts   'E' the exit door   'M' a manuscript
//   'W' a sentry lantern (its sweep is defined below, per level)
// Guard patrols are defined per level as tile waypoints, so a patrol never
// crosses a shelf: every waypoint sits on open floor.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

const LEVEL_DEFS = [
  {
    name: 'The Reading Room',
    map: [
      '################################',
      '#..............##............E.#',
      '#.......L......d.......L.......#',
      '#..M...........##..............#',
      '#..............##......d.......#',
      '#..####....####.##.####....###.#',
      '#..............##..............#',
      '#..d...........##......W.......#',
      '#..............##..............#',
      '#..####....####.##.####....###.#',
      '#..............##..............#',
      '#......M.......##.......d......#',
      '#..............##..............#',
      '#..d...........##..............#',
      '#..............##.......L......#',
      '#..P...........##..............#',
      '#.......L......##.......M......#',
      '################################',
    ],
    guards: [
      { spawn: [20, 3], waypoints: [[20, 3], [26, 3], [26, 6], [20, 6]] },
      { spawn: [8, 13], waypoints: [[8, 13], [8, 6]] },
    ],
    watchers: [{ baseAngle: -Math.PI / 2, sweep: 0.96 }],
  },
  {
    name: 'The Map Gallery',
    map: [
      '################################',
      '#..M...........#......E........#',
      '#..............#.......L.......#',
      '#..#...#...#...#...#...#...#...#',
      '#..............#...............#',
      '#..d...........#......W........#',
      '#..............#...............#',
      '#..#...#...#...#...#...#...#...#',
      '#..............................#',
      '#.......M......#.......d.......#',
      '#..............#...............#',
      '#..#...#...#...#...#...#...#...#',
      '#..............#...............#',
      '#..L...........#......W........#',
      '#..............#...............#',
      '#..#...#...#...#...#...#...#...#',
      '#..P...........#.......M.......#',
      '################################',
    ],
    guards: [
      { spawn: [6, 2], waypoints: [[6, 2], [13, 2], [13, 5], [6, 5]] },
      { spawn: [20, 10], waypoints: [[20, 10], [28, 10], [28, 13], [20, 13]] },
      { spawn: [10, 16], waypoints: [[10, 16], [10, 9]] },
    ],
    watchers: [
      { baseAngle: Math.PI / 2, sweep: 1.1 },
      { baseAngle: -Math.PI / 2, sweep: 1.1 },
    ],
  },
  {
    name: 'The Vault of Tomes',
    map: [
      '################################',
      '#..M.........##........E.......#',
      '#...........##.................#',
      '#..####..####..####..####..###.#',
      '#...........##.................#',
      '#..d........##....W............#',
      '#...........##.................#',
      '#..####..####..####..####..###.#',
      '#..............................#',
      '#....M.....##.....d.....M......#',
      '#...........##.................#',
      '#..####..####..####..####..###.#',
      '#...........##.................#',
      '#..L........##....W............#',
      '#...........##.................#',
      '#..####..####..####..####..###.#',
      '#..P........##.................#',
      '################################',
    ],
    guards: [
      { spawn: [6, 2], waypoints: [[6, 2], [10, 2], [10, 5], [6, 5]] },
      { spawn: [20, 8], waypoints: [[20, 8], [28, 8], [28, 10], [20, 10]] },
      { spawn: [8, 14], waypoints: [[8, 14], [8, 11]] },
    ],
    watchers: [
      { baseAngle: Math.PI / 2, sweep: 1.0 },
      { baseAngle: -Math.PI / 2, sweep: 1.0 },
    ],
  },
];

// Parse one level definition into the structures the game loop uses.
// Throws on a malformed map so a bad level can never ship silently.
export function loadLevel(index) {
  const def = LEVEL_DEFS[index];
  if (!def) return null;
  const rows = def.map;
  if (rows.length !== ROWS) throw new Error('level ' + index + ': ' + rows.length + ' rows, want ' + ROWS);
  const grid = [];
  const lamps = [];
  const manuscripts = [];
  let playerStart = null;
  let exit = null;
  const watcherTiles = [];
  for (let y = 0; y < ROWS; y++) {
    if (rows[y].length !== COLS) {
      throw new Error('level ' + index + ' row ' + y + ': ' + rows[y].length + ' cols, want ' + COLS);
    }
    grid.push(rows[y].split(''));
    for (let x = 0; x < COLS; x++) {
      const c = rows[y][x];
      const px = x * TILE + TILE / 2;
      const py = y * TILE + TILE / 2;
      if (c === 'L') lamps.push({ x: px, y: py });
      else if (c === 'M') manuscripts.push({ x: px, y: py, taken: false });
      else if (c === 'P') playerStart = { x: px, y: py };
      else if (c === 'E') exit = { x: px, y: py };
      else if (c === 'W') watcherTiles.push({ x: px, y: py });
    }
  }
  if (!playerStart) throw new Error('level ' + index + ': no player start');
  if (!exit) throw new Error('level ' + index + ': no exit');
  if (manuscripts.length === 0) throw new Error('level ' + index + ': no manuscripts');
  if (watcherTiles.length !== def.watchers.length) {
    throw new Error('level ' + index + ': ' + watcherTiles.length + ' watcher tiles, ' + def.watchers.length + ' watcher defs');
  }
  const watchers = watcherTiles.map((w, i) => ({
    x: w.x,
    y: w.y,
    baseAngle: def.watchers[i].baseAngle,
    sweep: def.watchers[i].sweep,
    angle: def.watchers[i].baseAngle,
    sweepT: Math.random() * Math.PI * 2,
    seeing: false,
  }));
  const guards = def.guards.map((g) => ({
    spawn: { x: g.spawn[0] * TILE + TILE / 2, y: g.spawn[1] * TILE + TILE / 2 },
    waypoints: g.waypoints.map(([wx, wy]) => ({ x: wx * TILE + TILE / 2, y: wy * TILE + TILE / 2 })),
  }));
  return {
    name: def.name,
    grid,
    lamps,
    manuscripts,
    playerStart,
    exit,
    watchers,
    guards,
    quota: manuscripts.length,
  };
}

export function levelCount() {
  return LEVEL_DEFS.length;
}

// A tile is solid when it is outside the map or a shelf, wall or desk.
export function isSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const c = level.grid[ty][tx];
  return c === '#' || c === 'd';
}

// Only shelves and walls block sight; you can be seen over a desk.
export function blocksSight(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return level.grid[ty][tx] === '#';
}

// True when a point stands in a lamp's warm pool (easier to spot).
export function isLit(level, x, y) {
  for (const lamp of level.lamps) {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < 95 * 95) return true;
  }
  return false;
}
