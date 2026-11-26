// Dialects (per user, per language) and TTS voices.
import { getLang } from './langs.js';
import { getDialect } from './settings.js';

// Presets shown as buttons in /dialect <code>. Any free text works too.
export const DIALECTS = {
  en: [['🇺🇸', 'American'], ['🇬🇧', 'British'], ['🇦🇺', 'Australian'], ['🇮🇳', 'Indian']],
  es: [['🇪🇸', 'Castilian (Spain)'], ['🇲🇽', 'Mexican'], ['🇦🇷', 'Argentine (Rioplatense)']],
  pt: [['🇧🇷', 'Brazilian'], ['🇵🇹', 'European']],
  fr: [['🇫🇷', 'France'], ['🇨🇦', 'Canadian (Québécois)'], ['🇧🇪', 'Belgian']],
  de: [['🇩🇪', 'Germany'], ['🇦🇹', 'Austrian'], ['🇨🇭', 'Swiss']],
  ar: [['📜', 'Modern Standard'], ['🇪🇬', 'Egyptian'], ['🇸🇦', 'Gulf'], ['🇱🇧', 'Levantine'], ['🇲🇦', 'Moroccan (Darija)']],
  zh: [['🇨🇳', 'Mainland (Simplified)'], ['🇹🇼', 'Taiwan (Traditional)'], ['🇭🇰', 'Cantonese (Hong Kong)']],
  fa: [['🇮🇷', 'Iranian'], ['🇦🇫', 'Dari (Afghan)']],
  ru: [['🇷🇺', 'Standard'], ['💬', 'Colloquial']],
  tr: [['🇹🇷', 'Istanbul'], ['💬', 'Colloquial']],
  uz: [['🏙', 'Tashkent'], ['📜', 'Literary']],
  ko: [['🇰🇷', 'Seoul'], ['💬', 'Casual (banmal)']],
  ja: [['🎩', 'Polite (desu/masu)'], ['💬', 'Casual']],
};

// { code, name } for the translator/TTS, with the user's dialect applied.
export async function langFor(code, userId) {
  const base = getLang(code)?.name ?? code;
  const dialect = await getDialect(userId, code);
  return { code, name: dialect ? `${base} (${dialect} variety)` : base, dialect };
}

// Gemini TTS prebuilt voices with their official style tags.
export const VOICES = [
  ['Zephyr', 'Bright'], ['Puck', 'Upbeat'], ['Charon', 'Informative'], ['Kore', 'Firm'],
  ['Fenrir', 'Excitable'], ['Leda', 'Youthful'], ['Orus', 'Firm'], ['Aoede', 'Breezy'],
  ['Callirrhoe', 'Easy-going'], ['Autonoe', 'Bright'], ['Enceladus', 'Breathy'], ['Iapetus', 'Clear'],
  ['Umbriel', 'Easy-going'], ['Algieba', 'Smooth'], ['Despina', 'Smooth'], ['Erinome', 'Clear'],
  ['Algenib', 'Gravelly'], ['Rasalgethi', 'Informative'], ['Laomedeia', 'Upbeat'], ['Achernar', 'Soft'],
  ['Alnilam', 'Firm'], ['Schedar', 'Even'], ['Gacrux', 'Mature'], ['Pulcherrima', 'Forward'],
  ['Achird', 'Friendly'], ['Zubenelgenubi', 'Casual'], ['Vindemiatrix', 'Gentle'], ['Sadachbia', 'Lively'],
  ['Sadaltager', 'Knowledgeable'], ['Sulafat', 'Warm'],
];
export const isVoice = (name) => VOICES.some(([v]) => v === name);

// Character presets: a voice + a delivery style instruction for Gemini TTS.
// Generic archetypes only — no imitation of real people or existing characters.
export const PERSONAS = [
  { id: 'robot', emoji: '🤖', label: 'Robot', voice: 'Charon', style: 'a flat, monotone, mechanical robot voice' },
  { id: 'pirate', emoji: '🏴‍☠️', label: 'Qaroqchi', voice: 'Algenib', style: 'a rough, boisterous old sea pirate' },
  { id: 'grandpa', emoji: '👴', label: 'Bobo', voice: 'Gacrux', style: 'a slow, warm, kind elderly grandfather' },
  { id: 'granny', emoji: '👵', label: 'Buvi', voice: 'Sulafat', style: 'a gentle, caring elderly grandmother' },
  { id: 'kid', emoji: '🧒', label: 'Bola', voice: 'Leda', style: 'an excited, playful young child' },
  { id: 'anchor', emoji: '🎙', label: 'Diktor', voice: 'Rasalgethi', style: 'a clear, confident TV news anchor' },
  { id: 'whisper', emoji: '🤫', label: 'Pichirlash', voice: 'Enceladus', style: 'a soft, secretive whisper' },
  { id: 'story', emoji: '🧙', label: 'Ertakchi', voice: 'Schedar', style: 'a mysterious fairy-tale storyteller, slow and dramatic' },
  { id: 'happy', emoji: '😄', label: 'Quvnoq', voice: 'Puck', style: 'a very cheerful, upbeat and energetic person' },
  { id: 'sad', emoji: '😢', label: 'G‘amgin', voice: 'Achernar', style: 'a sad, tired and quiet person' },
  { id: 'angry', emoji: '😠', label: 'Jahldor', voice: 'Fenrir', style: 'an irritated, grumpy and impatient person' },
  { id: 'sport', emoji: '⚽', label: 'Sharhlovchi', voice: 'Sadachbia', style: 'an over-excited sports commentator' },
];
export const getPersonaDef = (id) => PERSONAS.find((p) => p.id === id) ?? null;

// Persona by id ("pirate") or Uzbek label ("qaroqchi", "g'amgin"), case/apostrophe-insensitive.
const norm = (s) => s.toLowerCase().replace(/[‘’'`ʻʼ]/g, '');

// Personas whose Uzbek label or id starts with what's typed — for hints.
export function matchPersonas(prefix) {
  const t = norm(prefix);
  return PERSONAS.filter((p) => norm(p.label).startsWith(t) || p.id.startsWith(t));
}
export function findPersona(token) {
  const t = norm(token);
  return PERSONAS.find((p) => p.id === t || norm(p.label) === t) ?? null;
}
