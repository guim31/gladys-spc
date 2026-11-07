// -----------------------------------------------------------------------------
// Reading the SPC layers and evaluating them at a point, on the real files of
// 7 November and 27 April 2026.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  convectiveDate,
  evaluateDay,
  geometryContains,
  inCoverage,
  OutlookError,
  parseLayer,
  parseSpcTime,
} from '../src/outlook.js';
import { HOUSES } from './helpers/world.js';

const layer = async (set, name) =>
  parseLayer(
    await readFile(new URL(`./fixtures/${set}/${name}.lyr.geojson`, import.meta.url), 'utf8'),
  );

async function day1(set) {
  return {
    cat: await layer(set, 'day1otlk_cat'),
    tornado: await layer(set, 'day1otlk_torn'),
    hail: await layer(set, 'day1otlk_hail'),
    wind: await layer(set, 'day1otlk_wind'),
  };
}

test('reads the times of a layer', async () => {
  const cat = await layer('2026-11-07', 'day1otlk_cat');
  assert.equal(cat.valid, Date.parse('2026-11-07T16:30:00Z'));
  assert.equal(cat.expire, Date.parse('2026-11-08T12:00:00Z'));
  assert.equal(cat.issued, Date.parse('2026-11-07T16:26:00Z'));
  assert.equal(parseSpcTime('202611071630'), Date.parse('2026-11-07T16:30:00Z'));
  assert.equal(parseSpcTime('nonsense'), null);
});

test('an empty layer has no zone, a broken one is an error', async () => {
  const torn = await layer('2026-11-07', 'day1otlk_torn');
  assert.equal(torn.features.length, 1);
  assert.equal(torn.features[0].geometry.type, 'GeometryCollection');
  assert.throws(() => parseLayer('<html>'), OutlookError);
  assert.throws(() => parseLayer('{"type":"Feature"}'), OutlookError);
});

test('7 November: general thunderstorms in Texas, Marginal in Washington, nothing in Kansas City', async () => {
  const layers = await day1('2026-11-07');
  const midland = evaluateDay(1, layers, HOUSES.midland);
  assert.equal(midland.level, 0);
  assert.equal(midland.thunder, true);
  assert.equal(midland.date, '2026-11-07');

  const forks = evaluateDay(1, layers, HOUSES.forks);
  assert.equal(forks.level, 1);
  assert.deepEqual(forks.hazards, {
    tornado: { probability: 0, intensity: 0 },
    hail: { probability: 0, intensity: 0 },
    wind: { probability: 5, intensity: 0 },
  });

  const kansasCity = evaluateDay(1, layers, HOUSES.kansasCity);
  assert.equal(kansasCity.level, 0);
  assert.equal(kansasCity.thunder, false);
});

test('27 April: the highest nested zone wins, with the intensity groups of each hazard', async () => {
  const stLouis = evaluateDay(1, await day1('2026-04-27'), HOUSES.stLouis);
  assert.equal(stLouis.level, 4);
  assert.deepEqual(stLouis.hazards, {
    tornado: { probability: 15, intensity: 2 },
    hail: { probability: 30, intensity: 1 },
    wind: { probability: 45, intensity: 0 },
  });
});

test('day 3: any-severe probability and its own intensity layer', async () => {
  const layers = {
    cat: await layer('2026-04-27', 'day3otlk_cat'),
    severe: await layer('2026-04-27', 'day3otlk_prob'),
    severeIntensity: await layer('2026-04-27', 'day3otlk_cigprob'),
  };
  const result = evaluateDay(3, layers, HOUSES.kansasCity);
  assert.equal(result.date, '2026-04-29');
  assert.deepEqual(Object.keys(result.hazards), ['severe']);
  assert.equal(result.hazards.severe.intensity, 0);
});

test('a layer of another issue (the frozen _sig files) is ignored, not mixed in', async () => {
  const layers = await day1('2026-04-27');
  layers.tornado = await layer('2026-11-07', 'day1otlk_torn');
  const stLouis = evaluateDay(1, layers, HOUSES.stLouis);
  assert.equal(stLouis.hazards.tornado, undefined);
  assert.equal(stLouis.hazards.hail.probability, 30);
});

test('a point in a hole of a polygon is outside it', () => {
  const square = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  const geometry = { type: 'Polygon', coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] };
  assert.equal(geometryContains(geometry, 2, 2), true);
  assert.equal(geometryContains(geometry, 5, 5), false);
  assert.equal(geometryContains(geometry, 11, 5), false);
});

test('the convective day of the 01 UTC update of day 1 is the day before', () => {
  assert.equal(convectiveDate(Date.parse('2026-11-08T12:00:00Z')), '2026-11-07');
});

test('only the contiguous United States are covered', () => {
  assert.equal(inCoverage(HOUSES.stLouis), true);
  assert.equal(inCoverage(HOUSES.paris), false);
  assert.equal(inCoverage({ latitude: 61.2, longitude: -149.9 }), false); // Anchorage
  assert.equal(inCoverage({ latitude: null, longitude: null }), false);
});
