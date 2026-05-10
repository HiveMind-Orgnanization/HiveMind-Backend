import type { AppConfig } from "../config/env";
import type { HiveMindStore } from "./hivemind-store.types";
import { MemoryHiveMindStore } from "./memory-hivemind-store";
import { PostgresHiveMindStore } from "./postgres-hivemind-store";

let instance: HiveMindStore | null = null;

export async function initStore(cfg: AppConfig): Promise<void> {
  const url = cfg.DATABASE_URL?.trim();
  if (url) {
    instance = await PostgresHiveMindStore.connect(url);
  } else {
    instance = new MemoryHiveMindStore();
  }
}

/** Throws if initStore has not run successfully (programming error). */
export function hivemindStore(): HiveMindStore {
  if (!instance) {
    throw new Error("HiveMind store not initialized — call initStore() before routes handle requests");
  }
  return instance;
}

export async function closeStore(): Promise<void> {
  if (!instance) return;
  await instance.close();
  instance = null;
}
