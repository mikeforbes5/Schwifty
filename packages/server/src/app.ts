import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ProductKind, type Core } from "@schwifty/core";
import type { Config } from "./config";
import { toPublicProduct } from "./serialize";
import { llmsTxt } from "./llms";

// Placeholder — Task 7 replaces this with the real interface in payment.ts
export interface PaymentGateway {
  settle(header: string, requirements: unknown): Promise<unknown>;
}

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

  app.notFound((c) => c.json(errBody("NOT_FOUND", "No such route"), 404));
  app.onError((err, c) => c.json(errBody("INTERNAL", err.message), 500));

  return app;
}
