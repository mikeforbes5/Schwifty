import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoicesTable } from "../src/components/InvoicesTable";

const invoices = { invoices: [{
  number: "SCHW-2026-000001", orderId: "01O", issuedAt: "2026-07-09T12:00:00.000Z",
  productTitle: "Sigil One", totalUnits: 5_000_000, currency: "USDC",
  buyerAddress: "0xbuyer", terms: "ALL SALES FINAL — no returns, no refunds.",
}] };

afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("InvoicesTable", () => {
  it("renders fetched invoices with terms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(invoices))));
    wrap(<InvoicesTable token="tok" />);
    expect(await screen.findByText("SCHW-2026-000001")).toBeInTheDocument();
    expect(screen.getByText(/ALL SALES FINAL/)).toBeInTheDocument();
  });
});
