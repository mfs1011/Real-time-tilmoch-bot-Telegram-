// Uzbek TTS through our own gapir API (Gapiring model on our server): real Uzbek
// pronunciation, no daily quota. Used first for Uzbek text; anything it can't do
// (too long, server down, no key) falls through to Gemini / the free voice.
//
// Gapiring by Gapi (https://gapi.uz), an adaptation of Kyutai Pocket TTS
// (https://huggingface.co/kyutai/pocket-tts), CC BY 4.0
import { fetch } from 'sdk';
import { getSetting } from './settings.js';

export const GAPIR_MODEL = 'gapir';
const API = 'https://tts.kamgapir.uz/v1';
// The server makes ~1 s of audio per second of work, so long texts would keep the
// user waiting; they go to Gemini instead. Raise once the server is faster.
export const GAPIR_MAX_CHARS = 300;

export const isUzbek = (lang) => !lang || lang === 'uz' || lang === 'uzc';

// Gemini voice → gapir voice (f1 female, m1 male).
const MALE = new Set([
  'Puck', 'Charon', 'Fenrir', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Algenib',
  'Rasalgethi', 'Alnilam', 'Schedar', 'Achird', 'Zubenelgenubi', 'Sadachbia', 'Sadaltager',
]);

// Persona (by its Gemini style text) → gapir voice / role / manner.
const PERSONA = {
  robot: ['m1', 'operator', 'neutral'],
  pirate: ['m1', 'emotional', 'joking'],
  grandpa: ['m1', 'emotional', 'elderly'],
  granny: ['f1', 'emotional', 'elderly'],
  kid: ['f1', 'assistant', 'cheerful'],
  anchor: ['m1', 'operator', 'dictation'],
  whisper: ['f1', 'assistant', 'soothing'],
  story: ['m1', 'assistant', 'calm'],
  happy: ['f1', 'assistant', 'cheerful'],
  sad: ['f1', 'emotional', 'upset'],
  angry: ['m1', 'emotional', 'angry'],
  sport: ['m1', 'emotional', 'hurried'],
};

// opts: { voice, persona } from speechOpts(). Returns the JSON body for /v1/tts.
function request(text, { voice, persona }) {
  const p = PERSONA[persona];
  if (p) return { text, voice: p[0], role: p[1], manner: p[2] };
  return { text, voice: MALE.has(voice) ? 'm1' : 'f1', role: 'assistant', manner: 'neutral' };
}

// Returns { mime, bytes, model } (WAV, 24 kHz mono 16-bit) or null when gapir
// can't serve this text — the caller then tries the next engine.
export async function gapirTts(text, opts) {
  if (text.length > GAPIR_MAX_CHARS) return null;
  const key = await getSetting('gapir_key');
  if (!key) return null;
  let res;
  try {
    res = await fetch(`${API}/tts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(request(text, opts)),
    });
  } catch (e) {
    console.warn(`gapir: ${e.message ?? e}`);
    return null;
  }
  if (!res.ok) {
    console.warn(`gapir ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return null;
  }
  const parts = [];
  for await (const c of res.body) parts.push(c);
  const bytes = new Uint8Array(parts.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of parts) { bytes.set(c, o); o += c.length; }
  return { mime: 'audio/wav', bytes, model: GAPIR_MODEL };
}

// For /ttskey: checks a key against the server. Returns null if OK, else the reason.
export async function checkGapirKey(key) {
  try {
    const res = await fetch(`${API}/roles`, { headers: { authorization: `Bearer ${key}` } });
    if (res.ok) return null;
    return res.status === 401 ? 'kalit noto‘g‘ri' : `server javobi ${res.status}`;
  } catch (e) {
    return `server bilan bog‘lanib bo‘lmadi: ${e.message ?? e}`;
  }
}
