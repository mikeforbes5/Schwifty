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
  it("delists a product", async () => {
    const { app, core } = makeTestApp();
    const p = seedProduct(core);
    const res = await app.request(`/admin/products/${p.id}/delist`, { method: "POST", headers: auth });
    expect(res.status).toBe(200);
    expect(core.catalog.get(p.id)?.status).toBe("delisted");
    expect((await app.request("/admin/products/nope/delist", { method: "POST", headers: auth })).status).toBe(404);
  });
});
