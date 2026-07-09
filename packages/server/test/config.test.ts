import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base = { PAY_TO_ADDRESS: "0x" + "ab".repeat(20), ADMIN_TOKEN: "0123456789abcdef" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig(base as never);
    expect(c.network).toBe("base-sepolia");
    expect(c.port).toBe(4021);
    expect(c.facilitatorUrl).toBe("https://x402.org/facilitator");
    expect(c.usdcAddress).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7c");
  });
  it("selects mainnet USDC for base", () => {
    expect(loadConfig({ ...base, NETWORK: "base" } as never).usdcAddress)
      .toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
  it("rejects bad pay-to address", () => {
    expect(() => loadConfig({ ...base, PAY_TO_ADDRESS: "nope" } as never)).toThrow();
  });
});
