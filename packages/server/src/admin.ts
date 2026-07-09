import type { Hono } from "hono";
import { NotFoundError } from "@schwifty/core";
import { errBody, type AppDeps } from "./app";

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
