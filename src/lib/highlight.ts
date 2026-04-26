import type { SourceMatch } from "@/lib/types";

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildHighlightSegments(
  text: string,
  matches: SourceMatch[],
): HighlightSegment[] {
  const phrases = Array.from(
    new Set(
      matches
        .map((match) => match.matchedText?.trim())
        .filter((phrase): phrase is string => Boolean(phrase && phrase.length > 4)),
    ),
  ).sort((left, right) => right.length - left.length);

  if (!phrases.length) {
    return [{ text, highlighted: false }];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  const lowerText = text.toLowerCase();

  for (const phrase of phrases) {
    const regex = new RegExp(escapeRegex(phrase.toLowerCase()), "g");
    let result = regex.exec(lowerText);

    while (result) {
      ranges.push({ start: result.index, end: result.index + phrase.length });
      result = regex.exec(lowerText);
    }
  }

  if (!ranges.length) {
    return [{ text, highlighted: false }];
  }

  ranges.sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];

  for (const range of ranges) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), highlighted: false });
    }
    segments.push({ text: text.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}

