import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceUnits: integer("price_units").notNull(),
  edition: text("edition").notNull(),
  status: text("status").notNull(),
  preview: text("preview").notNull(),
  payload: text("payload").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  createdAt: text("created_at").notNull(),
  soldAt: text("sold_at"),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  buyerAddress: text("buyer_address").notNull(),
  amountUnits: integer("amount_units").notNull(),
  network: text("network").notNull(),
  paymentId: text("payment_id").notNull().unique(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  number: text("number").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  productTitle: text("product_title").notNull(),
  totalUnits: integer("total_units").notNull(),
  currency: text("currency").notNull(),
  buyerAddress: text("buyer_address").notNull(),
  terms: text("terms").notNull(),
});

export const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  amountUnits: integer("amount_units").notNull(),
  balanceAfterUnits: integer("balance_after_units").notNull(),
  createdAt: text("created_at").notNull(),
});
