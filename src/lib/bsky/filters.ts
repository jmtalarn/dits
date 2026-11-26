const MUTED_WORDS_KEY = 'dits_muted_words_v1';

export function getMutedWords(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MUTED_WORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function setMutedWords(words: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = Array.from(
    new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))
  );
  localStorage.setItem(MUTED_WORDS_KEY, JSON.stringify(normalized));
}

export function matchesMutedWords(text: string | undefined, mutedWords: string[]): boolean {
  if (!text || mutedWords.length === 0) return false;
  const lower = text.toLowerCase();
  return mutedWords.some((term) => lower.includes(term));
}
