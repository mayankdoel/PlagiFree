export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  title?: string;
  snippet?: string;
  sourceType?: "research-paper" | "web" | "unknown";
}

export type SearchProvider = "gemini-google-search" | "unavailable";

export interface AnalysisMeta {
  searchProvider: SearchProvider;
  pipelineVersion?: number;
  searchedPhrases: string[];
  searchQueries?: string[];
  sourceLookups: number;
  warning?: string;
  researchSummary?: string;
}

export interface ReportRecord {
  id: string;
  hash: string;
  text: string;
  score: number;
  severity: "original" | "moderate" | "high";
  matches: SourceMatch[];
  createdAt: string;
  cached: boolean;
  analysis: AnalysisMeta;
  source: {
    inputType: "text" | "file";
    filename?: string;
  };
}

