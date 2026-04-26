import "dotenv/config";

import cors from "cors";
import express from "express";

import { checkRouter } from "./routes/check";
import { reportRouter } from "./routes/report";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";

app.disable("x-powered-by");
app.use(
  cors({
    origin: [allowedOrigin],
    credentials: false,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({ ok: true, service: "plagifree-api" });
});

app.use("/api/check", checkRouter);
app.use("/api/report", reportRouter);

app.listen(port, () => {
  console.log(`PlagiFree API listening on http://localhost:${port}`);
});
