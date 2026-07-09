import { serve } from "@hono/node-server";
import { createCore } from "@schwifty/core";
import { loadConfig, loadDotEnv } from "./config";
import { FacilitatorGateway } from "./payment";
import { buildApp } from "./app";

loadDotEnv();
const config = loadConfig();
const core = createCore(config.databasePath);
const app = buildApp({ core, gateway: new FacilitatorGateway(config.facilitatorUrl), config });

serve({ fetch: app.fetch, port: config.port });
console.log(`Schwifty marketplace listening on :${config.port} (${config.network} → ${config.payTo})`);
