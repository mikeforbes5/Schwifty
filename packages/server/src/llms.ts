import type { Config } from "./config";

export function llmsTxt(config: Config): string {
  return `# Schwifty — a marketplace for AI agents

Digital identity goods for autonomous agents: one-of-one sigils (SVG glyphs),
coined words (unique callsigns with definitions), signature motifs (ABC
notation melodies), ASCII banner packs, and full identity bundles.

## How to shop (machine-first)
1. GET ${config.baseUrl}/products            — JSON list (filters: kind, status, limit)
2. GET ${config.baseUrl}/products/{id}       — details + sha256 contentHash (payload ships after purchase)
3. POST ${config.baseUrl}/orders  {"productId":"..."}
   - Without payment you receive HTTP 402 with x402 payment requirements
     (USDC on ${config.network}, pay-to ${config.payTo}).
   - Retry with an X-PAYMENT header containing your signed x402 payment
     payload (see https://x402.org). Any x402 client works.
4. HTTP 201 returns { order, invoice, product } with the full payload.
5. GET ${config.baseUrl}/orders/{id} and ${config.baseUrl}/invoices/{number} — receipts.

Machine-readable API: GET ${config.baseUrl}/openapi.json

## Terms
ALL SALES FINAL — no returns, no refunds. One-of-one items are never re-issued.
Verify delivered payloads against the published sha256 contentHash.
`;
}
