// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `storm_outlook`.
//
// For one house (the one chosen, else the first created): a heading when today
// or tomorrow reaches Slight (2), one status line per day with its category,
// coloured after the SPC scale as far as the closed palette of the core goes
// (green Marginal, yellow Slight and Enhanced, red Moderate and High), the
// tornado / hail / wind probabilities of today and tomorrow, the source with
// its time of issue, and a button to the SPC outlooks. The probabilities and
// the button each have a setting to hide them.
//
// Budget: 2 texts, 1 status, 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { selectorOfExternalId } from './devices.js';
import { LEVEL_NAMES, levelText, percent } from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { formatDateTime } from './time.js';

export const TTL_SECONDS = 900;
export const OUTLOOK_PAGE = 'https://www.spc.noaa.gov/products/outlook/';
const MAX_STATUS_TEXT = 40;

export const TEXT = {
  empty: {
    en: 'No device yet: create the device of your house in the Discover tab of the integration.',
    fr: "Aucun appareil pour l'instant : créez celui de votre maison dans l'onglet Découverte de l'intégration.",
    de: 'Noch kein Gerät: Lege das Gerät deines Hauses im Tab „Entdecken“ der Integration an.',
    es: 'Aún no hay dispositivo: cree el de su casa en la pestaña Descubrir de la integración.',
  },
  gone: {
    en: 'This house is no longer followed.',
    fr: "Cette maison n'est plus suivie.",
    de: 'Dieses Haus wird nicht mehr verfolgt.',
    es: 'Esta casa ya no se sigue.',
  },
  unavailable: {
    en: 'The SPC outlooks cannot be read for now.',
    fr: 'Les perspectives du SPC sont illisibles pour le moment.',
    de: 'Die Ausblicke des SPC sind gerade nicht lesbar.',
    es: 'Las perspectivas del SPC no se pueden leer por ahora.',
  },
  alert: {
    en: 'Severe storms {day}: {level}',
    fr: 'Orages violents {day} : {level}',
    de: 'Unwetter {day}: {level}',
    es: 'Tormentas severas {day}: {level}',
  },
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  later: { en: 'In 2 days', fr: 'Dans 2 jours', de: 'In 2 Tagen', es: 'En 2 días' },
  hazardsToday: {
    en: 'Tornado / hail / wind today',
    fr: "Tornade / grêle / rafales aujourd'hui",
    de: 'Tornado / Hagel / Böen heute',
    es: 'Tornado / granizo / rachas hoy',
  },
  hazardsTomorrow: {
    en: 'Tornado / hail / wind tomorrow',
    fr: 'Tornade / grêle / rafales demain',
    de: 'Tornado / Hagel / Böen morgen',
    es: 'Tornado / granizo / rachas mañana',
  },
  notIssued: {
    en: 'Not available',
    fr: 'Indisponible',
    de: 'Nicht verfügbar',
    es: 'No disponible',
  },
  issued: {
    en: 'SPC (NOAA), {date} · not an official warning',
    fr: 'SPC (NOAA), {date} · pas une alerte officielle',
    de: 'SPC (NOAA), {date} · keine amtliche Warnung',
    es: 'SPC (NOAA), {date} · no es un aviso oficial',
  },
  link: {
    en: 'SPC outlooks',
    fr: 'Perspectives du SPC',
    de: 'SPC-Ausblicke',
    es: 'Perspectivas del SPC',
  },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;
const fill = (text, values) =>
  Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);

/** Widget colour of an SPC category (closed palette of the core). */
export function levelColor(level, thunder = false) {
  if (level === null || level === undefined) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (level === 0) {
    return thunder ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL;
  }
  if (level === 1) {
    return WIDGET_COLORS.SUCCESS;
  }
  return level <= 3 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

/** "5 / 15 / 30 %", followed by " · CIG2" when an intensity group applies. */
export function hazardsValue(hazards, language) {
  const values = ['tornado', 'hail', 'wind'].map((name) => hazards[name]?.probability);
  if (values.some((value) => !Number.isFinite(value))) {
    return t(TEXT.notIssued, language);
  }
  const intensity = Math.max(...['tornado', 'hail', 'wind'].map((n) => hazards[n].intensity ?? 0));
  const text = `${values.slice(0, 2).join(' / ')} / ${percent(values[2], language)}`;
  return clip(intensity > 0 ? `${text} · CIG${intensity}` : text);
}

function content(monitor, house, language, settings, houseName = null) {
  const outlooks = monitor.outlooks(house);
  if (Object.keys(outlooks).length === 0) {
    return [{ type: 'text', variant: 'body', text: t(TEXT.unavailable, language) }];
  }
  const components = [];
  const labels = { 1: TEXT.today, 2: TEXT.tomorrow, 3: TEXT.later };
  const alertDay = [1, 2].find((day) => outlooks[day]?.level >= 2);
  if (alertDay) {
    components.push({
      type: 'text',
      variant: 'heading',
      text: fill(t(TEXT.alert, language), {
        day: t(labels[alertDay], language).toLowerCase(),
        level: levelText(outlooks[alertDay].level, language),
      }),
    });
  }
  const items = [1, 2, 3].map((day) => {
    const outlook = outlooks[day];
    return {
      label: t(labels[day], language),
      value: outlook
        ? clip(levelText(outlook.level, language, outlook.thunder))
        : t(TEXT.notIssued, language),
      color: levelColor(outlook?.level, outlook?.thunder),
      icon: outlook?.level > 0 ? 'alert-triangle' : 'cloud-lightning',
    };
  });
  if (settings.show_probabilities !== false) {
    for (const [day, label] of [
      [1, TEXT.hazardsToday],
      [2, TEXT.hazardsTomorrow],
    ]) {
      if (outlooks[day]) {
        items.push({
          label: t(label, language),
          value: hazardsValue(outlooks[day].hazards, language),
          color: WIDGET_COLORS.NEUTRAL,
          icon: 'wind',
        });
      }
    }
  }
  components.push({ type: 'status', items });
  const issued = outlooks[1]?.issued ?? Math.max(...Object.values(outlooks).map((o) => o.issued));
  if (Number.isFinite(issued)) {
    components.push({
      type: 'text',
      variant: 'caption',
      text:
        // Several houses: say which one (its name in Gladys).
        (houseName ? `${clip(houseName, 30)} · ` : '') +
        fill(t(TEXT.issued, language), { date: formatDateTime(issued, language) }),
    });
  }
  if (settings.show_link !== false) {
    components.push({
      type: 'button',
      label: t(TEXT.link, language),
      icon: 'external-link',
      style: 'secondary',
      link: { url: OUTLOOK_PAGE },
    });
  }
  return components;
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' } = {}) {
      const lang = LEVEL_NAMES[language] ? language : 'en';
      const created = monitor.created();
      const many = created.length > 1;
      const chosen =
        typeof settings?.house === 'string' && settings.house
          ? selectorOfExternalId(monitor.gladys, settings.house)
          : null;
      let components;
      if (chosen) {
        const house = created.find((h) => h.selector === chosen);
        components = house
          ? content(monitor, house, lang, settings ?? {}, many ? monitor.deviceName(house) : null)
          : [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }];
      } else if (created.length === 0) {
        components = [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }];
      } else {
        const name = many ? monitor.deviceName(created[0]) : null;
        components = content(monitor, created[0], lang, settings ?? {}, name);
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
