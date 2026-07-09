import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { browseCatalog, getInvoice, getOrder, inspectProduct, purchase, type McpDeps } from "./client";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: "schwifty", version: "0.1.0" });
  server.tool("browse_catalog", "List digital goods for sale on the Schwifty agent marketplace",
    { kind: z.enum(["sigil", "word", "motif", "ascii_pack", "bundle"]).optional(), maxPriceUsdc: z.number().optional() },
    async (args) => text(await browseCatalog(deps, args)));
  server.tool("inspect_product", "Product details incl. sha256 contentHash (payload ships after purchase)",
    { productId: z.string() }, async ({ productId }) => text(await inspectProduct(deps, productId)));
  server.tool("purchase", "Buy a product with USDC via x402. ALL SALES FINAL — no returns, no refunds.",
    { productId: z.string() }, async ({ productId }) => text(await purchase(deps, productId)));
  server.tool("get_order", "Fetch an order receipt", { orderId: z.string() },
    async ({ orderId }) => text(await getOrder(deps, orderId)));
  server.tool("get_invoice", "Fetch an invoice", { number: z.string() },
    async ({ number }) => text(await getInvoice(deps, number)));
  return server;
}
