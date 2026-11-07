// -----------------------------------------------------------------------------
// The convective outlooks of the Storm Prediction Center (NOAA), read from the
// GeoJSON layers it publishes, and evaluated at one point.
//
// Layers (https://www.spc.noaa.gov/products/outlook/), one FeatureCollection
// each, every feature a (Multi)Polygon with DN, LABEL, VALID, EXPIRE, ISSUE:
//   - dayNotlk_cat: the categorical outlook, LABEL TSTM (general
//     thunderstorms), MRGL, SLGT, ENH, MDT, HIGH; the polygons nest, the
//     highest one containing the point wins;
//   - day1/day2 _torn, _hail, _wind: probabilities within 25 miles of a point
//     (LABEL "0.05"...), and since March 2026 the conditional intensity groups
//     of the hazard in the same file (LABEL "CIG1" to "CIG3"), which replaced
//     the hatched "significant" areas;
//   - day3otlk_prob: probability of any severe weather, day3otlk_cigprob its
//     intensity groups.
// An empty layer holds one feature with an empty GeometryCollection.
//
// Trap: the old _sigtorn/_sighail/_sigwind/_sigprob layers are still served,
// frozen in March 2026. Any layer whose EXPIRE is not the one of the day's
// categorical layer is ignored for the same reason.
//
// Everything is computed here, in the container: the location of the house
// never leaves Gladys.
// -----------------------------------------------------------------------------

export const DAYS = [1, 2, 3];
export const HAZARDS_BY_DAY = {
  1: ['tornado', 'hail', 'wind'],
  2: ['tornado', 'hail', 'wind'],
  3: ['severe'],
};

// The SPC numbers its categories 1 (Marginal) to 5 (High); general
// thunderstorms (TSTM) are not severe: level 0, with the thunder flag.
export const CATEGORY_LEVELS = { TSTM: 0, MRGL: 1, SLGT: 2, ENH: 3, MDT: 4, HIGH: 5 };
export const MAX_LEVEL = 5;
export const MAX_INTENSITY = 3;

// The contiguous United States, the only area the outlooks cover.
export const COVERAGE = { west: -125.5, east: -66.5, south: 24, north: 50 };

export class OutlookError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OutlookError';
  }
}

/** "202611071630" (or an ISO date) → ms, null if neither. */
export function parseSpcTime(value) {
  const text = String(value ?? '').trim();
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    const [year, month, day, hour, minute] = compact.slice(1).map(Number);
    return Date.UTC(year, month - 1, day, hour, minute);
  }
  const ms = text ? Date.parse(text) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Reads one GeoJSON layer.
 * @returns {{valid: number|null, expire: number|null, issued: number|null,
 *   features: Array<{label: string, geometry: object}>}}
 */
export function parseLayer(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new OutlookError('not a GeoJSON document');
  }
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new OutlookError('not a FeatureCollection');
  }
  const layer = { valid: null, expire: null, issued: null, features: [] };
  for (const feature of data.features) {
    const properties = feature?.properties ?? {};
    layer.valid ??= parseSpcTime(properties.VALID_ISO ?? properties.VALID);
    layer.expire ??= parseSpcTime(properties.EXPIRE_ISO ?? properties.EXPIRE);
    layer.issued ??= parseSpcTime(properties.ISSUE_ISO ?? properties.ISSUE);
    if (feature?.geometry) {
      layer.features.push({
        label: String(properties.LABEL ?? '').trim(),
        geometry: feature.geometry,
      });
    }
  }
  return layer;
}

/** Ray casting: is the point inside the ring (an array of [lon, lat])? */
function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// A polygon: its outer ring, minus its holes.
function polygonContains(rings, lon, lat) {
  if (!Array.isArray(rings) || rings.length === 0 || !ringContains(rings[0], lon, lat)) {
    return false;
  }
  return !rings.slice(1).some((hole) => ringContains(hole, lon, lat));
}

/** Does a GeoJSON geometry contain the point? */
export function geometryContains(geometry, lon, lat) {
  switch (geometry?.type) {
    case 'Polygon':
      return polygonContains(geometry.coordinates, lon, lat);
    case 'MultiPolygon':
      return (geometry.coordinates ?? []).some((rings) => polygonContains(rings, lon, lat));
    case 'GeometryCollection':
      return (geometry.geometries ?? []).some((child) => geometryContains(child, lon, lat));
    default:
      return false;
  }
}

export function inCoverage({ latitude, longitude }) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    longitude >= COVERAGE.west &&
    longitude <= COVERAGE.east &&
    latitude >= COVERAGE.south &&
    latitude <= COVERAGE.north
  );
}

const containing = (layer, point) =>
  layer.features.filter((f) => geometryContains(f.geometry, point.longitude, point.latitude));

/** Highest probability (percent) and intensity group of a hazard layer at the point. */
function hazardAt(layer, point) {
  let probability = 0;
  let intensity = 0;
  for (const { label } of containing(layer, point)) {
    const group = /^CIG(\d)$/i.exec(label);
    if (group) {
      intensity = Math.max(intensity, Number(group[1]));
    } else if (/^0?\.\d+$/.test(label)) {
      probability = Math.max(probability, Math.round(Number(label) * 100));
    }
  }
  return { probability, intensity: Math.min(intensity, MAX_INTENSITY) };
}

/**
 * The outlook of one day at a point.
 * @param {object} layers { cat, tornado?, hail?, wind?, severe?, severeIntensity? } parsed layers
 * @param {{latitude: number, longitude: number}} point
 * @returns {{level: number, thunder: boolean, issued: number|null, valid: number|null,
 *   expire: number, date: string, hazards: object}}
 *   hazards: name → { probability, intensity }, a hazard whose layer is
 *   missing or stale is left out.
 */
export function evaluateDay(day, layers, point) {
  const cat = layers.cat;
  let level = 0;
  let thunder = false;
  for (const { label } of containing(cat, point)) {
    const value = CATEGORY_LEVELS[label.toUpperCase()];
    if (value !== undefined) {
      thunder = true;
      level = Math.max(level, value);
    }
  }
  const fresh = (layer) => Boolean(layer) && layer.expire === cat.expire;
  const hazards = {};
  for (const hazard of HAZARDS_BY_DAY[day]) {
    const layer = layers[hazard];
    if (!fresh(layer)) {
      continue;
    }
    hazards[hazard] = hazardAt(layer, point);
    if (hazard === 'severe') {
      // Day 3: the intensity groups come in their own layer.
      const groups = layers.severeIntensity;
      hazards.severe.intensity = fresh(groups) ? hazardAt(groups, point).intensity : null;
    }
  }
  return {
    level,
    thunder,
    issued: cat.issued,
    valid: cat.valid,
    expire: cat.expire,
    date: convectiveDate(cat.expire),
    hazards,
  };
}

/**
 * The convective day an outlook covers ("2026-11-07"): it runs from 12 UTC to
 * 12 UTC the next day, so it is the UTC date of the day before its expiry
 * (the 01 UTC update of day 1 starts on the next calendar day).
 */
export function convectiveDate(expire) {
  return new Date(expire - 24 * 3600 * 1000).toISOString().slice(0, 10);
}
