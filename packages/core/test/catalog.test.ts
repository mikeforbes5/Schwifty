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
