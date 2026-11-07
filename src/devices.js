// -----------------------------------------------------------------------------
// One Gladys device per located house of Gladys inside the area the SPC covers
// (the contiguous United States). The house selector is the platform id.
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js), all counter-sensor/integer except the summary:
// the Gladys "risk" badge only knows four levels, and a number lets a scene
// condition say "risk ≥ 2".
//   - day1/2/3_category: SPC category, 0 (none or general thunderstorms) to
//     5 (High);
//   - day1/2 _tornado, _hail, _wind and day3_severe: probability (%) of the
//     hazard within 25 miles;
//   - the same with _intensity: conditional intensity group, 0 to 3 (the
//     hatched "significant" areas of old);
//   - summary: text/text, one sentence in the language of the configuration.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { DAYS, HAZARDS_BY_DAY, MAX_INTENSITY, MAX_LEVEL } from './outlook.js';
import { summaryText } from './messages.js';

export const DEVICE_TYPE = 'house';

export const FEATURE_KEYS = [
  ...DAYS.map((day) => `day${day}_category`),
  ...DAYS.flatMap((day) => HAZARDS_BY_DAY[day].map((hazard) => `day${day}_${hazard}`)),
  ...DAYS.flatMap((day) => HAZARDS_BY_DAY[day].map((hazard) => `day${day}_${hazard}_intensity`)),
  'summary',
];

// Name patterns: frozen at creation in Gladys (language of the configuration).
const PATTERNS = {
  en: {
    days: { 1: 'today', 2: 'tomorrow', 3: 'in 2 days' },
    category: (d) => `Storm risk ${d} (0-5)`,
    tornado: (d) => `Tornado probability ${d} (%)`,
    hail: (d) => `Hail probability ${d} (%)`,
    wind: (d) => `Wind probability ${d} (%)`,
    severe: (d) => `Severe storm probability ${d} (%)`,
    tornado_intensity: (d) => `Tornado intensity group ${d}`,
    hail_intensity: (d) => `Hail intensity group ${d}`,
    wind_intensity: (d) => `Wind intensity group ${d}`,
    severe_intensity: (d) => `Severe intensity group ${d}`,
    summary: 'Severe storm outlook',
  },
  fr: {
    days: { 1: "aujourd'hui", 2: 'demain', 3: 'dans 2 jours' },
    category: (d) => `Risque orageux ${d} (0-5)`,
    tornado: (d) => `Probabilité de tornade ${d} (%)`,
    hail: (d) => `Probabilité de grêle ${d} (%)`,
    wind: (d) => `Probabilité de rafales ${d} (%)`,
    severe: (d) => `Orage violent ${d} (%)`,
    tornado_intensity: (d) => `Intensité tornade ${d} (groupe)`,
    hail_intensity: (d) => `Intensité grêle ${d} (groupe)`,
    wind_intensity: (d) => `Intensité rafales ${d} (groupe)`,
    severe_intensity: (d) => `Intensité orages ${d} (groupe)`,
    summary: 'Résumé du risque orageux',
  },
  de: {
    days: { 1: 'heute', 2: 'morgen', 3: 'in 2 Tagen' },
    category: (d) => `Unwetterrisiko ${d} (0-5)`,
    tornado: (d) => `Tornado-Wahrscheinlichkeit ${d} (%)`,
    hail: (d) => `Hagel-Wahrscheinlichkeit ${d} (%)`,
    wind: (d) => `Böen-Wahrscheinlichkeit ${d} (%)`,
    severe: (d) => `Unwetter ${d} (%)`,
    tornado_intensity: (d) => `Intensitätsgruppe Tornado ${d}`,
    hail_intensity: (d) => `Intensitätsgruppe Hagel ${d}`,
    wind_intensity: (d) => `Intensitätsgruppe Böen ${d}`,
    severe_intensity: (d) => `Intensitätsgruppe Unwetter ${d}`,
    summary: 'Unwetterausblick',
  },
  es: {
    days: { 1: 'hoy', 2: 'mañana', 3: 'en 2 días' },
    category: (d) => `Riesgo de tormentas ${d} (0-5)`,
    tornado: (d) => `Probabilidad de tornado ${d} (%)`,
    hail: (d) => `Probabilidad de granizo ${d} (%)`,
    wind: (d) => `Probabilidad de rachas ${d} (%)`,
    severe: (d) => `Tormenta severa ${d} (%)`,
    tornado_intensity: (d) => `Intensidad tornado ${d} (grupo)`,
    hail_intensity: (d) => `Intensidad granizo ${d} (grupo)`,
    wind_intensity: (d) => `Intensidad rachas ${d} (grupo)`,
    severe_intensity: (d) => `Intensidad tormentas ${d} (grupo)`,
    summary: 'Resumen del riesgo de tormentas',
  },
};

function nameOf(key, language) {
  const pattern = PATTERNS[language];
  if (key === 'summary') {
    return pattern.summary;
  }
  const [, day, kind] = /^day(\d)_(.+)$/.exec(key);
  return pattern[kind](pattern.days[day]);
}

export const NAMES = Object.fromEntries(
  Object.keys(PATTERNS).map((language) => [
    language,
    Object.fromEntries(FEATURE_KEYS.map((key) => [key, nameOf(key, language)])),
  ]),
);

export const DEVICE_NAMES = {
  en: 'Severe storm outlook',
  fr: "Risque d'orages violents",
  de: 'Unwetterausblick',
  es: 'Riesgo de tormentas severas',
};

/** External ids of a house device and of its features. */
export function houseIds(gladys, selector) {
  const ids = gladys.externalIds(DEVICE_TYPE, selector);
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS.map((key) => [key, ids.feature(key)])),
  };
}

/** The house selector of a device external id (null if not ours). */
export function selectorOfExternalId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

function feature(key, ids, language) {
  const base = {
    name: NAMES[language][key],
    external_id: ids[key],
    read_only: true,
    has_feedback: false,
  };
  if (key === 'summary') {
    return {
      ...base,
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      keep_history: false,
      min: 0,
      max: 0,
    };
  }
  const max = key.endsWith('_category')
    ? MAX_LEVEL
    : key.endsWith('_intensity')
      ? MAX_INTENSITY
      : 100;
  return {
    ...base,
    category: CATEGORIES.COUNTER_SENSOR,
    type: TYPES.SENSOR.INTEGER,
    keep_history: true,
    min: 0,
    max,
  };
}

/** The discovery payload of a house. */
export function buildDevice(gladys, house, language = 'fr') {
  const ids = houseIds(gladys, house.selector);
  return {
    name: `${DEVICE_NAMES[language]} · ${house.name}`.slice(0, 80),
    external_id: ids.device,
    model: 'NOAA SPC convective outlook',
    should_poll: false,
    features: FEATURE_KEYS.map((key) => feature(key, ids, language)),
  };
}

/**
 * States of a house device. A day the SPC did not answer for publishes
 * nothing (the last values age in Gladys); nor does a hazard whose layer is
 * missing or stale.
 * @param {object} outlooks day → evaluateDay() result
 */
export function deviceStates(gladys, selector, outlooks, language) {
  const ids = houseIds(gladys, selector);
  const states = [];
  const add = (key, value) => {
    if (Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids[key], state: value });
    }
  };
  for (const day of DAYS) {
    const outlook = outlooks[day];
    if (!outlook) {
      continue;
    }
    add(`day${day}_category`, outlook.level);
    for (const [hazard, value] of Object.entries(outlook.hazards)) {
      add(`day${day}_${hazard}`, value.probability);
      add(`day${day}_${hazard}_intensity`, value.intensity);
    }
  }
  const summary = summaryText(outlooks, language);
  if (summary) {
    states.push({ device_feature_external_id: ids.summary, text: summary });
  }
  return states;
}
