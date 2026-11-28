// Private-chat helpers: translation replies with a "🔊 Ovozli" button, voice
// replies (TTS), and understanding voice/audio/video notes/photos (STT/OCR).
import { api, db, InputFile } from 'sdk';
import { eq } from 'sdk/db';
import { snippets, cache } from '../schema.js';
import { getProvider } from './llm.js';
import { synthesize, modelLabel, isFreeModel, ptDay } from './tts.js';
import { understandMedia } from './translate.js';
import { getLang } from './langs.js';
import { getVoice, getPersona } from './settings.js';
import { getPersonaDef } from './dialects.js';

// TTS options for a user: a one-off persona (from "say qaroqchi …") wins,
// then their saved character preset, then their plain voice.
// lang: code of the spoken text (null = Uzbek/as typed) — used by the free fallback.
export async function speechOpts(userId, accent = null, personaId = null, lang = null) {
  const persona = getPersonaDef(personaId) ?? getPersonaDef(await getPersona(userId));
  return persona
    ? { voice: persona.voice, style: persona.style, persona: persona.id, accent, lang }
    : { voice: await getVoice(userId), style: null, persona: null, accent, lang };
}

const MAX_MEDIA_SECONDS = 300;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // Bot API getFile limit

const flagOf = (code) => getLang(code)?.flag ?? '🌐';

async function saveSnippet(text) {
  const [row] = await db.insert(snippets).values({ text }).returning({ id: snippets.id });
  return row.id;
}

// Returns { text, accent, lang } or null.
export async function getSnippet(id) {
  const raw = (await db.select().from(snippets).where(eq(snippets.id, id)).get())?.text;
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.t === 'string') return { text: o.t, accent: o.a ?? null, lang: o.l ?? null };
  } catch { /* plain text snippet */ }
  return { text: raw, accent: null, lang: null };
}

// Sends `body` with a button that turns `speak` into a voice message.
// accent: dialect of the spoken language; lang: its code (for the free voice).
export async function sendWithVoiceButton(chat_id, body, speak, accent = null, lang = null) {
  const canSpeak = Boolean(speak); // a free voice always exists as the last resort
  const reply_markup = canSpeak
    ? { inline_keyboard: [[{ text: '🔊 Ovozli', callback_data: `tts:${await saveSnippet(JSON.stringify({ t: speak, a: accent, l: lang }))}` }]] }
    : undefined;
  const text = body.length > 4000 ? `${body.slice(0, 4000)}…` : body;
  return api.sendMessage({ chat_id, text, reply_markup });
}

// ---- voice cache: same text + voice + style + accent → reuse Telegram file_id ----
// Free (robotic) voices are kept only for the day, so a better Gemini voice is
// made once the quota resets.
const voiceKey = (text, o) => `voice2:${o.voice ?? ''}:${o.style ?? ''}:${o.accent ?? ''}:${o.lang ?? ''}:${text}`;

async function getCachedVoice(key) {
  const raw = (await db.select().from(cache).where(eq(cache.key, key)).get())?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (isFreeModel(v.m) && v.d !== ptDay()) return null;
    return v; // { f: file_id, m: model, s: seconds }
  } catch {
    return null;
  }
}

async function putCachedVoice(key, fileId, model, seconds) {
  const value = JSON.stringify({ f: fileId, m: model, s: seconds, d: ptDay() });
  await db.insert(cache).values({ key, value })
    .onConflictDoUpdate({ target: cache.key, set: { value } })
    .run();
}

const captionFor = (model, cached, extra) =>
  [extra, `🔊 ${modelLabel(model)}${cached ? ' · kesh' : ''}`].filter(Boolean).join('\n');

// Synthesizes (or reuses) a voice. Returns { fileId, model, seconds, cached } —
// for a fresh voice, `send(InputFile)` must upload it and return the Message.
async function makeVoice(text, opts, send) {
  const key = voiceKey(text, opts);
  const hit = await getCachedVoice(key);
  if (hit) return { fileId: hit.f, model: hit.m, seconds: hit.s, cached: true };

  const p = await getProvider();
  const apiKey = p?.provider === 'gemini' ? p.key : null;
  const { mp3, seconds, model } = await synthesize(apiKey, text, opts);
  const msg = await send(new InputFile(mp3, 'tarjima.mp3', { type: 'audio/mpeg' }), seconds, model);
  const fileId = msg.voice?.file_id ?? msg.audio?.file_id;
  if (!fileId) throw new Error('Telegram ovozni qabul qilmadi.');
  await putCachedVoice(key, fileId, model, seconds);
  return { fileId, model, seconds, cached: false, msg };
}

// Text → voice message in the chat. opts: { voice, accent, style, lang };
// extra: sendVoice params (caption is extended with the model name).
export async function sendSpeech(chat_id, text, opts = {}, extra = {}) {
  await api.sendChatAction({ chat_id, action: 'record_voice' }).catch(() => {});
  const r = await makeVoice(text, opts, (voice, duration, model) => api.sendVoice({
    chat_id, voice, duration, ...extra, caption: captionFor(model, false, extra.caption),
  }));
  if (r.cached) {
    return api.sendVoice({ chat_id, voice: r.fileId, ...extra, caption: captionFor(r.model, true, extra.caption) });
  }
  return r.msg;
}

// Inline voice results need a Telegram file_id: a fresh voice is uploaded as a
// silent message to `uploadChatId` (the user's chat with the bot) and deleted.
// Returns { fileId, model, cached }.
export async function voiceFileId(uploadChatId, text, opts = {}) {
  const r = await makeVoice(text, opts, (voice, duration) => api.sendVoice({
    chat_id: uploadChatId, voice, duration, disable_notification: true,
  }));
  if (r.msg) await api.deleteMessage({ chat_id: uploadChatId, message_id: r.msg.message_id }).catch(() => {});
  return r;
}

export const voiceCaption = (model, cached) => captionFor(model, cached, null);

// Picks the file to understand from a message, or null.
export function pickMedia(m) {
  if (m.voice) return { file: m.voice, mime: m.voice.mime_type || 'audio/ogg', kind: 'audio', icon: '🎙' };
  if (m.audio) return { file: m.audio, mime: m.audio.mime_type || 'audio/mpeg', kind: 'audio', icon: '🎵' };
  if (m.video_note) return { file: m.video_note, mime: 'video/mp4', kind: 'audio', icon: '📹' };
  if (m.photo?.length) return { file: m.photo[m.photo.length - 1], mime: 'image/jpeg', kind: 'image', icon: '🖼' };
  const doc = m.document;
  if (doc?.mime_type?.startsWith('audio/')) return { file: doc, mime: doc.mime_type, kind: 'audio', icon: '🎵' };
  if (doc?.mime_type?.startsWith('image/')) return { file: doc, mime: doc.mime_type, kind: 'image', icon: '🖼' };
  return null;
}

// other: { code, name } — where Uzbek content gets translated to.
export async function handleMedia(chat_id, media, other) {
  if ((media.file.duration ?? 0) > MAX_MEDIA_SECONDS) {
    return api.sendMessage({ chat_id, text: `Juda uzun — ${MAX_MEDIA_SECONDS / 60} daqiqagacha yuboring.` });
  }
  if ((media.file.file_size ?? 0) > MAX_MEDIA_BYTES) {
    return api.sendMessage({ chat_id, text: 'Fayl 20 MB dan katta — Telegram botga bundan kattasini bermaydi.' });
  }
  await api.sendChatAction({ chat_id, action: 'typing' }).catch(() => {});
  const bytes = await api.getFileContent(media.file.file_id);
  const r = await understandMedia(bytes, media.mime, media.kind, other);
  if (!r.original && !r.translation) {
    return api.sendMessage({ chat_id, text: media.kind === 'image' ? 'Rasmda matn topilmadi.' : 'Nutq aniqlanmadi.' });
  }
  const body = [
    `${media.icon} ${flagOf(r.from)} ${r.from} → ${flagOf(r.to)} ${r.to}`,
    '',
    `📝 ${r.original}`,
    '',
    `${flagOf(r.to)} ${r.translation}`,
  ].join('\n');
  return sendWithVoiceButton(chat_id, body, r.translation, r.to === other.code ? other.dialect : null, r.to);
}
