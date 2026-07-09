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
