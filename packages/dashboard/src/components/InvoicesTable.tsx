import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "../api";
import { formatUsdc } from "../format";

export function InvoicesTable({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load invoices: {String(error)}</p>;
  return (
    <table>
      <thead><tr><th>Invoice</th><th>Product</th><th>Total (USDC)</th><th>Buyer</th><th>Issued</th><th>Terms</th></tr></thead>
      <tbody>{data.invoices.map((i) => (
        <tr key={i.number}>
          <td>{i.number}</td><td>{i.productTitle}</td><td>{formatUsdc(i.totalUnits)}</td>
          <td>{i.buyerAddress.slice(0, 10)}…</td><td>{i.issuedAt.slice(0, 10)}</td><td>{i.terms}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
