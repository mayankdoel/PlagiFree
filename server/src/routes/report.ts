import { Router } from "express";

import { loadReport } from "../services/plagiarism-service";
import { buildPdfReport } from "../services/report-service";

export const reportRouter = Router();

reportRouter.get("/:id", async (request, response) => {
  const report = await loadReport(request.params.id);
  if (!report) {
    response.status(404).json({ error: "Report not found." });
    return;
  }

  const pdfBuffer = await buildPdfReport(report);
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="plagifree-report-${report.id}.pdf"`);
  response.status(200).send(pdfBuffer);
});
