import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { NotFoundError, ProductKind, SoldOutError, type Core } from "@schwifty/core";
import type { Config } from "./config";
import { toPublicProduct } from "./serialize";
import { llmsTxt } from "./llms";
import { buildRequirements, type PaymentGateway } from "./payment";

export type { PaymentGateway } from "./payment";

export interface AppDeps { core: Core; gateway: PaymentGateway; config: Config }

export function errBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

const validationHook = (result: { success: boolean; error?: z.ZodError }, c: Context) => {
  if (!result.success)
    return c.json(errBody("VALIDATION_ERROR", "Invalid request", result.error?.flatten()), 400);
};

export function buildApp({ core, gateway, config }: AppDeps): Hono {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "Schwifty", tagline: "a marketplace for AI agents",
      llms: `${config.baseUrl}/llms.txt`, openapi: `${config.baseUrl}/openapi.json`,
      products: `${config.baseUrl}/products`,
    }));

  app.get("/llms.txt", (c) => c.text(llmsTxt(config)));

  const listQuery = z.object({
    kind: ProductKind.optional(),
    status: z.enum(["listed", "sold"]).default("listed"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  });
  app.get("/products", zValidator("query", listQuery, validationHook), (c) => {
    const q = c.req.valid("query");
    return c.json({ products: core.catalog.list(q).map(toPublicProduct) });
  });

  app.get("/products/:id", (c) => {
    const p = core.catalog.get(c.req.param("id"));
    if (!p || p.status === "delisted")
      return c.json(errBody("NOT_FOUND", "Product not found"), 404);
    return c.json({ product: toPublicProduct(p) });
  });

  const orderBody = z.object({ productId: z.string().min(1) });
  app.post("/orders", zValidator("json", orderBody, validationHook), async (c) => {
    const { productId } = c.req.valid("json");
    const product = core.catalog.get(productId);
    if (!product) return c.json(errBody("NOT_FOUND", "Product not found"), 404);
    if (product.status !== "listed")
      return c.json(errBody("SOLD_OUT", "Product is no longer available"), 409);

    const requirements = buildRequirements(product, config);
    const header = c.req.header("X-PAYMENT");
    if (!header)
      return c.json({ x402Version: 1, error: "X-PAYMENT header is required", accepts: [requirements] }, 402);

    const settled = await gateway.settle(header, requirements);
    if (!settled.success)
      return c.json(errBody("PAYMENT_FAILED", `Payment failed: ${settled.reason}`), 402);

    try {
      const result = core.purchases.recordPaidPurchase({
        productId, buyerAddress: settled.payer, paymentId: settled.paymentId, network: config.network,
      });
      return c.json(result, 201);
    } catch (e) {
      if (e instanceof SoldOutError) return c.json(errBody("SOLD_OUT", e.message), 409);
      if (e instanceof NotFoundError) return c.json(errBody("NOT_FOUND", e.message), 404);
      throw e;
    }
  });

  app.get("/orders/:id", (c) => {
    const order = core.purchases.getOrder(c.req.param("id"));
    if (!order) return c.json(errBody("NOT_FOUND", "Order not found"), 404);
    return c.json({ order });
  });

  app.get("/invoices/:number", (c) => {
    const invoice = core.purchases.getInvoice(c.req.param("number"));
    if (!invoice) return c.json(errBody("NOT_FOUND", "Invoice not found"), 404);
    return c.json({ invoice });
  });

  app.notFound((c) => c.json(errBody("NOT_FOUND", "No such route"), 404));
  app.onError((err, c) => c.json(errBody("INTERNAL", err.message), 500));

  return app;
}
