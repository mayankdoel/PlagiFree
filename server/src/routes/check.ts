import { Router } from "express";
import multer from "multer";

import { createReport, loadReport } from "../services/plagiarism-service";

const upload = multer({
  storage: multer.memoryStorage(),
});

export const checkRouter = Router();

checkRouter.post("/", upload.single("file"), async (request, response) => {
  try {
    const report = await createReport({
      text: typeof request.body.text === "string" ? request.body.text : undefined,
      file: request.file,
    });

    response.status(200).json({
      id: report.id,
      score: report.score,
      matches: report.matches,
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to complete plagiarism check.",
    });
  }
});

checkRouter.get("/:id", async (request, response) => {
  const report = await loadReport(request.params.id);
  if (!report) {
    response.status(404).json({ error: "Report not found." });
    return;
  }

  response.status(200).json(report);
});

