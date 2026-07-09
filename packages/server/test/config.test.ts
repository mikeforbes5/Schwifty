import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, loadDotEnv } from "../src/config";

const base = { PAY_TO_ADDRESS: "0x" + "ab".repeat(20), ADMIN_TOKEN: "0123456789abcdef" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig(base as never);
    expect(c.network).toBe("base-sepolia");
    expect(c.port).toBe(4021);
    expect(c.facilitatorUrl).toBe("https://x402.org/facilitator");
    expect(c.usdcAddress).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  });
  it("anchors the default database path to INIT_CWD so seed and server share one db", () => {
    const c = loadConfig({ ...base, INIT_CWD: "/somewhere/repo" } as never);
    expect(c.databasePath).toBe("/somewhere/repo/data/schwifty.db");
    const explicit = loadConfig({ ...base, DATABASE_PATH: "/tmp/x.db" } as never);
    expect(explicit.databasePath).toBe("/tmp/x.db");
  });
  it("resolves an explicit relative DATABASE_PATH against INIT_CWD, not the package cwd", () => {
    const c = loadConfig({ ...base, DATABASE_PATH: "./data/schwifty.db", INIT_CWD: "/somewhere/repo" } as never);
    expect(c.databasePath).toBe("/somewhere/repo/data/schwifty.db");
  });
  it("selects mainnet USDC for base", () => {
    expect(loadConfig({ ...base, NETWORK: "base" } as never).usdcAddress)
      .toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
  it("rejects bad pay-to address", () => {
    expect(() => loadConfig({ ...base, PAY_TO_ADDRESS: "nope" } as never)).toThrow();
  });
});

describe("loadDotEnv", () => {
  afterEach(() => { delete process.env.SCHWIFTY_TEST_VAR; });

  it("loads variables from a .env file in the given directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "schwifty-env-"));
    writeFileSync(join(dir, ".env"), "SCHWIFTY_TEST_VAR=from-file\n");
    loadDotEnv(dir);
    expect(process.env.SCHWIFTY_TEST_VAR).toBe("from-file");
  });
  it("is a no-op when no .env exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "schwifty-noenv-"));
    expect(() => loadDotEnv(dir)).not.toThrow();
  });
});
