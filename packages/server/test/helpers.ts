import { createCore, type Core } from "@schwifty/core";
import { buildApp, type PaymentGateway } from "../src/app";
import type { Config } from "../src/config";

export const testConfig: Config = {
  network: "base-sepolia", payTo: "0x" + "ab".repeat(20),
  facilitatorUrl: "http://facilitator.test", databasePath: ":memory:",
  adminToken: "test-admin-token-1234", port: 0,
  baseUrl: "http://market.test",
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

export class MockGateway implements PaymentGateway {
  calls: Array<{ header: string; requirements: unknown }> = [];
  failWith: string | null = null;
  async settle(header: string, requirements: unknown) {
    this.calls.push({ header, requirements });
    if (this.failWith) return { success: false as const, reason: this.failWith };
    return { success: true as const, paymentId: `0xpay${this.calls.length}`, payer: "0x" + "cd".repeat(20) };
  }
}

export function seedProduct(core: Core, over: Record<string, unknown> = {}) {
  return core.catalog.create({
    sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", description: "A one-of-one sigil",
    priceUnits: 5_000_000, edition: "unique", preview: "8x8 sigil",
    payload: JSON.stringify({ svg: "<svg/>" }), contentHash: "h1",
    ...over,
  } as never);
}

export function makeTestApp() {
  const core = createCore();
  const gateway = new MockGateway();
  const app = buildApp({ core, gateway, config: testConfig });
  return { app, core, gateway, config: testConfig };
}
