import crypto from "node:crypto";

import { buildTextStats, extractTextFromFile } from "./document-service";
import { getReportById, getCachedReport, saveReport } from "./storage";
import { extractPageText, searchPhrase } from "./search-service";
import type { ReportRecord, SourceMatch } from "../types/report";
import {
  cleanedText,
  cosineSimilarity,
  cleanTokens,
  severityFromScore,
  selectSearchPhrases,
  tokenize,
} from "../utils/text";

function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function deduplicateMatches(matches: SourceMatch[]) {
  const unique = new Map<string, SourceMatch>();

  for (const match of matches) {
    const key = `${match.url}:${match.matchedText}`;
    const existing = unique.get(key);
    if (!existing || match.similarity > existing.similarity) {
      unique.set(key, match);
    }
  }

  return [...unique.values()].sort((left, right) => right.similarity - left.similarity).slice(0, 20);
}

function calculateScore(sourceText: string, matches: SourceMatch[]) {
  if (!matches.length) {
    return 0;
  }

  const lowerText = sourceText.toLowerCase();
  const coveredCharacters = new Set<number>();

  for (const match of matches) {
    const phrase = match.matchedText.toLowerCase();
    let index = lowerText.indexOf(phrase);

    while (index !== -1) {
      for (let offset = index; offset < index + phrase.length; offset += 1) {
        coveredCharacters.add(offset);
      }
      index = lowerText.indexOf(phrase, index + phrase.length);
    }
  }

  const coverage = coveredCharacters.size / Math.max(sourceText.length, 1);
  const topSimilarity = matches.slice(0, 5).reduce((total, match) => total + match.similarity, 0) / Math.min(matches.length, 5);
  return Math.min(100, Math.round(coverage * 65 + topSimilarity * 0.35));
}

function containsExactPhrase(content: string, phrase: string) {
  return content.toLowerCase().includes(phrase.toLowerCase());
}

function tokenOverlapRatio(phrase: string, content: string) {
  const phraseTokens = cleanTokens(tokenize(phrase));
  if (!phraseTokens.length) {
    return 0;
  }

  const contentTokens = new Set(cleanTokens(tokenize(content)));
  const overlapCount = phraseTokens.filter((token) => contentTokens.has(token)).length;
  return overlapCount / phraseTokens.length;
}

function calculateMatchSimilarity(options: {
  phrase: string;
  pageText: string;
  snippet: string;
  title: string;
  inputText: string;
  inputCleaned: string;
}) {
  const phraseContext = [options.title, options.snippet, options.pageText.slice(0, 4000)]
    .filter(Boolean)
    .join(" ");
  const phraseSimilarity = Math.round(cosineSimilarity(options.phrase, phraseContext) * 100);
  const documentSimilarity = options.pageText
    ? Math.round(cosineSimilarity(options.inputCleaned, options.pageText) * 100)
    : 0;
  const overlapRatio = tokenOverlapRatio(options.phrase, phraseContext);
  const phraseAppearsInDocument = containsExactPhrase(options.inputText, options.phrase);
  const exactPhraseFound =
    containsExactPhrase(phraseContext, options.phrase) && phraseAppearsInDocument;

  let similarity = Math.max(documentSimilarity, phraseSimilarity);

  if (overlapRatio >= 0.7) {
    similarity = Math.max(similarity, Math.round(overlapRatio * 100));
  }

  if (exactPhraseFound) {
    similarity = Math.max(similarity, 86);
  }

  return similarity;
}

function ensureAnalysisMeta(report: ReportRecord): ReportRecord {
  if (report.analysis) {
    return report;
  }

  return {
    ...report,
    analysis: {
      searchProvider: "unavailable",
      searchedPhrases: [],
      sourceLookups: 0,
      warning: "This report was created before search diagnostics were added.",
    },
  };
}

export async function createReport(options: { text?: string; file?: Express.Multer.File | null }) {
  const incomingText = options.file ? await extractTextFromFile(options.file) : options.text ?? "";
  const { text: normalizedText } = buildTextStats(incomingText);

  if (!normalizedText) {
    throw new Error("No readable text was provided. Paste content or upload a supported file.");
  }

  const contentHash = hashText(normalizedText);
  const cachedReport = await getCachedReport(contentHash);

  if (cachedReport) {
    return {
      ...ensureAnalysisMeta(cachedReport),
      cached: true,
    };
  }

  const phrases = selectSearchPhrases(normalizedText);
  const inputCleaned = cleanedText(normalizedText);
  const collectedMatches: SourceMatch[] = [];
  const providerOrder = new Set<ReportRecord["analysis"]["searchProvider"]>();
  let sourceLookups = 0;
  let unavailableSearchCount = 0;
  let analysisWarning: string | undefined =
    phrases.length === 0
      ? "The extracted text did not contain enough high-signal phrases to run a reliable external comparison."
      : undefined;

  for (const phrase of phrases) {
    const searchResponse = await searchPhrase(phrase);
    providerOrder.add(searchResponse.provider);

    if (searchResponse.warning && !analysisWarning) {
      analysisWarning = searchResponse.warning;
    }

    if (searchResponse.provider === "unavailable") {
      unavailableSearchCount += 1;
      if (unavailableSearchCount >= 2 && sourceLookups === 0) {
        break;
      }
      continue;
    }

    for (const searchResult of searchResponse.results) {
      sourceLookups += 1;
      const pageText = await extractPageText(searchResult.url);
      const similarity = calculateMatchSimilarity({
        phrase,
        pageText,
        snippet: searchResult.snippet ?? "",
        title: searchResult.name ?? "",
        inputText: normalizedText,
        inputCleaned,
      });

      if (similarity < 24) {
        continue;
      }

      collectedMatches.push({
        url: searchResult.url,
        matchedText: phrase,
        similarity,
        title: searchResult.name,
        snippet: searchResult.snippet,
      });
    }
  }

  const matches = deduplicateMatches(collectedMatches);
  const score = calculateScore(normalizedText, matches);
  const searchProvider = providerOrder.has("bing-api")
    ? "bing-api"
    : providerOrder.has("bing-web")
      ? "bing-web"
      : "unavailable";
  const warning =
    matches.length === 0 && searchProvider === "unavailable"
      ? "External source search was unavailable during this scan, so 0% does not guarantee originality."
      : matches.length === 0 && sourceLookups > 0
        ? "No strong external matches were found for the best phrases extracted from this document."
        : matches.length === 0 && phrases.length === 0
          ? "This file did not yield enough searchable phrases for a dependable plagiarism scan."
      : analysisWarning;

  const report: ReportRecord = {
    id: crypto.randomUUID(),
    hash: contentHash,
    text: normalizedText,
    score,
    severity: severityFromScore(score),
    matches,
    createdAt: new Date().toISOString(),
    cached: false,
    analysis: {
      searchProvider,
      searchedPhrases: phrases,
      sourceLookups,
      warning,
    },
    source: options.file
      ? {
          inputType: "file",
          filename: options.file.originalname,
        }
      : {
          inputType: "text",
        },
  };

  await saveReport(report);
  return report;
}

export async function loadReport(id: string) {
  const report = await getReportById(id);
  return report ? ensureAnalysisMeta(report) : null;
}
