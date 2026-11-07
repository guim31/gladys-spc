// -----------------------------------------------------------------------------
// Dates shown to the user, in the time zone of Gladys (TZ, injected by the
// supervisor). The SPC writes its times in UTC.
// -----------------------------------------------------------------------------

const LOCALES = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
const FALLBACK_TIME_ZONE = 'America/Chicago'; // the SPC is in Norman, Oklahoma

function format(ms, language, options, timeZone) {
  const locale = LOCALES[language] ?? LOCALES.en;
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: FALLBACK_TIME_ZONE }).format(
      new Date(ms),
    );
  }
}

/** A short date and time, e.g. "11/7/26, 10:26 AM". */
export function formatDateTime(ms, language, timeZone = process.env.TZ || FALLBACK_TIME_ZONE) {
  return format(ms, language, { dateStyle: 'short', timeStyle: 'short' }, timeZone);
}

/** A convective day "2026-11-07" as a short date, e.g. "11/7/26" (a calendar date, no zone). */
export function formatDay(date, language) {
  return format(Date.parse(`${date}T12:00:00Z`), language, { dateStyle: 'short' }, 'UTC');
}
