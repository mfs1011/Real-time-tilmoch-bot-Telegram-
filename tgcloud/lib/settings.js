import { db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';

export async function getSetting(key) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  await db.insert(settings).values({ key, value: String(value) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
    .run();
}

export async function getOwnerId() {
  const v = await getSetting('owner_id');
  return v ? Number(v) : null;
}

// Per-user default language (`lang:<userId>`), then the bot-wide one, then English.
export async function getDefaultLang(userId) {
  return (userId && (await getSetting(`lang:${userId}`)))
    || (await getSetting('default_lang'))
    || 'en';
}

export async function setDefaultLang(userId, code) {
  await setSetting(`lang:${userId}`, code);
}

// TTS voice per user (Gemini prebuilt voice name).
export const DEFAULT_VOICE = 'Kore';

export async function getVoice(userId) {
  return (userId && (await getSetting(`voice:${userId}`))) || DEFAULT_VOICE;
}

export async function setVoice(userId, name) {
  await setSetting(`voice:${userId}`, name);
}

// Character preset per user (see PERSONAS in dialects.js); '' = plain voice.
export async function getPersona(userId) {
  return (userId && (await getSetting(`persona:${userId}`))) || '';
}

export async function setPersona(userId, id) {
  await setSetting(`persona:${userId}`, id ?? '');
}

// Dialect/variant per user and language, e.g. en → "American".
export async function getDialect(userId, code) {
  return (userId && code && (await getSetting(`dialect:${userId}:${code}`))) || null;
}

export async function setDialect(userId, code, dialect) {
  await setSetting(`dialect:${userId}:${code}`, dialect ?? '');
}

// Languages offered when the inline query has no language code (one LLM call for all).
export const MAX_FAVS = 5;

export async function getFavLangs(userId) {
  const saved = await getSetting(`fav:${userId}`);
  if (saved) return saved.split(',').filter(Boolean);
  const first = await getDefaultLang(userId);
  return [...new Set([first, 'en', 'ru', 'tr'])].slice(0, 4);
}

export async function setFavLangs(userId, codes) {
  await setSetting(`fav:${userId}`, codes.join(','));
}
