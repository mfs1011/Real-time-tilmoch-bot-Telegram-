// Keep emojis byte-for-byte through an LLM: swap each emoji for a ⟦n⟧ token
// before the call, put the originals back after.
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

export const EMOJI_RULE = 'Tokens like ⟦1⟧ stand for emojis: copy every such token unchanged, keep it next to the words it belongs to, and do not add any new emojis.';

// Returns { text, emojis } where text has ⟦n⟧ in place of each emoji.
export function protectEmojis(input) {
  const emojis = [];
  const graphemes = segmenter
    ? Array.from(segmenter.segment(input), (s) => s.segment)
    : Array.from(input);
  const text = graphemes
    .map((g) => (EMOJI.test(g) ? `⟦${emojis.push(g)}⟧` : g))
    .join('');
  return { text, emojis };
}

// Puts emojis back; any the model dropped are appended at the end.
export function restoreEmojis(output, emojis) {
  if (!emojis.length) return output;
  const used = new Set();
  let text = output.replace(/⟦(\d+)⟧/g, (m, n) => {
    const e = emojis[Number(n) - 1];
    if (!e) return '';
    used.add(Number(n));
    return e;
  });
  const missing = emojis.filter((_, i) => !used.has(i + 1));
  if (missing.length) text = `${text.trimEnd()} ${missing.join('')}`;
  return text;
}
