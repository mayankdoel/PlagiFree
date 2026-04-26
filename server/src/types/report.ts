export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  title?: string;
  snippet?: string;
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
  source: {
    inputType: "text" | "file";
    filename?: string;
  };
}

