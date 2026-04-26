import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

import type { ReportRecord } from "../types/report";

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME ?? "plagifree";
const diskCachePath = path.resolve(process.cwd(), "server", "data", "reports-cache.json");

const memoryStore = new Map<string, ReportRecord>();
const hashIndex = new Map<string, string>();

let clientPromise: Promise<MongoClient | null> | null = null;
let diskCacheLoaded = false;

async function ensureDiskCacheLoaded() {
  if (diskCacheLoaded) {
    return;
  }

  try {
    const raw = await readFile(diskCachePath, "utf-8");
    const records = JSON.parse(raw) as ReportRecord[];

    for (const record of records) {
      memoryStore.set(record.id, record);
      hashIndex.set(record.hash, record.id);
    }
  } catch {
    // Ignore missing or invalid cache files and continue with an empty store.
  } finally {
    diskCacheLoaded = true;
  }
}

async function persistDiskCache() {
  await mkdir(path.dirname(diskCachePath), { recursive: true });
  const payload = JSON.stringify([...memoryStore.values()], null, 2);
  await writeFile(diskCachePath, payload, "utf-8");
}

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

  await ensureDiskCacheLoaded();
  const reportId = hashIndex.get(hash);
  return reportId ? memoryStore.get(reportId) ?? null : null;
}

export async function saveReport(report: ReportRecord) {
  const mongoCollection = await collection();
  if (mongoCollection) {
    await mongoCollection.updateOne({ id: report.id }, { $set: report }, { upsert: true });
    await mongoCollection.createIndex({ id: 1 }, { unique: true });
    await mongoCollection.createIndex({ hash: 1 });
    return;
  }

  await ensureDiskCacheLoaded();
  memoryStore.set(report.id, report);
  hashIndex.set(report.hash, report.id);
  await persistDiskCache();
}

export async function getReportById(id: string) {
  const mongoCollection = await collection();
  if (mongoCollection) {
    return mongoCollection.findOne({ id });
  }

  await ensureDiskCacheLoaded();
  return memoryStore.get(id) ?? null;
}
