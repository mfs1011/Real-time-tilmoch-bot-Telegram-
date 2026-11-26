// /model menu: translation picks on top, everything else below.
import { listGeminiModels, DEFAULT_GEMINI_MODEL } from './gemini.js';
import { getSetting } from './settings.js';
import { getProvider } from './llm.js';

// Picked for translation by measured latency from the runtime (Nov 2026).
// Shown only if the key actually has access to the model.
const TRANSLATE_PICKS = [
  { id: 'gemini-flash-lite-latest', note: '⚡ ~1s' },
  { id: 'gemini-3.1-flash-lite', note: '⚡ ~0.7s' },
  { id: 'gemini-3.5-flash-lite', note: '⚡ ~1s' },
  { id: 'gemini-flash-latest', note: '🎯 sifat' },
  { id: 'gemini-3.8-flash', note: '🎯 sifat, sekin' },
];

const short = (id) => (id.startsWith('gemini-') ? id.slice('gemini-'.length) : id.replace(/^gemma-/, 'gemma '));
const header = (text) => [{ text, callback_data: 'noop' }];
const rows = (items, perRow) => {
  const out = [];
  for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
  return out;
};

// Returns params for sendMessage / editMessageText.
export async function buildModelMenu() {
  const p = await getProvider();
  if (p?.provider !== 'gemini') {
    return { text: 'Model tanlash Gemini kaliti uchun. Avval /key <Gemini kaliti> yuboring.' };
  }
  const current = (await getSetting('gemini_model')) || DEFAULT_GEMINI_MODEL;
  const available = await listGeminiModels(p.key);
  const ids = new Set(available.map((m) => m.id));

  const button = (id, note) => ({
    text: `${id === current ? '✅ ' : ''}${short(id)}${note ? ` ${note}` : ''}`,
    callback_data: `model:${id}`.slice(0, 64),
  });

  const picks = TRANSLATE_PICKS.filter((m) => ids.has(m.id));
  const pickIds = new Set(picks.map((m) => m.id));
  const others = available.filter((m) => !pickIds.has(m.id)).slice(0, 30);

  return {
    text: [
      `Joriy model: ${current}`,
      '',
      'Limitlar (RPM/RPD): https://aistudio.google.com/rate-limit',
      'Modellar haqida: https://ai.google.dev/gemini-api/docs/models',
    ].join('\n'),
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        header('⭐ Tarjima uchun'),
        ...picks.map((m) => [button(m.id, m.note)]),
        header('Boshqa modellar'),
        ...rows(others.map((m) => button(m.id)), 2),
      ],
    },
  };
}
