import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ulid } from "ulid";
import { NotFoundError, ProductKind } from "@schwifty/core";
import { forgeItem } from "@schwifty/forge";
import { errBody, type AppDeps } from "./app";
import { toPublicProduct } from "./serialize";

export function registerAdminRoutes(app: Hono, { core, config }: AppDeps): void {
  app.use("/admin/*", async (c, next) => {
    if (c.req.header("Authorization") !== `Bearer ${config.adminToken}`)
      return c.json(errBody("UNAUTHORIZED", "Invalid admin token"), 401);
    await next();
  });

  app.get("/admin/stats", (c) =>
    c.json({
      revenueTotalUnits: core.stats.revenueTotalUnits(),
      orderCount: core.stats.orderCount(),
      byKind: core.stats.revenueByKind(),
      timeSeries: core.stats.timeSeries(30),
      inventory: core.stats.inventory(),
    }));

  app.get("/admin/orders", (c) => c.json({ orders: core.purchases.listOrders() }));
  app.get("/admin/invoices", (c) => c.json({ invoices: core.purchases.listInvoices() }));

  const forgeBody = z.object({ kind: ProductKind, count: z.number().int().min(1).max(50) });
  app.post("/admin/forge", zValidator("json", forgeBody), (c) => {
    const { kind, count } = c.req.valid("json");
    const created = Array.from({ length: count }, () => {
      const seed = ulid();
      return core.catalog.create({ sku: `${kind.toUpperCase()}-${seed}`, ...forgeItem(kind, seed) });
    });
    return c.json({ created: created.map(toPublicProduct) }, 201);
  });

  app.post("/admin/products/:id/delist", (c) => {
    try {
      core.catalog.delist(c.req.param("id"));
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof NotFoundError) return c.json(errBody("NOT_FOUND", e.message), 404);
      throw e;
    }
  });
}
