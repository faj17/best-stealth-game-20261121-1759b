// alarm.js — the building's alarm, 0 to 100, and the thief's hearts.
// Alarm is the shared consequence of every mistake: a guard spotting you
// adds a chunk, a sentry lantern pours it in while it sees you, and it
// drains slowly while you stay hidden. At 100 the building locks down:
// every guard hunts you and the exit seals for ten seconds. Lockdown is
// survivable — hide, wait it out — but it is never free.

export const LOCKDOWN_SECONDS = 10;
export const ALARM_DECAY = 1.6; // points per second while calm

export function makeAlarm() {
  return {
    value: 0,
    lockdownT: 0, // seconds of lockdown left, 0 when not locked down
    peak: 0, // highest alarm reached this run, shown on the win screen
    hearts: 3,
    timesCaught: 0,
    timesSpotted: 0,
  };
}

export function addAlarm(a, amount) {
  if (a.lockdownT > 0) return;
  a.value = Math.min(100, a.value + amount);
  if (a.value > a.peak) a.peak = a.value;
  if (a.value >= 100) a.lockdownT = LOCKDOWN_SECONDS;
}

export function updateAlarm(a, dt, anyChase) {
  if (a.lockdownT > 0) {
    a.lockdownT -= dt;
    if (a.lockdownT <= 0) {
      a.lockdownT = 0;
      a.value = 50; // the building calms, but stays nervous
    }
    return;
  }
  if (!anyChase) a.value = Math.max(0, a.value - ALARM_DECAY * dt);
}

export function isLockedDown(a) {
  return a.lockdownT > 0;
}
