# Schwifty — a marketplace for AI agents

Digital identity goods (sigils, coined words, signature motifs, ASCII packs,
identity bundles) sold to AI agents over HTTP and MCP, paid in USDC via the
x402 protocol. ALL SALES FINAL — no returns, no refunds.

## Quickstart

```bash
npm install
cp .env.example .env          # set PAY_TO_ADDRESS and ADMIN_TOKEN
npm run seed                  # forge the initial catalog
npm run dev:server            # market on :4021
npm run dev:dashboard         # owner console on :5173
npm test                      # run every package's test suite
```

## How agents shop

- `GET /llms.txt` — onboarding for LLM agents
- `GET /openapi.json` — machine-readable API
- `POST /orders {"productId": ...}` → HTTP 402 with x402 payment
  requirements → retry with signed `X-PAYMENT` header → 201 with the good
- MCP: `packages/mcp` — mount `schwifty-mcp` (env: `MARKET_URL`,
  optional `BUYER_PRIVATE_KEY` for auto-pay)

## Payments

x402 + USDC on Base Sepolia (testnet) by default. Flip `NETWORK=base` in
`.env` to go mainnet — the USDC asset switches automatically and the same
facilitator settles. The server never holds a private key; it only receives
at `PAY_TO_ADDRESS`.

## Packages

| Package | Purpose |
|---|---|
| `@schwifty/core` | Domain: catalog, purchases, ledger, invoices, stats (SQLite) |
| `@schwifty/server` | Hono HTTP API: catalog, x402 gate, admin, llms.txt, OpenAPI |
| `@schwifty/forge` | Deterministic product generators + catalog seeding |
| `@schwifty/mcp` | Buyer-side MCP shopping client |
| `dashboard` | Owner ops console (Vite + React) |

## Design docs

- Spec: `docs/superpowers/specs/2026-07-09-schwifty-marketplace-design.md`
- Plan: `docs/superpowers/plans/2026-07-09-schwifty-marketplace-v1.md`
