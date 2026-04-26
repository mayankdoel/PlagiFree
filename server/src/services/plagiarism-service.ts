import crypto from "node:crypto";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { getReportById, getCachedReport, saveReport } from "./storage";
import { extractPageText, searchPhrase } from "./search-service";
import type { ReportRecord, SourceMatch } from "../types/report";
import {
  buildNGrams,
  cleanedText,
  cosineSimilarity,
  normalizeWhitespace,
  severityFromScore,
  tokenize,
} from "../utils/text";

async function extractTextFromFile(file: Express.Multer.File) {
  const extension = file.originalname.split(".").pop()?.toLowerCase();

  if (extension === "txt") {
    return file.buffer.toString("utf-8");
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  if (extension === "pdf") {
    const result = await pdfParse(file.buffer);
    return result.text;
  }

  throw new Error("Unsupported file type. Upload TXT, PDF, or DOCX files only.");
}

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

export async function createReport(options: { text?: string; file?: Express.Multer.File | null }) {
  const incomingText = options.file ? await extractTextFromFile(options.file) : options.text ?? "";
  const normalizedText = normalizeWhitespace(incomingText);

  if (!normalizedText) {
    throw new Error("No readable text was provided. Paste content or upload a supported file.");
  }

  const contentHash = hashText(normalizedText);
  const cachedReport = await getCachedReport(contentHash);

  if (cachedReport) {
    return {
      ...cachedReport,
      cached: true,
    };
  }

  const tokens = tokenize(normalizedText);
  const phrases = buildNGrams(tokens);
  const inputCleaned = cleanedText(normalizedText);
  const collectedMatches: SourceMatch[] = [];

  for (const phrase of phrases) {
    const searchResults = await searchPhrase(phrase);

    for (const searchResult of searchResults) {
      const pageText = await extractPageText(searchResult.url);
      const comparisonText = pageText || searchResult.snippet || "";
      const similarity = Math.round(cosineSimilarity(inputCleaned, comparisonText) * 100);

      if (similarity < 12) {
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

  const report: ReportRecord = {
    id: crypto.randomUUID(),
    hash: contentHash,
    text: normalizedText,
    score,
    severity: severityFromScore(score),
    matches,
    createdAt: new Date().toISOString(),
    cached: false,
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
  return getReportById(id);
}
