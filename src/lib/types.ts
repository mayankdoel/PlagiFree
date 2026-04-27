export type MatchSeverity = "original" | "moderate" | "high";
export type SearchProvider = "gemini-google-search" | "unavailable";

export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  snippet?: string;
  title?: string;
  sourceType?: "research-paper" | "web" | "unknown";
}

export interface AnalysisMeta {
  searchProvider: SearchProvider;
  pipelineVersion?: number;
  searchedPhrases: string[];
  searchQueries?: string[];
  sourceLookups: number;
  warning?: string;
  researchSummary?: string;
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

