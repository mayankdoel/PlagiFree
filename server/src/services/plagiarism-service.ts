import crypto from "node:crypto";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { getCachedReport, getReportById, saveReport } from "./storage";
import type { ReportRecord } from "../types/report";
import { normalizeWhitespace } from "../utils/text";

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

  const report: ReportRecord = {
    id: crypto.randomUUID(),
    hash,
    text: normalizedText,
    score: 0,
    severity: "original",
    matches: [],
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
