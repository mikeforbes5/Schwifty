import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "./api";
import { formatUsdc } from "./format";
import { StatCard } from "./components/StatCard";

const TOKEN_KEY = "schwifty_admin_token";

function Overview({ token }: { token: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats(token), refetchInterval: 10_000 });
  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load stats: {String(error)}</p>;
  return (
    <>
      <div className="cards">
        <StatCard label="Total revenue" value={`${formatUsdc(data.revenueTotalUnits)} USDC`} />
        <StatCard label="Paid orders" value={String(data.orderCount)} />
      </div>
      <h2>Revenue by kind</h2>
      <table>
        <thead><tr><th>Kind</th><th>Revenue (USDC)</th><th>Orders</th></tr></thead>
        <tbody>{data.byKind.map((k) => (
          <tr key={k.kind}><td>{k.kind}</td><td>{formatUsdc(k.units)}</td><td>{k.count}</td></tr>
        ))}</tbody>
      </table>
      <h2>Inventory</h2>
      <table>
        <thead><tr><th>Kind</th><th>Listed</th><th>Sold</th></tr></thead>
        <tbody>{data.inventory.map((k) => (
          <tr key={k.kind}><td>{k.kind}</td><td>{k.listed}</td><td>{k.sold}</td></tr>
        ))}</tbody>
      </table>
      <h2>Last 30 days</h2>
      <table>
        <thead><tr><th>Date</th><th>Revenue (USDC)</th></tr></thead>
        <tbody>{data.timeSeries.map((d) => (
          <tr key={d.date}><td>{d.date}</td><td>{formatUsdc(d.units)}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [tab, setTab] = useState<"overview" | "orders" | "invoices">("overview");
  const saveToken = (t: string) => { setToken(t); localStorage.setItem(TOKEN_KEY, t); };
  return (
    <div className="shell">
      <header>
        <h1>Schwifty Ops</h1>
        <input type="password" placeholder="admin token" value={token} onChange={(e) => saveToken(e.target.value)} />
      </header>
      <nav>
        {(["overview", "orders", "invoices"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {!token ? <p>Enter the admin token to connect.</p> :
        tab === "overview" ? <Overview token={token} /> :
        tab === "orders" ? <p>Orders — coming in Task 14</p> : <p>Invoices — coming in Task 14</p>}
    </div>
  );
}
