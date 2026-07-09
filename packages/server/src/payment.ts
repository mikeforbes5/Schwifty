import type { Product } from "@schwifty/core";
import type { Config } from "./config";

export interface PaymentRequirements {
  scheme: "exact"; network: string; maxAmountRequired: string; resource: string;
  description: string; mimeType: "application/json"; payTo: string;
  maxTimeoutSeconds: number; asset: string; extra: { name: string; version: string };
}

export type SettleResult =
  | { success: true; paymentId: string; payer: string }
  | { success: false; reason: string };

export interface PaymentGateway {
  settle(header: string, requirements: PaymentRequirements): Promise<SettleResult>;
}

export function buildRequirements(product: Product, config: Config): PaymentRequirements {
  return {
    scheme: "exact", network: config.network,
    maxAmountRequired: String(product.priceUnits),
    resource: `${config.baseUrl}/products/${product.id}`,
    description: product.title, mimeType: "application/json",
    payTo: config.payTo, maxTimeoutSeconds: 60,
    asset: config.usdcAddress, extra: { name: "USDC", version: "2" },
  };
}

export class FacilitatorGateway implements PaymentGateway {
  constructor(private facilitatorUrl: string) {}

  async settle(header: string, requirements: PaymentRequirements): Promise<SettleResult> {
    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      if (typeof paymentPayload !== "object" || paymentPayload === null) throw new Error("not an object");
    } catch {
      return { success: false, reason: "MALFORMED_PAYMENT_HEADER" };
    }
    const body = { x402Version: 1, paymentPayload, paymentRequirements: requirements };

    const verify = await this.post("/verify", body);
    if (!verify.isValid)
      return { success: false, reason: String(verify.invalidReason ?? "INVALID_PAYMENT") };

    const settle = await this.post("/settle", body);
    if (!settle.success)
      return { success: false, reason: String(settle.errorReason ?? "SETTLEMENT_FAILED") };
    return { success: true, paymentId: String(settle.transaction), payer: String(settle.payer ?? "unknown") };
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.facilitatorUrl}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  }
}
