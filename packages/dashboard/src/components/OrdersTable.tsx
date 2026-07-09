import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "../api";
import { formatUsdc } from "../format";

export function OrdersTable({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load orders: {String(error)}</p>;
  return (
    <table>
      <thead><tr><th>Order</th><th>Product</th><th>Buyer</th><th>USDC</th><th>Status</th><th>At</th></tr></thead>
      <tbody>{data.orders.map((o) => (
        <tr key={o.id}>
          <td>{o.id.slice(0, 10)}…</td><td>{o.productTitle}</td>
          <td>{o.buyerAddress.slice(0, 10)}…</td><td>{formatUsdc(o.amountUnits)}</td>
          <td>{o.status}</td><td>{o.createdAt.slice(0, 19).replace("T", " ")}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
