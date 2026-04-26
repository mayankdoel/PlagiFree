import crypto from "node:crypto";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { extractPageText, searchPhrase } from "./search-service";
import { getCachedReport, getReportById, saveReport } from "./storage";
import type { ReportRecord, SourceMatch } from "../types/report";
import { buildNGrams, cleanedText, cosineSimilarity, normalizeWhitespace, tokenize } from "../utils/text";

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

  return Math.min(100, Math.round((coveredCharacters.size / Math.max(sourceText.length, 1)) * 100));
}

export async function createReport(options: { text?: string; file?: Express.Multer.File | null }) {
  const incomingText = options.file ? await extractTextFromFile(options.file) : options.text ?? "";
  const normalizedText = normalizeWhitespace(incomingText);

  if (!normalizedText) {
    throw new Error("No readable text was provided. Paste content or upload a supported file.");
  }

  const hash = hashText(normalizedText);
  const cached = await getCachedReport(hash);
  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const inputCleaned = cleanedText(normalizedText);
  const phrases = buildNGrams(tokenize(normalizedText));
  const matches: SourceMatch[] = [];

  for (const phrase of phrases) {
    const searchResults = await searchPhrase(phrase);

    for (const searchResult of searchResults) {
      const pageText = await extractPageText(searchResult.url);
      const comparisonText = pageText || searchResult.snippet || "";
      const similarity = Math.round(cosineSimilarity(inputCleaned, comparisonText) * 100);

      if (similarity < 10) {
        continue;
      }

      matches.push({
        url: searchResult.url,
        matchedText: phrase,
        similarity,
        title: searchResult.name,
        snippet: searchResult.snippet,
      });
    }
  }

  const report: ReportRecord = {
    id: crypto.randomUUID(),
    hash,
    text: normalizedText,
    score: calculateScore(normalizedText, matches),
    severity: "original",
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
