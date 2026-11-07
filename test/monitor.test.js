// -----------------------------------------------------------------------------
// The monitor against the fake Gladys and the real SPC layers: devices per
// house, states, triggers, failures, statuses, the container's own refresh.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { houseIds } from '../src/devices.js';
import { HEARTBEAT_MS, TRIGGERS } from '../src/monitor.js';
import { STATUS } from '../src/messages.js';
import { createWorld, fixtureFetch, HOUSES, response } from './helpers/world.js';

const MINUTE = 60 * 1000;
const events = (fake, key) => fake.sceneEvents.filter((e) => e.key === key).map((e) => e.data);

test('one device per located house in the contiguous United States, polled by the container', async () => {
  const world = await createWorld({
    houses: [HOUSES.midland, HOUSES.paris, { ...HOUSES.forks, latitude: null }],
  });
  try {
    const devices = world.fake.discoveredDevices;
    assert.deepEqual(
      devices.map((d) => d.name),
      ['Severe storm outlook · Midland'],
    );
    assert.equal(devices[0].should_poll, false);
    assert.equal(devices[0].poll_frequency, undefined);
    assert.equal(devices[0].features.length, 18);
    assert.equal(devices[0].external_id, world.gladys.externalIds('house', 'midland').device);
    assert.equal(world.fake.connectionStatus.connected, true);
  } finally {
    await world.cleanup();
  }
});

test('no located house, or none in the United States: a clear status', async () => {
  let world = await createWorld({ houses: [] });
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: STATUS.noHouse });
  await world.cleanup();
  world = await createWorld({ houses: [HOUSES.paris] });
  assert.deepEqual(world.fake.connectionStatus, {
    connected: false,
    message: STATUS.outsideCoverage,
  });
  assert.equal(world.fake.discoveredDevices.length, 0);
  await world.cleanup();
});

test('publishes the outlooks of a created house', async () => {
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis, HOUSES.kansasCity],
    created: ['st-louis'],
  });
  try {
    const ids = houseIds(world.gladys, 'st-louis');
    const last = (id) => world.fake.lastState(id);
    assert.equal(last(ids.day1_category), 4);
    assert.equal(last(ids.day1_tornado), 15);
    assert.equal(last(ids.day1_tornado_intensity), 2);
    assert.equal(last(ids.day1_hail), 30);
    assert.equal(last(ids.day1_hail_intensity), 1);
    assert.equal(last(ids.day1_wind), 45);
    assert.equal(last(ids.day2_category), 0);
    assert.equal(last(ids.day3_category), 0);
    assert.equal(last(ids.day3_severe), 0);
    assert.equal(
      last(ids.summary),
      'Moderate risk of severe storms today (tornado 15%, hail 30%, wind 45%)',
    );
    // Not created: nothing published.
    assert.equal(last(houseIds(world.gladys, 'kansas-city').day1_category), undefined);
  } finally {
    await world.cleanup();
  }
});

test('the summary follows the language of the configuration', async () => {
  const world = await createWorld({
    config: { language: 'fr' },
    houses: [HOUSES.forks, HOUSES.midland],
    created: ['forks', 'midland'],
  });
  try {
    assert.equal(
      world.fake.lastState(houseIds(world.gladys, 'forks').summary),
      "Risque marginal d'orages violents aujourd'hui (rafales 5 %)",
    );
    assert.equal(
      world.fake.lastState(houseIds(world.gladys, 'midland').summary),
      "Orages ordinaires aujourd'hui, sans violence attendue",
    );
    assert.equal(
      world.fake.discoveredDevices[0].features[0].name,
      "Risque orageux aujourd'hui (0-5)",
    );
  } finally {
    await world.cleanup();
  }
});

test('the first cycle only sets the reference: no trigger', async () => {
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
  });
  try {
    assert.equal(world.fake.sceneEvents.length, 0);
  } finally {
    await world.cleanup();
  }
});

test('an upgrade seen after a restart fires the three triggers, once', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'gladys-spc-'));
  // Before the restart, St. Louis was forecast Slight with 5% tornado odds for the 27th.
  await writeFile(
    join(dataDir, 'spc.json'),
    JSON.stringify({
      houses: { 'st-louis': { seeded: true, dates: { '2026-04-27': { level: 2, tornado: 5 } } } },
    }),
  );
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
    dataDir,
  });
  try {
    const device = world.gladys.externalIds('house', 'st-louis').device;
    const reached = events(world.fake, TRIGGERS.RISK_REACHED);
    assert.deepEqual(
      reached.filter((e) => e.day === '1').map((e) => e.threshold),
      ['3', '4'],
    );
    assert.equal(reached[0].house, device);
    assert.equal(reached[0].house_name, 'Device st-louis');
    assert.equal(reached[0].level, 4);
    assert.equal(reached[0].level_name, 'Moderate');
    assert.equal(reached[0].day_name, 'today');
    assert.match(reached[0].date, /4\/27\/26/);

    // Tomorrow and the day after, seen for the first time: thunder only, nothing reached.
    assert.equal(reached.filter((e) => e.day !== '1').length, 0);

    const increased = events(world.fake, TRIGGERS.RISK_INCREASED);
    assert.equal(increased.length, 1);
    assert.equal(increased[0].previous_level, 2);
    assert.equal(increased[0].previous_level_name, 'Slight');

    const tornado = events(world.fake, TRIGGERS.TORNADO_REACHED);
    assert.deepEqual(
      tornado.map((e) => e.threshold),
      ['10', '15'],
    );
    assert.equal(tornado[0].probability, 15);
    assert.equal(tornado[0].intensity, 2);

    // The same outlook again: nothing new.
    const count = world.fake.sceneEvents.length;
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(world.fake.sceneEvents.length, count);

    const saved = JSON.parse(await readFile(join(dataDir, 'spc.json'), 'utf8'));
    assert.deepEqual(saved.houses['st-louis'].dates['2026-04-27'], { level: 4, tornado: 15 });
  } finally {
    await world.cleanup();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('the same date is followed from day 3 to day 1: a day 2 equal to the day 3 fires nothing', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'gladys-spc-'));
  // The day 3 of the 25th had already put the 27th at Moderate.
  await writeFile(
    join(dataDir, 'spc.json'),
    JSON.stringify({
      houses: { 'st-louis': { seeded: true, dates: { '2026-04-27': { level: 4, tornado: 15 } } } },
    }),
  );
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
    dataDir,
  });
  try {
    assert.equal(events(world.fake, TRIGGERS.RISK_REACHED).length, 0);
    assert.equal(events(world.fake, TRIGGERS.RISK_INCREASED).length, 0);
    assert.equal(events(world.fake, TRIGGERS.TORNADO_REACHED).length, 0);
  } finally {
    await world.cleanup();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('a house whose device is not created fires nothing, but its reference moves', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'gladys-spc-'));
  await writeFile(
    join(dataDir, 'spc.json'),
    JSON.stringify({
      houses: { 'st-louis': { seeded: true, dates: { '2026-04-27': { level: 1, tornado: 0 } } } },
    }),
  );
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    dataDir,
  });
  try {
    assert.equal(world.fake.sceneEvents.length, 0);
    assert.equal(world.monitor.memory['st-louis'].dates['2026-04-27'].level, 4);
  } finally {
    await world.cleanup();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('a new issue raises the risk: the triggers fire on the next cycle', async () => {
  // The reference says the 27th was quiet at Kansas City (an earlier issue);
  // the 16:30 UTC issue puts it at Marginal with 2% tornado odds.
  const state = { set: '2026-04-27' };
  const world = await createWorld({ state, houses: [HOUSES.kansasCity], created: ['kansas-city'] });
  try {
    const memory = world.monitor.memory['kansas-city'];
    assert.equal(memory.seeded, true);
    memory.dates['2026-04-27'] = { level: 0, tornado: 0 };
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    const reached = events(world.fake, TRIGGERS.RISK_REACHED);
    assert.deepEqual(
      reached.map((e) => [e.day, e.threshold, e.level]),
      [['1', '1', 1]],
    );
    assert.equal(events(world.fake, TRIGGERS.RISK_INCREASED)[0].previous_level, 0);
    assert.deepEqual(
      events(world.fake, TRIGGERS.TORNADO_REACHED).map((e) => e.threshold),
      ['2'],
    );
  } finally {
    await world.cleanup();
  }
});

test('the SPC down: nothing published, one status, everything back afterwards', async () => {
  let down = true;
  const fetch = fixtureFetch({ overrides: [[() => down, () => response(503)]] });
  const world = await createWorld({ houses: [HOUSES.forks], created: ['forks'], fetch });
  try {
    const ids = houseIds(world.gladys, 'forks');
    assert.equal(world.fake.lastState(ids.day1_category), undefined);
    assert.deepEqual(world.fake.connectionStatus, { connected: false, message: STATUS.sourceDown });
    down = false;
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(world.fake.lastState(ids.day1_category), 1);
    assert.equal(world.fake.connectionStatus.connected, true);
  } finally {
    await world.cleanup();
  }
});

test('an expired outlook is not published', async () => {
  const world = await createWorld({ houses: [HOUSES.forks], created: ['forks'] });
  try {
    world.gladys.forgetPublishedStates();
    // Two days later the same files are all expired.
    world.clock.now += 3 * 24 * 60 * MINUTE;
    const before = world.fake.states.length;
    await world.monitor.runCycle();
    assert.equal(world.fake.states.length, before);
  } finally {
    await world.cleanup();
  }
});

test('conditional requests: an unchanged file costs a 304', async () => {
  const calls = [];
  const world = await createWorld({ houses: [HOUSES.forks], fetch: fixtureFetch({ calls }) });
  try {
    assert.equal(calls.length, 11);
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(calls.length, 22);
    assert.ok(calls.slice(11).every((c) => c.options.headers['If-None-Match']));
  } finally {
    await world.cleanup();
  }
});

test('publishes only changes (the heartbeat is passed to the SDK)', async (t) => {
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
  });
  try {
    const before = world.fake.states.length;
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(world.fake.states.length, before);
    const spy = t.mock.method(world.gladys, 'publishChangedStates');
    world.clock.now += 15 * MINUTE;
    await world.monitor.runCycle();
    assert.equal(spy.mock.calls[0].arguments[1].heartbeat, HEARTBEAT_MS);
  } finally {
    await world.cleanup();
  }
});

test('onDeviceCreated publishes every state again and refreshes the widget', async () => {
  const world = await createWorld({ houses: [HOUSES.forks] });
  try {
    const ids = houseIds(world.gladys, 'forks');
    assert.equal(world.fake.lastState(ids.day1_category), undefined);
    world.fake.devices = [{ name: 'Forks', external_id: ids.device, features: [] }];
    const refreshes = world.fake.widgetRefreshes.length;
    await world.fake.deviceCreated({ name: 'Forks', external_id: ids.device, features: [] });
    assert.equal(world.fake.lastState(ids.day1_category), 1);
    assert.equal(world.fake.lastState(ids.day1_wind), 5);
    assert.ok(world.fake.widgetRefreshes.length > refreshes);
  } finally {
    await world.cleanup();
  }
});

test('the container refreshes on its own; onPoll is only a fallback', async () => {
  const calls = [];
  const world = await createWorld({
    houses: [HOUSES.forks],
    created: ['forks'],
    fetch: fixtureFetch({ calls }),
  });
  try {
    const device = { external_id: houseIds(world.gladys, 'forks').device };
    await world.fake.poll(device); // just after a cycle: no new read
    assert.equal(calls.length, 11);
    world.clock.now += 10 * MINUTE;
    await world.fake.poll(device);
    assert.equal(calls.length, 22);
  } finally {
    await world.cleanup();
  }
});

test('a reconnection publishes the houses, devices and states again', async () => {
  const world = await createWorld({ houses: [HOUSES.forks], created: ['forks'] });
  try {
    world.fake.houses.push(HOUSES.midland);
    await world.monitor.resync({ language: 'en' });
    assert.deepEqual(
      world.fake.discoveredDevices.map((d) => d.name),
      ['Severe storm outlook · Forks', 'Severe storm outlook · Midland'],
    );
  } finally {
    await world.cleanup();
  }
});
