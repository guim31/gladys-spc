// -----------------------------------------------------------------------------
// Test world: the SDK's fake Gladys, the real wiring (src/app.js), and a fake
// fetch serving the real SPC layers recorded under test/fixtures/<date>/
// (file names of www.spc.noaa.gov/products/outlook/). No network.
//   - 2026-11-07: a quiet day (general thunderstorms in Texas, a Marginal
//     risk on the coast of Washington);
//   - 2026-04-27: a Moderate risk over the Mississippi valley, 15% tornado
//     odds and intensity group 2.
// -----------------------------------------------------------------------------

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { OUTLOOK_BASE } from '../../src/source.js';
import { Store } from '../../src/store.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

export const NOV_7 = Date.parse('2026-11-07T19:30:00Z');
export const APR_27 = Date.parse('2026-04-27T18:00:00Z');

// Public places (no private address): one inside each zone, one outside.
export const HOUSES = {
  midland: { id: 'h1', name: 'Midland', selector: 'midland', latitude: 32.0, longitude: -102.08 },
  forks: { id: 'h2', name: 'Forks', selector: 'forks', latitude: 47.95, longitude: -124.38 },
  kansasCity: {
    id: 'h3',
    name: 'Kansas City',
    selector: 'kansas-city',
    latitude: 39.1,
    longitude: -94.58,
  },
  stLouis: { id: 'h4', name: 'St. Louis', selector: 'st-louis', latitude: 38.63, longitude: -90.2 },
  paris: { id: 'h5', name: 'Paris', selector: 'paris', latitude: 48.86, longitude: 2.35 },
};

export const response = (status, body = '', headers = {}) => ({
  status,
  text: async () => body,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
});

/** Path of a layer URL in a fixture set, or null. */
export function fixturePath(set, url) {
  if (!url.startsWith(`${OUTLOOK_BASE}/`)) {
    return null;
  }
  return join(FIXTURES, set, url.slice(OUTLOOK_BASE.length + 1));
}

/**
 * A fetch serving a fixture set (`state.set`, changeable during a test); 404
 * for a file the set does not hold. `overrides` maps a URL predicate to a
 * response, for the error cases. Answers 304 to a matching If-None-Match.
 */
export function fixtureFetch({ state = { set: '2026-11-07' }, overrides = [], calls = [] } = {}) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    for (const [match, answer] of overrides) {
      if (match(url)) {
        return typeof answer === 'function' ? answer(url) : answer;
      }
    }
    const path = fixturePath(state.set, url);
    if (!path) {
      return response(404);
    }
    let body;
    try {
      body = await readFile(path, 'utf8');
    } catch {
      return response(404);
    }
    const etag = `"${state.set}-${body.length}"`;
    if (options.headers?.['If-None-Match'] === etag) {
      return response(304, '', { etag });
    }
    return response(200, body, { etag });
  };
}

/**
 * Starts the integration against the fake Gladys.
 * @param {object} [options]
 * @param {object} [options.config] integration configuration
 * @param {object[]} [options.houses] houses of Gladys
 * @param {string[]} [options.created] selectors of the houses whose device the user created
 * @param {object} [options.state] { set } fixture set served
 * @param {Function} [options.fetch]
 * @param {object} [options.clock] { now } mutable clock
 * @param {string} [options.dataDir] reuse a /data directory (restart)
 */
export async function createWorld({
  config = { language: 'en' },
  houses = [HOUSES.midland, HOUSES.forks, HOUSES.kansasCity],
  created = [],
  state = { set: '2026-11-07' },
  fetch,
  clock = { now: state.set === '2026-04-27' ? APR_27 : NOV_7 },
  dataDir,
} = {}) {
  const directory = dataDir ?? (await mkdtemp(join(tmpdir(), 'gladys-spc-')));
  const gladys = createFakeGladys({ config, houses });
  gladys.fake.devices = created.map((selector) => ({
    name: `Device ${selector}`,
    external_id: gladys.externalIds('house', selector).device,
    features: [],
  }));
  const app = registerHandlers(gladys, {
    store: new Store(directory),
    fetch: fetch ?? fixtureFetch({ state }),
    timers: false,
    now: () => clock.now,
  });
  await gladys.connect();
  await app.ready;
  return {
    gladys,
    fake: gladys.fake,
    app,
    monitor: app.monitor,
    clock,
    state,
    directory,
    async cleanup() {
      await app.stop();
      if (!dataDir) {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

/** Captures what the SDK logger writes (console.log / console.error) at `level`. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
