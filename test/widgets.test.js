// -----------------------------------------------------------------------------
// The `storm_outlook` widget: content valid for the core (vocabulary and
// budget, checked by the SDK's validator), Gladys' device names, settings that
// hide the optional blocks.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/monitor.js';
import { hazardsValue, levelColor } from '../src/widgets.js';
import { createWorld, fixtureFetch, HOUSES, response } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];

async function get(world, settings = {}, language = 'en') {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'us' });
  assert.equal(ack.success, true, ack.error);
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), [], JSON.stringify(content));
  return content.components;
}

test('a Moderate day: heading, the three days, the probabilities, the source and the link', async () => {
  const world = await createWorld({
    state: { set: '2026-04-27' },
    houses: [HOUSES.stLouis],
    created: ['st-louis'],
  });
  try {
    const components = await get(world);
    assert.deepEqual(components[0], {
      type: 'text',
      variant: 'heading',
      text: 'Severe storms today: 4 · Moderate',
    });
    const status = components.find((c) => c.type === 'status');
    assert.deepEqual(
      status.items.map((i) => [i.label, i.value, i.color]),
      [
        ['Today', '4 · Moderate', 'danger'],
        ['Tomorrow', 'General thunderstorms', 'info'],
        ['In 2 days', 'No severe risk', 'neutral'],
        ['Tornado / hail / wind today', '15 / 30 / 45% · CIG2', 'neutral'],
        ['Tornado / hail / wind tomorrow', '0 / 0 / 0%', 'neutral'],
      ],
    );
    assert.match(
      components.find((c) => c.variant === 'caption').text,
      /^SPC \(NOAA\), .* not an official warning$/,
    );
    assert.equal(components.at(-1).link.url, 'https://www.spc.noaa.gov/products/outlook/');
    for (const language of LANGS) {
      await get(world, {}, language);
    }
  } finally {
    await world.cleanup();
  }
});

test('the settings hide the probabilities and the button; a house can be chosen', async () => {
  const world = await createWorld({
    houses: [HOUSES.midland, HOUSES.forks],
    created: ['midland', 'forks'],
  });
  try {
    const forks = world.gladys.externalIds('house', 'forks').device;
    const components = await get(world, {
      house: forks,
      show_probabilities: false,
      show_link: false,
    });
    assert.equal(
      components.some((c) => c.type === 'button'),
      false,
    );
    const status = components.find((c) => c.type === 'status');
    assert.deepEqual(
      status.items.map((i) => i.value),
      ['1 · Marginal', 'General thunderstorms', 'No severe risk'],
    );
    // No heading below Slight.
    assert.equal(
      components.some((c) => c.variant === 'heading'),
      false,
    );
  } finally {
    await world.cleanup();
  }
});

test('no device, a deleted house, an unreadable source: a plain text', async () => {
  let world = await createWorld({ houses: [HOUSES.forks] });
  let components = await get(world, {}, 'fr');
  assert.match(components[0].text, /Découverte/);
  components = await get(world, { house: world.gladys.externalIds('house', 'gone').device });
  assert.equal(components[0].text, 'This house is no longer followed.');
  await world.cleanup();

  const fetch = fixtureFetch({ overrides: [[() => true, () => response(500)]] });
  world = await createWorld({ houses: [HOUSES.forks], created: ['forks'], fetch });
  components = await get(world);
  assert.equal(components[0].text, 'The SPC outlooks cannot be read for now.');
  await world.cleanup();
});

test('colours follow the SPC scale within the closed palette', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((level) => levelColor(level)),
    ['neutral', 'success', 'warning', 'warning', 'danger', 'danger'],
  );
  assert.equal(levelColor(0, true), 'info');
  assert.equal(levelColor(null), 'neutral');
});

test('the probability line fits a status value in every language', () => {
  const hazards = {
    tornado: { probability: 60, intensity: 3 },
    hail: { probability: 60, intensity: 2 },
    wind: { probability: 90, intensity: 2 },
  };
  for (const language of LANGS) {
    assert.ok(hazardsValue(hazards, language).length <= 40);
  }
  assert.equal(hazardsValue({ tornado: { probability: 5, intensity: 0 } }, 'en'), 'Not available');
});
