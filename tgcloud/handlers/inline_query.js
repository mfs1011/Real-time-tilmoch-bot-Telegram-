// handlers/inline_query.js — `@bot en salom` typed in any chat.
// - empty / partial code  → hint button with matching language codes, no request
// - `en matn`             → that language (+ "with original" variant)
// - `matn` (no code)      → favourite languages in ONE request; pick one to send
// - `say en matn`         → translated, voiced (TTS) and offered as a voice message
// Translations are computed here, so the picked message is final when sent.
// Debounced: only the query that survives DEBOUNCE_MS calls the LLM.
import { api } from 'sdk';
import { accessOf } from '../lib/access.js';
import { parseQuery, execute, matchCodes } from '../lib/commands.js';
import { translateMany } from '../lib/translate.js';
import { getFavLangs } from '../lib/settings.js';
import { langFor, PERSONAS, findPersona, matchPersonas } from '../lib/dialects.js';
import { VOICE_WORDS } from '../lib/commands.js';
import { voiceFileId, speechOpts, voiceCaption } from '../lib/voice.js';
import { LANGS, getLang } from '../lib/langs.js';
import { looksLikeKey } from '../lib/llm.js';
import { settle, DEBOUNCE_MS } from '../lib/debounce.js';

const preview = (s, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);
const clip = (s, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const article = (id, title, text) => ({
  type: 'article',
  id,
  title,
  description: preview(text),
  input_message_content: { message_text: text },
});

export default async function (query) {
  const answer = (results, extra = {}) => api.answerInlineQuery({
    inline_query_id: query.id,
    results,
    is_personal: true,
    cache_time: 300,
    ...extra,
  });
  const hint = (text, start = 'help') => answer([], { button: { text: clip(text), start_parameter: start } });

  if (!(await accessOf(query.from.id))) {
    // Deep link → private chat → /start access → owner gets a request with buttons.
    return answer([], { cache_time: 0, button: { text: '🔒 Ruxsat so‘rash', start_parameter: 'access' } });
  }

  const q = query.query.trim();
  if (!q) return hint(`Til kodi + matn: ${Object.keys(LANGS).slice(0, 8).join(' ')} …`);
  if (looksLikeKey(q)) return answer([], { cache_time: 0 });

  // Voice queries before there is text to speak → hints, never a TTS request.
  //   "say"            → all characters (button opens the /persona menu)
  //   "say q"          → characters starting with "q"
  //   "say qaroqchi"   → chosen; "say qaroqchi en" → language chosen too
  const words = q.split(/\s+/);
  if (VOICE_WORDS.includes(words[0].toLowerCase()) && words.length <= 3) {
    const [, w1, w2] = words;
    const p = w1 && findPersona(w1);
    if (!w1) return hint(`🎭 Personajlar: ${PERSONAS.map((x) => x.label.toLowerCase()).join(', ')}`, 'persona');
    if (p && !w2) return hint(`${p.emoji} ${p.label} — endi til + matn (en salom)`, 'persona');
    if (p && words.length === 3 && getLang(w2)) {
      return hint(`${p.emoji} ${p.label} · ${getLang(w2).flag} ${getLang(w2).name} — matn yozing`, 'persona');
    }
    if (p && words.length === 3 && w2.length <= 2 && matchCodes(w2).length) {
      return hint(`${p.emoji} ${p.label} · ${matchCodes(w2).join(' · ')} — til kodi`, 'persona');
    }
    if (!p && words.length === 2 && !getLang(w1)) {
      const m = matchPersonas(w1);
      if (m.length) return hint(`🎭 ${m.map((x) => `${x.emoji} ${x.label.toLowerCase()}`).join(' · ')}`, 'persona');
    }
    if (!p && getLang(w1) && words.length === 2) {
      return hint(`🔊 ${getLang(w1).flag} ${getLang(w1).name} — matn yozing`, 'persona');
    }
  }

  // Only a (partial) code typed so far → show what it can become.
  if (!/\s/.test(q)) {
    const exact = getLang(q);
    if (exact) return hint(`${exact.flag} ${exact.name} — endi matn yozing`);
    const matches = matchCodes(q);
    if (matches.length) return hint(`${matches.join(' · ')} — kod + matn`);
  }

  const parsed = await parseQuery(q, query.from.id);
  if (!parsed.text) return answer([]);

  // A newer keystroke arrived — drop this query without spending a request.
  // Voice waits longer: TTS has a small daily quota, don't voice half-typed words.
  if (!(await settle(query.from.id, query.id, parsed.kind === 'voice' ? 1200 : DEBOUNCE_MS))) return;

  try {
    if (!parsed.explicit) {
      const langs = await Promise.all((await getFavLangs(query.from.id))
        .filter((c) => getLang(c))
        .map((c) => langFor(c, query.from.id)));
      const out = await translateMany(parsed.text, langs);
      return answer(langs.map(({ code, name }) => article(`fav_${code}`, `${getLang(code).flag} ${name}`, out[code])));
    }

    const { title, text, accent } = await execute(parsed);

    if (parsed.kind === 'voice') {
      // Upload to the user's own chat with the bot to get a file_id (needs /start there).
      const v = await voiceFileId(query.from.id, text, await speechOpts(query.from.id, accent, parsed.persona, parsed.code))
        .catch((e) => {
          if (/chat not found|blocked|forbidden/i.test(String(e.description ?? e.message))) {
            throw new Error('Avval botning o‘ziga /start yozing — ovoz u yerda tayyorlanadi.');
          }
          throw e;
        });
      return answer([
        { type: 'voice', id: 'voice', voice_file_id: v.fileId, title: `${title} — ${clip(text, 40)}`, caption: voiceCaption(v.model, v.cached) },
        article('voice_text', `${title.replace('🔊 ', '')} (matn)`, text),
      ]);
    }

    return answer([
      article('result', title, text),
      article('with_original', `${title} + asl matn`, `${text}\n\n— ${parsed.text}`),
    ]);
  } catch (e) {
    console.error(e);
    return answer([], {
      cache_time: 0,
      button: { text: `⚠️ ${clip(String(e.message ?? e))}`, start_parameter: 'help' },
    });
  }
}
