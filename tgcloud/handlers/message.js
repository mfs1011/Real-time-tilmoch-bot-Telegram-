// handlers/message.js — private chat with the bot: setup commands, access
// management. Plain/forwarded text is translated (Uzbek → your language,
// anything else → Uzbek); voice/audio/video notes/photos are transcribed or
// read and translated (STT/OCR). Replies carry a "🔊 Ovozli" (TTS) button.
import { api } from 'sdk';
import {
  getOwnerId, setSetting, getSetting, getDefaultLang, setDefaultLang,
  getFavLangs, setFavLangs, MAX_FAVS, setDialect,
} from '../lib/settings.js';
import { getEngine, translateAuto } from '../lib/translate.js';
import { PROVIDERS, looksLikeKey, detectProviderByCall } from '../lib/llm.js';
import { DEFAULT_GEMINI_MODEL } from '../lib/gemini.js';
import { buildModelMenu } from '../lib/models_menu.js';
import { LANGS, getLang, langsText } from '../lib/langs.js';
import { helpText, parseQuery, execute } from '../lib/commands.js';
import { accessOf, requestAccess, setStatus, removeUser, buildUsersMenu } from '../lib/access.js';
import { pickMedia, handleMedia, sendWithVoiceButton, sendSpeech, speechOpts } from '../lib/voice.js';
import { langFor } from '../lib/dialects.js';
import { ttsUsage, modelLabel, FREE_MODEL } from '../lib/tts.js';
import { checkGapirKey, GAPIR_MAX_CHARS } from '../lib/gapir.js';
import { buildDialectMenu, buildVoiceMenu, buildPersonaMenu } from '../lib/prefs_menu.js';

const OWNER_ONLY = new Set(['/key', '/delkey', '/ttskey', '/model', '/users', '/allow', '/deny']);

export default async function (message) {
  if (message.chat.type !== 'private') return;
  const media = pickMedia(message);
  if (!message.text && !media) return;

  const chat_id = message.chat.id;
  const reply = (text) => api.sendMessage({ chat_id, text });
  const msgText = message.text ?? '';
  let [cmd, ...rest] = msgText.trim().split(/\s+/);
  cmd = cmd.replace(/@\w+$/, ''); // "/help@bot" → "/help"
  let arg = rest.join(' ');

  // First person to /start becomes the owner — do it right after deploy.
  if (!(await getOwnerId()) && cmd === '/start') {
    await setSetting('owner_id', message.from.id);
    await reply('✅ Siz bot egasi sifatida saqlandingiz.');
  }

  const access = await accessOf(message.from.id);
  const isOwner = access === 'owner';

  // A bare API key is never translated. Owner: treat as /key. Others: just drop it.
  if (msgText && looksLikeKey(msgText)) {
    if (!isOwner) {
      await api.deleteMessage({ chat_id, message_id: message.message_id }).catch(() => {});
      return reply('Bu kalitga o‘xshaydi — tarjima qilinmadi va o‘chirildi.');
    }
    arg = msgText.trim();
    cmd = '/key';
  }

  if (!access) {
    const r = await requestAccess(message.from);
    if (r === 'denied') return reply('Kechirasiz, bu botdan foydalanishga ruxsat yo‘q.');
    if (r === 'pending') return reply('⏳ So‘rovingiz bot egasiga yuborilgan, javobni kuting.');
    return reply('🔒 Bu shaxsiy bot. Bot egasiga ruxsat so‘rovi yuborildi — ruxsat berilganda xabar olasiz.');
  }

  if (OWNER_ONLY.has(cmd) && !isOwner) return reply('Bu komanda faqat bot egasi uchun.');

  // The language Uzbek content is translated to (forwarded/media messages).
  const myLang = async () => langFor(await getDefaultLang(message.from.id), message.from.id);

  if (media) {
    try {
      return await handleMedia(chat_id, media, await myLang());
    } catch (e) {
      console.error(e);
      return reply(`⚠️ ${e.message ?? e}`);
    }
  }

  switch (cmd) {
    case '/start':
      // Deep link from the inline hint button: t.me/bot?start=persona
      if (arg === 'persona') return api.sendMessage({ chat_id, ...(await buildPersonaMenu(message.from.id)) });
    // falls through
    case '/help': {
      const me = await api.getMe();
      return reply(helpText(isOwner, me.username));
    }

    case '/key': {
      // Remove the message so the key doesn't stay in chat history.
      await api.deleteMessage({ chat_id, message_id: message.message_id }).catch(() => {});
      // `/key <kalit>` — provider found by testing; `/key gemini <kalit>` — explicit.
      const parts = arg.split(/\s+/).filter(Boolean);
      const only = parts.length === 2 && PROVIDERS[parts[0].toLowerCase()] ? parts[0].toLowerCase() : null;
      const key = only ? parts[1] : parts[0];
      if (!key || parts.length > (only ? 2 : 1)) {
        return reply('Format: /key <kalit>  yoki  /key gemini <kalit>  /  /key claude <kalit>');
      }
      let provider;
      try {
        provider = await detectProviderByCall(key, only);
      } catch (e) {
        return reply(`❌ Kalit ishlamadi, saqlanmadi (xabaringiz o‘chirildi).\n${e.message ?? e}`);
      }
      await setSetting('llm_key', key);
      await setSetting('llm_provider', provider);
      const label = PROVIDERS[provider].label;
      return reply(`🔑 ${label} kaliti tekshirildi va saqlandi, xabaringiz o‘chirildi. Endi tarjimalar ${label} orqali.`);
    }

    case '/ttskey': {
      // gapir (o'zbekcha ovoz serveri) kaliti. `/ttskey off` — o'chirish.
      await api.deleteMessage({ chat_id, message_id: message.message_id }).catch(() => {});
      const key = arg.trim();
      if (!key) return reply('Format: /ttskey <kalit>   (o‘chirish: /ttskey off)');
      if (key === 'off') {
        await setSetting('gapir_key', '');
        return reply('gapir kaliti o‘chirildi. O‘zbekcha ovoz endi Gemini / Google orqali.');
      }
      const err = await checkGapirKey(key);
      if (err) return reply(`❌ gapir kaliti saqlanmadi (xabaringiz o‘chirildi): ${err}`);
      await setSetting('gapir_key', key);
      return reply(`🔑 gapir kaliti saqlandi, xabaringiz o‘chirildi. O‘zbekcha matn (${GAPIR_MAX_CHARS} belgigacha) endi Gapiring ovozida.`);
    }

    case '/delkey':
      await setSetting('llm_key', '');
      await setSetting('llm_provider', '');
      return reply('Kalit o‘chirildi. Endi Google Translate ishlatiladi.');

    case '/model': {
      if (arg) {
        await setSetting('gemini_model', arg);
        return reply(`Gemini modeli: ${arg}`);
      }
      try {
        return await api.sendMessage({ chat_id, ...(await buildModelMenu()) });
      } catch (e) {
        console.error(e);
        return reply(`⚠️ ${e.message ?? e}\nQo‘lda: /model <model> (hozirgi: ${(await getSetting('gemini_model')) || DEFAULT_GEMINI_MODEL})`);
      }
    }

    case '/users':
      return api.sendMessage({ chat_id, ...(await buildUsersMenu()) });

    case '/allow':
    case '/deny': {
      const id = Number(arg);
      if (!Number.isInteger(id) || id <= 0) return reply(`Format: ${cmd} <user_id>`);
      if (cmd === '/allow') {
        await setStatus(id, 'allowed');
        await api.sendMessage({ chat_id: id, text: '✅ Sizga botdan foydalanishga ruxsat berildi. /help' }).catch(() => {});
        return reply(`✅ ${id} ga ruxsat berildi.`);
      }
      await removeUser(id);
      return reply(`🗑 ${id} ning ruxsati olib tashlandi.`);
    }

    case '/lang': {
      const code = arg.toLowerCase();
      const lang = getLang(code);
      if (!lang) return reply(`Noma’lum til kodi. ISO kod yozing (masalan: en, ru, pl, uk, az). Ro‘yxat: /langs`);
      await setDefaultLang(message.from.id, code);
      return reply(`Standart tilingiz: ${lang.flag} ${lang.name}`);
    }

    case '/langs':
      return reply(langsText());

    case '/fav': {
      const codes = [...new Set(arg.toLowerCase().split(/[\s,]+/).filter(Boolean))];
      if (!codes.length) {
        const cur = await getFavLangs(message.from.id);
        return reply(`Sevimli tillar: ${cur.map((c) => `${getLang(c)?.flag ?? ''} ${c}`).join(', ')}\nO‘zgartirish: /fav en ru tr de (${MAX_FAVS} tagacha)\nIstalgan ISO kod ishlaydi (en, ru, pl, uk, az …)`);
      }
      const bad = codes.filter((c) => !getLang(c));
      if (bad.length) return reply(`Noma’lum kod: ${bad.join(', ')}\nISO kod yozing (masalan: en, ru, pl, uk, az)`);
      if (codes.length > MAX_FAVS) return reply(`Ko‘pi bilan ${MAX_FAVS} ta til.`);
      await setFavLangs(message.from.id, codes);
      return reply(`Sevimli tillar: ${codes.map((c) => `${getLang(c).flag} ${c}`).join(', ')}`);
    }

    case '/say': {
      // /say <matn> — read it aloud; /say en <matn> — translate, then read aloud.
      if (!arg) return reply('Format: /say <matn>  yoki  /say en <matn> (tarjima qilib o‘qiydi)');
      try {
        // "/say qaroqchi en salom" → reuse the inline parser by prefixing "say".
        const parsed = await parseQuery(`say ${arg}`, message.from.id);
        const r = await execute(parsed);
        return await sendSpeech(chat_id, r.text, await speechOpts(message.from.id, r.accent, parsed.persona, parsed.code));
      } catch (e) {
        console.error(e);
        return reply(`⚠️ ${e.message ?? e}`);
      }
    }

    case '/dialect': {
      // /dialect — overview; /dialect en — presets as buttons;
      // /dialect en British — free text; /dialect en - — reset.
      const [code, ...words] = arg.split(/\s+/).filter(Boolean);
      if (!code) return api.sendMessage({ chat_id, ...(await buildDialectMenu(message.from.id, null)) });
      if (!getLang(code)) return reply('Noma’lum til kodi. Ro‘yxat: /langs');
      const value = words.join(' ');
      if (!value) return api.sendMessage({ chat_id, ...(await buildDialectMenu(message.from.id, code.toLowerCase())) });
      await setDialect(message.from.id, code.toLowerCase(), value === '-' ? '' : value);
      return reply(value === '-' ? `${code}: dialekt o‘chirildi.` : `${getLang(code).flag} ${code}: ${value}`);
    }

    case '/voice':
      return api.sendMessage({ chat_id, ...(await buildVoiceMenu(message.from.id)) });

    case '/persona':
      return api.sendMessage({ chat_id, ...(await buildPersonaMenu(message.from.id)) });

    case '/limits': {
      const rows = await ttsUsage();
      const now = Date.now();
      const lines = rows.map(({ model, used, downUntil }) => {
        const down = downUntil > now ? ` — ⛔ limit tugagan, ~${Math.ceil((downUntil - now) / 60000)} daq.` : '';
        return `${model === FREE_MODEL ? '🤖' : '🔊'} ${modelLabel(model)}: ${used} ta${down}`;
      });
      return reply([
        'Bugungi ovozlar (Tinch okeani vaqti bilan yarim tunda yangilanadi):',
        '',
        ...lines,
        '',
        'Tartib: yuqoridan pastga, limiti tugaganlar o‘tkazib yuboriladi.',
        'Keshdan qayta yuborilgan ovozlar sanalmaydi.',
        'Rasmiy limitlar: https://aistudio.google.com/rate-limit',
      ].join('\n'));
    }

    case '/status': {
      const lang = await getDefaultLang(message.from.id);
      if (!isOwner) return reply(`Standart tilingiz: ${lang}`);
      const engine = await getEngine();
      return reply(`Dvijok: ${engine === 'google' ? 'Google Translate (bepul)' : engine}\nStandart til: ${lang}`);
    }

    default: {
      if (cmd.startsWith('/')) return reply(helpText(isOwner, (await api.getMe()).username));
      try {
        const parsed = await parseQuery(msgText, message.from.id);
        // "en matn" → that language; plain/forwarded text → auto direction.
        if (parsed.explicit) {
          const { title, text, accent } = await execute(parsed);
          if (parsed.kind === 'voice') return await sendSpeech(chat_id, text, await speechOpts(message.from.id, accent, parsed.persona, parsed.code));
          return await sendWithVoiceButton(chat_id, `${title}\n\n${text}`, parsed.kind === 'lang' ? text : null, accent, parsed.code);
        }
        const other = await myLang();
        const r = await translateAuto(msgText, other);
        const flag = (c) => getLang(c)?.flag ?? '🌐';
        return await sendWithVoiceButton(chat_id, `${flag(r.from)} ${r.from} → ${flag(r.to)} ${r.to}\n\n${r.translation}`,
          r.translation, r.to === other.code ? other.dialect : null, r.to);
      } catch (e) {
        console.error(e);
        return reply(`⚠️ ${e.message ?? e}`);
      }
    }
  }
}
