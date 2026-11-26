// Language codes usable as inline commands: `@bot en matn`.
// Add more here — the code is what you type, the name goes to the translator.
export const LANGS = {
  en: { name: 'English', flag: '🇬🇧' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  uz: { name: 'Uzbek (Latin script)', flag: '🇺🇿' },
  tr: { name: 'Turkish', flag: '🇹🇷' },
  de: { name: 'German', flag: '🇩🇪' },
  fr: { name: 'French', flag: '🇫🇷' },
  es: { name: 'Spanish', flag: '🇪🇸' },
  it: { name: 'Italian', flag: '🇮🇹' },
  ar: { name: 'Arabic', flag: '🇸🇦' },
  zh: { name: 'Chinese (Simplified)', flag: '🇨🇳' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  ko: { name: 'Korean', flag: '🇰🇷' },
  kk: { name: 'Kazakh', flag: '🇰🇿' },
  ky: { name: 'Kyrgyz', flag: '🇰🇬' },
  tg: { name: 'Tajik', flag: '🇹🇯' },
  fa: { name: 'Persian', flag: '🇮🇷' },
  hi: { name: 'Hindi', flag: '🇮🇳' },
  // Central Asia & neighbours
  uzc: { name: 'Uzbek (Cyrillic script)', flag: '🇺🇿' },
  tk: { name: 'Turkmen', flag: '🇹🇲' },
  az: { name: 'Azerbaijani', flag: '🇦🇿' },
  tt: { name: 'Tatar', flag: '🌐' },
  ug: { name: 'Uyghur', flag: '🌐' },
  ps: { name: 'Pashto', flag: '🇦🇫' },
  ur: { name: 'Urdu', flag: '🇵🇰' },
  mn: { name: 'Mongolian', flag: '🇲🇳' },
  ka: { name: 'Georgian', flag: '🇬🇪' },
  hy: { name: 'Armenian', flag: '🇦🇲' },
  ku: { name: 'Kurdish', flag: '🌐' },
  // Europe
  pt: { name: 'Portuguese', flag: '🇵🇹' },
  uk: { name: 'Ukrainian', flag: '🇺🇦' },
  pl: { name: 'Polish', flag: '🇵🇱' },
  nl: { name: 'Dutch', flag: '🇳🇱' },
  sv: { name: 'Swedish', flag: '🇸🇪' },
  fi: { name: 'Finnish', flag: '🇫🇮' },
  nb: { name: 'Norwegian (Bokmål)', flag: '🇳🇴' },
  dan: { name: 'Danish', flag: '🇩🇰' },
  isl: { name: 'Icelandic', flag: '🇮🇸' },
  cs: { name: 'Czech', flag: '🇨🇿' },
  sk: { name: 'Slovak', flag: '🇸🇰' },
  hu: { name: 'Hungarian', flag: '🇭🇺' },
  ro: { name: 'Romanian', flag: '🇷🇴' },
  bg: { name: 'Bulgarian', flag: '🇧🇬' },
  el: { name: 'Greek', flag: '🇬🇷' },
  sr: { name: 'Serbian', flag: '🇷🇸' },
  hr: { name: 'Croatian', flag: '🇭🇷' },
  bs: { name: 'Bosnian', flag: '🇧🇦' },
  sl: { name: 'Slovenian', flag: '🇸🇮' },
  mk: { name: 'Macedonian', flag: '🇲🇰' },
  sq: { name: 'Albanian', flag: '🇦🇱' },
  lt: { name: 'Lithuanian', flag: '🇱🇹' },
  lv: { name: 'Latvian', flag: '🇱🇻' },
  et: { name: 'Estonian', flag: '🇪🇪' },
  bel: { name: 'Belarusian', flag: '🇧🇾' },
  ga: { name: 'Irish', flag: '🇮🇪' },
  ca: { name: 'Catalan', flag: '🌐' },
  la: { name: 'Latin', flag: '🌐' },
  // Middle East & Africa
  heb: { name: 'Hebrew', flag: '🇮🇱' },
  iw: { name: 'Hebrew', flag: '🇮🇱' },
  sw: { name: 'Swahili', flag: '🇰🇪' },
  amh: { name: 'Amharic', flag: '🇪🇹' },
  som: { name: 'Somali', flag: '🇸🇴' },
  hau: { name: 'Hausa', flag: '🇳🇬' },
  yor: { name: 'Yoruba', flag: '🇳🇬' },
  af: { name: 'Afrikaans', flag: '🇿🇦' },
  // South & East Asia
  'zh-tw': { name: 'Chinese (Traditional)', flag: '🇹🇼' },
  bn: { name: 'Bengali', flag: '🇧🇩' },
  pa: { name: 'Punjabi', flag: '🇮🇳' },
  mr: { name: 'Marathi', flag: '🇮🇳' },
  gu: { name: 'Gujarati', flag: '🇮🇳' },
  te: { name: 'Telugu', flag: '🇮🇳' },
  kn: { name: 'Kannada', flag: '🇮🇳' },
  ml: { name: 'Malayalam', flag: '🇮🇳' },
  tam: { name: 'Tamil', flag: '🇮🇳' },
  nep: { name: 'Nepali', flag: '🇳🇵' },
  sin: { name: 'Sinhala', flag: '🇱🇰' },
  mya: { name: 'Burmese', flag: '🇲🇲' },
  vi: { name: 'Vietnamese', flag: '🇻🇳' },
  th: { name: 'Thai', flag: '🇹🇭' },
  km: { name: 'Khmer', flag: '🇰🇭' },
  lo: { name: 'Lao', flag: '🇱🇦' },
  id: { name: 'Indonesian', flag: '🇮🇩' },
  ms: { name: 'Malay', flag: '🇲🇾' },
  tl: { name: 'Filipino', flag: '🇵🇭' },
};

// Any other ISO 639-1 code works too (Gemini knows far more languages than
// the list above) — the name comes from Intl.DisplayNames.
const displayNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

// 2-letter codes that are also common Uzbek/English words — as the first word
// of a query they'd be read as a language ("ha mayli" → Hausa). Excluded;
// the important ones have 3-letter aliases above (dan, heb, tam, nep, …).
const AMBIGUOUS = new Set([
  'ha', 'to', 'yo', 'da', 'ki', 'na', 'so', 'ta', 'ne', 'ay', 'om', 'ba',
  'mi', 'se', 'si', 'sa', 'an', 'or', 'is', 'as', 'am', 'be', 'no', 'my', 'he',
]);

// Full list for /langs.
export function langsText() {
  const items = Object.entries(LANGS).map(([c, l]) => `${l.flag} ${c} — ${l.name}`);
  return [
    `Tayyor tillar (${items.length} ta):`,
    '',
    ...items,
    '',
    'Bulardan tashqari istalgan 2 harfli ISO kod ham ishlaydi (🌐 bilan chiqadi).',
  ].join('\n');
}

// Returns { name, flag } or null.
export function getLang(code) {
  const c = String(code).toLowerCase();
  if (LANGS[c]) return LANGS[c];
  if (!/^[a-z]{2}$/.test(c) || AMBIGUOUS.has(c)) return null;
  const name = displayNames.of(c);
  return name && name.toLowerCase() !== c ? { name, flag: '🌐' } : null;
}
