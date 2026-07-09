import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrdersTable } from "../src/components/OrdersTable";

const orders = { orders: [{
  id: "01O", productId: "01P", productTitle: "Sigil One", buyerAddress: "0xbuyer",
  amountUnits: 5_000_000, network: "base-sepolia", paymentId: "0xpay",
  status: "paid", createdAt: "2026-07-09T12:00:00.000Z",
}] };

afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("OrdersTable", () => {
  it("renders fetched orders", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(orders))));
    wrap(<OrdersTable token="tok" />);
    expect(await screen.findByText("Sigil One")).toBeInTheDocument();
    expect(screen.getByText("5.00")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
  });
});
