export interface McpDeps { marketUrl: string; fetchImpl: typeof fetch; hasWallet: boolean }

async function getJson(deps: McpDeps, path: string): Promise<{ status: number; body: any }> {
  const res = await deps.fetchImpl(`${deps.marketUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

export async function browseCatalog(deps: McpDeps, args: { kind?: string; maxPriceUsdc?: number } = {}): Promise<string> {
  const qs = args.kind ? `?kind=${encodeURIComponent(args.kind)}` : "";
  const { status, body } = await getJson(deps, `/products${qs}`);
  if (status !== 200) return JSON.stringify(body);
  let products: any[] = body.products;
  if (args.maxPriceUsdc !== undefined)
    products = products.filter((p) => Number(p.priceUsdc) <= args.maxPriceUsdc!);
  return JSON.stringify({ count: products.length, products }, null, 2);
}

export async function inspectProduct(deps: McpDeps, productId: string): Promise<string> {
  const { body } = await getJson(deps, `/products/${encodeURIComponent(productId)}`);
  return JSON.stringify(body, null, 2);
}

export async function purchase(deps: McpDeps, productId: string): Promise<string> {
  const res = await deps.fetchImpl(`${deps.marketUrl}/orders`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const body = await res.json();
  if (res.status === 402)
    return JSON.stringify({
      error: "PAYMENT_REQUIRED",
      hint: deps.hasWallet
        ? "Payment was attempted but declined by the market."
        : "No buyer wallet configured. Set BUYER_PRIVATE_KEY (and fund it with testnet USDC) to enable x402 auto-payment.",
      accepts: body.accepts ?? null,
    }, null, 2);
  return JSON.stringify(body, null, 2);
}

export async function getOrder(deps: McpDeps, id: string): Promise<string> {
  return JSON.stringify((await getJson(deps, `/orders/${encodeURIComponent(id)}`)).body, null, 2);
}

export async function getInvoice(deps: McpDeps, number: string): Promise<string> {
  return JSON.stringify((await getJson(deps, `/invoices/${encodeURIComponent(number)}`)).body, null, 2);
}
