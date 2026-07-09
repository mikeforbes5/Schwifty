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
