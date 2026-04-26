import PDFDocument from "pdfkit";

import type { ReportRecord } from "../types/report";

function collectBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    document.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

export async function buildPdfReport(report: ReportRecord) {
  const document = new PDFDocument({ margin: 48, size: "A4" });
  const bufferPromise = collectBuffer(document);

  document.fillColor("#0f172a").fontSize(24).text("PlagiFree Report", { align: "left" });
  document.moveDown(0.4);
  document.fillColor("#475569").fontSize(11).text(`Generated: ${new Date(report.createdAt).toLocaleString()}`);
  document.text(`Similarity score: ${report.score}%`);
  document.text(`Severity: ${report.severity}`);
  document.text(`Input type: ${report.source.inputType}${report.source.filename ? ` (${report.source.filename})` : ""}`);

  document.moveDown();
  document.fillColor("#0f172a").fontSize(16).text("Matched Sources");
  document.moveDown(0.6);

  report.matches.forEach((match, index) => {
    document
      .fillColor("#111827")
      .fontSize(12)
      .text(`${index + 1}. ${match.title ?? match.url}`, { continued: false });
    document.fillColor("#2563eb").fontSize(10).text(match.url);
    document.fillColor("#334155").fontSize(10).text(`Phrase: ${match.matchedText}`);
    document.text(`Match: ${match.similarity}%`);
    if (match.snippet) {
      document.text(`Snippet: ${match.snippet}`);
    }
    document.moveDown(0.8);
  });

  document.addPage();
  document.fillColor("#0f172a").fontSize(16).text("Input Text");
  document.moveDown(0.6);
  document.fillColor("#334155").fontSize(10).text(report.text);

  document.end();
  return bufferPromise;
}
