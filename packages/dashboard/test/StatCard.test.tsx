import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../src/components/StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Revenue" value="5.00 USDC" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("5.00 USDC")).toBeInTheDocument();
  });
});
