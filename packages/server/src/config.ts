import { resolve } from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  NETWORK: z.enum(["base-sepolia", "base"]).default("base-sepolia"),
  PAY_TO_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  DATABASE_PATH: z.string().optional(),
  INIT_CWD: z.string().optional(),
  ADMIN_TOKEN: z.string().min(16),
  PORT: z.coerce.number().int().default(4021),
  BASE_URL: z.string().url().default("http://localhost:4021"),
});

export const USDC_ADDRESS: Record<"base-sepolia" | "base", string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7c",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export interface Config {
  network: "base-sepolia" | "base"; payTo: string; facilitatorUrl: string;
  databasePath: string; adminToken: string; port: number; baseUrl: string;
  usdcAddress: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = EnvSchema.parse(env);
  // npm workspace scripts run with the package dir as cwd; INIT_CWD is where
  // the user invoked npm, so seed and server default to the same db file.
  const databasePath = e.DATABASE_PATH ?? resolve(e.INIT_CWD ?? process.cwd(), "data/schwifty.db");
  return {
    network: e.NETWORK, payTo: e.PAY_TO_ADDRESS, facilitatorUrl: e.FACILITATOR_URL,
    databasePath, adminToken: e.ADMIN_TOKEN, port: e.PORT,
    baseUrl: e.BASE_URL, usdcAddress: USDC_ADDRESS[e.NETWORK],
  };
}
