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
