const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "this",
  "these",
  "those",
  "or",
  "if",
  "but",
  "into",
  "their",
  "there",
  "than",
  "them",
  "they",
  "we",
  "you",
  "your",
]);

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

export function cleanTokens(tokens: string[]) {
  return tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function cleanedText(text: string) {
  return cleanTokens(tokenize(text)).join(" ");
}

export function buildNGrams(tokens: string[], min = 5, max = 8, limit = 12) {
  const counts = new Map<string, number>();

  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return right[0].length - left[0].length;
    })
    .map(([phrase]) => phrase)
    .filter((phrase, index, phrases) => phrases.findIndex((item) => item.includes(phrase)) === index)
    .slice(0, limit);
}

export function cosineSimilarity(left: string, right: string) {
  const leftTokens = cleanTokens(tokenize(left));
  const rightTokens = cleanTokens(tokenize(right));

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftVector = new Map<string, number>();
  const rightVector = new Map<string, number>();

  for (const token of leftTokens) {
    leftVector.set(token, (leftVector.get(token) ?? 0) + 1);
  }

  for (const token of rightTokens) {
    rightVector.set(token, (rightVector.get(token) ?? 0) + 1);
  }

  const keys = new Set([...leftVector.keys(), ...rightVector.keys()]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const key of keys) {
    const leftValue = leftVector.get(key) ?? 0;
    const rightValue = rightVector.get(key) ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function severityFromScore(score: number): "original" | "moderate" | "high" {
  if (score <= 20) {
    return "original";
  }
  if (score <= 50) {
    return "moderate";
  }
  return "high";
}

