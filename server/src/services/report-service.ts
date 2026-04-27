import PDFDocument from "pdfkit";

import type { ReportRecord, SourceMatch } from "../types/report";

const COLORS = {
  bg: "#f6f8fc",
  ink: "#111827",
  muted: "#64748b",
  line: "#dbe4f0",
  white: "#ffffff",
  navy: "#0b1020",
  cyan: "#22d3ee",
  mint: "#5ff5ba",
  amber: "#fbbf24",
  coral: "#fb7185",
  blue: "#60a5fa",
  panel: "#eef4ff",
};

const PAGE_MARGIN = 42;
const FOOTER_GAP = 40;

function collectBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    document.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function providerLabel(report: ReportRecord) {
  return report.analysis.searchProvider === "gemini-google-search"
    ? "Gemini academic research"
    : "Gemini unavailable";
}

function severityTheme(report: ReportRecord) {
  if (report.severity === "high") {
    return { label: "High risk", accent: COLORS.coral, fill: "#fff1f2" };
  }

  if (report.severity === "moderate") {
    return { label: "Moderate overlap", accent: COLORS.amber, fill: "#fffbeb" };
  }

  return { label: "Looks original", accent: COLORS.mint, fill: "#ecfdf5" };
}

function sourceLabel(match: SourceMatch) {
  if (match.sourceType === "research-paper") {
    return "Research paper";
  }
  if (match.sourceType === "web") {
    return "Web source";
  }
  return "Source";
}

function drawPageChrome(document: PDFKit.PDFDocument, pageNumber: number) {
  const { width, height } = document.page;

  document.rect(0, 0, width, height).fill(COLORS.bg);
  document.rect(0, 0, width, 8).fill(COLORS.cyan);
  document.rect(width * 0.38, 0, width * 0.24, 8).fill(COLORS.mint);

  document
    .fillColor("#94a3b8")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("PLAGIFREE", PAGE_MARGIN, height - 28, { lineBreak: false });

  document
    .fillColor("#94a3b8")
    .font("Helvetica")
    .fontSize(8)
    .text(`Page ${pageNumber}`, width - PAGE_MARGIN - 45, height - 28, {
      width: 45,
      align: "right",
      lineBreak: false,
    });
}

function addPage(document: PDFKit.PDFDocument, page: { value: number }) {
  if (page.value > 0) {
    document.addPage();
  }

  page.value += 1;
  drawPageChrome(document, page.value);
  document.y = 62;
}

function availableBottom(document: PDFKit.PDFDocument) {
  return document.page.height - FOOTER_GAP;
}

function ensureSpace(document: PDFKit.PDFDocument, page: { value: number }, neededHeight: number) {
  if (document.y + neededHeight <= availableBottom(document)) {
    return;
  }

  addPage(document, page);
}

function drawPill(
  document: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  colors: { fill: string; stroke?: string; text: string },
) {
  document.font("Helvetica-Bold").fontSize(8);
  const width = document.widthOfString(text) + 18;
  document
    .roundedRect(x, y, width, 20, 10)
    .fillAndStroke(colors.fill, colors.stroke ?? colors.fill);
  document.fillColor(colors.text).text(text, x + 9, y + 6, {
    width: width - 18,
    lineBreak: false,
  });
  return width;
}

function drawMetricCard(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent: string,
) {
  document.roundedRect(x, y, width, 78, 8).fillAndStroke(COLORS.white, COLORS.line);
  document.roundedRect(x, y, 6, 78, 4).fill(accent);
  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(label.toUpperCase(), x + 18, y + 16, {
      width: width - 30,
      lineBreak: false,
    });
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(value, x + 18, y + 38, {
      width: width - 30,
      lineBreak: false,
    });
}

function drawPieChart(
  document: PDFKit.PDFDocument,
  centerX: number,
  centerY: number,
  radius: number,
  score: number,
  overlapColor: string,
) {
  const drawable = document as PDFKit.PDFDocument & {
    arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => PDFKit.PDFDocument;
  };
  const overlap = Math.max(0, Math.min(100, score));

  document.circle(centerX, centerY, radius).fill("#e5edf8");

  if (overlap > 0) {
    drawable
      .moveTo(centerX, centerY)
      .lineTo(centerX, centerY - radius)
      .arc(centerX, centerY, radius, -90, -90 + (360 * overlap) / 100)
      .lineTo(centerX, centerY)
      .fill(overlapColor);
  }

  document.circle(centerX, centerY, radius * 0.58).fill(COLORS.white);
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(`${overlap}%`, centerX - 34, centerY - 15, {
      width: 68,
      align: "center",
      lineBreak: false,
    });
  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("OVERLAP", centerX - 34, centerY + 18, {
      width: 68,
      align: "center",
      characterSpacing: 1.5,
      lineBreak: false,
    });

  return { overlap, original: 100 - overlap };
}

function drawSectionHeading(document: PDFKit.PDFDocument, title: string, subtitle?: string) {
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(17)
    .text(title, PAGE_MARGIN, document.y);

  if (subtitle) {
    document
      .moveDown(0.25)
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(9.5)
      .text(subtitle, PAGE_MARGIN, document.y, {
        width: document.page.width - PAGE_MARGIN * 2,
        lineGap: 2,
      });
  }

  document.moveDown(0.8);
}

function drawCoverPage(document: PDFKit.PDFDocument, report: ReportRecord, page: { value: number }) {
  addPage(document, page);

  const { width } = document.page;
  const contentWidth = width - PAGE_MARGIN * 2;
  const theme = severityTheme(report);

  document.rect(0, 0, width, document.page.height).fill(COLORS.navy);
  document.rect(0, 0, width, 10).fill(COLORS.cyan);
  document.rect(width * 0.34, 0, width * 0.26, 10).fill(COLORS.mint);

  document
    .save()
    .rotate(-10, { origin: [width - 120, 160] })
    .rect(width - 210, 106, 250, 40)
    .fill(COLORS.cyan)
    .rect(width - 228, 162, 250, 40)
    .fill(COLORS.blue)
    .restore();

  document
    .fillColor("#93f8ff")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("PLAGIFREE REPORT", PAGE_MARGIN, 72, {
      characterSpacing: 3,
      lineBreak: false,
    });

  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(34)
    .text("Similarity analysis", PAGE_MARGIN, 108, {
      width: contentWidth * 0.68,
      lineGap: 3,
    });

  document
    .fillColor("#cbd5e1")
    .font("Helvetica")
    .fontSize(12)
    .text(
      "A cleaner plagiarism report with Gemini research notes, source evidence, and a quick visual breakdown.",
      PAGE_MARGIN,
      184,
      {
        width: contentWidth * 0.72,
        lineGap: 4,
      },
    );

  const leftX = PAGE_MARGIN;
  const topY = 258;
  const leftW = 220;
  const rightX = leftX + leftW + 16;
  const rightW = contentWidth - leftW - 16;

  document.roundedRect(leftX, topY, leftW, 186, 12).fillAndStroke("#111827", "#243146");
  drawPill(document, theme.label, leftX + 18, topY + 18, {
    fill: theme.fill,
    text: COLORS.ink,
  });
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(60)
    .text(`${report.score}%`, leftX + 18, topY + 58, {
      width: leftW - 36,
      lineBreak: false,
    });
  document
    .fillColor("#94a3b8")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("SIMILARITY", leftX + 22, topY + 126, {
      characterSpacing: 2,
      lineBreak: false,
    });

  document.roundedRect(leftX + 18, topY + 150, leftW - 36, 12, 6).fill("#1f2937");
  document
    .roundedRect(leftX + 18, topY + 150, Math.max(12, (leftW - 36) * (report.score / 100)), 12, 6)
    .fill(theme.accent);

  document.roundedRect(rightX, topY, rightW, 186, 12).fillAndStroke("#111827", "#243146");
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Scan snapshot", rightX + 18, topY + 20, {
      width: rightW - 36,
    });

  const metaRows = [
    ["Generated", formatDate(report.createdAt)],
    ["Input", `${report.source.inputType}${report.source.filename ? ` - ${truncate(report.source.filename, 36)}` : ""}`],
    ["Provider", providerLabel(report)],
    ["Sources checked", `${report.analysis.sourceLookups}`],
    ["Matches", `${report.matches.length}`],
  ];

  let rowY = topY + 52;
  for (const [label, value] of metaRows) {
    document
      .fillColor("#94a3b8")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(label.toUpperCase(), rightX + 18, rowY, {
        width: 102,
        lineBreak: false,
      });
    document
      .fillColor("#e5e7eb")
      .font("Helvetica")
      .fontSize(10)
      .text(value, rightX + 128, rowY - 1, {
        width: rightW - 146,
      });
    rowY += 24;
  }

  document.roundedRect(PAGE_MARGIN, 468, contentWidth, 170, 12).fillAndStroke("#0f172a", "#243146");
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Research verdict", PAGE_MARGIN + 20, 490, {
      width: contentWidth - 40,
    });
  document
    .fillColor("#cbd5e1")
    .font("Helvetica")
    .fontSize(10)
    .text(
      truncate(
        report.analysis.researchSummary ??
          report.analysis.warning ??
          "No extra Gemini summary was attached to this report.",
        560,
      ),
      PAGE_MARGIN + 20,
      522,
      {
        width: contentWidth - 40,
        lineGap: 4,
      },
    );
}

function drawOverviewPage(document: PDFKit.PDFDocument, report: ReportRecord, page: { value: number }) {
  addPage(document, page);
  drawSectionHeading(document, "Signal snapshot", "A visual read of overlap, originality, and source activity.");

  const theme = severityTheme(report);
  const chartBoxY = document.y;
  const contentWidth = document.page.width - PAGE_MARGIN * 2;
  const chartBoxW = 248;
  const sideX = PAGE_MARGIN + chartBoxW + 18;
  const sideW = contentWidth - chartBoxW - 18;

  document.roundedRect(PAGE_MARGIN, chartBoxY, chartBoxW, 250, 10).fillAndStroke(COLORS.white, COLORS.line);
  drawPieChart(document, PAGE_MARGIN + chartBoxW / 2, chartBoxY + 110, 66, report.score, theme.accent);

  drawPill(document, "Originality", PAGE_MARGIN + 24, chartBoxY + 196, {
    fill: "#ecfdf5",
    stroke: "#bbf7d0",
    text: "#047857",
  });
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(`${100 - report.score}%`, PAGE_MARGIN + 24, chartBoxY + 224, {
      width: 80,
      lineBreak: false,
    });

  drawPill(document, "Overlap", PAGE_MARGIN + 124, chartBoxY + 196, {
    fill: theme.fill,
    stroke: COLORS.line,
    text: COLORS.ink,
  });
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(`${report.score}%`, PAGE_MARGIN + 124, chartBoxY + 224, {
      width: 80,
      lineBreak: false,
    });

  document.roundedRect(sideX, chartBoxY, sideW, 250, 10).fillAndStroke(COLORS.white, COLORS.line);
  drawMetricCard(document, sideX + 16, chartBoxY + 16, (sideW - 44) / 2, "Severity", titleCase(report.severity), theme.accent);
  drawMetricCard(document, sideX + 28 + (sideW - 44) / 2, chartBoxY + 16, (sideW - 44) / 2, "Matches", `${report.matches.length}`, COLORS.cyan);
  drawMetricCard(document, sideX + 16, chartBoxY + 108, sideW - 32, "Provider", providerLabel(report), COLORS.mint);

  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Best phrases searched", sideX + 16, chartBoxY + 206, {
      width: sideW - 32,
    });
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text(
      truncate((report.analysis.searchedPhrases ?? []).join(" | "), 240) || "No high-signal phrases were stored for this scan.",
      sideX + 16,
      chartBoxY + 228,
      {
        width: sideW - 32,
        lineGap: 3,
      },
    );

  document.y = chartBoxY + 278;

  const queries = report.analysis.searchQueries?.slice(0, 8) ?? [];
  if (queries.length) {
    drawSectionHeading(document, "Gemini search queries", "The exact search-style prompts Gemini used while checking for overlap.");
    let x = PAGE_MARGIN;
    let y = document.y;
    const maxX = document.page.width - PAGE_MARGIN;

    for (const query of queries) {
      const label = truncate(query, 82);
      document.font("Helvetica-Bold").fontSize(8);
      const width = Math.min(maxX - PAGE_MARGIN, document.widthOfString(label) + 22);

      if (x + width > maxX) {
        x = PAGE_MARGIN;
        y += 28;
      }

      ensureSpace(document, page, y - document.y + 32);
      document.roundedRect(x, y, width, 22, 11).fillAndStroke("#ecfeff", "#bae6fd");
      document
        .fillColor("#0f766e")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(label, x + 11, y + 7, {
          width: width - 22,
          lineBreak: false,
        });
      x += width + 8;
    }

    document.y = y + 38;
  }
}

function measureSourceCardHeight(document: PDFKit.PDFDocument, match: SourceMatch, width: number) {
  const innerWidth = width - 36;
  document.font("Helvetica-Bold").fontSize(12);
  const titleHeight = document.heightOfString(truncate(match.title ?? match.url, 116), {
    width: innerWidth - 90,
    lineGap: 2,
  });
  document.font("Helvetica").fontSize(9.5);
  const phraseHeight = document.heightOfString(truncate(match.matchedText, 180), {
    width: innerWidth,
    lineGap: 2,
  });
  const snippet = match.snippet ? truncate(match.snippet, 260) : "";
  const snippetHeight = snippet
    ? document.heightOfString(snippet, {
        width: innerWidth,
        lineGap: 2,
      })
    : 0;

  return Math.max(132, 86 + titleHeight + phraseHeight + snippetHeight);
}

function drawSourceCard(document: PDFKit.PDFDocument, match: SourceMatch, index: number, y: number) {
  const x = PAGE_MARGIN;
  const width = document.page.width - PAGE_MARGIN * 2;
  const innerWidth = width - 36;
  const title = truncate(match.title ?? match.url, 116);
  const phrase = truncate(match.matchedText, 180);
  const snippet = match.snippet ? truncate(match.snippet, 260) : "";
  const height = measureSourceCardHeight(document, match, width);
  const accent = match.similarity >= 70 ? COLORS.coral : match.similarity >= 35 ? COLORS.amber : COLORS.cyan;

  document.roundedRect(x, y, width, height, 10).fillAndStroke(COLORS.white, COLORS.line);
  document.roundedRect(x, y, 6, height, 4).fill(accent);

  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(`#${index + 1} SOURCE`, x + 18, y + 16, {
      lineBreak: false,
    });
  document
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(title, x + 18, y + 34, {
      width: innerWidth - 86,
      lineGap: 2,
    });

  drawPill(document, `${match.similarity}%`, x + width - 70, y + 18, {
    fill: "#f8fafc",
    stroke: COLORS.line,
    text: COLORS.ink,
  });

  let cursorY = y + 38 + document.heightOfString(title, { width: innerWidth - 86, lineGap: 2 });
  document
    .fillColor("#2563eb")
    .font("Helvetica")
    .fontSize(8.5)
    .text(truncate(match.url, 120), x + 18, cursorY, {
      width: innerWidth,
    });
  cursorY += 22;

  const sourceBadge = drawPill(document, sourceLabel(match), x + 18, cursorY, {
    fill: "#f1f5f9",
    stroke: COLORS.line,
    text: COLORS.muted,
  });
  drawPill(document, "Matched phrase", x + 26 + sourceBadge, cursorY, {
    fill: "#ecfeff",
    stroke: "#bae6fd",
    text: "#0f766e",
  });
  cursorY += 30;

  document
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(9.5)
    .text(phrase, x + 18, cursorY, {
      width: innerWidth,
      lineGap: 2,
    });
  cursorY += document.heightOfString(phrase, { width: innerWidth, lineGap: 2 }) + 12;

  if (snippet) {
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(snippet, x + 18, cursorY, {
        width: innerWidth,
        lineGap: 2,
      });
  }

  return height;
}

function drawSourcesPage(document: PDFKit.PDFDocument, report: ReportRecord, page: { value: number }) {
  addPage(document, page);
  drawSectionHeading(document, "Source receipts", "Confirmed matches, overlap scores, and the strongest evidence snippets.");

  if (!report.matches.length) {
    document.roundedRect(PAGE_MARGIN, document.y, document.page.width - PAGE_MARGIN * 2, 106, 10).fillAndStroke(COLORS.white, COLORS.line);
    document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("No confirmed source matches", PAGE_MARGIN + 18, document.y + 20, {
        width: document.page.width - PAGE_MARGIN * 2 - 36,
      });
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(
        report.analysis.warning ?? "This scan did not confirm strong public source overlap for the highest-signal phrases.",
        PAGE_MARGIN + 18,
        document.y + 48,
        {
          width: document.page.width - PAGE_MARGIN * 2 - 36,
          lineGap: 3,
        },
      );
    return;
  }

  for (const [index, match] of report.matches.entries()) {
    const cardHeight = measureSourceCardHeight(document, match, document.page.width - PAGE_MARGIN * 2);
    ensureSpace(document, page, cardHeight + 16);

    const y = document.y;
    drawSourceCard(document, match, index, y);
    document.y = y + cardHeight + 14;
  }
}

function drawInputAppendix(document: PDFKit.PDFDocument, report: ReportRecord, page: { value: number }) {
  addPage(document, page);
  drawSectionHeading(document, "Input appendix", "The document text used for the scan, trimmed in the PDF for readability.");

  const x = PAGE_MARGIN;
  const y = document.y;
  const width = document.page.width - PAGE_MARGIN * 2;
  const height = document.page.height - y - 56;
  const excerpt = truncate(report.text, 9000);

  document.roundedRect(x, y, width, height, 10).fillAndStroke(COLORS.white, COLORS.line);
  document
    .fillColor("#334155")
    .font("Helvetica")
    .fontSize(9)
    .text(excerpt, x + 18, y + 18, {
      width: width - 36,
      height: height - 36,
      lineGap: 3,
    });
}

export async function buildPdfReport(report: ReportRecord) {
  const document = new PDFDocument({ margin: PAGE_MARGIN, size: "A4" });
  const bufferPromise = collectBuffer(document);
  const page = { value: 0 };

  drawCoverPage(document, report, page);
  drawOverviewPage(document, report, page);
  drawSourcesPage(document, report, page);
  drawInputAppendix(document, report, page);

  document.end();
  return bufferPromise;
}
