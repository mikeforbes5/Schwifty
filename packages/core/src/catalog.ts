import { and, desc, eq, type SQL } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "./db";
import { products } from "./schema";
import { DuplicateContentError, NotFoundError } from "./errors";
import type { Edition, Product, ProductKind, ProductStatus } from "./types";

export interface NewProduct {
  sku: string; kind: ProductKind; title: string; description: string;
  priceUnits: number; edition: Edition; preview: string; payload: string;
  contentHash: string;
}

export class CatalogService {
  constructor(private db: Db) {}

  create(input: NewProduct): Product {
    if (this.db.select().from(products).where(eq(products.contentHash, input.contentHash)).get())
      throw new DuplicateContentError(input.contentHash);
    const row = {
      id: ulid(), ...input, status: "listed" as const,
      createdAt: new Date().toISOString(), soldAt: null,
    };
    this.db.insert(products).values(row).run();
    return row as Product;
  }

  list(filter: { kind?: ProductKind; status?: ProductStatus; limit?: number } = {}): Product[] {
    const conds: SQL[] = [];
    if (filter.kind) conds.push(eq(products.kind, filter.kind));
    if (filter.status) conds.push(eq(products.status, filter.status));
    return this.db.select().from(products)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(products.id)).limit(filter.limit ?? 50).all() as Product[];
  }

  get(id: string): Product | undefined {
    return this.db.select().from(products).where(eq(products.id, id)).get() as Product | undefined;
  }

  bySku(sku: string): Product | undefined {
    return this.db.select().from(products).where(eq(products.sku, sku)).get() as Product | undefined;
  }

  delist(id: string): void {
    const res = this.db.update(products).set({ status: "delisted" }).where(eq(products.id, id)).run();
    if (res.changes === 0) throw new NotFoundError(`Product ${id}`);
  }
}
