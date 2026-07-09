import { z } from "zod";

export const ProductKind = z.enum(["sigil", "word", "motif", "ascii_pack", "bundle"]);
export type ProductKind = z.infer<typeof ProductKind>;
export const Edition = z.enum(["unique", "open"]);
export type Edition = z.infer<typeof Edition>;
export const ProductStatus = z.enum(["listed", "sold", "delisted"]);
export type ProductStatus = z.infer<typeof ProductStatus>;
export const OrderStatus = z.enum(["paid", "failed"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const INVOICE_TERMS = "ALL SALES FINAL — no returns, no refunds.";

export interface Product {
  id: string; sku: string; kind: ProductKind; title: string; description: string;
  priceUnits: number; edition: Edition; status: ProductStatus;
  preview: string; payload: string; contentHash: string;
  createdAt: string; soldAt: string | null;
}
export interface Order {
  id: string; productId: string; buyerAddress: string; amountUnits: number;
  network: string; paymentId: string; status: OrderStatus; createdAt: string;
}
export interface Invoice {
  number: string; orderId: string; issuedAt: string; productTitle: string;
  totalUnits: number; currency: "USDC"; buyerAddress: string; terms: string;
}
export interface LedgerEntry {
  id: string; orderId: string; type: "sale"; amountUnits: number;
  balanceAfterUnits: number; createdAt: string;
}
