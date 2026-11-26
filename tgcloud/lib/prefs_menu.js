// /dialect and /voice menus (per user).
import { getLang } from './langs.js';
import { DIALECTS, VOICES, PERSONAS, getPersonaDef } from './dialects.js';
import { getDialect, getVoice, getFavLangs, getDefaultLang, getPersona } from './settings.js';

const rows = (items, perRow) => {
  const out = [];
  for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
  return out;
};

// code = null → overview of the user's languages; code → presets for that language.
export async function buildDialectMenu(userId, code) {
  if (!code) {
    const mine = [...new Set([await getDefaultLang(userId), ...(await getFavLangs(userId)), ...Object.keys(DIALECTS)])];
    const lines = [];
    for (const c of mine) {
      const d = await getDialect(userId, c);
      if (d) lines.push(`${getLang(c)?.flag ?? '🌐'} ${c}: ${d}`);
    }
    return {
      text: [
        'Dialektlar — tarjima va talaffuz shu variantda bo‘ladi.',
        lines.length ? `\nSizda:\n${lines.join('\n')}` : '\nHozircha tanlanmagan (standart variant).',
        '\nTilni tanlang yoki yozing: /dialect en British · /dialect ar Egyptian · /dialect en - (o‘chirish)',
      ].join('\n'),
      reply_markup: {
        inline_keyboard: rows(Object.keys(DIALECTS).map((c) => ({
          text: `${getLang(c)?.flag ?? '🌐'} ${c}`,
          callback_data: `dia:${c}`,
        })), 4),
      },
    };
  }

  const current = await getDialect(userId, code);
  const presets = DIALECTS[code] ?? [];
  const lang = getLang(code);
  return {
    text: [
      `${lang?.flag ?? '🌐'} ${lang?.name ?? code} — dialekt: ${current || 'standart'}`,
      presets.length ? '' : '\nTayyor variantlar yo‘q — o‘zingiz yozing:',
      `Erkin matn: /dialect ${code} <variant>`,
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        ...rows(presets.map(([flag, name], i) => ({
          text: `${current === name ? '✅ ' : ''}${flag} ${name}`,
          callback_data: `dia:${code}:${i}`,
        })), 2),
        [{ text: `${current ? '' : '✅ '}Standart`, callback_data: `dia:${code}:x` }, { text: '⬅️ Orqaga', callback_data: 'dia:' }],
      ],
    },
  };
}

export async function buildVoiceMenu(userId) {
  const current = await getVoice(userId);
  const persona = getPersonaDef(await getPersona(userId));
  return {
    text: [
      `🔊 Ovoz: ${current}`,
      persona ? `⚠️ Hozir ${persona.emoji} ${persona.label} personaji yoqilgan — oddiy ovoz tanlasangiz, personaj o‘chadi.` : '',
      'Tanlasangiz, namuna yuboraman. 🎲 — tasodifiy 3 ta ovozni eshitib ko‘ring.',
    ].filter(Boolean).join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎲 3 ta namuna', callback_data: 'vcs:' }, { text: '🎭 Personajlar', callback_data: 'ps:menu' }],
        ...rows(VOICES.map(([name, style]) => ({
          text: `${!persona && name === current ? '✅ ' : ''}${name} · ${style}`,
          callback_data: `vc:${name}`,
        })), 2),
      ],
    },
  };
}

export async function buildPersonaMenu(userId) {
  const current = await getPersona(userId);
  const p = getPersonaDef(current);
  return {
    text: [
      `🎭 Personaj: ${p ? `${p.emoji} ${p.label}` : 'yo‘q (oddiy ovoz)'}`,
      'Personaj ovozli xabarlarni o‘z ohangida o‘qiydi. Tanlasangiz, namuna yuboraman.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        ...rows(PERSONAS.map((x) => ({
          text: `${x.id === current ? '✅ ' : ''}${x.emoji} ${x.label}`,
          callback_data: `ps:${x.id}`,
        })), 3),
        [{ text: `${current ? '' : '✅ '}🚫 Personajsiz`, callback_data: 'ps:none' }, { text: '🔊 Ovozlar', callback_data: 'vc:menu' }],
      ],
    },
  };
}
