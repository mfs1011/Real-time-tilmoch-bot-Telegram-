// Text → voice message: Gemini TTS (WAV, 24 kHz mono 16-bit) → MP3 (lamejs) →
// Telegram sendVoice (accepts OGG/Opus, MP3 or M4A).
import { fetch } from 'sdk';
import { Mp3Encoder } from './vendor/lame.js';
import { base64ToBytes } from './b64.js';
import { getSetting, setSetting } from './settings.js';
import { gapirTts, isUzbek, GAPIR_MODEL } from './gapir.js';

export const TTS_MAX_CHARS = 1500;

// Free tier gives each TTS model its own small daily quota (~10 requests), so
// every Gemini TTS model is used in turn, and only when all are spent do we
// fall back to Google Translate's free voice (no key, no quota, no Uzbek).
// Style/accent only work on the Interactions API (speech_metadata) — in the
// text they get read aloud — so generateContent models get a plain voice.
export const CHAIN = [
  { api: 'interactions', model: 'gemini-3.8-flash-lite-tts' },
  { api: 'interactions', model: 'gemini-3.8-flash-tts' },
  { api: 'generate', model: 'gemini-3.1-flash-tts-preview' },
  { api: 'generate', model: 'gemini-2.5-flash-preview-tts' },
  { api: 'generate', model: 'gemini-2.5-pro-preview-tts' },
];
export const FREE_MODEL = 'google-translate';
// Uzbek has no Google voice: Latin text is read by the Turkish voice, Cyrillic by the Russian one.
const FREE_UZ_LATIN = 'google-translate:tr';
const FREE_UZ_CYRILLIC = 'google-translate:ru';
export const isFreeModel = (m) => String(m).startsWith(FREE_MODEL);
export const modelLabel = (m) => {
  if (m === FREE_UZ_LATIN) return 'Google Translate (bepul, turkcha talaffuz)';
  if (m === FREE_UZ_CYRILLIC) return 'Google Translate (bepul, ruscha talaffuz)';
  if (isFreeModel(m)) return 'Google Translate (bepul)';
  if (m === GAPIR_MODEL) return 'Gapiring (o‘zbekcha)';
  return m.replace(/^gemini-/, '');
};

export class TtsQuotaError extends Error {}

// ---- quota bookkeeping (quotas reset at midnight Pacific time) ----
export const ptDay = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

async function countUse(model) {
  const k = `ttsuse:${ptDay()}:${model}`;
  await setSetting(k, Number((await getSetting(k)) || 0) + 1);
}

// "Please retry in 45m11.3s" → ms; unknown → 1 hour.
function retryMs(message) {
  const m = /retry in\s+(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i.exec(message ?? '');
  const ms = m ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 : 0;
  return ms > 0 ? ms : 3600 * 1000;
}

const isDown = async (model) => Number((await getSetting(`ttsdown:${model}`)) || 0) > Date.now();
const markDown = (model, ms) => setSetting(`ttsdown:${model}`, Date.now() + ms);

// For /limits: [{ model, used, downUntil }] incl. the free fallback.
export async function ttsUsage() {
  const day = ptDay();
  const rows = [];
  for (const { model } of [{ model: GAPIR_MODEL }, ...CHAIN, { model: FREE_MODEL }]) {
    rows.push({
      model,
      used: Number((await getSetting(`ttsuse:${day}:${model}`)) || 0),
      downUntil: Number((await getSetting(`ttsdown:${model}`)) || 0),
    });
  }
  return rows;
}

// Finds the base64 audio wherever the Interactions response keeps it.
function findAudio(obj) {
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (typeof o.data === 'string' && o.data.length > 100) {
      found = { data: o.data, mime: o.mime_type ?? o.mimeType ?? '' };
      return;
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(obj);
  return found;
}

async function callInteractions(apiKey, model, text, voice, style) {
  const content = { type: 'text', text };
  if (style) content.annotations = [{ type: 'speech_metadata', style }];
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model,
      input: [{ type: 'user_input', content: [content] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  const data = await res.json();
  return { res, data, audio: res.ok ? findAudio(data) : null };
}

async function callGenerate(apiKey, model, text, voice) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  const data = await res.json();
  const inl = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  return { res, data, audio: inl?.data ? { data: inl.data, mime: inl.mimeType ?? '' } : null };
}

// Returns { mime, bytes, model } or null if every Gemini model is out of quota.
async function geminiTts(apiKey, text, voice, style) {
  for (const { api, model } of CHAIN) {
    if (await isDown(model)) continue;
    const r = api === 'interactions'
      ? await callInteractions(apiKey, model, text, voice, style)
      : await callGenerate(apiKey, model, text, voice);
    if (r.audio) {
      await countUse(model);
      return { mime: r.audio.mime, bytes: base64ToBytes(r.audio.data), model };
    }
    const msg = r.data.error?.message ?? 'audio yo‘q';
    console.warn(`${model} ${r.res.status}: ${msg.slice(0, 160)}`);
    if (r.res.status === 429) await markDown(model, retryMs(msg));
    else if (r.res.status === 404) await markDown(model, 24 * 3600 * 1000); // no access to this model
    else if (r.res.status === 503) continue; // overloaded right now — try the next one
    else if (r.res.status >= 500) continue;
    else throw new Error(`TTS xatosi (${model} ${r.res.status}): ${msg.slice(0, 160)}`);
  }
  return null;
}

// ---- free fallback: Google Translate TTS (MP3, ≤200 chars per request) ----
const FREE_LANG = {
  zh: 'zh-CN', 'zh-tw': 'zh-TW', iw: 'iw', heb: 'iw', dan: 'da', tam: 'ta', nep: 'ne', bel: 'be',
  isl: 'is', amh: 'am', som: 'so', hau: 'ha', yor: 'yo', mya: 'my', sin: 'si', nb: 'no',
};
// null/uz = Uzbek as typed. Returns { tl, model } — the Google voice to use.
export function freeVoiceFor(code, text = '') {
  if (!code || code === 'uz' || code === 'uzc') {
    return /[\u0400-\u04FF]/.test(text) || code === 'uzc'
      ? { tl: 'ru', model: FREE_UZ_CYRILLIC }
      : { tl: 'tr', model: FREE_UZ_LATIN };
  }
  return { tl: FREE_LANG[code] ?? code, model: FREE_MODEL };
}

function chunks(text, max = 180) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('! ', max), rest.lastIndexOf('? ', max), rest.lastIndexOf(', ', max));
    if (cut < max / 3) cut = rest.lastIndexOf(' ', max);
    if (cut < 1) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

async function freeTts(text, lang) {
  const { tl, model } = freeVoiceFor(lang, text);
  const parts = [];
  for (const q of chunks(text)) {
    const res = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(q)}`, {
      headers: { 'user-agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Bepul ovoz ishlamadi (${res.status}): "${tl}" tili yo‘q bo‘lishi mumkin.`);
    for await (const c of res.body) parts.push(c);
  }
  const mp3 = new Uint8Array(parts.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of parts) { mp3.set(c, o); o += c.length; }
  await countUse(FREE_MODEL);
  // Google Translate TTS MP3 is ~64 kbps.
  return { mp3, seconds: Math.max(1, Math.round((mp3.length * 8) / 64000)), model };
}

const ascii = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

// WAV → { pcm: Int16Array (mono), rate }. Also accepts raw L16 ("audio/L16;rate=24000").
function decodeAudio({ mime, bytes }) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 0) === 'RIFF' && ascii(bytes, 8) === 'WAVE') {
    let pos = 12;
    let rate = 24000;
    let channels = 1;
    while (pos + 8 <= bytes.length) {
      const id = ascii(bytes, pos);
      const len = view.getUint32(pos + 4, true);
      if (id === 'fmt ') {
        channels = view.getUint16(pos + 10, true);
        rate = view.getUint32(pos + 12, true);
      } else if (id === 'data') {
        const end = Math.min(pos + 8 + len, bytes.length);
        const samples = new Int16Array(Math.floor((end - pos - 8) / 2 / channels));
        for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(pos + 8 + i * 2 * channels, true);
        return { pcm: samples, rate };
      }
      pos += 8 + len + (len % 2);
    }
    throw new Error('WAV ichida audio topilmadi.');
  }
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const samples = new Int16Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true);
  return { pcm: samples, rate };
}

function encodeMp3({ pcm, rate }) {
  const enc = new Mp3Encoder(1, rate, 48);
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (buf.length) chunks.push(buf);
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(tail);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c.buffer, c.byteOffset, c.length), o);
    o += c.length;
  }
  return { mp3: out, seconds: Math.round(pcm.length / rate) };
}

// Returns { mp3: Uint8Array, seconds, model }. accent ("British") and style
// ("a whisper") go to the Interactions API as speech_metadata.style.
// lang: language code of `text` — needed for the free fallback (null = Uzbek/unknown).
// Uzbek goes to gapir first (real Uzbek voice, no quota); apiKey null → no Gemini.
export async function synthesize(apiKey, text, { voice = 'Kore', accent = null, style = null, lang = null, persona = null } = {}) {
  const body = text.slice(0, TTS_MAX_CHARS);
  if (isUzbek(lang)) {
    const u = await gapirTts(body, { voice, persona });
    if (u) {
      await countUse(GAPIR_MODEL);
      return { ...encodeMp3(decodeAudio(u)), model: u.model };
    }
  }
  if (apiKey) {
    const how = [style, accent && `a natural ${accent} accent`].filter(Boolean).join(', ') || null;
    const g = await geminiTts(apiKey, body, voice, how);
    if (g) return { ...encodeMp3(decodeAudio(g)), model: g.model };
  }
  return freeTts(body, lang);
}
