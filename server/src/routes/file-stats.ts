import { Router } from "express";
import multer from "multer";

import { buildTextStats, extractTextFromFile } from "../services/document-service";

const upload = multer({
  storage: multer.memoryStorage(),
});

export const fileStatsRouter = Router();

fileStatsRouter.post("/", upload.single("file"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Please upload a file to preview stats." });
      return;
    }

    const extractedText = await extractTextFromFile(request.file);
    const stats = buildTextStats(extractedText);

    response.status(200).json({
      filename: request.file.originalname,
      ...stats,
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Unable to parse uploaded file.",
    });
  }
});
