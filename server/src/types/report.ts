export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  title?: string;
  snippet?: string;
}

export interface AnalysisMeta {
  searchProvider: "bing-api" | "bing-web" | "unavailable";
  searchedPhrases: string[];
  sourceLookups: number;
  warning?: string;
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

