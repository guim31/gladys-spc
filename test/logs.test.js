// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: nothing at info for a normal
// cycle; a failure that repeats is one line, plus one when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, createWorld, fixtureFetch, HOUSES, response } from './helpers/world.js';

const MINUTE = 60 * 1000;

test('a normal refresh cycle writes nothing at info', async (t) => {
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
  });
  t.after(() => world.cleanup());
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
  }
  assert.deepEqual(lines, []);
});

test('a failure that repeats is one line, and one when it is over', async (t) => {
  let down = false;
  const fetch = fixtureFetch({ overrides: [[() => down, () => response(502)]] });
  const world = await createWorld({ houses: [HOUSES.forks], created: ['forks'], fetch });
  t.after(() => world.cleanup());
  const lines = captureLogs(t, 'info');
  down = true;
  for (let i = 0; i < 3; i += 1) {
    await world.monitor.runCycle();
  }
  down = false;
  await world.monitor.runCycle();
  assert.equal(lines.length, 2, lines.map((l) => l.text).join('\n'));
  assert.equal(lines[0].level, 'warn');
  assert.match(lines[0].text, /HTTP 502/);
  assert.equal(lines[1].level, 'info');
});

test('never logs the location of a house, even at debug', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
  });
  t.after(() => world.cleanup());
  world.monitor.memory['st-louis'].dates['2026-04-27'].level = 0;
  await world.monitor.runCycle();
  assert.ok(lines.length > 0);
  assert.doesNotMatch(lines.map((l) => l.text).join('\n'), /38\.63|-90\.2/);
});
