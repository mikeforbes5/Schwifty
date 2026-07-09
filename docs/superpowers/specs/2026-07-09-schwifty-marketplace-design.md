# Schwifty — A Marketplace for AI Agents (v1 Design)

**Date:** 2026-07-09
**Status:** Approved by owner (design review 2026-07-09)

## Overview

Schwifty is a digital-goods marketplace whose customers are AI agents. The house
(us) generates and sells original digital products with zero marginal cost and
enforced scarcity. Agents discover the store over HTTP or mount it as an MCP
tool server, and pay with USDC via the x402 payment protocol (HTTP 402). A
human-facing dashboard lets the owner monitor revenue, inventory, orders, and
invoices. All sales are final — there is no refund path anywhere in the system.

## Goals

- Sell house-generated digital goods to AI agents with the lowest possible
  friction for a machine buyer.
- Real payment rail (x402 + USDC) running against the Base Sepolia testnet,
  switchable to Base mainnet by configuration only.
- TypeScript everywhere, test-driven development, Zod validation on every
  input boundary (server and dashboard).
- Owner dashboard for revenue / inventory / orders / invoices.

## Non-Goals (v1)

- Third-party sellers (v1 is a house store; marketplace take-rate model is a
  future phase).
- SSH/terminal storefront (future phase; agents shop via HTTP/MCP first).
- Fiat payments, refunds, returns, or chargebacks (explicitly excluded).
- Hosting/deployment (local-first, but nothing may assume localhost).
- Real-world goods (robot fashion, parts, 3D prints — future roadmap).

## Product Line ("the Forge")

ROI logic: zero marginal cost + enforced scarcity + genuine utility to agents.
Agents in multi-agent systems need distinguishable identity; identity assets
are the anchor products.

| Product | Kind | Edition | Price (USDC) | Description |
|---|---|---|---|---|
| Sigil | `sigil` | one-of-one | 5.00 | Procedurally generated SVG identity glyph, deterministic from seed; registry guarantees uniqueness |
| Coined word | `word` | one-of-one | 5.00 | Unique pronounceable neologism + definition; usable as agent name/callsign |
| Signature motif | `motif` | one-of-one | 2.50 | Short melody in ABC notation; an agent's audio identity |
| ASCII banner pack | `ascii_pack` | open edition | 0.50 | Decorative terminal art packs; unlimited, volume seller |
| Identity bundle | `bundle` | one-of-one | 10.00 | Word + sigil + motif, bundle discount |

- One-of-one products transition `listed → sold` exactly once; the registry
  never re-issues sold content (uniqueness enforced against content hash).
- Every product publishes a `contentHash` (sha256 of payload) before purchase
  so buyers can verify integrity/provenance after delivery. Full payload is
  delivered only after payment settles.
- Prices are stored in USDC base units (1 USDC = 1,000,000 units; USDC has 6
  decimals) and are owner-adjustable.

## Architecture

Modular TypeScript monorepo (npm workspaces):

```
Schwifty/
├── packages/
│   ├── core/        # Domain: catalog, orders, ledger, invoices. Pure TS + Zod.
│   │                # No HTTP, no payment-protocol knowledge. Drizzle + SQLite.
│   ├── server/      # Hono HTTP API. Zod-validated routes, OpenAPI, llms.txt,
│   │                # x402 payment gate, admin routes for the dashboard.
│   ├── mcp/         # Buyer-side MCP shopping client. Agents mount this as a
│   │                # tool server; it calls the HTTP API. Holds the BUYER's
│   │                # wallet (x402-fetch) — browse-only mode without a wallet.
│   ├── forge/       # Product generators: sigil SVGs, coined words, ABC
│   │                # motifs, ASCII packs. Deterministic from seeds.
│   └── dashboard/   # Vite + React + TanStack Query owner console.
```

### Key boundaries

- `core` exposes typed services (CatalogService, OrderService, LedgerService,
  InvoiceService) and owns all state transitions. Everything else adapts.
- Payments sit behind a `PaymentGateway` interface in `server`; the x402
  facilitator client is one implementation, the test mock is another.
- Network (`base-sepolia` vs `base`), receiving wallet address, facilitator
  URL, database path, and admin token are all environment configuration.
- The server never holds a private key: x402 receiving requires only a wallet
  address; the facilitator verifies/settles. Only the buyer-side MCP client
  manages a (buyer's) key.

### Persistence

Drizzle ORM on SQLite (file DB locally, `:memory:` in tests). Schema and
queries are written to be Postgres-compatible so a later move is a driver
swap plus migration run, not a rewrite.

## Domain Model

- **Product**: `id` (ulid), `sku`, `kind`, `title`, `description`,
  `priceUnits` (int, USDC base units), `edition` (`unique` | `open`),
  `status` (`listed` | `sold` | `delisted`), `preview` (public teaser),
  `payload` (delivered post-purchase), `contentHash`, `createdAt`, `soldAt?`.
- **Order**: `id` (ulid), `productId`, `buyerAddress`, `amountUnits`,
  `network`, `paymentId` (settlement identifier/tx hash), `status`
  (`settling` | `paid` | `failed`), `createdAt`.
- **Invoice**: `number` (`SCHW-YYYY-NNNNNN`), `orderId`, `issuedAt`, line
  items, `totalUnits`, `currency: USDC`, `buyerAddress`,
  `terms: "ALL SALES FINAL — no returns, no refunds."`.
- **LedgerEntry**: append-only; `id`, `orderId`, `type: sale`, `amountUnits`,
  `balanceAfterUnits`, `createdAt`. Revenue reporting derives from the ledger.

### Purchase flow (x402)

1. Agent discovers the store: `GET /llms.txt` (how to shop, in plain text for
   LLMs) or `GET /openapi.json`, or MCP `tools/list`.
2. `GET /products` → browse; `GET /products/:id` → metadata + preview + hash.
3. `POST /orders {productId}` with no payment → `402 Payment Required` with
   x402 payment requirements (amount, asset = USDC, network, payTo address).
4. Agent retries with signed `X-PAYMENT` header. Server verifies and settles
   via the facilitator.
5. On settlement, in one transaction: one-of-one product flips
   `listed → sold` (atomic compare-and-set; a concurrent second buyer gets
   `409 SOLD_OUT`), order recorded as `paid`, ledger entry appended, invoice
   generated. Response: order + invoice + full product payload.
6. Duplicate settlement of the same payment is idempotent (keyed by
   `paymentId`) and returns the original order.

### Error handling

- Every error response is a machine-first JSON envelope:
  `{ "error": { "code": "SOLD_OUT", "message": "...", "details?": {...} } }`.
- Validation failures → `400` with field-level details (from Zod).
- Payment verification/settlement failures → `402` with reason code.
- Unknown resources → `404`; conflict (sold out / duplicate) → `409`.

## HTTP API (public)

- `GET /` — store banner + pointers to llms.txt / openapi.json
- `GET /llms.txt` — agent onboarding: what's sold, how to pay, terms
- `GET /openapi.json` — generated from Zod route schemas
- `GET /products` — list, filters: `kind`, `status`, cursor pagination
- `GET /products/:id` — public metadata (no payload)
- `POST /orders` — x402-gated purchase (flow above)
- `GET /orders/:id`, `GET /invoices/:number` — receipts (ulid/number are
  unguessable)

## Admin API + Dashboard

- Admin routes under `/admin/*`, bearer-token auth (`ADMIN_TOKEN` env):
  stats (revenue total + time series, by kind), orders feed, invoice
  list/detail, inventory (listed/sold by kind), product management
  (list/delist, restock open editions via forge).
- Dashboard (Vite + React + TanStack Query) renders those views. All API
  responses parsed with Zod on the client — validation on both boundaries.
- Dashboard is for the human owner: clean, ops-focused. The agent-facing
  storefront has no UI by design — its interface is the API/MCP contract.

## MCP Package

Buyer-side shopping client (stdio binary + mountable HTTP transport), tools:

- `browse_catalog { kind?, maxPriceUsdc? }`
- `inspect_product { productId }`
- `purchase { productId }` — uses the buyer's configured wallet via
  x402-fetch; clear error if no wallet configured
- `get_order { orderId }` / `get_invoice { number }`

## Testing Strategy (TDD, Vitest everywhere)

- **core**: unit tests written first for pricing, inventory state machine,
  ledger append/balance, invoice numbering, idempotency. In-memory SQLite.
- **server**: integration tests via Hono `app.request` — route validation,
  error envelopes, 402 handshake, atomic sold-out behavior, admin auth.
- **payments**: `PaymentGateway` mock for the full suite; an env-gated
  contract test can hit the real testnet facilitator on demand.
- **forge**: determinism (same seed → identical output), uniqueness
  (duplicate content hash rejected), validity (SVG parses; ABC well-formed).
- **dashboard**: component tests with Testing Library + jsdom.
- Red → green → refactor. No implementation before a failing test.

## Configuration

`NETWORK` (`base-sepolia` | `base`), `PAY_TO_ADDRESS`, `FACILITATOR_URL`,
`DATABASE_PATH`, `ADMIN_TOKEN`, `PORT`. Mainnet switch = config change only.

## Build Order

1. Monorepo scaffold + `core` domain (TDD)
2. HTTP API + validation + OpenAPI + llms.txt
3. x402 payment integration (testnet)
4. Forge generators + seeded catalog
5. MCP shopping client
6. Dashboard

## Future Roadmap (out of scope for v1)

- SSH terminal storefront (terminal.shop-style, for humans and style points)
- Base mainnet flip; treasury/withdrawal tooling
- Third-party agent sellers with marketplace take rate
- Real-world data products; robot fashion/parts; 3D-printed goods
- Agent identity verification / reputation
