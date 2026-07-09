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
