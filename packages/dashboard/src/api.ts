import { z } from "zod";

export const StatsSchema = z.object({
  revenueTotalUnits: z.number(),
  orderCount: z.number(),
  byKind: z.array(z.object({ kind: z.string(), units: z.number(), count: z.number() })),
  timeSeries: z.array(z.object({ date: z.string(), units: z.number() })),
  inventory: z.array(z.object({ kind: z.string(), listed: z.number(), sold: z.number() })),
});
export type Stats = z.infer<typeof StatsSchema>;

export const OrdersSchema = z.object({
  orders: z.array(z.object({
    id: z.string(), productId: z.string(), productTitle: z.string(),
    buyerAddress: z.string(), amountUnits: z.number(), network: z.string(),
    paymentId: z.string(), status: z.string(), createdAt: z.string(),
  })),
});
export type Orders = z.infer<typeof OrdersSchema>;

export const InvoicesSchema = z.object({
  invoices: z.array(z.object({
    number: z.string(), orderId: z.string(), issuedAt: z.string(),
    productTitle: z.string(), totalUnits: z.number(), currency: z.string(),
    buyerAddress: z.string(), terms: z.string(),
  })),
});
export type Invoices = z.infer<typeof InvoicesSchema>;

async function getValidated<T>(path: string, token: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return schema.parse(await res.json());
}

export const fetchStats = (token: string) => getValidated("/admin/stats", token, StatsSchema);
export const fetchOrders = (token: string) => getValidated("/admin/orders", token, OrdersSchema);
export const fetchInvoices = (token: string) => getValidated("/admin/invoices", token, InvoicesSchema);
