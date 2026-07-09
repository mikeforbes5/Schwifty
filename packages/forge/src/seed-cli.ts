import { resolve } from "node:path";
import { createCore } from "@schwifty/core";
import { seedCatalog } from "./seed";

// Anchor the default to INIT_CWD (where npm was invoked) so `npm run seed`
// from the repo root writes the same db file the server reads.
const path = process.env.DATABASE_PATH
  ?? resolve(process.env.INIT_CWD ?? process.cwd(), "data/schwifty.db");
const core = createCore(path);
console.log(`Seeded ${seedCatalog(core)} products into ${path}`);
