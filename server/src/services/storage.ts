import { MongoClient } from "mongodb";

import type { ReportRecord } from "../types/report";

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME ?? "plagifree";

const memoryStore = new Map<string, ReportRecord>();
const hashIndex = new Map<string, string>();

let clientPromise: Promise<MongoClient | null> | null = null;

async function connectMongo() {
  if (!mongoUri) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = MongoClient.connect(mongoUri)
      .then((client) => client)
      .catch(() => null);
  }

  return clientPromise;
}

async function collection() {
  const client = await connectMongo();
  if (!client) {
    return null;
  }
  return client.db(mongoDbName).collection<ReportRecord>("reports");
}

export async function getCachedReport(hash: string) {
  const mongoCollection = await collection();
  if (mongoCollection) {
    return mongoCollection.findOne({ hash });
  }

  const reportId = hashIndex.get(hash);
  return reportId ? memoryStore.get(reportId) ?? null : null;
}

export async function saveReport(report: ReportRecord) {
  const mongoCollection = await collection();
  if (mongoCollection) {
    await mongoCollection.updateOne({ id: report.id }, { $set: report }, { upsert: true });
    return;
  }

  memoryStore.set(report.id, report);
  hashIndex.set(report.hash, report.id);
}

export async function getReportById(id: string) {
  const mongoCollection = await collection();
  if (mongoCollection) {
    return mongoCollection.findOne({ id });
  }
  return memoryStore.get(id) ?? null;
}
