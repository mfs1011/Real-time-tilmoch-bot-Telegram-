// /uzovoz — the user's own settings for Uzbek speech (gapir / Gapiring), separate
// from the Gemini /voice and /persona. Unset = old behaviour (mapped from those).
import { getSetting, setSetting } from './settings.js';

// [role, manner, Uzbek label]
export const MANNERS = {
  assistant: [
    ['neutral', '😐 Oddiy'], ['warm', '🤗 Iliq'], ['cheerful', '😄 Quvnoq'], ['empathetic', '🤝 Hamdard'],
    ['calm', '😌 Xotirjam'], ['dictation', '📝 Diktovka'], ['soothing', '🌙 Tinchlantiruvchi'],
  ],
  operator: [
    ['neutral', '😐 Oddiy'], ['warm', '🤗 Iliq'], ['cheerful', '😄 Quvnoq'], ['empathetic', '🤝 Hamdard'],
    ['calm', '😌 Xotirjam'], ['dictation', '📝 Diktovka'], ['persuasive', '💼 Ishontiruvchi'], ['brisk', '⚡ Tezkor'],
  ],
  emotional: [
    ['angry', '😠 Jahldor'], ['upset', '😢 Xafa'], ['irritated', '😤 Asabiy'], ['worried', '😟 Xavotirli'],
    ['tired', '😩 Charchagan'], ['sceptical', '🤨 Shubhali'], ['confused', '😵 Sarosimali'], ['hurried', '🏃 Shoshqaloq'],
    ['joking', '😜 Hazilkash'], ['grateful', '🙏 Minnatdor'], ['curious', '🧐 Qiziquvchan'], ['friendly', '😊 Do‘stona'],
    ['calm', '😌 Xotirjam'], ['elderly', '👴 Keksa'],
  ],
};
const ROLE_LABEL = { assistant: 'Yordamchi', operator: 'Operator', emotional: 'Hissiy' };
const VOICE_LABEL = { f1: '👩 Ayol', m1: '👨 Erkak' };
const REGISTER_LABEL = { literary: '📖 Adabiy', conversational: '🗣 So‘zlashuv' };
// Model default temperature is 0.3.
export const LIVELINESS = { flat: ['😶 Bir tekis', 0.15], normal: ['🙂 Oddiy', null], lively: ['🎭 Ifodali', 0.5] };

export const DEFAULT_UZ = { v: 'f1', r: 'assistant', m: 'neutral', g: 'literary', t: 'normal' };
const key = (userId) => `uzvoice:${userId}`;

// The user's settings, or null if they never opened /uzovoz.
export async function getUzVoice(userId) {
  const raw = userId && (await getSetting(key(userId)));
  if (!raw) return null;
  try {
    return { ...DEFAULT_UZ, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

const save = (userId, s) => setSetting(key(userId), s ? JSON.stringify(s) : '');

const mannerLabel = (r, m) => MANNERS[r]?.find(([x]) => x === m)?.[1] ?? m;

// JSON body fields for the gapir API.
export function uzRequest(s) {
  const body = { voice: s.v, role: s.r, manner: s.m, register: s.g };
  const t = LIVELINESS[s.t]?.[1];
  if (t != null) body.temperature = t;
  return body;
}

export const uzSummary = (s) =>
  `${VOICE_LABEL[s.v]} · ${ROLE_LABEL[s.r]}: ${mannerLabel(s.r, s.m)} · ${REGISTER_LABEL[s.g]} · ${LIVELINESS[s.t][0]}`;

const rows = (items, perRow) => {
  const out = [];
  for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
  return out;
};
const mark = (on, text) => `${on ? '✅ ' : ''}${text}`;

export async function buildUzMenu(userId) {
  const saved = await getUzVoice(userId);
  const s = saved ?? DEFAULT_UZ;
  const header = (text) => [{ text: `— ${text} —`, callback_data: 'noop' }];
  return {
    text: [
      '🇺🇿 O‘zbekcha ovoz (Gapiring)',
      saved ? uzSummary(s) : 'Hozir sozlanmagan: /voice va /persona dan olinadi. Biror narsani tanlasangiz, shu sozlamalar ishlaydi.',
      '',
      'Uslub: 📖 adabiy — yozilganidek; 🗣 so‘zlashuv — Toshkent og‘zaki shakllari (qilyapsan → qivossan).',
      'Jonlilik: bir tekis — barqaror, ifodali — hissiyotliroq.',
      '🎲 — tanlangan sozlamada namuna.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        Object.entries(VOICE_LABEL).map(([v, t]) => ({ text: mark(saved && s.v === v, t), callback_data: `uz:v:${v}` })),
        ...Object.entries(MANNERS).flatMap(([r, list]) => [
          header(ROLE_LABEL[r]),
          ...rows(list.map(([m, t]) => ({ text: mark(saved && s.r === r && s.m === m, t), callback_data: `uz:m:${r}:${m}` })), 3),
        ]),
        header('Uslub va jonlilik'),
        Object.entries(REGISTER_LABEL).map(([g, t]) => ({ text: mark(saved && s.g === g, t), callback_data: `uz:g:${g}` })),
        Object.entries(LIVELINESS).map(([t, [label]]) => ({ text: mark(saved && s.t === t, label), callback_data: `uz:t:${t}` })),
        [{ text: '🎲 Namuna', callback_data: 'uz:s' }, { text: '♻️ Standartga qaytarish', callback_data: 'uz:x' }],
      ],
    },
  };
}

export const UZ_SAMPLE = 'Assalomu alaykum! Tarjimalaringizni shu ovozda o‘qib beraman. Qalaysiz, ishlaringiz yaxshimi?';

// Applies a "uz:…" button. Returns { toast, sample } — sample: settings to voice a sample with.
export async function applyUzButton(userId, data) {
  if (data === 'uz:menu') return { toast: '' };
  if (data === 'uz:s') return { toast: '🎲 Namuna tayyorlanmoqda…', sample: (await getUzVoice(userId)) ?? DEFAULT_UZ };
  if (data === 'uz:x') {
    await save(userId, null);
    return { toast: '♻️ Standart' };
  }
  const s = { ...((await getUzVoice(userId)) ?? DEFAULT_UZ) };
  let m;
  if ((m = data.match(/^uz:v:(f1|m1)$/))) s.v = m[1];
  else if ((m = data.match(/^uz:m:(\w+):(\w+)$/)) && MANNERS[m[1]]?.some(([x]) => x === m[2])) [s.r, s.m] = [m[1], m[2]];
  else if ((m = data.match(/^uz:g:(literary|conversational)$/))) s.g = m[1];
  else if ((m = data.match(/^uz:t:(flat|normal|lively)$/))) s.t = m[1];
  else return { toast: '' };
  await save(userId, s);
  return { toast: '✅ Saqlandi' };
}
