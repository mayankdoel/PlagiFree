import type { ReportRecord } from "../types/report";

const reports = new Map<string, ReportRecord>();
const hashIndex = new Map<string, string>();

export async function getCachedReport(hash: string) {
  const reportId = hashIndex.get(hash);
  return reportId ? reports.get(reportId) ?? null : null;
}

export async function saveReport(report: ReportRecord) {
  reports.set(report.id, report);
  hashIndex.set(report.hash, report.id);
}

export async function getReportById(id: string) {
  return reports.get(id) ?? null;
}
