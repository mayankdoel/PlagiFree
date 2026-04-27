import crypto from "node:crypto";

import { buildTextStats, extractTextFromFile } from "./document-service";
import { searchResearchSources } from "./gemini-research-service";
import { getReportById, getCachedReport, saveReport } from "./storage";
import type { ReportRecord, SourceMatch } from "../types/report";
import { severityFromScore, selectSearchPhrases } from "../utils/text";

const SCAN_PIPELINE_VERSION = 3;

export class PlagiarismCheckError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PlagiarismCheckError";
    this.statusCode = statusCode;
  }
}

function hashText(text: string) {
  return crypto
    .createHash("sha256")
    .update(`gemini-only-v${SCAN_PIPELINE_VERSION}:${text}`)
    .digest("hex");
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

  return [...unique.values()]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 20);
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
  const topSimilarity =
    matches.slice(0, 5).reduce((total, match) => total + match.similarity, 0) /
    Math.min(matches.length, 5);

  return Math.min(100, Math.round(coverage * 65 + topSimilarity * 0.35));
}

function ensureAnalysisMeta(report: ReportRecord): ReportRecord {
  if (report.analysis) {
    return report;
  }

  return {
    ...report,
    analysis: {
      searchProvider: "unavailable",
      pipelineVersion: 0,
      searchedPhrases: [],
      searchQueries: [],
      sourceLookups: 0,
      warning: "This report was created before Gemini-only research diagnostics were added.",
      researchSummary: undefined,
    },
  };
}

function isCurrentGeminiReport(report: ReportRecord) {
  return (
    report.analysis?.pipelineVersion === SCAN_PIPELINE_VERSION &&
    report.analysis.searchProvider === "gemini-google-search" &&
    report.matches.length > 0
  );
}

export async function createReport(options: { text?: string; file?: Express.Multer.File | null }) {
  const incomingText = options.file ? await extractTextFromFile(options.file) : options.text ?? "";
  const { text: normalizedText } = buildTextStats(incomingText);

  if (!normalizedText) {
    throw new Error("No readable text was provided. Paste content or upload a supported file.");
  }

  const contentHash = hashText(normalizedText);
  const cachedReport = await getCachedReport(contentHash);

  if (cachedReport && isCurrentGeminiReport(cachedReport)) {
    return {
      ...ensureAnalysisMeta(cachedReport),
      cached: true,
    };
  }

  const phrases = selectSearchPhrases(normalizedText);
  const geminiResearch = await searchResearchSources(normalizedText, phrases);

  if (geminiResearch.warning?.includes("GEMINI_API_KEY is not configured")) {
    throw new PlagiarismCheckError(geminiResearch.warning, 400);
  }

  if (geminiResearch.retryable && geminiResearch.matches.length === 0) {
    throw new PlagiarismCheckError(
      "Gemini is temporarily overloaded. I retried the request and tried fallback Gemini models, but Google still returned a temporary capacity error. Please run the check again in a minute.",
      503,
    );
  }

  const matches = deduplicateMatches(geminiResearch.matches);
  const score = calculateScore(normalizedText, matches);
  const warning =
    geminiResearch.warning ??
    (matches.length === 0
      ? "Gemini did not confirm any strong source overlaps for this document."
      : undefined);

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
      searchProvider:
        geminiResearch.provider === "gemini-google-search" ? "gemini-google-search" : "unavailable",
      pipelineVersion: SCAN_PIPELINE_VERSION,
      searchedPhrases: phrases,
      searchQueries: geminiResearch.searchQueries,
      sourceLookups: geminiResearch.sourceLookups,
      warning,
      researchSummary: geminiResearch.summary,
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
