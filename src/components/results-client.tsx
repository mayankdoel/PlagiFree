"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, ArrowLeft, Download, Globe, LoaderCircle, ScanText, ShieldCheck } from "lucide-react";

import { buildHighlightSegments } from "@/lib/highlight";
import type { MatchSeverity, PlagiarismReport } from "@/lib/types";

const severityConfig: Record<
  MatchSeverity,
  { label: string; ringColor: string; textColor: string; badge: string }
> = {
  original: {
    label: "Original",
    ringColor: "#5ff5ba",
    textColor: "text-emerald-300",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  moderate: {
    label: "Moderate overlap",
    ringColor: "#ffc857",
    textColor: "text-amber-200",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  },
  high: {
    label: "High plagiarism risk",
    ringColor: "#ff7f6b",
    textColor: "text-rose-200",
    badge: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  },
};

export function ResultsClient({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchReport = async () => {
      try {
        setLoading(true);
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

  const highlightSegments = useMemo(
    () => (report ? buildHighlightSegments(report.text, report.matches) : []),
    [report],
  );

  if (loading) {
    return (
      <div className="glass-panel flex min-h-[420px] items-center justify-center p-10">
        <div className="flex items-center gap-3 text-slate-300">
          <LoaderCircle className="h-5 w-5 animate-spin text-accent-cyan" />
          Building your plagiarism report...
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
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition duration-200 hover:border-accent-cyan/40 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to checker
        </Link>
      </div>
    );
  }

  const severity = severityConfig[report.severity];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition duration-200 hover:border-accent-cyan/40 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          New check
        </Link>

        <a
          href={`/api/report/${report.id}`}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-cyan via-sky-400 to-accent-mint px-5 py-3 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(98,230,255,0.25)]"
        >
          <Download className="h-4 w-4" />
          Download PDF Report
        </a>
      </div>

      <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <article className="glass-panel p-7">
          <div
            className="score-ring mx-auto flex h-52 w-52 items-center justify-center rounded-full"
            style={
              {
                "--ring-value": report.score,
                "--ring-color": severity.ringColor,
              } as CSSProperties
            }
          >
            <div className="text-center">
              <div className="text-5xl font-bold text-white">{report.score}%</div>
              <div className="mt-2 text-sm uppercase tracking-[0.22em] text-slate-400">Similarity</div>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <div className={`inline-flex rounded-full border px-3 py-1 text-sm ${severity.badge}`}>
              {severity.label}
            </div>
            <div className="grid gap-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="flex items-center gap-2">
                  <ScanText className="h-4 w-4 text-accent-cyan" />
                  Matches found
                </span>
                <strong className="text-white">{report.matches.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-accent-mint" />
                  Source type
                </span>
                <strong className="text-white">{report.source?.inputType ?? "text"}</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent-cyan" />
                  Cache status
                </span>
                <strong className="text-white">{report.cached ? "Cached" : "Fresh scan"}</strong>
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-6">
          <article className="glass-panel p-6">
            <h2 className="mb-4 text-2xl font-semibold text-white">Highlighted input</h2>
            <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/65 p-5 text-[15px] leading-8 text-slate-200">
              {highlightSegments.map((segment, index) => (
                <span
                  key={`${segment.text.slice(0, 20)}-${index}`}
                  className={
                    segment.highlighted
                      ? "rounded bg-amber-300/20 px-1 py-0.5 text-amber-100"
                      : undefined
                  }
                >
                  {segment.text}
                </span>
              ))}
            </div>
          </article>

          <article className="glass-panel overflow-hidden">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-2xl font-semibold text-white">Matched sources</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-slate-300">
                  <tr>
                    <th className="px-6 py-4 font-medium">Source URL</th>
                    <th className="px-6 py-4 font-medium">Matched Phrase</th>
                    <th className="px-6 py-4 font-medium">Match %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {report.matches.map((match) => (
                    <tr
                      key={`${match.url}-${match.matchedText}`}
                      className="transition duration-200 hover:bg-white/[0.03]"
                    >
                      <td className="px-6 py-4 align-top text-slate-200">
                        <a
                          href={match.url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 break-all text-accent-cyan transition duration-200 hover:text-white"
                        >
                          {match.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-300">{match.matchedText}</td>
                      <td className={`px-6 py-4 align-top font-semibold ${severity.textColor}`}>
                        {match.similarity}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
