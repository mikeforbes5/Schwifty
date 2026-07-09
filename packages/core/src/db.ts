import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DDL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL, price_units INTEGER NOT NULL,
  edition TEXT NOT NULL, status TEXT NOT NULL, preview TEXT NOT NULL,
  payload TEXT NOT NULL, content_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL, sold_at TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL, buyer_address TEXT NOT NULL,
  amount_units INTEGER NOT NULL, network TEXT NOT NULL,
  payment_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  number TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, issued_at TEXT NOT NULL,
  product_title TEXT NOT NULL, total_units INTEGER NOT NULL, currency TEXT NOT NULL,
  buyer_address TEXT NOT NULL, terms TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, type TEXT NOT NULL,
  amount_units INTEGER NOT NULL, balance_after_units INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
`;

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(path = ":memory:"): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}
