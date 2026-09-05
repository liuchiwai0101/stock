import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultPolicy, hydratePolicy, type AdaptivePolicy } from "@/lib/adaptive-policy";
import { mergePredictionLogs, type LoggedPrediction } from "@/lib/prediction-log";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "learn-log.json");

export type LearnStore = {
  predictions: LoggedPrediction[];
  policy: AdaptivePolicy;
  updatedAt: string;
};

async function emptyStore(): Promise<LearnStore> {
  return { predictions: [], policy: defaultPolicy(), updatedAt: new Date().toISOString() };
}

export async function readLearnStore(): Promise<LearnStore> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<LearnStore>;
    return {
      predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
      policy: parsed.policy ? hydratePolicy(parsed.policy) : defaultPolicy(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyStore();
  }
}

export async function writeLearnStore(store: LearnStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function mergeLearnStore(incoming: {
  predictions?: LoggedPrediction[];
  policy?: AdaptivePolicy;
}): Promise<LearnStore> {
  const current = await readLearnStore();
  const next: LearnStore = {
    predictions: mergePredictionLogs(current.predictions, incoming.predictions ?? []),
    policy: incoming.policy ? hydratePolicy(incoming.policy) : current.policy,
    updatedAt: new Date().toISOString(),
  };
  await writeLearnStore(next);
  return next;
}
