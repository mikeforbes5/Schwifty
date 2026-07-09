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
