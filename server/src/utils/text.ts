export function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function tokenize(text: string) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function buildNGrams(tokens: string[], min = 5, max = 8, limit = 12) {
  const phrases: string[] = [];

  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(" "));
    }
  }

  return [...new Set(phrases)].slice(0, limit);
}
