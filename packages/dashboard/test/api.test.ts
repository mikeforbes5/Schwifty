import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStats } from "../src/api";

const goodStats = {
  revenueTotalUnits: 5_000_000, orderCount: 1,
  byKind: [{ kind: "sigil", units: 5_000_000, count: 1 }],
  timeSeries: [{ date: "2026-07-09", units: 5_000_000 }],
  inventory: [{ kind: "sigil", listed: 3, sold: 1 }],
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchStats", () => {
  it("sends the bearer token and parses valid stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(goodStats)));
    vi.stubGlobal("fetch", fetchMock);
    const stats = await fetchStats("tok");
    expect(stats.revenueTotalUnits).toBe(5_000_000);
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/stats");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("throws on non-200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(fetchStats("tok")).rejects.toThrow(/401/);
  });
  it("throws on schema mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: 1 }))));
    await expect(fetchStats("tok")).rejects.toThrow();
  });
});
