import { createDb } from "./db";
import { CatalogService } from "./catalog";
import { PurchaseService } from "./purchase";
import { StatsService } from "./stats";

export function createCore(dbPath?: string) {
  const db = createDb(dbPath);
  return {
    db,
    catalog: new CatalogService(db),
    purchases: new PurchaseService(db),
    stats: new StatsService(db),
  };
}
export type Core = ReturnType<typeof createCore>;

export * from "./types";
export * from "./errors";
export * from "./money";
export { createDb, type Db } from "./db";
export { CatalogService, type NewProduct } from "./catalog";
export { PurchaseService, type PurchaseInput, type PurchaseResult } from "./purchase";
export { StatsService } from "./stats";
export * as schema from "./schema";
