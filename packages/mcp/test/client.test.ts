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
