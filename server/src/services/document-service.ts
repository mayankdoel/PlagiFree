import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { normalizeWhitespace } from "../utils/text";

export interface TextStats {
  text: string;
  words: number;
  characters: number;
}

export async function extractTextFromFile(file: Express.Multer.File) {
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

export function buildTextStats(rawText: string): TextStats {
  const text = normalizeWhitespace(rawText);
  const words = text ? text.split(/\s+/).length : 0;

  return {
    text,
    words,
    characters: text.length,
  };
}
