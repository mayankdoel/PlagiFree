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

function rawWordTokens(text: string) {
  return normalizeWhitespace(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’/-]*/gu) ?? [];
}

function isNumericToken(token: string) {
  return /^\d+$/.test(token);
}

function isRomanNumeralToken(token: string) {
  return /^(?:[ivxlcdm]+)$/i.test(token);
}

function isSearchableToken(token: string) {
  if (token.length < 3) {
    return false;
  }

  if (isNumericToken(token) || isRomanNumeralToken(token)) {
    return false;
  }

  return /[a-z]/i.test(token);
}

function phraseQualityScore(phrase: string) {
  const tokens = phrase.split(" ");
  const uniqueCount = new Set(tokens).size;
  const longTokenCount = tokens.filter((token) => token.length > 4).length;
  const alphabeticCount = tokens.filter((token) => /[a-z]/i.test(token)).length;
  const repeatedTokenPenalty = tokens.length - uniqueCount;

  return uniqueCount * 4 + longTokenCount * 2 + alphabeticCount - repeatedTokenPenalty * 3;
}

function rawPhraseQualityScore(tokens: string[], occurrences: number, firstIndex: number) {
  const loweredTokens = tokens.map((token) => token.toLowerCase());
  const uniqueCount = new Set(loweredTokens).size;
  const searchableCount = loweredTokens.filter(isSearchableToken).length;
  const stopWordCount = loweredTokens.filter((token) => STOP_WORDS.has(token)).length;
  const longTokenCount = loweredTokens.filter((token) => token.length > 5).length;
  const titleCaseCount = tokens.filter((token) => /^[A-Z][\p{L}\p{N}'’/-]*$/u.test(token)).length;
  const allCapsCount = tokens.filter((token) => token.length > 1 && token === token.toUpperCase() && /[A-Z]/.test(token)).length;
  const repeatedBonus = Math.min(occurrences, 4) * 8;
  const earlyBonus = firstIndex < 80 ? 10 : firstIndex < 220 ? 5 : 0;

  return (
    searchableCount * 5 +
    uniqueCount * 3 +
    longTokenCount * 2 +
    titleCaseCount +
    allCapsCount * 2 +
    repeatedBonus +
    earlyBonus -
    stopWordCount
  );
}

function buildExactSearchPhrases(text: string, limit: number) {
  const tokens = rawWordTokens(text);

  if (tokens.length < 4) {
    return [];
  }

  const candidates = new Map<
    string,
    {
      phrase: string;
      count: number;
      firstIndex: number;
      searchableCount: number;
      uniqueCount: number;
      stopWordRatio: number;
    }
  >();

  for (let size = 4; size <= 9; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phraseTokens = tokens.slice(index, index + size);
      const loweredTokens = phraseTokens.map((token) => token.toLowerCase());
      const searchableCount = loweredTokens.filter(isSearchableToken).length;

      if (searchableCount < 4) {
        continue;
      }

      const uniqueCount = new Set(loweredTokens).size;
      if (uniqueCount < 4) {
        continue;
      }

      const stopWordCount = loweredTokens.filter((token) => STOP_WORDS.has(token)).length;
      const stopWordRatio = stopWordCount / phraseTokens.length;
      if (stopWordRatio > 0.55) {
        continue;
      }

      const phrase = phraseTokens.join(" ");
      const key = phrase.toLowerCase();
      const existing = candidates.get(key);

      if (existing) {
        existing.count += 1;
        continue;
      }

      candidates.set(key, {
        phrase,
        count: 1,
        firstIndex: index,
        searchableCount,
        uniqueCount,
        stopWordRatio,
      });
    }
  }

  return [...candidates.values()]
    .map((candidate) => ({
      phrase: candidate.phrase,
      score:
        rawPhraseQualityScore(candidate.phrase.split(" "), candidate.count, candidate.firstIndex) +
        candidate.uniqueCount * 2 +
        candidate.searchableCount * 2 -
        Math.round(candidate.stopWordRatio * 8),
      count: candidate.count,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return right.phrase.length - left.phrase.length;
    })
    .map((candidate) => candidate.phrase)
    .filter((phrase, index, phrases) => {
      const lowered = phrase.toLowerCase();
      return phrases.findIndex((item) => item.toLowerCase().includes(lowered)) === index;
    })
    .slice(0, limit);
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

export function selectSearchPhrases(text: string, limit = 12) {
  const exactCandidates = buildExactSearchPhrases(text, limit);
  const filteredTokens = cleanTokens(tokenize(text)).filter(isSearchableToken);
  const fallbackCandidates = buildNGrams(filteredTokens, 5, 8, limit * 5)
    .map((phrase) => ({
      phrase,
      score: phraseQualityScore(phrase),
      uniqueWords: new Set(phrase.split(" ")).size,
    }))
    .filter((candidate) => candidate.uniqueWords >= 4)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.phrase.length - left.phrase.length;
    })
    .map((candidate) => candidate.phrase);

  return [...exactCandidates, ...fallbackCandidates]
    .filter((phrase, index, phrases) => {
      const lowered = phrase.toLowerCase();
      return phrases.findIndex((item) => item.toLowerCase().includes(lowered)) === index;
    })
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

