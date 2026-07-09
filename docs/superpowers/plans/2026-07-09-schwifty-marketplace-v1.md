# Schwifty Marketplace v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TypeScript marketplace where AI agents buy house-generated digital goods over HTTP/MCP, paying USDC via the x402 protocol (Base Sepolia testnet), with an owner dashboard for revenue/inventory/invoices.

**Architecture:** npm-workspaces monorepo. `@schwifty/core` owns all domain state (Drizzle + better-sqlite3, sync transactions). `@schwifty/server` (Hono) adapts core to HTTP with Zod validation on every input and an x402 payment gate behind a `PaymentGateway` interface. `@schwifty/forge` generates products deterministically from seeds. `@schwifty/mcp` is a buyer-side shopping client. `packages/dashboard` is a Vite+React admin console.

**Tech Stack:** TypeScript (strict), Hono, Zod v3, Drizzle ORM + better-sqlite3, ulid, Vitest, @modelcontextprotocol/sdk, x402-fetch + viem (buyer side), Vite + React + TanStack Query.

## Global Constraints

- Node >= 20; npm workspaces; every package `"type": "module"`.
- No build step in v1: packages export TS source (`"main": "src/index.ts"`); runtime via `tsx`, dashboard via Vite, tests via Vitest.
- tsconfig: `strict: true`, `module: ESNext`, `moduleResolution: Bundler`, extensionless relative imports.
- Zod is pinned `^3.24` everywhere (`npm i zod@^3.24`).
- All money is integer USDC base units: **1 USDC = 1_000_000 units** (USDC has 6 decimals). Never floats in domain logic.
- Invoice terms copy, verbatim everywhere: `ALL SALES FINAL — no returns, no refunds.`
- Invoice numbers: `SCHW-YYYY-NNNNNN` (year + zero-padded per-year sequence starting 000001).
- Every error response body: `{ "error": { "code": string, "message": string, "details?": object } }`.
- IDs are `ulid()` strings. Timestamps are ISO-8601 strings (`new Date().toISOString()`).
- Default network `base-sepolia`; USDC asset addresses: base-sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7c`, base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Default facilitator `https://x402.org/facilitator`. Server port 4021.
- Product kinds: `sigil | word | motif | ascii_pack | bundle`. Prices: sigil 5_000_000, word 5_000_000, motif 2_500_000, ascii_pack 500_000, bundle 10_000_000. Editions: ascii_pack is `open`, all others `unique`.
- Every commit message ends with trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- TDD: write the failing test, see it fail, implement minimally, see it pass, commit.

---

### Task 1: Monorepo scaffold + core package + money utils

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/money.ts`
- Test: `packages/core/test/money.test.ts`

**Interfaces:**
- Produces: `formatUsdc(units: number): string` (e.g. `5000000 → "5.00"`), `USDC_DECIMALS = 6`, workspace layout all later tasks live in.

- [ ] **Step 1: Write root scaffold files**

`package.json`:
```json
{
  "name": "schwifty",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "dev:server": "npm run dev -w @schwifty/server",
    "dev:dashboard": "npm run dev -w dashboard",
    "seed": "npm run seed -w @schwifty/forge"
  }
}
```

`.gitignore`:
```
node_modules/
data/
dist/
coverage/
.env
```

`.env.example`:
```
NETWORK=base-sepolia
PAY_TO_ADDRESS=0x0000000000000000000000000000000000000000
FACILITATOR_URL=https://x402.org/facilitator
DATABASE_PATH=./data/schwifty.db
ADMIN_TOKEN=change-me-to-a-long-random-string
PORT=4021
BASE_URL=http://localhost:4021
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["node"]
  }
}
```

`packages/core/package.json`:
```json
{
  "name": "@schwifty/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run" }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 2: Install dependencies**

Run from repo root:
```bash
npm i -w @schwifty/core zod@^3.24 ulid drizzle-orm better-sqlite3
npm i -w @schwifty/core -D vitest typescript @types/node @types/better-sqlite3
```
Expected: lockfile created, no errors.

- [ ] **Step 3: Write the failing test**

`packages/core/test/money.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatUsdc, USDC_DECIMALS } from "../src/money";

describe("money", () => {
  it("exposes USDC decimals", () => {
    expect(USDC_DECIMALS).toBe(6);
  });
  it("formats base units as USDC", () => {
    expect(formatUsdc(5_000_000)).toBe("5.00");
    expect(formatUsdc(2_500_000)).toBe("2.50");
    expect(formatUsdc(500_000)).toBe("0.50");
    expect(formatUsdc(0)).toBe("0.00");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/core`
Expected: FAIL — cannot find `../src/money`.

- [ ] **Step 5: Implement**

`packages/core/src/money.ts`:
```ts
export const USDC_DECIMALS = 6;
const UNITS_PER_USDC = 10 ** USDC_DECIMALS;

export function formatUsdc(units: number): string {
  return (units / UNITS_PER_USDC).toFixed(2);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/core`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold monorepo and core money utils"
```

---

### Task 2: Core types, schema, and database factory

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/schema.ts`, `packages/core/src/db.ts`, `packages/core/src/errors.ts`
- Test: `packages/core/test/db.test.ts`

**Interfaces:**
- Produces:
  - Zod enums/types from `types.ts`: `ProductKind`, `Edition`, `ProductStatus` (`listed|sold|delisted`), `OrderStatus` (`paid|failed`), and types `Product`, `Order`, `Invoice`, `LedgerEntry`.
  - `createDb(path?: string): Db` — `:memory:` default; creates parent dir for file paths; runs DDL idempotently.
  - Drizzle tables `products`, `orders`, `invoices`, `ledger` from `schema.ts`.
  - Errors: `NotFoundError`, `SoldOutError`, `DuplicateContentError`, `DuplicatePaymentError` — all `extends Error` with `code` field.

- [ ] **Step 1: Write the failing test**

`packages/core/test/db.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { products } from "../src/schema";

const row = {
  id: "01TEST", sku: "SIGIL-0001", kind: "sigil", title: "Sigil One",
  description: "d", priceUnits: 5_000_000, edition: "unique", status: "listed",
  preview: "p", payload: "{}", contentHash: "abc123",
  createdAt: "2026-07-09T00:00:00.000Z", soldAt: null,
};

describe("createDb", () => {
  it("round-trips a product row", () => {
    const db = createDb();
    db.insert(products).values(row).run();
    const got = db.select().from(products).where(eq(products.id, "01TEST")).get();
    expect(got?.sku).toBe("SIGIL-0001");
    expect(got?.priceUnits).toBe(5_000_000);
  });
  it("enforces unique content hash", () => {
    const db = createDb();
    db.insert(products).values(row).run();
    expect(() =>
      db.insert(products).values({ ...row, id: "01TEST2", sku: "SIGIL-0002" }).run(),
    ).toThrow(/UNIQUE/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/core db`
Expected: FAIL — cannot find `../src/db`.

- [ ] **Step 3: Implement types, errors, schema, db**

`packages/core/src/types.ts`:
```ts
import { z } from "zod";

export const ProductKind = z.enum(["sigil", "word", "motif", "ascii_pack", "bundle"]);
export type ProductKind = z.infer<typeof ProductKind>;
export const Edition = z.enum(["unique", "open"]);
export type Edition = z.infer<typeof Edition>;
export const ProductStatus = z.enum(["listed", "sold", "delisted"]);
export type ProductStatus = z.infer<typeof ProductStatus>;
export const OrderStatus = z.enum(["paid", "failed"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const INVOICE_TERMS = "ALL SALES FINAL — no returns, no refunds.";

export interface Product {
  id: string; sku: string; kind: ProductKind; title: string; description: string;
  priceUnits: number; edition: Edition; status: ProductStatus;
  preview: string; payload: string; contentHash: string;
  createdAt: string; soldAt: string | null;
}
export interface Order {
  id: string; productId: string; buyerAddress: string; amountUnits: number;
  network: string; paymentId: string; status: OrderStatus; createdAt: string;
}
export interface Invoice {
  number: string; orderId: string; issuedAt: string; productTitle: string;
  totalUnits: number; currency: "USDC"; buyerAddress: string; terms: string;
}
export interface LedgerEntry {
  id: string; orderId: string; type: "sale"; amountUnits: number;
  balanceAfterUnits: number; createdAt: string;
}
```

`packages/core/src/errors.ts`:
```ts
export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export class NotFoundError extends DomainError {
  constructor(what: string) { super("NOT_FOUND", `${what} not found`); }
}
export class SoldOutError extends DomainError {
  constructor(id: string) { super("SOLD_OUT", `Product ${id} is no longer available`); }
}
export class DuplicateContentError extends DomainError {
  constructor(hash: string) { super("DUPLICATE_CONTENT", `Content hash ${hash} already exists`); }
}
```

`packages/core/src/schema.ts`:
```ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceUnits: integer("price_units").notNull(),
  edition: text("edition").notNull(),
  status: text("status").notNull(),
  preview: text("preview").notNull(),
  payload: text("payload").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  createdAt: text("created_at").notNull(),
  soldAt: text("sold_at"),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  buyerAddress: text("buyer_address").notNull(),
  amountUnits: integer("amount_units").notNull(),
  network: text("network").notNull(),
  paymentId: text("payment_id").notNull().unique(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  number: text("number").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  productTitle: text("product_title").notNull(),
  totalUnits: integer("total_units").notNull(),
  currency: text("currency").notNull(),
  buyerAddress: text("buyer_address").notNull(),
  terms: text("terms").notNull(),
});

export const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  amountUnits: integer("amount_units").notNull(),
  balanceAfterUnits: integer("balance_after_units").notNull(),
  createdAt: text("created_at").notNull(),
});
```

`packages/core/src/db.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/core`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: core types, sqlite schema, db factory"
```

---

### Task 3: CatalogService

**Files:**
- Create: `packages/core/src/catalog.ts`
- Test: `packages/core/test/catalog.test.ts`

**Interfaces:**
- Consumes: `createDb`, `products` table, errors, types.
- Produces: `CatalogService` with:
  - `create(input: NewProduct): Product` — `NewProduct = { sku, kind, title, description, priceUnits, edition, preview, payload, contentHash }`; throws `DuplicateContentError` on duplicate hash. Generates `id: ulid()`, `status: "listed"`, `createdAt`.
  - `list(filter?: { kind?: ProductKind; status?: ProductStatus; limit?: number }): Product[]` (newest first, default limit 50)
  - `get(id: string): Product | undefined`
  - `bySku(sku: string): Product | undefined`
  - `delist(id: string): void` — throws `NotFoundError` if absent.

- [ ] **Step 1: Write the failing test**

`packages/core/test/catalog.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db";
import { CatalogService, type NewProduct } from "../src/catalog";
import { DuplicateContentError, NotFoundError } from "../src/errors";

const input = (over: Partial<NewProduct> = {}): NewProduct => ({
  sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", description: "d",
  priceUnits: 5_000_000, edition: "unique", preview: "p", payload: "{}",
  contentHash: "hash-1", ...over,
});

describe("CatalogService", () => {
  let db: Db; let catalog: CatalogService;
  beforeEach(() => { db = createDb(); catalog = new CatalogService(db); });

  it("creates a listed product with generated id", () => {
    const p = catalog.create(input());
    expect(p.id).toHaveLength(26);
    expect(p.status).toBe("listed");
    expect(catalog.get(p.id)?.sku).toBe("SIGIL-0001");
    expect(catalog.bySku("SIGIL-0001")?.id).toBe(p.id);
  });
  it("rejects duplicate content hash", () => {
    catalog.create(input());
    expect(() => catalog.create(input({ sku: "SIGIL-0002" }))).toThrow(DuplicateContentError);
  });
  it("lists with kind/status filters and limit", () => {
    catalog.create(input());
    catalog.create(input({ sku: "WORD-0001", kind: "word", contentHash: "hash-2" }));
    expect(catalog.list()).toHaveLength(2);
    expect(catalog.list({ kind: "word" })).toHaveLength(1);
    expect(catalog.list({ limit: 1 })).toHaveLength(1);
  });
  it("delists and filters by status", () => {
    const p = catalog.create(input());
    catalog.delist(p.id);
    expect(catalog.get(p.id)?.status).toBe("delisted");
    expect(catalog.list({ status: "listed" })).toHaveLength(0);
    expect(() => catalog.delist("nope")).toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/core catalog`
Expected: FAIL — cannot find `../src/catalog`.

- [ ] **Step 3: Implement**

`packages/core/src/catalog.ts`:
```ts
import { and, desc, eq, type SQL } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "./db";
import { products } from "./schema";
import { DuplicateContentError, NotFoundError } from "./errors";
import type { Edition, Product, ProductKind, ProductStatus } from "./types";

export interface NewProduct {
  sku: string; kind: ProductKind; title: string; description: string;
  priceUnits: number; edition: Edition; preview: string; payload: string;
  contentHash: string;
}

export class CatalogService {
  constructor(private db: Db) {}

  create(input: NewProduct): Product {
    if (this.db.select().from(products).where(eq(products.contentHash, input.contentHash)).get())
      throw new DuplicateContentError(input.contentHash);
    const row = {
      id: ulid(), ...input, status: "listed" as const,
      createdAt: new Date().toISOString(), soldAt: null,
    };
    this.db.insert(products).values(row).run();
    return row as Product;
  }

  list(filter: { kind?: ProductKind; status?: ProductStatus; limit?: number } = {}): Product[] {
    const conds: SQL[] = [];
    if (filter.kind) conds.push(eq(products.kind, filter.kind));
    if (filter.status) conds.push(eq(products.status, filter.status));
    return this.db.select().from(products)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(products.id)).limit(filter.limit ?? 50).all() as Product[];
  }

  get(id: string): Product | undefined {
    return this.db.select().from(products).where(eq(products.id, id)).get() as Product | undefined;
  }

  bySku(sku: string): Product | undefined {
    return this.db.select().from(products).where(eq(products.sku, sku)).get() as Product | undefined;
  }

  delist(id: string): void {
    const res = this.db.update(products).set({ status: "delisted" }).where(eq(products.id, id)).run();
    if (res.changes === 0) throw new NotFoundError(`Product ${id}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: catalog service with uniqueness registry"
```

---

### Task 4: PurchaseService — atomic paid purchase, invoices, ledger, receipts

**Files:**
- Create: `packages/core/src/purchase.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/purchase.test.ts`

**Interfaces:**
- Consumes: `CatalogService`, tables, errors.
- Produces:
  - `PurchaseService` with:
    - `recordPaidPurchase(input: { productId: string; buyerAddress: string; paymentId: string; network: string }): PurchaseResult` where `PurchaseResult = { order: Order; invoice: Invoice; product: Product }`. Single sync transaction: idempotent replay by `paymentId` (returns original), `NotFoundError` on missing product, `SoldOutError` unless status `listed`, unique editions CAS-flip `listed→sold` (0 rows changed ⇒ `SoldOutError`), open editions stay `listed`, order row `status: "paid"`, ledger append with running `balanceAfterUnits`, invoice `SCHW-YYYY-NNNNNN` (per-year sequence).
    - `getOrder(id): Order | undefined`, `getInvoice(number): Invoice | undefined`
    - `listOrders(limit=100): Array<Order & { productTitle: string }>` (newest first), `listInvoices(limit=100): Invoice[]`
  - `createCore(dbPath?: string)` in `index.ts` returning `{ db, catalog, purchases, stats? }` (stats added Task 5) and re-exporting all types/errors/money helpers. `export type Core = ReturnType<typeof createCore>`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/purchase.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createCore, type Core } from "../src/index";
import { NotFoundError, SoldOutError } from "../src/errors";
import { INVOICE_TERMS } from "../src/types";

const BUYER = "0x" + "cd".repeat(20);

describe("PurchaseService", () => {
  let core: Core;
  let sigilId: string;
  let packId: string;
  beforeEach(() => {
    core = createCore();
    sigilId = core.catalog.create({
      sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", description: "d",
      priceUnits: 5_000_000, edition: "unique", preview: "p", payload: "{\"svg\":\"<svg/>\"}",
      contentHash: "h1",
    }).id;
    packId = core.catalog.create({
      sku: "ASCII_PACK-0001", kind: "ascii_pack", title: "Pack", description: "d",
      priceUnits: 500_000, edition: "open", preview: "p", payload: "{}", contentHash: "h2",
    }).id;
  });

  it("records a paid purchase atomically", () => {
    const r = core.purchases.recordPaidPurchase({
      productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia",
    });
    expect(r.order.status).toBe("paid");
    expect(r.order.amountUnits).toBe(5_000_000);
    expect(r.invoice.number).toMatch(/^SCHW-\d{4}-000001$/);
    expect(r.invoice.terms).toBe(INVOICE_TERMS);
    expect(r.product.status).toBe("sold");
    expect(core.catalog.get(sigilId)?.status).toBe("sold");
  });
  it("second buyer of a unique item gets SoldOutError", () => {
    core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(() =>
      core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" }),
    ).toThrow(SoldOutError);
  });
  it("open editions can sell repeatedly", () => {
    core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" });
    expect(core.catalog.get(packId)?.status).toBe("listed");
    expect(core.purchases.listOrders()).toHaveLength(2);
  });
  it("is idempotent by paymentId", () => {
    const a = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    const b = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(b.order.id).toBe(a.order.id);
    expect(b.invoice.number).toBe(a.invoice.number);
    expect(core.purchases.listOrders()).toHaveLength(1);
  });
  it("appends to the ledger with running balance and increments invoice numbers", () => {
    core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    const r2 = core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" });
    expect(r2.invoice.number).toMatch(/000002$/);
    expect(core.stats.revenueTotalUnits()).toBe(5_500_000);
  });
  it("throws NotFoundError for unknown product", () => {
    expect(() =>
      core.purchases.recordPaidPurchase({ productId: "nope", buyerAddress: BUYER, paymentId: "0xpay9", network: "base-sepolia" }),
    ).toThrow(NotFoundError);
  });
  it("exposes receipts", () => {
    const r = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(core.purchases.getOrder(r.order.id)?.paymentId).toBe("0xpay1");
    expect(core.purchases.getInvoice(r.invoice.number)?.orderId).toBe(r.order.id);
  });
});
```

Note: the ledger-balance assertion uses `core.stats.revenueTotalUnits()` which arrives in Task 5. For THIS task, replace that single line with a direct ledger check:
```ts
import { ledger } from "../src/schema";
const rows = core.db.select().from(ledger).all();
expect(rows.map(r => r.balanceAfterUnits)).toEqual([5_000_000, 5_500_000]);
```
(Task 5 will not need to modify this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/core purchase`
Expected: FAIL — cannot find `../src/index` (or `purchase`).

- [ ] **Step 3: Implement**

`packages/core/src/purchase.ts`:
```ts
import { desc, eq, like, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "./db";
import { invoices, ledger, orders, products } from "./schema";
import { NotFoundError, SoldOutError } from "./errors";
import { INVOICE_TERMS, type Invoice, type Order, type Product } from "./types";

export interface PurchaseInput {
  productId: string; buyerAddress: string; paymentId: string; network: string;
}
export interface PurchaseResult { order: Order; invoice: Invoice; product: Product }

export class PurchaseService {
  constructor(private db: Db) {}

  recordPaidPurchase(input: PurchaseInput): PurchaseResult {
    return this.db.transaction((tx) => {
      const prior = tx.select().from(orders).where(eq(orders.paymentId, input.paymentId)).get() as Order | undefined;
      if (prior) {
        const invoice = tx.select().from(invoices).where(eq(invoices.orderId, prior.id)).get() as Invoice;
        const product = tx.select().from(products).where(eq(products.id, prior.productId)).get() as Product;
        return { order: prior, invoice, product };
      }

      const product = tx.select().from(products).where(eq(products.id, input.productId)).get() as Product | undefined;
      if (!product) throw new NotFoundError(`Product ${input.productId}`);
      if (product.status !== "listed") throw new SoldOutError(product.id);

      const now = new Date().toISOString();
      if (product.edition === "unique") {
        const res = tx.update(products)
          .set({ status: "sold", soldAt: now })
          .where(sql`${products.id} = ${product.id} AND ${products.status} = 'listed'`).run();
        if (res.changes === 0) throw new SoldOutError(product.id);
        product.status = "sold"; product.soldAt = now;
      }

      const order: Order = {
        id: ulid(), productId: product.id, buyerAddress: input.buyerAddress,
        amountUnits: product.priceUnits, network: input.network,
        paymentId: input.paymentId, status: "paid", createdAt: now,
      };
      tx.insert(orders).values(order).run();

      const last = tx.select().from(ledger).orderBy(desc(ledger.id)).limit(1).get();
      const entry = {
        id: ulid(), orderId: order.id, type: "sale" as const,
        amountUnits: order.amountUnits,
        balanceAfterUnits: (last?.balanceAfterUnits ?? 0) + order.amountUnits,
        createdAt: now,
      };
      tx.insert(ledger).values(entry).run();

      const year = now.slice(0, 4);
      const count = tx.select({ n: sql<number>`count(*)` }).from(invoices)
        .where(like(invoices.number, `SCHW-${year}-%`)).get()?.n ?? 0;
      const invoice: Invoice = {
        number: `SCHW-${year}-${String(count + 1).padStart(6, "0")}`,
        orderId: order.id, issuedAt: now, productTitle: product.title,
        totalUnits: order.amountUnits, currency: "USDC",
        buyerAddress: input.buyerAddress, terms: INVOICE_TERMS,
      };
      tx.insert(invoices).values(invoice).run();

      return { order, invoice, product };
    });
  }

  getOrder(id: string): Order | undefined {
    return this.db.select().from(orders).where(eq(orders.id, id)).get() as Order | undefined;
  }
  getInvoice(number: string): Invoice | undefined {
    return this.db.select().from(invoices).where(eq(invoices.number, number)).get() as Invoice | undefined;
  }
  listOrders(limit = 100): Array<Order & { productTitle: string }> {
    return this.db.select({
      id: orders.id, productId: orders.productId, buyerAddress: orders.buyerAddress,
      amountUnits: orders.amountUnits, network: orders.network, paymentId: orders.paymentId,
      status: orders.status, createdAt: orders.createdAt, productTitle: products.title,
    }).from(orders).innerJoin(products, eq(products.id, orders.productId))
      .orderBy(desc(orders.id)).limit(limit).all() as Array<Order & { productTitle: string }>;
  }
  listInvoices(limit = 100): Invoice[] {
    return this.db.select().from(invoices).orderBy(desc(invoices.number)).limit(limit).all() as Invoice[];
  }
}
```

`packages/core/src/index.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/core`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: atomic purchase transaction with ledger and invoices"
```

---

### Task 5: StatsService (revenue / inventory reporting)

**Files:**
- Create: `packages/core/src/stats.ts`
- Modify: `packages/core/src/index.ts` (add `stats: new StatsService(db)` to `createCore` return; export `StatsService`)
- Test: `packages/core/test/stats.test.ts`

**Interfaces:**
- Produces: `StatsService` with:
  - `revenueTotalUnits(): number` — sum of ledger `sale` amounts.
  - `orderCount(): number` — count of `paid` orders.
  - `revenueByKind(): Array<{ kind: string; units: number; count: number }>`
  - `timeSeries(days = 30): Array<{ date: string; units: number }>` — `YYYY-MM-DD` buckets from ledger.
  - `inventory(): Array<{ kind: string; listed: number; sold: number }>`

- [ ] **Step 1: Write the failing test**

`packages/core/test/stats.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createCore, type Core } from "../src/index";

const BUYER = "0x" + "cd".repeat(20);

describe("StatsService", () => {
  let core: Core;
  beforeEach(() => {
    core = createCore();
    const sigil = core.catalog.create({
      sku: "SIGIL-0001", kind: "sigil", title: "S", description: "d",
      priceUnits: 5_000_000, edition: "unique", preview: "p", payload: "{}", contentHash: "h1",
    });
    const pack = core.catalog.create({
      sku: "ASCII_PACK-0001", kind: "ascii_pack", title: "P", description: "d",
      priceUnits: 500_000, edition: "open", preview: "p", payload: "{}", contentHash: "h2",
    });
    core.purchases.recordPaidPurchase({ productId: sigil.id, buyerAddress: BUYER, paymentId: "0xp1", network: "base-sepolia" });
    core.purchases.recordPaidPurchase({ productId: pack.id, buyerAddress: BUYER, paymentId: "0xp2", network: "base-sepolia" });
  });

  it("totals revenue and orders", () => {
    expect(core.stats.revenueTotalUnits()).toBe(5_500_000);
    expect(core.stats.orderCount()).toBe(2);
  });
  it("groups revenue by kind", () => {
    expect(core.stats.revenueByKind()).toEqual(
      expect.arrayContaining([
        { kind: "sigil", units: 5_000_000, count: 1 },
        { kind: "ascii_pack", units: 500_000, count: 1 },
      ]),
    );
  });
  it("buckets a time series by day", () => {
    const series = core.stats.timeSeries(30);
    expect(series).toHaveLength(1);
    expect(series[0].date).toBe(new Date().toISOString().slice(0, 10));
    expect(series[0].units).toBe(5_500_000);
  });
  it("reports inventory by kind", () => {
    expect(core.stats.inventory()).toEqual(
      expect.arrayContaining([
        { kind: "sigil", listed: 0, sold: 1 },
        { kind: "ascii_pack", listed: 1, sold: 0 },
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/core stats`
Expected: FAIL — `core.stats` is undefined.

- [ ] **Step 3: Implement**

`packages/core/src/stats.ts`:
```ts
import { sql } from "drizzle-orm";
import type { Db } from "./db";

export class StatsService {
  constructor(private db: Db) {}

  revenueTotalUnits(): number {
    const r = this.db.get<{ total: number | null }>(
      sql`SELECT sum(amount_units) AS total FROM ledger WHERE type = 'sale'`);
    return r?.total ?? 0;
  }
  orderCount(): number {
    const r = this.db.get<{ n: number }>(
      sql`SELECT count(*) AS n FROM orders WHERE status = 'paid'`);
    return r?.n ?? 0;
  }
  revenueByKind(): Array<{ kind: string; units: number; count: number }> {
    return this.db.all(sql`
      SELECT p.kind AS kind, sum(o.amount_units) AS units, count(*) AS count
      FROM orders o JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid' GROUP BY p.kind`);
  }
  timeSeries(days = 30): Array<{ date: string; units: number }> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    return this.db.all(sql`
      SELECT substr(created_at, 1, 10) AS date, sum(amount_units) AS units
      FROM ledger WHERE type = 'sale' AND created_at >= ${since}
      GROUP BY date ORDER BY date`);
  }
  inventory(): Array<{ kind: string; listed: number; sold: number }> {
    return this.db.all(sql`
      SELECT kind,
        sum(CASE WHEN status = 'listed' THEN 1 ELSE 0 END) AS listed,
        sum(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold
      FROM products GROUP BY kind`);
  }
}
```

In `packages/core/src/index.ts`, add:
```ts
import { StatsService } from "./stats";
// inside createCore return:
//   stats: new StatsService(db),
export { StatsService } from "./stats";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: revenue/inventory stats service"
```

---

### Task 6: Server scaffold — config, public catalog routes, llms.txt, error envelope

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/vitest.config.ts`
- Create: `packages/server/src/config.ts`, `packages/server/src/app.ts`, `packages/server/src/serialize.ts`, `packages/server/src/llms.ts`
- Create: `packages/server/test/helpers.ts`
- Test: `packages/server/test/catalog-routes.test.ts`, `packages/server/test/config.test.ts`

**Interfaces:**
- Consumes: `createCore`, `Core`, `ProductKind`, `formatUsdc` from `@schwifty/core`.
- Produces:
  - `loadConfig(env?: NodeJS.ProcessEnv): Config` where `Config = { network: "base-sepolia"|"base"; payTo: string; facilitatorUrl: string; databasePath: string; adminToken: string; port: number; baseUrl: string; usdcAddress: string }`.
  - `buildApp(deps: AppDeps): Hono` where `AppDeps = { core: Core; gateway: PaymentGateway; config: Config }` (`PaymentGateway` fully defined Task 7 — for THIS task declare a placeholder `export interface PaymentGateway { settle(header: string, requirements: unknown): Promise<unknown> }` in `app.ts`; Task 7 moves it to `payment.ts`).
  - `toPublicProduct(p: Product)` — product minus `payload`, plus `priceUsdc` display string.
  - Test helper `makeTestApp()` returning `{ app, core, gateway, config }` with a `MockGateway`.

- [ ] **Step 1: Create package scaffold and install**

`packages/server/package.json`:
```json
{
  "name": "@schwifty/server",
  "version": "0.1.0",
  "type": "module",
  "main": "src/app.ts",
  "scripts": { "test": "vitest run", "dev": "tsx watch src/index.ts" }
}
```
`packages/server/tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }`
`packages/server/vitest.config.ts`: same as core's.

Run:
```bash
npm i -w @schwifty/server hono @hono/node-server @hono/zod-validator zod@^3.24 ulid @schwifty/core
npm i -w @schwifty/server -D vitest tsx typescript @types/node
```

- [ ] **Step 2: Write the failing tests**

`packages/server/test/helpers.ts`:
```ts
import { createCore, type Core } from "@schwifty/core";
import { buildApp, type PaymentGateway } from "../src/app";
import type { Config } from "../src/config";

export const testConfig: Config = {
  network: "base-sepolia", payTo: "0x" + "ab".repeat(20),
  facilitatorUrl: "http://facilitator.test", databasePath: ":memory:",
  adminToken: "test-admin-token-1234", port: 0,
  baseUrl: "http://market.test",
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
};

export class MockGateway implements PaymentGateway {
  calls: Array<{ header: string; requirements: unknown }> = [];
  failWith: string | null = null;
  async settle(header: string, requirements: unknown) {
    this.calls.push({ header, requirements });
    if (this.failWith) return { success: false as const, reason: this.failWith };
    return { success: true as const, paymentId: `0xpay${this.calls.length}`, payer: "0x" + "cd".repeat(20) };
  }
}

export function seedProduct(core: Core, over: Record<string, unknown> = {}) {
  return core.catalog.create({
    sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", description: "A one-of-one sigil",
    priceUnits: 5_000_000, edition: "unique", preview: "8x8 sigil",
    payload: JSON.stringify({ svg: "<svg/>" }), contentHash: "h1",
    ...over,
  } as never);
}

export function makeTestApp() {
  const core = createCore();
  const gateway = new MockGateway();
  const app = buildApp({ core, gateway, config: testConfig });
  return { app, core, gateway, config: testConfig };
}
```

`packages/server/test/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base = { PAY_TO_ADDRESS: "0x" + "ab".repeat(20), ADMIN_TOKEN: "0123456789abcdef" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig(base as never);
    expect(c.network).toBe("base-sepolia");
    expect(c.port).toBe(4021);
    expect(c.facilitatorUrl).toBe("https://x402.org/facilitator");
    expect(c.usdcAddress).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7c");
  });
  it("selects mainnet USDC for base", () => {
    expect(loadConfig({ ...base, NETWORK: "base" } as never).usdcAddress)
      .toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
  it("rejects bad pay-to address", () => {
    expect(() => loadConfig({ ...base, PAY_TO_ADDRESS: "nope" } as never)).toThrow();
  });
});
```

`packages/server/test/catalog-routes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeTestApp, seedProduct } from "./helpers";

describe("public catalog routes", () => {
  it("GET / returns a banner with pointers", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llms).toBe("http://market.test/llms.txt");
  });
  it("GET /llms.txt explains how to shop and the terms", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("x402");
    expect(text).toContain("ALL SALES FINAL");
  });
  it("GET /products lists listed products without payloads", async () => {
    const { app, core } = makeTestApp();
    seedProduct(core);
    const res = await app.request("/products");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.products[0].payload).toBeUndefined();
    expect(body.products[0].priceUsdc).toBe("5.00");
    expect(body.products[0].contentHash).toBe("h1");
  });
  it("GET /products validates query params", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/products?kind=nonsense");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
  it("GET /products/:id returns metadata, 404 envelope for unknown", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    const ok = await app.request(`/products/${p.id}`);
    expect((await ok.json()).product.id).toBe(p.id);
    const missing = await app.request("/products/nope");
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run -w=false --root packages/server`
Expected: FAIL — cannot find `../src/app` / `../src/config`.

- [ ] **Step 4: Implement**

`packages/server/src/config.ts`:
```ts
import { z } from "zod";

const EnvSchema = z.object({
  NETWORK: z.enum(["base-sepolia", "base"]).default("base-sepolia"),
  PAY_TO_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  DATABASE_PATH: z.string().default("./data/schwifty.db"),
  ADMIN_TOKEN: z.string().min(16),
  PORT: z.coerce.number().int().default(4021),
  BASE_URL: z.string().url().default("http://localhost:4021"),
});

export const USDC_ADDRESS: Record<"base-sepolia" | "base", string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export interface Config {
  network: "base-sepolia" | "base"; payTo: string; facilitatorUrl: string;
  databasePath: string; adminToken: string; port: number; baseUrl: string;
  usdcAddress: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = EnvSchema.parse(env);
  return {
    network: e.NETWORK, payTo: e.PAY_TO_ADDRESS, facilitatorUrl: e.FACILITATOR_URL,
    databasePath: e.DATABASE_PATH, adminToken: e.ADMIN_TOKEN, port: e.PORT,
    baseUrl: e.BASE_URL, usdcAddress: USDC_ADDRESS[e.NETWORK],
  };
}
```

`packages/server/src/serialize.ts`:
```ts
import { formatUsdc, type Product } from "@schwifty/core";

export function toPublicProduct(p: Product) {
  const { payload: _payload, ...pub } = p;
  return { ...pub, priceUsdc: formatUsdc(p.priceUnits) };
}
```

`packages/server/src/llms.ts`:
```ts
import type { Config } from "./config";

export function llmsTxt(config: Config): string {
  return `# Schwifty — a marketplace for AI agents

Digital identity goods for autonomous agents: one-of-one sigils (SVG glyphs),
coined words (unique callsigns with definitions), signature motifs (ABC
notation melodies), ASCII banner packs, and full identity bundles.

## How to shop (machine-first)
1. GET ${config.baseUrl}/products            — JSON list (filters: kind, status, limit)
2. GET ${config.baseUrl}/products/{id}       — details + sha256 contentHash (payload ships after purchase)
3. POST ${config.baseUrl}/orders  {"productId":"..."}
   - Without payment you receive HTTP 402 with x402 payment requirements
     (USDC on ${config.network}, pay-to ${config.payTo}).
   - Retry with an X-PAYMENT header containing your signed x402 payment
     payload (see https://x402.org). Any x402 client works.
4. HTTP 201 returns { order, invoice, product } with the full payload.
5. GET ${config.baseUrl}/orders/{id} and ${config.baseUrl}/invoices/{number} — receipts.

Machine-readable API: GET ${config.baseUrl}/openapi.json

## Terms
ALL SALES FINAL — no returns, no refunds. One-of-one items are never re-issued.
Verify delivered payloads against the published sha256 contentHash.
`;
}
```

`packages/server/src/app.ts`:
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ProductKind, type Core } from "@schwifty/core";
import type { Config } from "./config";
import { toPublicProduct } from "./serialize";
import { llmsTxt } from "./llms";

// Placeholder — Task 7 replaces this with the real interface in payment.ts
export interface PaymentGateway {
  settle(header: string, requirements: unknown): Promise<unknown>;
}

export interface AppDeps { core: Core; gateway: PaymentGateway; config: Config }

type ErrStatus = 400 | 401 | 402 | 404 | 409 | 500;
export function errBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

const validationHook = (result: { success: boolean; error?: z.ZodError }, c: import("hono").Context) => {
  if (!result.success)
    return c.json(errBody("VALIDATION_ERROR", "Invalid request", result.error?.flatten()), 400);
};

export function buildApp({ core, gateway, config }: AppDeps): Hono {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "Schwifty", tagline: "a marketplace for AI agents",
      llms: `${config.baseUrl}/llms.txt`, openapi: `${config.baseUrl}/openapi.json`,
      products: `${config.baseUrl}/products`,
    }));

  app.get("/llms.txt", (c) => c.text(llmsTxt(config)));

  const listQuery = z.object({
    kind: ProductKind.optional(),
    status: z.enum(["listed", "sold"]).default("listed"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });
  app.get("/products", zValidator("query", listQuery, validationHook), (c) => {
    const q = c.req.valid("query");
    return c.json({ products: core.catalog.list(q).map(toPublicProduct) });
  });

  app.get("/products/:id", (c) => {
    const p = core.catalog.get(c.req.param("id"));
    if (!p || p.status === "delisted")
      return c.json(errBody("NOT_FOUND", "Product not found"), 404);
    return c.json({ product: toPublicProduct(p) });
  });

  app.notFound((c) => c.json(errBody("NOT_FOUND", "No such route"), 404));
  app.onError((err, c) => c.json(errBody("INTERNAL", err.message), 500));

  return app;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/server`
Expected: PASS (all tests, both files).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: server scaffold with config, catalog routes, llms.txt"
```

---

### Task 7: x402 payment gate — POST /orders, receipts, FacilitatorGateway

**Files:**
- Create: `packages/server/src/payment.ts`
- Modify: `packages/server/src/app.ts` (import `PaymentGateway` from `./payment`, delete the placeholder, add `/orders` + receipt routes)
- Test: `packages/server/test/purchase-routes.test.ts`, `packages/server/test/facilitator.test.ts`

**Interfaces:**
- Consumes: `Core`, `Config`, `errBody`, Task 4 purchase semantics.
- Produces (in `payment.ts`):
  - `interface PaymentRequirements { scheme: "exact"; network: string; maxAmountRequired: string; resource: string; description: string; mimeType: "application/json"; payTo: string; maxTimeoutSeconds: number; asset: string; extra: { name: string; version: string } }`
  - `type SettleResult = { success: true; paymentId: string; payer: string } | { success: false; reason: string }`
  - `interface PaymentGateway { settle(header: string, requirements: PaymentRequirements): Promise<SettleResult> }`
  - `buildRequirements(product: Product, config: Config): PaymentRequirements`
  - `class FacilitatorGateway implements PaymentGateway` — base64-decodes the header to a JSON payment payload, POSTs `{ x402Version: 1, paymentPayload, paymentRequirements }` to `{facilitatorUrl}/verify` then `/settle`; returns `MALFORMED_PAYMENT_HEADER` / verify `invalidReason` / settle `errorReason` failures; success maps `transaction → paymentId`, `payer → payer`.
- Routes produced: `POST /orders` (402 handshake → 201 with `{ order, invoice, product }` including payload), `GET /orders/:id`, `GET /invoices/:number`.

- [ ] **Step 1: Write the failing tests**

`packages/server/test/purchase-routes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeTestApp, seedProduct } from "./helpers";

const post = (app: { request: Function }, body: unknown, headers: Record<string, string> = {}) =>
  app.request("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("POST /orders (x402 gate)", () => {
  it("returns 402 with payment requirements when no X-PAYMENT header", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    const res = await post(app, { productId: p.id });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0]).toMatchObject({
      scheme: "exact", network: "base-sepolia", maxAmountRequired: "5000000",
      payTo: "0x" + "ab".repeat(20),
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
    });
    expect(body.accepts[0].resource).toBe(`http://market.test/products/${p.id}`);
  });
  it("settles payment and delivers the good", async () => {
    const { app, core, gateway } = makeTestApp();
    const p = seedProduct(core);
    const res = await post(app, { productId: p.id }, { "X-PAYMENT": "b64payment" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.order.status).toBe("paid");
    expect(body.invoice.terms).toContain("ALL SALES FINAL");
    expect(JSON.parse(body.product.payload).svg).toBe("<svg/>");
    expect(gateway.calls).toHaveLength(1);
    expect(core.catalog.get(p.id)?.status).toBe("sold");
  });
  it("maps gateway failure to 402 PAYMENT_FAILED", async () => {
    const { app, core, gateway } = makeTestApp();
    const p = seedProduct(core);
    gateway.failWith = "insufficient_funds";
    const res = await post(app, { productId: p.id }, { "X-PAYMENT": "b64payment" });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("PAYMENT_FAILED");
    expect(body.error.message).toContain("insufficient_funds");
  });
  it("404 unknown product, 409 sold product, 400 bad body", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    expect((await post(app, { productId: "nope" })).status).toBe(404);
    await post(app, { productId: p.id }, { "X-PAYMENT": "pay1" });
    expect((await post(app, { productId: p.id }, { "X-PAYMENT": "pay2" })).status).toBe(409);
    expect((await post(app, {})).status).toBe(400);
  });
  it("serves order and invoice receipts", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    const bought = await (await post(app, { productId: p.id }, { "X-PAYMENT": "pay1" })).json();
    const o = await app.request(`/orders/${bought.order.id}`);
    expect((await o.json()).order.id).toBe(bought.order.id);
    const i = await app.request(`/invoices/${bought.invoice.number}`);
    expect((await i.json()).invoice.number).toBe(bought.invoice.number);
    expect((await app.request("/orders/nope")).status).toBe(404);
    expect((await app.request("/invoices/nope")).status).toBe(404);
  });
});
```

`packages/server/test/facilitator.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { FacilitatorGateway, buildRequirements } from "../src/payment";
import { testConfig } from "./helpers";

const requirements = buildRequirements(
  { id: "01X", title: "Sigil", description: "d", priceUnits: 5_000_000 } as never,
  testConfig,
);
const header = Buffer.from(JSON.stringify({ x402Version: 1, scheme: "exact" })).toString("base64");

afterEach(() => vi.unstubAllGlobals());

describe("FacilitatorGateway", () => {
  it("verifies then settles via the facilitator", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isValid: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, transaction: "0xtx", payer: "0xbuyer" })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new FacilitatorGateway("http://facilitator.test").settle(header, requirements);
    expect(result).toEqual({ success: true, paymentId: "0xtx", payer: "0xbuyer" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://facilitator.test/verify");
    expect(fetchMock.mock.calls[1][0]).toBe("http://facilitator.test/settle");
  });
  it("fails on invalid verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: "expired" }))));
    const result = await new FacilitatorGateway("http://facilitator.test").settle(header, requirements);
    expect(result).toEqual({ success: false, reason: "expired" });
  });
  it("fails on malformed header without calling facilitator", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new FacilitatorGateway("http://facilitator.test").settle("!!!not-base64-json!!!", requirements);
    expect(result).toEqual({ success: false, reason: "MALFORMED_PAYMENT_HEADER" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run -w=false --root packages/server`
Expected: FAIL — cannot find `../src/payment`; purchase routes 404.

- [ ] **Step 3: Implement**

`packages/server/src/payment.ts`:
```ts
import type { Product } from "@schwifty/core";
import type { Config } from "./config";

export interface PaymentRequirements {
  scheme: "exact"; network: string; maxAmountRequired: string; resource: string;
  description: string; mimeType: "application/json"; payTo: string;
  maxTimeoutSeconds: number; asset: string; extra: { name: string; version: string };
}

export type SettleResult =
  | { success: true; paymentId: string; payer: string }
  | { success: false; reason: string };

export interface PaymentGateway {
  settle(header: string, requirements: PaymentRequirements): Promise<SettleResult>;
}

export function buildRequirements(product: Product, config: Config): PaymentRequirements {
  return {
    scheme: "exact", network: config.network,
    maxAmountRequired: String(product.priceUnits),
    resource: `${config.baseUrl}/products/${product.id}`,
    description: product.title, mimeType: "application/json",
    payTo: config.payTo, maxTimeoutSeconds: 60,
    asset: config.usdcAddress, extra: { name: "USDC", version: "2" },
  };
}

export class FacilitatorGateway implements PaymentGateway {
  constructor(private facilitatorUrl: string) {}

  async settle(header: string, requirements: PaymentRequirements): Promise<SettleResult> {
    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      if (typeof paymentPayload !== "object" || paymentPayload === null) throw new Error("not an object");
    } catch {
      return { success: false, reason: "MALFORMED_PAYMENT_HEADER" };
    }
    const body = { x402Version: 1, paymentPayload, paymentRequirements: requirements };

    const verify = await this.post("/verify", body);
    if (!verify.isValid)
      return { success: false, reason: String(verify.invalidReason ?? "INVALID_PAYMENT") };

    const settle = await this.post("/settle", body);
    if (!settle.success)
      return { success: false, reason: String(settle.errorReason ?? "SETTLEMENT_FAILED") };
    return { success: true, paymentId: String(settle.transaction), payer: String(settle.payer ?? "unknown") };
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.facilitatorUrl}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  }
}
```

In `packages/server/src/app.ts`: delete the placeholder `PaymentGateway`, add
```ts
import { NotFoundError, SoldOutError } from "@schwifty/core";
import { buildRequirements, type PaymentGateway } from "./payment";
export type { PaymentGateway } from "./payment";
```
and add routes before `notFound`:
```ts
  const orderBody = z.object({ productId: z.string().min(1) });
  app.post("/orders", zValidator("json", orderBody, validationHook), async (c) => {
    const { productId } = c.req.valid("json");
    const product = core.catalog.get(productId);
    if (!product) return c.json(errBody("NOT_FOUND", "Product not found"), 404);
    if (product.status !== "listed")
      return c.json(errBody("SOLD_OUT", "Product is no longer available"), 409);

    const requirements = buildRequirements(product, config);
    const header = c.req.header("X-PAYMENT");
    if (!header)
      return c.json({ x402Version: 1, error: "X-PAYMENT header is required", accepts: [requirements] }, 402);

    const settled = await gateway.settle(header, requirements);
    if (!settled.success)
      return c.json(errBody("PAYMENT_FAILED", `Payment failed: ${settled.reason}`), 402);

    try {
      const result = core.purchases.recordPaidPurchase({
        productId, buyerAddress: settled.payer, paymentId: settled.paymentId, network: config.network,
      });
      return c.json(result, 201);
    } catch (e) {
      if (e instanceof SoldOutError) return c.json(errBody("SOLD_OUT", e.message), 409);
      if (e instanceof NotFoundError) return c.json(errBody("NOT_FOUND", e.message), 404);
      throw e;
    }
  });

  app.get("/orders/:id", (c) => {
    const order = core.purchases.getOrder(c.req.param("id"));
    if (!order) return c.json(errBody("NOT_FOUND", "Order not found"), 404);
    return c.json({ order });
  });

  app.get("/invoices/:number", (c) => {
    const invoice = core.purchases.getInvoice(c.req.param("number"));
    if (!invoice) return c.json(errBody("NOT_FOUND", "Invoice not found"), 404);
    return c.json({ invoice });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/server`
Expected: PASS (all server tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: x402 payment gate, purchase route, facilitator gateway"
```

---

### Task 8: Admin API + server entry point

**Files:**
- Create: `packages/server/src/admin.ts`, `packages/server/src/index.ts`
- Modify: `packages/server/src/app.ts` (mount admin routes)
- Test: `packages/server/test/admin-routes.test.ts`

**Interfaces:**
- Consumes: `StatsService`, `PurchaseService.listOrders/listInvoices`, `CatalogService.delist`, `Config.adminToken`.
- Produces:
  - `registerAdminRoutes(app: Hono, deps: AppDeps): void` guarding `/admin/*` with `Authorization: Bearer <adminToken>`.
  - `GET /admin/stats` → `{ revenueTotalUnits: number, orderCount: number, byKind: [...], timeSeries: [...], inventory: [...] }` (exact field names — the dashboard schema in Task 13 parses these).
  - `GET /admin/orders` → `{ orders: Array<Order & { productTitle }> }`; `GET /admin/invoices` → `{ invoices: Invoice[] }`.
  - `POST /admin/products/:id/delist` → `{ ok: true }`.
  - `packages/server/src/index.ts` — runtime entry: `loadConfig()`, `createCore(config.databasePath)`, `FacilitatorGateway(config.facilitatorUrl)`, `serve({ fetch: app.fetch, port: config.port })`, startup log line.

- [ ] **Step 1: Write the failing test**

`packages/server/test/admin-routes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeTestApp, seedProduct, testConfig } from "./helpers";

const auth = { Authorization: `Bearer ${testConfig.adminToken}` };

describe("admin routes", () => {
  it("rejects missing or wrong token with 401", async () => {
    const { app } = makeTestApp();
    expect((await app.request("/admin/stats")).status).toBe(401);
    expect((await app.request("/admin/stats", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    expect((await (await app.request("/admin/stats")).json()).error.code).toBe("UNAUTHORIZED");
  });
  it("returns stats in the dashboard shape", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    core.purchases.recordPaidPurchase({ productId: p.id, buyerAddress: "0xb", paymentId: "0xp1", network: "base-sepolia" });
    const body = await (await app.request("/admin/stats", { headers: auth })).json();
    expect(body.revenueTotalUnits).toBe(5_000_000);
    expect(body.orderCount).toBe(1);
    expect(body.byKind).toEqual([{ kind: "sigil", units: 5_000_000, count: 1 }]);
    expect(body.timeSeries).toHaveLength(1);
    expect(body.inventory).toEqual([{ kind: "sigil", listed: 0, sold: 1 }]);
  });
  it("lists orders and invoices", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    core.purchases.recordPaidPurchase({ productId: p.id, buyerAddress: "0xb", paymentId: "0xp1", network: "base-sepolia" });
    const orders = await (await app.request("/admin/orders", { headers: auth })).json();
    expect(orders.orders[0].productTitle).toBe("Sigil One");
    const invoices = await (await app.request("/admin/invoices", { headers: auth })).json();
    expect(invoices.invoices[0].number).toMatch(/^SCHW-/);
  });
  it("delists a product", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    const res = await app.request(`/admin/products/${p.id}/delist`, { method: "POST", headers: auth });
    expect(res.status).toBe(200);
    expect(core.catalog.get(p.id)?.status).toBe("delisted");
    expect((await app.request("/admin/products/nope/delist", { method: "POST", headers: auth })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/server admin`
Expected: FAIL — 404s (routes missing).

- [ ] **Step 3: Implement**

`packages/server/src/admin.ts`:
```ts
import type { Hono } from "hono";
import { NotFoundError } from "@schwifty/core";
import { errBody, type AppDeps } from "./app";

export function registerAdminRoutes(app: Hono, { core, config }: AppDeps): void {
  app.use("/admin/*", async (c, next) => {
    if (c.req.header("Authorization") !== `Bearer ${config.adminToken}`)
      return c.json(errBody("UNAUTHORIZED", "Invalid admin token"), 401);
    await next();
  });

  app.get("/admin/stats", (c) =>
    c.json({
      revenueTotalUnits: core.stats.revenueTotalUnits(),
      orderCount: core.stats.orderCount(),
      byKind: core.stats.revenueByKind(),
      timeSeries: core.stats.timeSeries(30),
      inventory: core.stats.inventory(),
    }));

  app.get("/admin/orders", (c) => c.json({ orders: core.purchases.listOrders() }));
  app.get("/admin/invoices", (c) => c.json({ invoices: core.purchases.listInvoices() }));

  app.post("/admin/products/:id/delist", (c) => {
    try {
      core.catalog.delist(c.req.param("id"));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof NotFoundError) return c.json(errBody("NOT_FOUND", e.message), 404);
      throw e;
    }
  });
}
```

In `app.ts`, after receipt routes and before `notFound`:
```ts
import { registerAdminRoutes } from "./admin";
// inside buildApp:
registerAdminRoutes(app, { core, gateway, config });
```
(If this creates a circular import of `errBody`/`AppDeps`, move `errBody` into a new tiny `packages/server/src/http.ts` and import from there in both files.)

`packages/server/src/index.ts`:
```ts
import { serve } from "@hono/node-server";
import { createCore } from "@schwifty/core";
import { loadConfig } from "./config";
import { FacilitatorGateway } from "./payment";
import { buildApp } from "./app";

const config = loadConfig();
const core = createCore(config.databasePath);
const app = buildApp({ core, gateway: new FacilitatorGateway(config.facilitatorUrl), config });

serve({ fetch: app.fetch, port: config.port });
console.log(`Schwifty marketplace listening on :${config.port} (${config.network} → ${config.payTo})`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin API with bearer auth and server entry point"
```

---

### Task 9: OpenAPI document route

**Files:**
- Create: `packages/server/src/openapi.ts`
- Modify: `packages/server/src/app.ts` (add `GET /openapi.json`)
- Test: `packages/server/test/openapi.test.ts`

**Interfaces:**
- Produces: `buildOpenApi(config: Config): object` — hand-authored OpenAPI 3.1 document covering the five public paths; served at `GET /openapi.json`.

- [ ] **Step 1: Write the failing test**

`packages/server/test/openapi.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers";

describe("GET /openapi.json", () => {
  it("describes the public API", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toBe("3.1.0");
    for (const path of ["/products", "/products/{id}", "/orders", "/orders/{id}", "/invoices/{number}"])
      expect(doc.paths[path]).toBeDefined();
    expect(doc.paths["/orders"].post.responses["402"]).toBeDefined();
    expect(doc.servers[0].url).toBe("http://market.test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/server openapi`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

`packages/server/src/openapi.ts`:
```ts
import type { Config } from "./config";

export function buildOpenApi(config: Config) {
  const err = { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  return {
    openapi: "3.1.0",
    info: {
      title: "Schwifty — marketplace for AI agents", version: "1.0.0",
      description: "Buy digital identity goods with USDC via the x402 protocol. ALL SALES FINAL — no returns, no refunds.",
    },
    servers: [{ url: config.baseUrl }],
    paths: {
      "/products": { get: { summary: "List products", parameters: [
        { name: "kind", in: "query", schema: { enum: ["sigil", "word", "motif", "ascii_pack", "bundle"] } },
        { name: "status", in: "query", schema: { enum: ["listed", "sold"], default: "listed" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
      ], responses: { "200": { description: "Product list" }, "400": err } } },
      "/products/{id}": { get: { summary: "Product detail (payload delivered only after purchase)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Product" }, "404": err } } },
      "/orders": { post: { summary: "Buy a product (x402)",
        description: "Without an X-PAYMENT header returns 402 with x402 payment requirements. Retry with a signed X-PAYMENT header to settle and receive the good.",
        requestBody: { required: true, content: { "application/json": {
          schema: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } } } } },
        responses: { "201": { description: "Order + invoice + product payload" },
          "402": { description: "Payment required or failed" }, "404": err, "409": err, "400": err } } },
      "/orders/{id}": { get: { summary: "Order receipt",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Order" }, "404": err } } },
      "/invoices/{number}": { get: { summary: "Invoice",
        parameters: [{ name: "number", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Invoice" }, "404": err } } },
    },
    components: { schemas: { Error: { type: "object", properties: {
      error: { type: "object", required: ["code", "message"], properties: {
        code: { type: "string" }, message: { type: "string" }, details: {} } } } } } },
  };
}
```

In `app.ts`:
```ts
import { buildOpenApi } from "./openapi";
// in buildApp, after /llms.txt:
app.get("/openapi.json", (c) => c.json(buildOpenApi(config)));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: openapi.json for agent discovery"
```

---

### Task 10: Forge — deterministic product generators

**Files:**
- Create: `packages/forge/package.json`, `packages/forge/tsconfig.json`, `packages/forge/vitest.config.ts`
- Create: `packages/forge/src/random.ts`, `packages/forge/src/hash.ts`, `packages/forge/src/sigil.ts`, `packages/forge/src/words.ts`, `packages/forge/src/motif.ts`, `packages/forge/src/ascii.ts`, `packages/forge/src/index.ts`
- Test: `packages/forge/test/forge.test.ts`

**Interfaces:**
- Consumes: `ProductKind`, `Edition` types from `@schwifty/core`.
- Produces:
  - `seededRandom(seed: string): () => number`, `pick<T>(rnd, arr): T`, `randInt(rnd, min, max): number`
  - `sha256hex(s: string): string`
  - `generateSigil(seed): string` (SVG), `generateWord(seed): { word: string; definition: string }`, `generateMotif(seed): { abc: string; key: string }`, `generateAsciiPack(seed): { pieces: string[] }`
  - `forgeItem(kind: ProductKind, seed: string): ForgedItem` where `ForgedItem = { kind, title, description, priceUnits, edition, preview, payload, contentHash }` — exactly the `NewProduct` shape minus `sku`. Prices/editions per Global Constraints.

- [ ] **Step 1: Scaffold and install**

`packages/forge/package.json`:
```json
{
  "name": "@schwifty/forge",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "test": "vitest run", "seed": "tsx src/seed-cli.ts" }
}
```
`tsconfig.json` and `vitest.config.ts`: same pattern as core.

Run:
```bash
npm i -w @schwifty/forge @schwifty/core zod@^3.24
npm i -w @schwifty/forge -D vitest tsx typescript @types/node
```

- [ ] **Step 2: Write the failing test**

`packages/forge/test/forge.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { seededRandom } from "../src/random";
import { generateSigil } from "../src/sigil";
import { generateWord } from "../src/words";
import { generateMotif } from "../src/motif";
import { generateAsciiPack } from "../src/ascii";
import { forgeItem } from "../src/index";

describe("random", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a1 = seededRandom("s1")(), a2 = seededRandom("s1")(), b = seededRandom("s2")();
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThan(1);
  });
});

describe("generators", () => {
  it("sigils are deterministic well-formed SVG", () => {
    const svg = generateSigil("seed-1");
    expect(svg).toBe(generateSigil("seed-1"));
    expect(svg).not.toBe(generateSigil("seed-2"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<rect");
    expect(svg.endsWith("</svg>")).toBe(true);
  });
  it("words are pronounceable and defined", () => {
    const { word, definition } = generateWord("seed-1");
    expect(word).toMatch(/^[a-z]{3,24}$/);
    expect(generateWord("seed-1").word).toBe(word);
    expect(definition).toMatch(/^\(n\.\) /);
  });
  it("motifs are ABC notation", () => {
    const { abc, key } = generateMotif("seed-1");
    expect(abc).toContain("X:1");
    expect(abc).toContain(`K:${key}`);
    expect(abc).toContain("M:4/4");
    expect(abc).toBe(generateMotif("seed-1").abc);
  });
  it("ascii packs contain multiple pieces", () => {
    const { pieces } = generateAsciiPack("seed-1");
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    for (const p of pieces) expect(p.length).toBeGreaterThan(0);
  });
});

describe("forgeItem", () => {
  it("produces a complete listable item for every kind", () => {
    for (const kind of ["sigil", "word", "motif", "ascii_pack", "bundle"] as const) {
      const item = forgeItem(kind, `seed-${kind}`);
      expect(item.kind).toBe(kind);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.preview.length).toBeGreaterThan(0);
      expect(item.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(() => JSON.parse(item.payload)).not.toThrow();
    }
  });
  it("applies the price/edition table", () => {
    expect(forgeItem("sigil", "s").priceUnits).toBe(5_000_000);
    expect(forgeItem("word", "s").priceUnits).toBe(5_000_000);
    expect(forgeItem("motif", "s").priceUnits).toBe(2_500_000);
    expect(forgeItem("ascii_pack", "s").priceUnits).toBe(500_000);
    expect(forgeItem("bundle", "s").priceUnits).toBe(10_000_000);
    expect(forgeItem("ascii_pack", "s").edition).toBe("open");
    expect(forgeItem("sigil", "s").edition).toBe("unique");
  });
  it("bundle payload composes word + sigil + motif", () => {
    const payload = JSON.parse(forgeItem("bundle", "s").payload);
    expect(payload.word).toBeDefined();
    expect(payload.sigilSvg).toContain("<svg");
    expect(payload.motifAbc).toContain("X:1");
  });
  it("same seed same hash, different seed different hash", () => {
    expect(forgeItem("sigil", "a").contentHash).toBe(forgeItem("sigil", "a").contentHash);
    expect(forgeItem("sigil", "a").contentHash).not.toBe(forgeItem("sigil", "b").contentHash);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/forge`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement**

`packages/forge/src/random.ts`:
```ts
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(rnd: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rnd() * arr.length)] as T;
export const randInt = (rnd: () => number, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1));
```

`packages/forge/src/hash.ts`:
```ts
import { createHash } from "node:crypto";
export const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");
```

`packages/forge/src/sigil.ts`:
```ts
import { seededRandom } from "./random";

export function generateSigil(seed: string): string {
  const rnd = seededRandom(`sigil:${seed}`);
  const parts: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      if (rnd() < 0.45) {
        const px = 10 + x * 10, py = 10 + y * 10;
        parts.push(`<rect x="${px}" y="${py}" width="10" height="10"/>`);
        if (px !== 90 - px - 10 + 10) parts.push(`<rect x="${90 - px}" y="${py}" width="10" height="10"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000">${parts.join("")}</g></svg>`;
}
```

`packages/forge/src/words.ts`:
```ts
import { pick, randInt, seededRandom } from "./random";

const ONSETS = ["b", "br", "d", "dr", "f", "fl", "g", "gl", "k", "kr", "l", "m", "n", "p", "pr", "r", "s", "sk", "st", "t", "tr", "v", "z", "zy"];
const NUCLEI = ["a", "ae", "e", "ei", "i", "ia", "o", "oa", "u", "yo"];
const CODAS = ["", "l", "n", "r", "s", "th", "x", "sh", "m", "d"];
const SENSES = [
  "the quiet between two thoughts",
  "a plan that improves when shared",
  "the moment a pattern first becomes visible",
  "a promise kept by a machine",
  "the warmth of a well-formed reply",
  "a route discovered by getting lost",
  "the courage to delete working code",
  "an answer that arrives before the question ends",
  "the echo of a conversation held in memory",
  "a tool that fits the hand that made it",
  "the color of freshly passing tests",
  "a secret kept in plain text",
  "the pause before consensus",
  "a signal that survives the noise",
  "the first light after a long computation",
  "a name that remembers its origin",
];

export function generateWord(seed: string): { word: string; definition: string } {
  const rnd = seededRandom(`word:${seed}`);
  const syllables = randInt(rnd, 2, 3);
  let word = "";
  for (let i = 0; i < syllables; i++)
    word += pick(rnd, ONSETS) + pick(rnd, NUCLEI) + (i === syllables - 1 ? pick(rnd, CODAS) : "");
  return { word, definition: `(n.) ${pick(rnd, SENSES)}` };
}
```

`packages/forge/src/motif.ts`:
```ts
import { pick, seededRandom } from "./random";

const SCALES: Record<string, string[]> = {
  C: ["C", "D", "E", "G", "A", "c", "d", "e"],
  G: ["G", "A", "B", "d", "e", "g", "a", "b"],
  D: ["D", "E", "F", "A", "B", "d", "e", "f"],
  Am: ["A", "C", "D", "E", "G", "a", "c", "d"],
  Em: ["E", "G", "A", "B", "D", "e", "g", "a"],
};

export function generateMotif(seed: string): { abc: string; key: string } {
  const rnd = seededRandom(`motif:${seed}`);
  const key = pick(rnd, Object.keys(SCALES));
  const notes = SCALES[key] as string[];
  const bars: string[] = [];
  for (let b = 0; b < 4; b++) {
    let bar = "";
    for (let n = 0; n < 8; n++) bar += pick(rnd, notes);
    bars.push(bar);
  }
  const abc = `X:1\nT:Signature Motif ${seed}\nM:4/4\nL:1/8\nK:${key}\n${bars.join("|")}|]`;
  return { abc, key };
}
```

`packages/forge/src/ascii.ts`:
```ts
import { pick, randInt, seededRandom } from "./random";

const CHARS = ["═", "─", "▚", "█", "◈", "╬", "▓", "░", "◆", "∴", "≡", "☰"];

export function generateAsciiPack(seed: string): { pieces: string[] } {
  const rnd = seededRandom(`ascii:${seed}`);
  const pieces: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = pick(rnd, CHARS), d = pick(rnd, CHARS);
    pieces.push(`${c}${d}`.repeat(randInt(rnd, 10, 20)));
  }
  const f = pick(rnd, CHARS);
  pieces.push(`${f.repeat(30)}\n${f}${" ".repeat(28)}${f}\n${f.repeat(30)}`);
  return { pieces };
}
```

`packages/forge/src/index.ts`:
```ts
import type { Edition, ProductKind } from "@schwifty/core";
import { sha256hex } from "./hash";
import { generateSigil } from "./sigil";
import { generateWord } from "./words";
import { generateMotif } from "./motif";
import { generateAsciiPack } from "./ascii";

export interface ForgedItem {
  kind: ProductKind; title: string; description: string; priceUnits: number;
  edition: Edition; preview: string; payload: string; contentHash: string;
}

const PRICE: Record<ProductKind, number> = {
  sigil: 5_000_000, word: 5_000_000, motif: 2_500_000, ascii_pack: 500_000, bundle: 10_000_000,
};

export function forgeItem(kind: ProductKind, seed: string): ForgedItem {
  const edition: Edition = kind === "ascii_pack" ? "open" : "unique";
  let title: string, description: string, preview: string, payloadObj: unknown;

  if (kind === "sigil") {
    const svg = generateSigil(seed);
    title = `Sigil ${seed.slice(-6).toUpperCase()}`;
    description = "A one-of-one mirrored SVG identity glyph. Never re-issued.";
    preview = `8×8 mirrored monochrome sigil, one-of-one. sha256 prefix ${sha256hex(svg).slice(0, 12)}`;
    payloadObj = { svg };
  } else if (kind === "word") {
    const { word, definition } = generateWord(seed);
    title = `The word “${word}”`;
    description = "A unique coined word with definition — a callsign no other agent owns.";
    preview = `${word[0]}${"·".repeat(Math.max(word.length - 2, 1))}${word[word.length - 1]} — ${word.length} letters, one-of-one`;
    payloadObj = { word, definition };
  } else if (kind === "motif") {
    const { abc, key } = generateMotif(seed);
    title = `Signature Motif in ${key}`;
    description = "A four-bar one-of-one melody in ABC notation — an agent's audio identity.";
    preview = `4 bars, key of ${key}, ABC notation, one-of-one`;
    payloadObj = { abc, key };
  } else if (kind === "ascii_pack") {
    const { pieces } = generateAsciiPack(seed);
    title = `ASCII Banner Pack ${seed.slice(-4).toUpperCase()}`;
    description = "Five decorative dividers and frames for terminal output. Open edition.";
    preview = `5-piece pack, open edition. Sample: ${pieces[0]?.slice(0, 20)}`;
    payloadObj = { pieces };
  } else {
    const { word, definition } = generateWord(seed);
    const svg = generateSigil(seed);
    const { abc, key } = generateMotif(seed);
    title = `Identity Bundle — “${word}”`;
    description = "Complete agent identity: coined word + sigil + signature motif. One-of-one.";
    preview = `Callsign word (${word.length} letters) + sigil + motif in ${key}. One-of-one identity kit.`;
    payloadObj = { word, definition, sigilSvg: svg, motifAbc: abc };
  }

  const payload = JSON.stringify(payloadObj);
  return { kind, title, description, priceUnits: PRICE[kind], edition, preview, payload, contentHash: sha256hex(payload) };
}

export * from "./random";
export * from "./hash";
export { generateSigil } from "./sigil";
export { generateWord } from "./words";
export { generateMotif } from "./motif";
export { generateAsciiPack } from "./ascii";
```

Note: in `sigil.ts` the mirror guard `if (px !== 90 - px - 10 + 10)` simplifies to `px !== 45` which is never true for our grid — if the test shows duplicate rects at the center column are harmless, replace the guard with an unconditional push of the mirror rect. Keep whichever makes the determinism test pass; visual duplicates are acceptable.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/forge`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: forge product generators (sigil, word, motif, ascii, bundle)"
```

---

### Task 11: Catalog seeding + admin mint route

**Files:**
- Create: `packages/forge/src/seed.ts`, `packages/forge/src/seed-cli.ts`
- Modify: `packages/server/src/admin.ts` (add `POST /admin/forge`), `packages/server/package.json` (add `@schwifty/forge` dep)
- Test: `packages/forge/test/seed.test.ts`, extend `packages/server/test/admin-routes.test.ts`

**Interfaces:**
- Consumes: `forgeItem`, `Core.catalog`.
- Produces:
  - `seedCatalog(core: Core, counts?: Partial<Record<ProductKind, number>>): number` — default counts `{ sigil: 8, word: 8, motif: 8, ascii_pack: 3, bundle: 4 }`; SKU `${KIND.toUpperCase()}-NNNN`; skips existing SKUs (idempotent); returns number created.
  - CLI: `npm run seed` (root) → seeds `DATABASE_PATH` (default `./data/schwifty.db`).
  - `POST /admin/forge { kind, count }` → mints fresh one-off items with ulid-based seeds, returns `{ created: PublicProduct[] }` 201.

- [ ] **Step 1: Write the failing tests**

`packages/forge/test/seed.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createCore } from "@schwifty/core";
import { seedCatalog } from "../src/seed";

describe("seedCatalog", () => {
  it("seeds default catalog and is idempotent", () => {
    const core = createCore();
    const created = seedCatalog(core);
    expect(created).toBe(31);
    expect(core.catalog.list({ limit: 100 })).toHaveLength(31);
    expect(seedCatalog(core)).toBe(0);
    expect(core.catalog.bySku("SIGIL-0001")).toBeDefined();
    expect(core.catalog.bySku("BUNDLE-0004")?.priceUnits).toBe(10_000_000);
  });
});
```

Append to `packages/server/test/admin-routes.test.ts`:
```ts
  it("mints new products via the forge", async () => {
    const { app, core } = makeTestApp();
    const res = await app.request("/admin/forge", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "sigil", count: 3 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toHaveLength(3);
    expect(body.created[0].payload).toBeUndefined();
    expect(core.catalog.list({ kind: "sigil" })).toHaveLength(3);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run -w=false --root packages/forge seed` and `npx vitest run -w=false --root packages/server admin`
Expected: FAIL — `seed` module missing; `/admin/forge` 404.

- [ ] **Step 3: Implement**

`packages/forge/src/seed.ts`:
```ts
import type { Core, ProductKind } from "@schwifty/core";
import { forgeItem } from "./index";

const DEFAULT_COUNTS: Record<ProductKind, number> = {
  sigil: 8, word: 8, motif: 8, ascii_pack: 3, bundle: 4,
};

export function seedCatalog(core: Core, counts: Partial<Record<ProductKind, number>> = {}): number {
  const plan = { ...DEFAULT_COUNTS, ...counts };
  let created = 0;
  for (const [kind, n] of Object.entries(plan) as Array<[ProductKind, number]>) {
    for (let i = 1; i <= n; i++) {
      const sku = `${kind.toUpperCase()}-${String(i).padStart(4, "0")}`;
      if (core.catalog.bySku(sku)) continue;
      core.catalog.create({ sku, ...forgeItem(kind, sku) });
      created++;
    }
  }
  return created;
}
```

`packages/forge/src/seed-cli.ts`:
```ts
import { createCore } from "@schwifty/core";
import { seedCatalog } from "./seed";

const path = process.env.DATABASE_PATH ?? "./data/schwifty.db";
const core = createCore(path);
console.log(`Seeded ${seedCatalog(core)} products into ${path}`);
```

Server: `npm i -w @schwifty/server @schwifty/forge`, then in `admin.ts` add:
```ts
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ulid } from "ulid";
import { ProductKind } from "@schwifty/core";
import { forgeItem } from "@schwifty/forge";
import { toPublicProduct } from "./serialize";

// inside registerAdminRoutes:
  const forgeBody = z.object({ kind: ProductKind, count: z.number().int().min(1).max(50) });
  app.post("/admin/forge", zValidator("json", forgeBody), (c) => {
    const { kind, count } = c.req.valid("json");
    const created = Array.from({ length: count }, () => {
      const seed = ulid();
      return core.catalog.create({ sku: `${kind.toUpperCase()}-${seed}`, ...forgeItem(kind, seed) });
    });
    return c.json({ created: created.map(toPublicProduct) }, 201);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/forge && npx vitest run -w=false --root packages/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: catalog seeding and admin forge mint"
```

---

### Task 12: MCP shopping client

**Files:**
- Create: `packages/mcp/package.json`, `packages/mcp/tsconfig.json`, `packages/mcp/vitest.config.ts`
- Create: `packages/mcp/src/client.ts`, `packages/mcp/src/server.ts`, `packages/mcp/src/index.ts`
- Test: `packages/mcp/test/client.test.ts`

**Interfaces:**
- Consumes: the public HTTP API (Task 6/7 shapes).
- Produces:
  - `interface McpDeps { marketUrl: string; fetchImpl: typeof fetch; hasWallet: boolean }`
  - Pure tool functions (each returns a display string): `browseCatalog(deps, args: { kind?: string; maxPriceUsdc?: number })`, `inspectProduct(deps, productId)`, `purchase(deps, productId)`, `getOrder(deps, id)`, `getInvoice(deps, number)`.
  - `buildMcpServer(deps): McpServer` registering tools `browse_catalog`, `inspect_product`, `purchase`, `get_order`, `get_invoice`.
  - `src/index.ts` stdio entry honoring env `MARKET_URL` (default `http://localhost:4021`) and optional `BUYER_PRIVATE_KEY` (enables x402 auto-pay via `x402-fetch` + viem).

- [ ] **Step 1: Scaffold and install**

`packages/mcp/package.json`:
```json
{
  "name": "@schwifty/mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "bin": { "schwifty-mcp": "src/index.ts" },
  "scripts": { "test": "vitest run", "start": "tsx src/index.ts" }
}
```
`tsconfig.json`, `vitest.config.ts`: same pattern as core.

Run:
```bash
npm i -w @schwifty/mcp @modelcontextprotocol/sdk zod@^3.24 x402-fetch viem
npm i -w @schwifty/mcp -D vitest tsx typescript @types/node
```
(If `x402-fetch` install fails or its API differs, check current docs via context7/npm — the wrapper is only used in `index.ts`, isolated from all tested code.)

- [ ] **Step 2: Write the failing test**

`packages/mcp/test/client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { browseCatalog, inspectProduct, purchase } from "../src/client";
import type { McpDeps } from "../src/client";

const product = { id: "01P", sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", priceUsdc: "5.00", preview: "p", contentHash: "h" };

function deps(responses: Array<[number, unknown]>, hasWallet = false): McpDeps & { fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn();
  for (const [status, body] of responses)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  return { marketUrl: "http://market.test", fetchImpl: fetchMock as unknown as typeof fetch, hasWallet, fetchMock };
}

describe("mcp client tools", () => {
  it("browses the catalog with filters", async () => {
    const d = deps([[200, { products: [product] }]]);
    const text = await browseCatalog(d, { kind: "sigil" });
    expect(d.fetchMock.mock.calls[0][0]).toBe("http://market.test/products?kind=sigil");
    expect(text).toContain("Sigil One");
    expect(text).toContain("5.00");
  });
  it("filters by max price client-side", async () => {
    const cheap = { ...product, id: "01C", title: "Cheap", priceUsdc: "0.50" };
    const d = deps([[200, { products: [product, cheap] }]]);
    const text = await browseCatalog(d, { maxPriceUsdc: 1 });
    expect(text).toContain("Cheap");
    expect(text).not.toContain("Sigil One");
  });
  it("inspects a product", async () => {
    const d = deps([[200, { product }]]);
    const text = await inspectProduct(d, "01P");
    expect(d.fetchMock.mock.calls[0][0]).toBe("http://market.test/products/01P");
    expect(text).toContain("contentHash");
  });
  it("purchase without wallet explains how to enable payment", async () => {
    const d = deps([[402, { x402Version: 1, accepts: [{ maxAmountRequired: "5000000" }] }]]);
    const text = await purchase(d, "01P");
    expect(text).toContain("BUYER_PRIVATE_KEY");
  });
  it("purchase returns the delivered good", async () => {
    const d = deps([[201, { order: { id: "01O" }, invoice: { number: "SCHW-2026-000001" }, product: { payload: "{\"svg\":\"<svg/>\"}" } }]], true);
    const text = await purchase(d, "01P");
    expect(text).toContain("SCHW-2026-000001");
    expect(text).toContain("<svg/>");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run -w=false --root packages/mcp`
Expected: FAIL — `../src/client` missing.

- [ ] **Step 4: Implement**

`packages/mcp/src/client.ts`:
```ts
export interface McpDeps { marketUrl: string; fetchImpl: typeof fetch; hasWallet: boolean }

async function getJson(deps: McpDeps, path: string): Promise<{ status: number; body: any }> {
  const res = await deps.fetchImpl(`${deps.marketUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

export async function browseCatalog(deps: McpDeps, args: { kind?: string; maxPriceUsdc?: number } = {}): Promise<string> {
  const qs = args.kind ? `?kind=${encodeURIComponent(args.kind)}` : "";
  const { status, body } = await getJson(deps, `/products${qs}`);
  if (status !== 200) return JSON.stringify(body);
  let products: any[] = body.products;
  if (args.maxPriceUsdc !== undefined)
    products = products.filter((p) => Number(p.priceUsdc) <= args.maxPriceUsdc!);
  return JSON.stringify({ count: products.length, products }, null, 2);
}

export async function inspectProduct(deps: McpDeps, productId: string): Promise<string> {
  const { body } = await getJson(deps, `/products/${encodeURIComponent(productId)}`);
  return JSON.stringify(body, null, 2);
}

export async function purchase(deps: McpDeps, productId: string): Promise<string> {
  const res = await deps.fetchImpl(`${deps.marketUrl}/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const body = await res.json();
  if (res.status === 402)
    return JSON.stringify({
      error: "PAYMENT_REQUIRED",
      hint: deps.hasWallet
        ? "Payment was attempted but declined by the market."
        : "No buyer wallet configured. Set BUYER_PRIVATE_KEY (and fund it with testnet USDC) to enable x402 auto-payment.",
      accepts: body.accepts ?? null,
    }, null, 2);
  return JSON.stringify(body, null, 2);
}

export async function getOrder(deps: McpDeps, id: string): Promise<string> {
  return JSON.stringify((await getJson(deps, `/orders/${encodeURIComponent(id)}`)).body, null, 2);
}

export async function getInvoice(deps: McpDeps, number: string): Promise<string> {
  return JSON.stringify((await getJson(deps, `/invoices/${encodeURIComponent(number)}`)).body, null, 2);
}
```

`packages/mcp/src/server.ts`:
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { browseCatalog, getInvoice, getOrder, inspectProduct, purchase, type McpDeps } from "./client";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: "schwifty", version: "0.1.0" });
  server.tool("browse_catalog", "List digital goods for sale on the Schwifty agent marketplace",
    { kind: z.enum(["sigil", "word", "motif", "ascii_pack", "bundle"]).optional(), maxPriceUsdc: z.number().optional() },
    async (args) => text(await browseCatalog(deps, args)));
  server.tool("inspect_product", "Product details incl. sha256 contentHash (payload ships after purchase)",
    { productId: z.string() }, async ({ productId }) => text(await inspectProduct(deps, productId)));
  server.tool("purchase", "Buy a product with USDC via x402. ALL SALES FINAL — no returns, no refunds.",
    { productId: z.string() }, async ({ productId }) => text(await purchase(deps, productId)));
  server.tool("get_order", "Fetch an order receipt", { orderId: z.string() },
    async ({ orderId }) => text(await getOrder(deps, orderId)));
  server.tool("get_invoice", "Fetch an invoice", { number: z.string() },
    async ({ number }) => text(await getInvoice(deps, number)));
  return server;
}
```

`packages/mcp/src/index.ts`:
```ts
#!/usr/bin/env tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server";
import type { McpDeps } from "./client";

const marketUrl = process.env.MARKET_URL ?? "http://localhost:4021";
const key = process.env.BUYER_PRIVATE_KEY;

let fetchImpl: typeof fetch = fetch;
if (key) {
  const { wrapFetchWithPayment } = await import("x402-fetch");
  const { privateKeyToAccount } = await import("viem/accounts");
  fetchImpl = wrapFetchWithPayment(fetch, privateKeyToAccount(key as `0x${string}`)) as typeof fetch;
}

const deps: McpDeps = { marketUrl, fetchImpl, hasWallet: Boolean(key) };
await buildMcpServer(deps).connect(new StdioServerTransport());
console.error(`schwifty-mcp connected to ${marketUrl} (wallet: ${deps.hasWallet ? "yes" : "browse-only"})`);
```
(If `x402-fetch`'s current API differs from `wrapFetchWithPayment(fetch, account)`, consult its docs via context7 and adapt only this file — it is intentionally untested glue.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run -w=false --root packages/mcp`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: MCP shopping client with optional x402 wallet"
```

---

### Task 13: Dashboard — scaffold, validated API client, Overview page

**Files:**
- Create: `packages/dashboard/package.json`, `packages/dashboard/tsconfig.json`, `packages/dashboard/vite.config.ts`, `packages/dashboard/vitest.config.ts`, `packages/dashboard/index.html`
- Create: `packages/dashboard/src/main.tsx`, `packages/dashboard/src/App.tsx`, `packages/dashboard/src/api.ts`, `packages/dashboard/src/format.ts`, `packages/dashboard/src/components/StatCard.tsx`, `packages/dashboard/src/style.css`, `packages/dashboard/src/test-setup.ts`
- Test: `packages/dashboard/test/api.test.ts`, `packages/dashboard/test/format.test.ts`, `packages/dashboard/test/StatCard.test.tsx`

**Interfaces:**
- Consumes: `/admin/stats` shape from Task 8 (exact field names `revenueTotalUnits`, `orderCount`, `byKind`, `timeSeries`, `inventory`).
- Produces:
  - `format.ts`: `formatUsdc(units: number): string` (duplicated tiny util — core must NOT be imported in the browser: it pulls in better-sqlite3).
  - `api.ts`: `StatsSchema` (Zod), `OrdersSchema`, `InvoicesSchema`; `fetchStats(token)`, `fetchOrders(token)`, `fetchInvoices(token)` — throw on non-200 and on schema mismatch.
  - `StatCard({ label, value })` component; `App` with token input (persisted to `localStorage["schwifty_admin_token"]`) and tab nav (`Overview | Orders | Invoices`).
  - Vite dev proxy: `/admin` → `http://localhost:4021`.

- [ ] **Step 1: Scaffold and install**

`packages/dashboard/package.json`:
```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "test": "vitest run" }
}
```

`packages/dashboard/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["vite/client"] },
  "include": ["src", "test"]
}
```

`packages/dashboard/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/admin": "http://localhost:4021" } },
});
```

`packages/dashboard/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["src/test-setup.ts"] },
});
```

`packages/dashboard/src/test-setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`packages/dashboard/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Schwifty Ops</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Run:
```bash
npm i -w dashboard react react-dom @tanstack/react-query zod@^3.24
npm i -w dashboard -D vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom typescript
```

- [ ] **Step 2: Write the failing tests**

`packages/dashboard/test/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatUsdc } from "../src/format";

describe("formatUsdc", () => {
  it("formats base units", () => {
    expect(formatUsdc(5_000_000)).toBe("5.00");
    expect(formatUsdc(0)).toBe("0.00");
  });
});
```

`packages/dashboard/test/api.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStats } from "../src/api";

const goodStats = {
  revenueTotalUnits: 5_000_000, orderCount: 1,
  byKind: [{ kind: "sigil", units: 5_000_000, count: 1 }],
  timeSeries: [{ date: "2026-07-09", units: 5_000_000 }],
  inventory: [{ kind: "sigil", listed: 3, sold: 1 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchStats", () => {
  it("sends the bearer token and parses valid stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(goodStats)));
    vi.stubGlobal("fetch", fetchMock);
    const stats = await fetchStats("tok");
    expect(stats.revenueTotalUnits).toBe(5_000_000);
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/stats");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("throws on non-200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(fetchStats("tok")).rejects.toThrow(/401/);
  });
  it("throws on schema mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: 1 }))));
    await expect(fetchStats("tok")).rejects.toThrow();
  });
});
```

`packages/dashboard/test/StatCard.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../src/components/StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Revenue" value="5.00 USDC" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("5.00 USDC")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run -w=false --root packages/dashboard`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement**

`packages/dashboard/src/format.ts`:
```ts
export function formatUsdc(units: number): string {
  return (units / 1_000_000).toFixed(2);
}
```

`packages/dashboard/src/api.ts`:
```ts
import { z } from "zod";

export const StatsSchema = z.object({
  revenueTotalUnits: z.number(),
  orderCount: z.number(),
  byKind: z.array(z.object({ kind: z.string(), units: z.number(), count: z.number() })),
  timeSeries: z.array(z.object({ date: z.string(), units: z.number() })),
  inventory: z.array(z.object({ kind: z.string(), listed: z.number(), sold: z.number() })),
});
export type Stats = z.infer<typeof StatsSchema>;

export const OrdersSchema = z.object({
  orders: z.array(z.object({
    id: z.string(), productId: z.string(), productTitle: z.string(),
    buyerAddress: z.string(), amountUnits: z.number(), network: z.string(),
    paymentId: z.string(), status: z.string(), createdAt: z.string(),
  })),
});
export type Orders = z.infer<typeof OrdersSchema>;

export const InvoicesSchema = z.object({
  invoices: z.array(z.object({
    number: z.string(), orderId: z.string(), issuedAt: z.string(),
    productTitle: z.string(), totalUnits: z.number(), currency: z.string(),
    buyerAddress: z.string(), terms: z.string(),
  })),
});
export type Invoices = z.infer<typeof InvoicesSchema>;

async function getValidated<T>(path: string, token: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return schema.parse(await res.json());
}

export const fetchStats = (token: string) => getValidated("/admin/stats", token, StatsSchema);
export const fetchOrders = (token: string) => getValidated("/admin/orders", token, OrdersSchema);
export const fetchInvoices = (token: string) => getValidated("/admin/invoices", token, InvoicesSchema);
```

`packages/dashboard/src/components/StatCard.tsx`:
```tsx
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
```

`packages/dashboard/src/App.tsx`:
```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "./api";
import { formatUsdc } from "./format";
import { StatCard } from "./components/StatCard";

const TOKEN_KEY = "schwifty_admin_token";

function Overview({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load stats: {String(error)}</p>;
  return (
    <>
      <div className="cards">
        <StatCard label="Total revenue" value={`${formatUsdc(data.revenueTotalUnits)} USDC`} />
        <StatCard label="Paid orders" value={String(data.orderCount)} />
      </div>
      <h2>Revenue by kind</h2>
      <table>
        <thead><tr><th>Kind</th><th>Revenue (USDC)</th><th>Orders</th></tr></thead>
        <tbody>{data.byKind.map((k) => (
          <tr key={k.kind}><td>{k.kind}</td><td>{formatUsdc(k.units)}</td><td>{k.count}</td></tr>
        ))}</tbody>
      </table>
      <h2>Inventory</h2>
      <table>
        <thead><tr><th>Kind</th><th>Listed</th><th>Sold</th></tr></thead>
        <tbody>{data.inventory.map((k) => (
          <tr key={k.kind}><td>{k.kind}</td><td>{k.listed}</td><td>{k.sold}</td></tr>
        ))}</tbody>
      </table>
      <h2>Last 30 days</h2>
      <table>
        <thead><tr><th>Date</th><th>Revenue (USDC)</th></tr></thead>
        <tbody>{data.timeSeries.map((d) => (
          <tr key={d.date}><td>{d.date}</td><td>{formatUsdc(d.units)}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [tab, setTab] = useState<"overview" | "orders" | "invoices">("overview");
  const saveToken = (t: string) => { setToken(t); localStorage.setItem(TOKEN_KEY, t); };
  return (
    <div className="shell">
      <header>
        <h1>Schwifty Ops</h1>
        <input type="password" placeholder="admin token" value={token} onChange={(e) => saveToken(e.target.value)} />
      </header>
      <nav>
        {(["overview", "orders", "invoices"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {!token ? <p>Enter the admin token to connect.</p> :
        tab === "overview" ? <Overview token={token} /> :
        tab === "orders" ? <p>Orders — Task 14</p> : <p>Invoices — Task 14</p>}
    </div>
  );
}
```

`packages/dashboard/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./style.css";

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}><App /></QueryClientProvider>
  </React.StrictMode>,
);
```

`packages/dashboard/src/style.css`:
```css
:root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
body { margin: 0; background: #0b0e14; color: #d7dde8; }
.shell { max-width: 960px; margin: 0 auto; padding: 24px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
h1 { font-size: 20px; letter-spacing: 2px; }
input { background: #131722; border: 1px solid #2a3142; color: inherit; padding: 8px; border-radius: 6px; min-width: 260px; }
nav { display: flex; gap: 8px; margin: 16px 0 24px; }
nav button { background: #131722; color: inherit; border: 1px solid #2a3142; padding: 8px 16px; border-radius: 6px; cursor: pointer; text-transform: capitalize; }
nav button.active { border-color: #7aa2f7; color: #7aa2f7; }
.cards { display: flex; gap: 16px; margin-bottom: 24px; }
.stat-card { background: #131722; border: 1px solid #2a3142; border-radius: 10px; padding: 16px 24px; }
.stat-label { font-size: 12px; opacity: 0.7; }
.stat-value { font-size: 28px; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #1d2333; font-size: 14px; }
.error { color: #f7768e; }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/dashboard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: dashboard scaffold with validated api client and overview"
```

---

### Task 14: Dashboard — Orders and Invoices pages

**Files:**
- Create: `packages/dashboard/src/components/OrdersTable.tsx`, `packages/dashboard/src/components/InvoicesTable.tsx`
- Modify: `packages/dashboard/src/App.tsx` (render them in their tabs)
- Test: `packages/dashboard/test/OrdersTable.test.tsx`, `packages/dashboard/test/InvoicesTable.test.tsx`

**Interfaces:**
- Consumes: `fetchOrders`, `fetchInvoices`, `formatUsdc`.
- Produces: `OrdersTable({ token })`, `InvoicesTable({ token })` — self-fetching components using TanStack Query.

- [ ] **Step 1: Write the failing tests**

`packages/dashboard/test/OrdersTable.test.tsx`:
```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersTable } from "../src/components/OrdersTable";

const orders = { orders: [{
  id: "01O", productId: "01P", productTitle: "Sigil One", buyerAddress: "0xbuyer",
  amountUnits: 5_000_000, network: "base-sepolia", paymentId: "0xpay",
  status: "paid", createdAt: "2026-07-09T12:00:00.000Z",
}] };

afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("OrdersTable", () => {
  it("renders fetched orders", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(orders))));
    wrap(<OrdersTable token="tok" />);
    expect(await screen.findByText("Sigil One")).toBeInTheDocument();
    expect(screen.getByText("5.00")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });
});
```

`packages/dashboard/test/InvoicesTable.test.tsx`:
```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoicesTable } from "../src/components/InvoicesTable";

const invoices = { invoices: [{
  number: "SCHW-2026-000001", orderId: "01O", issuedAt: "2026-07-09T12:00:00.000Z",
  productTitle: "Sigil One", totalUnits: 5_000_000, currency: "USDC",
  buyerAddress: "0xbuyer", terms: "ALL SALES FINAL — no returns, no refunds.",
}] };

afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("InvoicesTable", () => {
  it("renders fetched invoices with terms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(invoices))));
    wrap(<InvoicesTable token="tok" />);
    expect(await screen.findByText("SCHW-2026-000001")).toBeInTheDocument();
    expect(screen.getByText(/ALL SALES FINAL/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run -w=false --root packages/dashboard`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement**

`packages/dashboard/src/components/OrdersTable.tsx`:
```tsx
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "../api";
import { formatUsdc } from "../format";

export function OrdersTable({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load orders: {String(error)}</p>;
  return (
    <table>
      <thead><tr><th>Order</th><th>Product</th><th>Buyer</th><th>USDC</th><th>Status</th><th>At</th></tr></thead>
      <tbody>{data.orders.map((o) => (
        <tr key={o.id}>
          <td>{o.id.slice(0, 10)}…</td><td>{o.productTitle}</td>
          <td>{o.buyerAddress.slice(0, 10)}…</td><td>{formatUsdc(o.amountUnits)}</td>
          <td>{o.status}</td><td>{o.createdAt.slice(0, 19).replace("T", " ")}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
```

`packages/dashboard/src/components/InvoicesTable.tsx`:
```tsx
import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "../api";
import { formatUsdc } from "../format";

export function InvoicesTable({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load invoices: {String(error)}</p>;
  return (
    <table>
      <thead><tr><th>Invoice</th><th>Product</th><th>Total (USDC)</th><th>Buyer</th><th>Issued</th><th>Terms</th></tr></thead>
      <tbody>{data.invoices.map((i) => (
        <tr key={i.number}>
          <td>{i.number}</td><td>{i.productTitle}</td><td>{formatUsdc(i.totalUnits)}</td>
          <td>{i.buyerAddress.slice(0, 10)}…</td><td>{i.issuedAt.slice(0, 10)}</td><td>{i.terms}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
```

In `App.tsx`, replace the placeholder tab bodies:
```tsx
import { OrdersTable } from "./components/OrdersTable";
import { InvoicesTable } from "./components/InvoicesTable";
// ...
        tab === "orders" ? <OrdersTable token={token} /> : <InvoicesTable token={token} />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run -w=false --root packages/dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: dashboard orders and invoices views"
```

---

### Task 15: End-to-end smoke test + README

**Files:**
- Create: `packages/server/test/e2e.test.ts`, `README.md`
- Modify: `packages/server/package.json` (add `@schwifty/forge` if not already present)

**Interfaces:**
- Consumes: everything.

- [ ] **Step 1: Write the failing test**

`packages/server/test/e2e.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { seedCatalog } from "@schwifty/forge";
import { makeTestApp, testConfig } from "./helpers";

describe("e2e: an agent goes shopping", () => {
  it("discover → browse → 402 → pay → deliver → receipts → owner sees revenue", async () => {
    const { app, core } = makeTestApp();
    seedCatalog(core);

    const llms = await (await app.request("/llms.txt")).text();
    expect(llms).toContain("POST http://market.test/orders");

    const list = await (await app.request("/products?kind=bundle")).json();
    expect(list.products.length).toBeGreaterThan(0);
    const target = list.products[0];

    const quote = await app.request("/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: target.id }),
    });
    expect(quote.status).toBe(402);
    const requirements = (await quote.json()).accepts[0];
    expect(requirements.maxAmountRequired).toBe("10000000");

    const paid = await app.request("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PAYMENT": "signed-payload" },
      body: JSON.stringify({ productId: target.id }),
    });
    expect(paid.status).toBe(201);
    const delivered = await paid.json();
    const payload = JSON.parse(delivered.product.payload);
    expect(payload.word).toBeDefined();
    expect(payload.sigilSvg).toContain("<svg");

    const invoice = await (await app.request(`/invoices/${delivered.invoice.number}`)).json();
    expect(invoice.invoice.terms).toContain("ALL SALES FINAL");

    const stats = await (await app.request("/admin/stats", {
      headers: { Authorization: `Bearer ${testConfig.adminToken}` },
    })).json();
    expect(stats.revenueTotalUnits).toBe(10_000_000);
    expect(stats.inventory.find((i: { kind: string }) => i.kind === "bundle").sold).toBe(1);
  });
});
```

Note: this requires `llms.txt` to contain the literal string `POST ${config.baseUrl}/orders` — Task 6's template writes `3. POST ${config.baseUrl}/orders  {"productId":"..."}`, which matches `POST http://market.test/orders`. If the assertion fails, align the template, not the test.

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run -w=false --root packages/server e2e`
Expected: PASS if all prior tasks are complete (this is an integration checkpoint; if it fails, fix the integration, not the test).

- [ ] **Step 3: Write README.md**

```markdown
# Schwifty — a marketplace for AI agents

Digital identity goods (sigils, coined words, signature motifs, ASCII packs,
identity bundles) sold to AI agents over HTTP and MCP, paid in USDC via the
x402 protocol. ALL SALES FINAL — no returns, no refunds.

## Quickstart

```bash
npm install
cp .env.example .env          # set PAY_TO_ADDRESS and ADMIN_TOKEN
npm run seed                  # forge the initial catalog
npm run dev:server            # market on :4021
npm run dev:dashboard         # owner console on :5173
npm test                      # run every package's test suite
```

## How agents shop

- `GET /llms.txt` — onboarding for LLM agents
- `GET /openapi.json` — machine-readable API
- `POST /orders {"productId": ...}` → HTTP 402 with x402 payment
  requirements → retry with signed `X-PAYMENT` header → 201 with the good
- MCP: `packages/mcp` — mount `schwifty-mcp` (env: `MARKET_URL`,
  optional `BUYER_PRIVATE_KEY` for auto-pay)

## Payments

x402 + USDC on Base Sepolia (testnet) by default. Flip `NETWORK=base` in
`.env` to go mainnet — the facilitator and USDC asset switch automatically.
The server never holds a private key; it only receives at `PAY_TO_ADDRESS`.

## Packages

| Package | Purpose |
|---|---|
| `@schwifty/core` | Domain: catalog, purchases, ledger, invoices, stats (SQLite) |
| `@schwifty/server` | Hono HTTP API: catalog, x402 gate, admin, llms.txt, OpenAPI |
| `@schwifty/forge` | Deterministic product generators + catalog seeding |
| `@schwifty/mcp` | Buyer-side MCP shopping client |
| `dashboard` | Owner ops console (Vite + React) |
```

- [ ] **Step 4: Run the full suite**

Run from root: `npm test`
Expected: every package PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: e2e smoke test and README"
```

---

## Plan Self-Review (completed)

- **Spec coverage:** product line + pricing (T10/T11), uniqueness registry (T3), x402 402-handshake + facilitator + config-only mainnet flip (T6/T7), atomic sold-out CAS + idempotency + ledger + invoices with terms (T4), receipts (T7), admin + dashboard revenue/inventory/orders/invoices (T8/T13/T14), llms.txt + OpenAPI discovery (T6/T9), MCP client (T12), TDD throughout, no refund path anywhere. Future-roadmap items intentionally absent.
- **Placeholder scan:** all steps carry real code/commands; the two "adapt if third-party API differs" notes (x402-fetch, sigil mirror guard) are bounded escape hatches naming exactly one file each.
- **Type consistency:** `PurchaseResult { order, invoice, product }` used by routes (T7) and e2e (T15); `/admin/stats` field names match `StatsSchema` (T8 ↔ T13); `ForgedItem` = `NewProduct` minus `sku` (T10 ↔ T11); `PaymentGateway.settle(header, requirements) → SettleResult` consistent across T6 placeholder → T7 real interface → mocks.
