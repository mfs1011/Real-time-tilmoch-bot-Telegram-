// handlers/callback_query.js — owner's buttons: /model menu, /users menu,
// access-request answers.
import { api } from 'sdk';
import { getOwnerId, setSetting, setVoice, setDialect, setPersona } from '../lib/settings.js';
import { DIALECTS, VOICES, isVoice, getPersonaDef } from '../lib/dialects.js';
import { buildDialectMenu, buildVoiceMenu, buildPersonaMenu } from '../lib/prefs_menu.js';
import { buildModelMenu } from '../lib/models_menu.js';
import { getUser, setStatus, removeUser, isPublic, setPublic, buildUsersMenu, accessOf } from '../lib/access.js';
import { getSnippet, sendSpeech, speechOpts } from '../lib/voice.js';
import { buildUzMenu, applyUzButton, UZ_SAMPLE, uzSummary } from '../lib/uzvoice.js';

export default async function (q) {
  const toast = (text) => api.answerCallbackQuery({ callback_query_id: q.id, text });
  const edit = (params) => q.message
    ? api.editMessageText({ chat_id: q.message.chat.id, message_id: q.message.message_id, ...params })
      .catch(() => {}) // "message is not modified" etc.
    : null;

  const data = q.data ?? '';

  const SAMPLE = 'Salom! Tarjimalaringizni shu ovozda o‘qib beraman.';
  const speakTo = async (chatId, text, opts, extra) => {
    try {
      await sendSpeech(chatId, text, opts, extra);
    } catch (e) {
      console.error(e);
      await api.sendMessage({ chat_id: q.from.id, text: `⚠️ ${e.message ?? e}` });
    }
  };

  // Per-user buttons — anyone with access.
  if (data === 'noop') return toast(''); // header/label buttons

  if (/^(tts|dia|vc|vcs|vcset|ps|uz):/.test(data)) {
    if (!(await accessOf(q.from.id))) return toast('Ruxsat yo‘q.');

    // "🔊 Ovozli"
    const tts = data.match(/^tts:(\d+)$/);
    if (tts) {
      const snip = await getSnippet(Number(tts[1]));
      if (!snip) return toast('Matn topilmadi (eskirgan).');
      await toast('🔊 Tayyorlanmoqda…');
      return speakTo(q.message?.chat.id ?? q.from.id, snip.text, await speechOpts(q.from.id, snip.accent, null, snip.lang));
    }

    // /dialect menu: "dia:" overview, "dia:en" presets, "dia:en:2" pick, "dia:en:x" reset.
    const dia = data.match(/^dia:([\w-]*)(?::(\w+))?$/);
    if (dia) {
      const [, code, pick] = dia;
      if (pick !== undefined) {
        const preset = DIALECTS[code]?.[Number(pick)];
        await setDialect(q.from.id, code, pick === 'x' ? '' : preset?.[1] ?? '');
        await toast(pick === 'x' ? 'Standart' : `✅ ${preset?.[1] ?? ''}`);
      } else {
        await toast('');
      }
      return edit(await buildDialectMenu(q.from.id, code || null));
    }

    const chatId = q.message?.chat.id ?? q.from.id;

    // /uzovoz menu: "uz:menu", "uz:v:f1", "uz:m:<role>:<manner>", "uz:g:…", "uz:t:…", "uz:s" sample, "uz:x" reset.
    if (data.startsWith('uz:')) {
      const r = await applyUzButton(q.from.id, data);
      await toast(r.toast);
      await edit(await buildUzMenu(q.from.id));
      if (r.sample) return speakTo(chatId, UZ_SAMPLE, { lang: 'uz', uz: r.sample }, { caption: `🇺🇿 ${uzSummary(r.sample)}` });
      return;
    }

    // /voice menu. "vc:menu" open; "vc:<name>" pick + sample.
    if (data === 'vc:menu') {
      await toast('');
      return edit(await buildVoiceMenu(q.from.id));
    }
    const vc = data.match(/^vc:(\w+)$/);
    if (vc && isVoice(vc[1])) {
      await setVoice(q.from.id, vc[1]);
      await setPersona(q.from.id, ''); // a plain voice replaces the character
      await toast(`🔊 ${vc[1]}`);
      await edit(await buildVoiceMenu(q.from.id));
      return speakTo(chatId, `Salom! Men ${vc[1]}man. Tarjimalaringizni shu ovozda o‘qib beraman.`, { voice: vc[1] });
    }

    // 🎲 three random voices, each with a "pick this" button.
    if (data === 'vcs:') {
      await toast('🎲 3 ta namuna tayyorlanmoqda…');
      const pool = [...VOICES].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const [name, style] of pool) {
        await speakTo(chatId, SAMPLE, { voice: name }, {
          caption: `${name} · ${style}`,
          reply_markup: { inline_keyboard: [[{ text: `✅ ${name} ni tanlash`, callback_data: `vcset:${name}` }]] },
        });
      }
      return;
    }
    const vcset = data.match(/^vcset:(\w+)$/);
    if (vcset && isVoice(vcset[1])) {
      await setVoice(q.from.id, vcset[1]);
      await setPersona(q.from.id, '');
      return toast(`✅ Ovoz: ${vcset[1]}`);
    }

    // /persona menu. "ps:menu" open; "ps:none" off; "ps:<id>" pick + sample.
    if (data === 'ps:menu') {
      await toast('');
      return edit(await buildPersonaMenu(q.from.id));
    }
    if (data === 'ps:none') {
      await setPersona(q.from.id, '');
      await toast('🚫 Personajsiz');
      return edit(await buildPersonaMenu(q.from.id));
    }
    const ps = data.match(/^ps:(\w+)$/);
    const persona = ps && getPersonaDef(ps[1]);
    if (persona) {
      await setPersona(q.from.id, persona.id);
      await toast(`${persona.emoji} ${persona.label}`);
      await edit(await buildPersonaMenu(q.from.id));
      return speakTo(chatId, SAMPLE, { voice: persona.voice, style: persona.style }, { caption: `${persona.emoji} ${persona.label}` });
    }
    return toast('');
  }

  if (q.from.id !== (await getOwnerId())) return toast('Faqat bot egasi uchun.');

  if (data.startsWith('model:')) {
    const model = data.slice('model:'.length);
    await setSetting('gemini_model', model);
    await toast(`Model: ${model}`);
    return edit(await buildModelMenu());
  }

  if (data === 'acc:public') {
    const on = !(await isPublic());
    await setPublic(on);
    await toast(on ? '🌍 Hammaga ochildi' : '🔒 Faqat ruxsatlilar');
    return edit(await buildUsersMenu());
  }

  const m = data.match(/^acc:(allow|deny|del):(\d+)$/);
  if (m) {
    const [, action, idStr] = m;
    const id = Number(idStr);
    const user = await getUser(id);
    const who = user?.name ?? String(id);

    if (action === 'allow') {
      await setStatus(id, 'allowed');
      await api.sendMessage({ chat_id: id, text: '✅ Sizga botdan foydalanishga ruxsat berildi. /help' }).catch(() => {});
      await toast(`✅ ${who}`);
    } else if (action === 'deny') {
      await setStatus(id, 'denied');
      await toast(`❌ ${who} rad etildi`);
    } else {
      await removeUser(id);
      await toast(`🗑 ${who} o‘chirildi`);
    }

    // Request notification → replace buttons with the outcome; /users menu → refresh it.
    if (q.message?.text?.startsWith('🔔')) {
      const outcome = action === 'allow' ? '✅ Ruxsat berildi' : '❌ Rad etildi';
      return edit({ text: `${q.message.text}\n\n${outcome}` });
    }
    return edit(await buildUsersMenu());
  }

  // 'noop' = header/label buttons.
  return api.answerCallbackQuery({ callback_query_id: q.id });
}
