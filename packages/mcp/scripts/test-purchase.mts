// Simulate a buyer agent: browse the market and buy one product, paying real
// (testnet) USDC via x402. Uses TEST_BUYER_PRIVATE_KEY from the repo .env.
// Usage: npx tsx packages/mcp/scripts/test-purchase.mts [--kind ascii_pack] [--max-usdc 6]
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

process.loadEnvFile(resolve(process.env.INIT_CWD ?? process.cwd(), ".env"));

const { values } = parseArgs({ options: {
  kind: { type: "string", default: "ascii_pack" },
  "max-usdc": { type: "string", default: "6" },
} });

const key = process.env.TEST_BUYER_PRIVATE_KEY ?? "";
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.log("TEST_BUYER_PRIVATE_KEY missing or malformed in .env");
  process.exit(1);
}
const marketUrl = process.env.MARKET_URL ?? "http://localhost:4021";
const account = privateKeyToAccount(key as `0x${string}`);
const maxUnits = BigInt(Math.round(Number(values["max-usdc"]) * 1e6));
const payingFetch = wrapFetchWithPayment(fetch, account, maxUnits);

const list = await (await fetch(`${marketUrl}/products?kind=${values.kind}&limit=1`)).json();
const product = list.products?.[0];
if (!product) {
  console.log(`No listed products of kind "${values.kind}"`);
  process.exit(1);
}
console.log(`buying: ${product.title} — ${product.priceUsdc} USDC (${product.id})`);

const res = await payingFetch(`${marketUrl}/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId: product.id }),
});
const body = await res.json();
if (res.status !== 201) {
  console.log(`purchase failed (${res.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log("PURCHASED ✓");
console.log(`  order:    ${body.order.id} (${body.order.status})`);
console.log(`  invoice:  ${body.invoice.number} — ${body.invoice.terms}`);
console.log(`  buyer:    ${body.order.buyerAddress}`);
console.log(`  tx:       https://sepolia.basescan.org/tx/${body.order.paymentId}`);
console.log(`  payload:  ${body.product.payload.slice(0, 120)}…`);
