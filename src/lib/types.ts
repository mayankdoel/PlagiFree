export type MatchSeverity = "original" | "moderate" | "high";

export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  snippet?: string;
  title?: string;
}

export interface AnalysisMeta {
  searchProvider: "bing-api" | "bing-web" | "unavailable";
  searchedPhrases: string[];
  sourceLookups: number;
  warning?: string;
}

export interface PlagiarismReport {
  id: string;
  score: number;
  severity: MatchSeverity;
  text: string;
  matches: SourceMatch[];
  createdAt: string;
  cached: boolean;
  analysis: AnalysisMeta;
  source?: {
    filename?: string;
    inputType: "text" | "file";
  };
}

