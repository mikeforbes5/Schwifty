import { beforeEach, describe, expect, it } from "vitest";
import { createCore, type Core } from "../src/index";
import { NotFoundError, SoldOutError } from "../src/errors";
import { INVOICE_TERMS } from "../src/types";
import { ledger } from "../src/schema";

const BUYER = "0x" + "cd".repeat(20);

describe("PurchaseService", () => {
  let core: Core;
  let sigilId: string;
  let packId: string;
  beforeEach(() => {
    core = createCore();
    sigilId = core.catalog.create({
      sku: "SIGIL-0001", kind: "sigil", title: "Sigil One", description: "d",
      priceUnits: 5_000_000, edition: "unique", preview: "p", payload: "{\"svg\":\"<svg/>\"}",
      contentHash: "h1",
    }).id;
    packId = core.catalog.create({
      sku: "ASCII_PACK-0001", kind: "ascii_pack", title: "Pack", description: "d",
      priceUnits: 500_000, edition: "open", preview: "p", payload: "{}", contentHash: "h2",
    }).id;
  });

  it("records a paid purchase atomically", () => {
    const r = core.purchases.recordPaidPurchase({
      productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia",
    });
    expect(r.order.status).toBe("paid");
    expect(r.order.amountUnits).toBe(5_000_000);
    expect(r.invoice.number).toMatch(/^SCHW-\d{4}-000001$/);
    expect(r.invoice.terms).toBe(INVOICE_TERMS);
    expect(r.product.status).toBe("sold");
    expect(core.catalog.get(sigilId)?.status).toBe("sold");
  });
  it("second buyer of a unique item gets SoldOutError", () => {
    core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(() =>
      core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" }),
    ).toThrow(SoldOutError);
  });
  it("open editions can sell repeatedly", () => {
    core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" });
    expect(core.catalog.get(packId)?.status).toBe("listed");
    expect(core.purchases.listOrders()).toHaveLength(2);
  });
  it("is idempotent by paymentId", () => {
    const a = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    const b = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(b.order.id).toBe(a.order.id);
    expect(b.invoice.number).toBe(a.invoice.number);
    expect(core.purchases.listOrders()).toHaveLength(1);
  });
  it("appends to the ledger with running balance and increments invoice numbers", () => {
    core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    const r2 = core.purchases.recordPaidPurchase({ productId: packId, buyerAddress: BUYER, paymentId: "0xpay2", network: "base-sepolia" });
    expect(r2.invoice.number).toMatch(/000002$/);
    const rows = core.db.select().from(ledger).all();
    expect(rows.map((r) => r.balanceAfterUnits)).toEqual([5_000_000, 5_500_000]);
  });
  it("throws NotFoundError for unknown product", () => {
    expect(() =>
      core.purchases.recordPaidPurchase({ productId: "nope", buyerAddress: BUYER, paymentId: "0xpay9", network: "base-sepolia" }),
    ).toThrow(NotFoundError);
  });
  it("exposes receipts", () => {
    const r = core.purchases.recordPaidPurchase({ productId: sigilId, buyerAddress: BUYER, paymentId: "0xpay1", network: "base-sepolia" });
    expect(core.purchases.getOrder(r.order.id)?.paymentId).toBe("0xpay1");
    expect(core.purchases.getInvoice(r.invoice.number)?.orderId).toBe(r.order.id);
  });
});
