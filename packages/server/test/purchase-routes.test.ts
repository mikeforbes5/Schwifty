import { describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { makeTestApp, seedProduct } from "./helpers";

const post = (app: Hono, body: unknown, headers: Record<string, string> = {}) =>
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
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
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
