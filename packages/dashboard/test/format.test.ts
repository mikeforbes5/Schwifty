import { describe, expect, it } from "vitest";
import { formatUsdc } from "../src/format";

describe("formatUsdc", () => {
  it("formats base units", () => {
    expect(formatUsdc(5_000_000)).toBe("5.00");
    expect(formatUsdc(0)).toBe("0.00");
  });
});
