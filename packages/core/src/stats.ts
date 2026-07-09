import { sql } from "drizzle-orm";
import type { Db } from "./db";

export class StatsService {
  constructor(private db: Db) {}

  revenueTotalUnits(): number {
    const r = this.db.get<{ total: number | null }>(
      sql`SELECT sum(amount_units) AS total FROM ledger WHERE type = 'sale'`);
    return r?.total ?? 0;
  }
  orderCount(): number {
    const r = this.db.get<{ n: number }>(
      sql`SELECT count(*) AS n FROM orders WHERE status = 'paid'`);
    return r?.n ?? 0;
  }
  revenueByKind(): Array<{ kind: string; units: number; count: number }> {
    return this.db.all(sql`
      SELECT p.kind AS kind, sum(o.amount_units) AS units, count(*) AS count
      FROM orders o JOIN products p ON p.id = o.product_id
      WHERE o.status = 'paid' GROUP BY p.kind`);
  }
  timeSeries(days = 30): Array<{ date: string; units: number }> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    return this.db.all(sql`
      SELECT substr(created_at, 1, 10) AS date, sum(amount_units) AS units
      FROM ledger WHERE type = 'sale' AND created_at >= ${since}
      GROUP BY date ORDER BY date`);
  }
  inventory(): Array<{ kind: string; listed: number; sold: number }> {
    return this.db.all(sql`
      SELECT kind,
        sum(CASE WHEN status = 'listed' THEN 1 ELSE 0 END) AS listed,
        sum(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold
      FROM products GROUP BY kind`);
  }
}
