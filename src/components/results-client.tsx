"use client";

import { useEffect, useState } from "react";

import type { PlagiarismReport } from "@/lib/types";

export function ResultsClient({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/check/${reportId}`);
        if (!response.ok) {
          throw new Error("Unable to load this report.");
        }
        const payload = (await response.json()) as PlagiarismReport;
        setReport(payload);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load report.");
      }
    };

    void fetchReport();
  }, [reportId]);

  if (error) {
    return <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-6 text-rose-100">{error}</div>;
  }

  if (!report) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-slate-300">Loading report...</div>;
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-slate-200">
      <h2 className="text-2xl font-semibold text-white">Similarity Score</h2>
      <p className="mt-4 text-5xl font-bold">{report.score}%</p>
    </div>
  );
}
