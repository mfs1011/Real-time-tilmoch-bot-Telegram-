// LLM provider selection. The provider is stored explicitly next to the key
// (settings: llm_provider, llm_key) — decided once, by testing the key against
// each provider's API, so new key formats need no code changes.
import { askClaude } from './claude.js';
import { askGemini, listGeminiModels, DEFAULT_GEMINI_MODEL } from './gemini.js';
import { getSetting, setSetting } from './settings.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini', validate: (key) => listGeminiModels(key) },
  claude: { label: 'Claude', validate: (key) => askClaude(key, 'Reply with: ok', 'ping') },
};

// Format-agnostic: one long token with letters and digits, no spaces → treat as a secret.
// Used only to keep secrets out of translation, never to pick a provider.
export function looksLikeKey(text) {
  const t = text.trim();
  return t.length >= 30 && /^[\w.\-]+$/.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t);
}

// Tries the key against providers (the named one only, if given). Returns the
// provider id that accepted it, or throws with each provider's error.
export async function detectProviderByCall(key, only) {
  // A known prefix only decides which provider is tried FIRST, so the key
  // normally reaches just its own vendor. Unknown formats still work.
  const hint = key.startsWith('sk-ant-') ? 'claude' : 'gemini';
  const order = only ? [only] : [hint, ...Object.keys(PROVIDERS).filter((id) => id !== hint)];
  const errors = [];
  for (const id of order) {
    try {
      await PROVIDERS[id].validate(key);
      return id;
    } catch (e) {
      errors.push(`${PROVIDERS[id].label}: ${e.message ?? e}`);
    }
  }
  throw new Error(errors.join('\n'));
}

export async function getProvider() {
  const key = await getSetting('llm_key');
  if (!key) return null;
  let provider = await getSetting('llm_provider');
  if (!PROVIDERS[provider]) {
    // Key saved before llm_provider existed — detect once and remember.
    try {
      provider = await detectProviderByCall(key);
      await setSetting('llm_provider', provider);
    } catch {
      return null;
    }
  }
  return { provider, key };
}

// Returns null when no key is set (caller falls back to Google Translate).
export async function getLLM() {
  const p = await getProvider();
  if (!p) return null;
  if (p.provider === 'gemini') {
    const model = (await getSetting('gemini_model')) || DEFAULT_GEMINI_MODEL;
    return { name: `gemini:${model}`, ask: (system, text) => askGemini(p.key, system, text, model) };
  }
  return { name: 'claude', ask: (system, text) => askClaude(p.key, system, text) };
}
