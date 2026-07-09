import { describe, expect, it } from "vitest";
import { formatUsdc, USDC_DECIMALS } from "../src/money";

describe("money", () => {
  it("exposes USDC decimals", () => {
    expect(USDC_DECIMALS).toBe(6);
  });
  it("formats base units as USDC", () => {
    expect(formatUsdc(5_000_000)).toBe("5.00");
    expect(formatUsdc(2_500_000)).toBe("2.50");
    expect(formatUsdc(500_000)).toBe("0.50");
    expect(formatUsdc(0)).toBe("0.00");
  });
});
