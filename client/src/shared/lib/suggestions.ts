/**
 * Ranking for YouTube autocomplete rows.
 *
 * Shared by the participant search and the admin search; they had byte-identical
 * copies of this before, which is how they would have drifted apart.
 */

const normalize = (value: string) => value.toLowerCase().trim();

export function rankSuggestions(query: string, rawSuggestions: string[]): string[] {
  const q = normalize(query);
  const unique = Array.from(new Set(rawSuggestions.map((item) => item.trim()).filter(Boolean)));

  return unique
    .map((text) => {
      const n = normalize(text);
      return { text, starts: n.startsWith(q), idx: n.indexOf(q), len: n.length };
    })
    .sort((a, b) => {
      if (a.starts !== b.starts) return a.starts ? -1 : 1;
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.len - b.len;
    })
    .map((item) => item.text);
}
