// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The SPC issues day 1 five times a day (06, 13, 1630, 20, 01 UTC), day 2
// twice and day 3 once or twice: reading every 15 minutes sees each issue
// quickly, with conditional requests that cost a 304 in between.
export const REFRESH_MINUTES = 15;

export const DEFAULT_CONFIG = {
  language: 'fr',
};

/**
 * @param {object} raw configuration from Gladys
 * @returns {{language: string}}
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  const language = LANGUAGES.includes(config.language) ? config.language : DEFAULT_CONFIG.language;
  return { language };
}
