// -----------------------------------------------------------------------------
// Texts the container produces, in the four languages of Gladys: category
// names, the summary sentence, connection statuses. German says "du", Spanish
// "usted".
// -----------------------------------------------------------------------------

// The SPC categories, 1 to 5 (the NWS Spanish names for es). 0 is "no severe
// risk"; general thunderstorms have their own text.
export const LEVEL_NAMES = {
  en: { 0: 'No severe risk', 1: 'Marginal', 2: 'Slight', 3: 'Enhanced', 4: 'Moderate', 5: 'High' },
  fr: { 0: 'Aucun risque', 1: 'Marginal', 2: 'Faible', 3: 'Accru', 4: 'Modéré', 5: 'Élevé' },
  de: { 0: 'Kein Risiko', 1: 'Marginal', 2: 'Gering', 3: 'Erhöht', 4: 'Mäßig', 5: 'Hoch' },
  es: { 0: 'Sin riesgo', 1: 'Marginal', 2: 'Ligero', 3: 'Mejorado', 4: 'Moderado', 5: 'Alto' },
};

export const THUNDER = {
  en: 'General thunderstorms',
  fr: 'Orages ordinaires',
  de: 'Gewöhnliche Gewitter',
  es: 'Tormentas comunes',
};

export const DAY_WORDS = {
  en: { 1: 'today', 2: 'tomorrow', 3: 'in 2 days' },
  fr: { 1: "aujourd'hui", 2: 'demain', 3: 'dans 2 jours' },
  de: { 1: 'heute', 2: 'morgen', 3: 'in 2 Tagen' },
  es: { 1: 'hoy', 2: 'mañana', 3: 'en 2 días' },
};

export const HAZARD_WORDS = {
  en: { tornado: 'tornado', hail: 'hail', wind: 'wind', severe: 'severe' },
  fr: { tornado: 'tornade', hail: 'grêle', wind: 'rafales', severe: 'orage violent' },
  de: { tornado: 'Tornado', hail: 'Hagel', wind: 'Böen', severe: 'Unwetter' },
  es: { tornado: 'tornado', hail: 'granizo', wind: 'rachas', severe: 'tormenta severa' },
};

// {level}: the category name, lower case where the grammar wants it; {day}.
const SENTENCES = {
  en: {
    risk: (level, day) => `${level} risk of severe storms ${day}`,
    thunder: (day) => `General thunderstorms ${day}, not severe`,
    none: (day) => `No severe storms expected ${day}`,
  },
  fr: {
    risk: (level, day) => `Risque ${level.toLowerCase()} d'orages violents ${day}`,
    thunder: (day) => `Orages ordinaires ${day}, sans violence attendue`,
    none: (day) => `Pas d'orage violent attendu ${day}`,
  },
  de: {
    risk: (level, day) => `Unwetterrisiko ${day}: ${level}`,
    thunder: (day) => `Gewöhnliche Gewitter ${day}, keine Unwetter`,
    none: (day) => `Keine Unwetter erwartet ${day}`,
  },
  es: {
    risk: (level, day) => `Riesgo ${level.toLowerCase()} de tormentas severas ${day}`,
    thunder: (day) => `Tormentas comunes ${day}, no severas`,
    none: (day) => `No se esperan tormentas severas ${day}`,
  },
};

// Connection statuses: setConnectionStatus receives the whole object (core 5.2+).
export const STATUS = {
  sourceDown: {
    en: 'The SPC outlooks cannot be read for now. Retrying every 15 minutes.',
    fr: 'Les perspectives du SPC sont illisibles pour le moment. Nouvel essai toutes les 15 minutes.',
    de: 'Die Ausblicke des SPC sind gerade nicht lesbar. Neuer Versuch alle 15 Minuten.',
    es: 'Las perspectivas del SPC no se pueden leer por ahora. Nuevo intento cada 15 minutos.',
  },
  noHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses.',
    fr: "Aucune maison de Gladys n'a de position : renseignez-la dans Paramètres → Maisons.",
    de: 'Kein Haus in Gladys hat einen Standort: Lege ihn unter Einstellungen → Häuser fest.',
    es: 'Ninguna casa de Gladys tiene ubicación: indíquela en Ajustes → Casas.',
  },
  outsideCoverage: {
    en: 'No house is in the contiguous United States, the only area the SPC outlooks cover.',
    fr: "Aucune maison n'est dans les États-Unis contigus, la seule zone couverte par le SPC.",
    de: 'Kein Haus liegt in den angrenzenden USA, dem einzigen Gebiet der SPC-Ausblicke.',
    es: 'Ninguna casa está en los Estados Unidos contiguos, la única zona que cubre el SPC.',
  },
  initFailed: {
    en: 'The integration could not start. See its logs.',
    fr: "L'intégration n'a pas pu démarrer. Consultez ses journaux.",
    de: 'Die Integration konnte nicht starten. Sieh dir ihre Protokolle an.',
    es: 'La integración no pudo iniciarse. Consulte sus registros.',
  },
};

const t = (table, language) => table[language] ?? table.en;

/** "2 · Slight", or "General thunderstorms" for level 0 with thunder. */
export function levelText(level, language, thunder = false) {
  if (level === 0) {
    return thunder ? t(THUNDER, language) : t(LEVEL_NAMES, language)[0];
  }
  return `${level} · ${t(LEVEL_NAMES, language)[level]}`;
}

/** "15%" in English, "15 %" elsewhere. */
export function percent(value, language) {
  return language === 'en' ? `${value}%` : `${value} %`;
}

/** "tornado 5%, hail 15%": the hazards above 0, or ''. */
export function hazardsText(hazards, language) {
  return Object.entries(hazards)
    .filter(([, value]) => value?.probability > 0)
    .map(
      ([name, value]) =>
        `${t(HAZARD_WORDS, language)[name]} ${percent(value.probability, language)}`,
    )
    .join(', ');
}

/**
 * The summary sentence of a house: today's outlook with its hazards, then
 * tomorrow and the day after when they carry a severe risk.
 * @param {object} outlooks day → evaluateDay() result (or missing)
 * @returns {string|null} null when today is not known
 */
export function summaryText(outlooks, language) {
  const today = outlooks[1];
  if (!today) {
    return null;
  }
  const words = t(SENTENCES, language);
  const days = t(DAY_WORDS, language);
  let text;
  if (today.level > 0) {
    text = words.risk(t(LEVEL_NAMES, language)[today.level], days[1]);
    const hazards = hazardsText(today.hazards, language);
    if (hazards) {
      text += ` (${hazards})`;
    }
  } else {
    text = today.thunder ? words.thunder(days[1]) : words.none(days[1]);
  }
  for (const day of [2, 3]) {
    const outlook = outlooks[day];
    if (outlook?.level > 0) {
      text += `; ${days[day]}: ${levelText(outlook.level, language)}`;
    }
  }
  return text;
}
