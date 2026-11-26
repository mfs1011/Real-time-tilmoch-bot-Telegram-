// Gemini generateContent over raw HTTP (no npm packages in the runtime).
import { fetch } from 'sdk';

// Measured from the runtime (Nov 2026): flash-lite ~1s, 3.8-flash 4–18s per short translation.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

const NOT_TEXT = /embed|image|imagen|banana|veo|tts|audio|transcribe|live|vision|aqa|robotics|computer-use|customtools|genie|omni|decision/i;

// Text models this key can call with generateContent, newest-looking first.
export async function listGeminiModels(apiKey) {
  const out = [];
  let pageToken = '';
  do {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${data?.error?.message ?? res.statusText}`);
    for (const m of data.models ?? []) {
      const id = m.name.replace(/^models\//, '');
      if (!/^(gemini|gemma)-/.test(id) || NOT_TEXT.test(id)) continue;
      if (!(m.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      out.push({ id, displayName: m.displayName ?? id, input: m.inputTokenLimit, output: m.outputTokenLimit });
    }
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return out.sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));
}

// parts: Gemini content parts — [{ text }] or [{ inlineData: { mimeType, data } }, { text }].
async function call(apiKey, model, system, parts, withThinking, json) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = { maxOutputTokens: 4000 };
  // Short texts — low thinking keeps inline answers fast.
  if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
  if (json) generationConfig.responseMimeType = 'application/json';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig,
    }),
  });
  return { res, data: await res.json() };
}

// Used when the chosen model is overloaded (503) or out of quota (429).
const fallbackFor = (model) =>
  model === 'gemini-flash-lite-latest' ? 'gemini-3.1-flash-lite' : 'gemini-flash-lite-latest';

export async function askGemini(apiKey, system, userText, model = DEFAULT_GEMINI_MODEL) {
  return askGeminiParts(apiKey, system, [{ text: userText }], model);
}

// Multimodal (audio/image + text). json: ask for application/json output.
export async function askGeminiParts(apiKey, system, parts, model = DEFAULT_GEMINI_MODEL, json = false) {
  let { res, data } = await call(apiKey, model, system, parts, true, json);
  if (res.status === 503 || res.status === 429) {
    const fb = fallbackFor(model);
    console.warn(`${model} → ${res.status}, falling back to ${fb}`);
    model = fb;
    ({ res, data } = await call(apiKey, model, system, parts, true, json));
  }
  // Some models (Gemma, older/lite ones) reject thinkingLevel — retry without it.
  if (res.status === 400 && /think/i.test(data?.error?.message ?? '')) {
    ({ res, data } = await call(apiKey, model, system, parts, false, json));
  }
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${data?.error?.message ?? res.statusText}`);
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini so‘rovni blokladi: ${data.promptFeedback.blockReason}`);
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text) throw new Error(`Gemini bo‘sh javob qaytardi (${cand?.finishReason ?? 'no candidates'}).`);
  return text;
}
