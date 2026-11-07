// -----------------------------------------------------------------------------
// Downloads the SPC outlook layers (public domain, no key).
//
// Eleven small files per cycle, every 15 minutes, with conditional requests
// (If-None-Match / If-Modified-Since): between two issues the SPC answers
// 304 with no body. A layer of another issue than the day's categorical one
// (read a few seconds apart, or one of the frozen files) is ignored by
// src/outlook.js. Only a categorical layer that cannot be read is a failure:
// an optional layer that fails keeps its last copy, or is left out.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { parseLayer } from './outlook.js';

const logger = createLogger({ name: 'spc-source' });

export const OUTLOOK_BASE = 'https://www.spc.noaa.gov/products/outlook';

export const USER_AGENT =
  'gladys-spc (Gladys Assistant integration; +https://github.com/guim31/gladys-spc)';

// Layer files of each day, by role. `cat` is required, the others optional.
export const LAYER_FILES = {
  1: {
    cat: 'day1otlk_cat',
    tornado: 'day1otlk_torn',
    hail: 'day1otlk_hail',
    wind: 'day1otlk_wind',
  },
  2: {
    cat: 'day2otlk_cat',
    tornado: 'day2otlk_torn',
    hail: 'day2otlk_hail',
    wind: 'day2otlk_wind',
  },
  3: { cat: 'day3otlk_cat', severe: 'day3otlk_prob', severeIntensity: 'day3otlk_cigprob' },
};

export const layerUrl = (name) => `${OUTLOOK_BASE}/${name}.lyr.geojson`;

export class SourceError extends Error {
  constructor(message, { status = null } = {}) {
    super(message);
    this.name = 'SourceError';
    this.status = status;
  }
}

export class Source {
  /**
   * @param {Function} fetchImpl
   * @param {object} [options]
   * @param {number} [options.timeoutMs]
   */
  constructor(fetchImpl, { timeoutMs = 30000 } = {}) {
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    // url → { etag, lastModified, layer }
    this.cache = new Map();
  }

  /** A parsed layer, or null when the SPC does not publish it (404). */
  async layer(name) {
    const url = layerUrl(name);
    const cached = this.cache.get(url);
    const headers = { 'User-Agent': USER_AGENT, Accept: 'application/geo+json, application/json' };
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }
    if (cached?.lastModified) {
      headers['If-Modified-Since'] = cached.lastModified;
    }
    let response;
    try {
      response = await this.fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason =
        err?.name === 'TimeoutError'
          ? `no answer in ${this.timeoutMs / 1000} s`
          : String(err?.message);
      throw new SourceError(`www.spc.noaa.gov: ${reason}`);
    }
    if (response.status === 304 && cached) {
      return cached.layer;
    }
    if (response.status === 404) {
      this.cache.delete(url);
      return null;
    }
    if (response.status !== 200) {
      throw new SourceError(`www.spc.noaa.gov: HTTP ${response.status} for ${name}`, {
        status: response.status,
      });
    }
    let layer;
    try {
      layer = parseLayer(await response.text());
    } catch (err) {
      throw new SourceError(`${name}: ${err.message}`);
    }
    this.cache.set(url, {
      etag: response.headers?.get?.('etag') ?? null,
      lastModified: response.headers?.get?.('last-modified') ?? null,
      layer,
    });
    return layer;
  }

  /**
   * The layers of the three days. A day whose categorical layer cannot be read
   * is null, and its error is returned (the first one); an optional layer that
   * fails keeps its last copy (the expiry check of outlook.js bounds its age),
   * or is null.
   * @returns {Promise<{days: object, failure: Error|null}>}
   */
  async readAll() {
    const days = {};
    let failure = null;
    for (const [day, files] of Object.entries(LAYER_FILES)) {
      const layers = {};
      try {
        layers.cat = await this.layer(files.cat);
        if (!layers.cat) {
          throw new SourceError(`${files.cat} is not published`);
        }
      } catch (err) {
        days[day] = null;
        failure ??= err;
        continue;
      }
      for (const [role, name] of Object.entries(files)) {
        if (role === 'cat') {
          continue;
        }
        try {
          layers[role] = await this.layer(name);
        } catch (err) {
          logger.debug(`Keeping the last copy of ${name}: ${err.message}`);
          layers[role] = this.cache.get(layerUrl(name))?.layer ?? null;
        }
      }
      days[day] = layers;
    }
    return { days, failure };
  }
}
