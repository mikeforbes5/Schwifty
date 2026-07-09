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
