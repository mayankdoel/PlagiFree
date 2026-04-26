"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Download, LoaderCircle, ScanText } from "lucide-react";

import type { PlagiarismReport } from "@/lib/types";

export function ResultsClient({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/check/${reportId}`);
        if (!response.ok) {
          throw new Error("Unable to load this report.");
        }
        const payload = (await response.json()) as PlagiarismReport;
        if (active) {
          setReport(payload);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load report.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchReport();

    return () => {
      active = false;
    };
  }, [reportId]);

  if (loading) {
    return (
      <div className="glass-panel flex min-h-[320px] items-center justify-center p-10">
        <div className="flex items-center gap-3 text-slate-300">
          <LoaderCircle className="h-5 w-5 animate-spin text-accent-cyan" />
          Building your report...
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="glass-panel p-8">
        <div className="mb-4 flex items-center gap-3 text-rose-200">
          <AlertTriangle className="h-5 w-5" />
          <p>{error ?? "Report not found."}</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Back to checker
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          New check
        </Link>
        <a href={`/api/report/${report.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-cyan via-sky-400 to-accent-mint px-5 py-3 text-sm font-semibold text-slate-950">
          <Download className="h-4 w-4" />
          Download PDF Report
        </a>
      </div>

      <div className="glass-panel p-6">
        <div className="mb-4 flex items-center gap-2 text-slate-300">
          <ScanText className="h-4 w-4 text-accent-cyan" />
          Similarity score
        </div>
        <p className="text-6xl font-bold text-white">{report.score}%</p>
        <p className="mt-3 text-sm text-slate-400">{report.matches.length} matches found</p>
      </div>
    </div>
  );
}
