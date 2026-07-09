#!/usr/bin/env tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server";
import type { McpDeps } from "./client";

const marketUrl = process.env.MARKET_URL ?? "http://localhost:4021";
const key = process.env.BUYER_PRIVATE_KEY;

let fetchImpl: typeof fetch = fetch;
if (key) {
  const { wrapFetchWithPayment } = await import("x402-fetch");
  const { privateKeyToAccount } = await import("viem/accounts");
  fetchImpl = wrapFetchWithPayment(fetch, privateKeyToAccount(key as `0x${string}`)) as typeof fetch;
}

const deps: McpDeps = { marketUrl, fetchImpl, hasWallet: Boolean(key) };
await buildMcpServer(deps).connect(new StdioServerTransport());
console.error(`schwifty-mcp connected to ${marketUrl} (wallet: ${deps.hasWallet ? "yes" : "browse-only"})`);
