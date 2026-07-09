import { createDb } from "./db";
import { CatalogService } from "./catalog";
import { PurchaseService } from "./purchase";

export function createCore(dbPath?: string) {
  const db = createDb(dbPath);
  return { db, catalog: new CatalogService(db), purchases: new PurchaseService(db) };
}
export type Core = ReturnType<typeof createCore>;

export * from "./types";
export * from "./errors";
export * from "./money";
export { createDb, type Db } from "./db";
export { CatalogService, type NewProduct } from "./catalog";
export { PurchaseService, type PurchaseInput, type PurchaseResult } from "./purchase";
export * as schema from "./schema";
