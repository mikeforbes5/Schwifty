import { desc, eq, like, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "./db";
import { invoices, ledger, orders, products } from "./schema";
import { NotFoundError, SoldOutError } from "./errors";
import { INVOICE_TERMS, type Invoice, type Order, type Product } from "./types";

export interface PurchaseInput {
  productId: string; buyerAddress: string; paymentId: string; network: string;
}
export interface PurchaseResult { order: Order; invoice: Invoice; product: Product }

export class PurchaseService {
  constructor(private db: Db) {}

  recordPaidPurchase(input: PurchaseInput): PurchaseResult {
    return this.db.transaction((tx) => {
      const prior = tx.select().from(orders).where(eq(orders.paymentId, input.paymentId)).get() as Order | undefined;
      if (prior) {
        const invoice = tx.select().from(invoices).where(eq(invoices.orderId, prior.id)).get() as Invoice;
        const product = tx.select().from(products).where(eq(products.id, prior.productId)).get() as Product;
        return { order: prior, invoice, product };
      }

      const product = tx.select().from(products).where(eq(products.id, input.productId)).get() as Product | undefined;
      if (!product) throw new NotFoundError(`Product ${input.productId}`);
      if (product.status !== "listed") throw new SoldOutError(product.id);

      const now = new Date().toISOString();
      if (product.edition === "unique") {
        const res = tx.update(products)
          .set({ status: "sold", soldAt: now })
          .where(sql`${products.id} = ${product.id} AND ${products.status} = 'listed'`).run();
        if (res.changes === 0) throw new SoldOutError(product.id);
        product.status = "sold"; product.soldAt = now;
      }

      const order: Order = {
        id: ulid(), productId: product.id, buyerAddress: input.buyerAddress,
        amountUnits: product.priceUnits, network: input.network,
        paymentId: input.paymentId, status: "paid", createdAt: now,
      };
      tx.insert(orders).values(order).run();

      const last = tx.select().from(ledger).orderBy(desc(ledger.id)).limit(1).get();
      const entry = {
        id: ulid(), orderId: order.id, type: "sale" as const,
        amountUnits: order.amountUnits,
        balanceAfterUnits: (last?.balanceAfterUnits ?? 0) + order.amountUnits,
        createdAt: now,
      };
      tx.insert(ledger).values(entry).run();

      const year = now.slice(0, 4);
      const count = tx.select({ n: sql<number>`count(*)` }).from(invoices)
        .where(like(invoices.number, `SCHW-${year}-%`)).get()?.n ?? 0;
      const invoice: Invoice = {
        number: `SCHW-${year}-${String(count + 1).padStart(6, "0")}`,
        orderId: order.id, issuedAt: now, productTitle: product.title,
        totalUnits: order.amountUnits, currency: "USDC",
        buyerAddress: input.buyerAddress, terms: INVOICE_TERMS,
      };
      tx.insert(invoices).values(invoice).run();

      return { order, invoice, product };
    });
  }

  getOrder(id: string): Order | undefined {
    return this.db.select().from(orders).where(eq(orders.id, id)).get() as Order | undefined;
  }
  getInvoice(number: string): Invoice | undefined {
    return this.db.select().from(invoices).where(eq(invoices.number, number)).get() as Invoice | undefined;
  }
  listOrders(limit = 100): Array<Order & { productTitle: string }> {
    return this.db.select({
      id: orders.id, productId: orders.productId, buyerAddress: orders.buyerAddress,
      amountUnits: orders.amountUnits, network: orders.network, paymentId: orders.paymentId,
      status: orders.status, createdAt: orders.createdAt, productTitle: products.title,
    }).from(orders).innerJoin(products, eq(products.id, orders.productId))
      .orderBy(desc(orders.id)).limit(limit).all() as Array<Order & { productTitle: string }>;
  }
  listInvoices(limit = 100): Invoice[] {
    return this.db.select().from(invoices).orderBy(desc(invoices.number)).limit(limit).all() as Invoice[];
  }
}
