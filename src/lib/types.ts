export type MatchSeverity = "original" | "moderate" | "high";

export interface SourceMatch {
  url: string;
  matchedText: string;
  similarity: number;
  snippet?: string;
  title?: string;
}

export interface PlagiarismReport {
  id: string;
  score: number;
  severity: MatchSeverity;
  text: string;
  matches: SourceMatch[];
  createdAt: string;
  cached: boolean;
  source?: {
    filename?: string;
    inputType: "text" | "file";
  };
}

