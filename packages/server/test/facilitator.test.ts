import { afterEach, describe, expect, it, vi } from "vitest";
import { FacilitatorGateway, buildRequirements } from "../src/payment";
import { testConfig } from "./helpers";

const requirements = buildRequirements(
  { id: "01X", title: "Sigil", description: "d", priceUnits: 5_000_000 } as never,
  testConfig,
);
const header = Buffer.from(JSON.stringify({ x402Version: 1, scheme: "exact" })).toString("base64");

afterEach(() => vi.unstubAllGlobals());

describe("FacilitatorGateway", () => {
  it("verifies then settles via the facilitator", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ isValid: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, transaction: "0xtx", payer: "0xbuyer" })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new FacilitatorGateway("http://facilitator.test").settle(header, requirements);
    expect(result).toEqual({ success: true, paymentId: "0xtx", payer: "0xbuyer" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://facilitator.test/verify");
    expect(fetchMock.mock.calls[1][0]).toBe("http://facilitator.test/settle");
  });
  it("fails on invalid verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: "expired" }))));
    const result = await new FacilitatorGateway("http://facilitator.test").settle(header, requirements);
    expect(result).toEqual({ success: false, reason: "expired" });
  });
  it("fails on malformed header without calling facilitator", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new FacilitatorGateway("http://facilitator.test").settle("!!!not-base64-json!!!", requirements);
    expect(result).toEqual({ success: false, reason: "MALFORMED_PAYMENT_HEADER" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
