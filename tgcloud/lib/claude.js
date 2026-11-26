// Claude Messages API over raw HTTP — the serverless runtime has no npm
// packages, so the official SDK can't be imported here.
import { fetch } from 'sdk';

const MODEL = 'claude-opus-5-5';

export class ClaudeError extends Error {}

export async function askClaude(apiKey, system, userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Server-side fallback: if the model declines, the API retries on a
      // fallback model inside the same call.
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      // Short texts — low effort keeps inline answers fast.
      output_config: { effort: 'low' },
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ClaudeError(`Claude API ${res.status}: ${data?.error?.message ?? res.statusText}`);
  }
  if (data.stop_reason === 'refusal') {
    throw new ClaudeError('Claude bu matnni qayta ishlashdan bosh tortdi.');
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new ClaudeError('Claude bo‘sh javob qaytardi.');
  return text;
}
