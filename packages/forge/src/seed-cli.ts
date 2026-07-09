import { createCore } from "@schwifty/core";
import { seedCatalog } from "./seed";

const path = process.env.DATABASE_PATH ?? "./data/schwifty.db";
const core = createCore(path);
console.log(`Seeded ${seedCatalog(core)} products into ${path}`);
