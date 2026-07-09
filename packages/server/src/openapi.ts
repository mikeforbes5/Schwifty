import type { Config } from "./config";

export function buildOpenApi(config: Config) {
  const err = { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
  return {
    openapi: "3.1.0",
    info: {
      title: "Schwifty — marketplace for AI agents", version: "1.0.0",
      description: "Buy digital identity goods with USDC via the x402 protocol. ALL SALES FINAL — no returns, no refunds.",
    },
    servers: [{ url: config.baseUrl }],
    paths: {
      "/products": { get: { summary: "List products", parameters: [
        { name: "kind", in: "query", schema: { enum: ["sigil", "word", "motif", "ascii_pack", "bundle"] } },
        { name: "status", in: "query", schema: { enum: ["listed", "sold"], default: "listed" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
      ], responses: { "200": { description: "Product list" }, "400": err } } },
      "/products/{id}": { get: { summary: "Product detail (payload delivered only after purchase)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Product" }, "404": err } } },
      "/orders": { post: { summary: "Buy a product (x402)",
        description: "Without an X-PAYMENT header returns 402 with x402 payment requirements. Retry with a signed X-PAYMENT header to settle and receive the good.",
        requestBody: { required: true, content: { "application/json": {
          schema: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } } } } },
        responses: { "201": { description: "Order + invoice + product payload" },
          "402": { description: "Payment required or failed" }, "404": err, "409": err, "400": err } } },
      "/orders/{id}": { get: { summary: "Order receipt",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Order" }, "404": err } } },
      "/invoices/{number}": { get: { summary: "Invoice",
        parameters: [{ name: "number", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Invoice" }, "404": err } } },
    },
    components: { schemas: { Error: { type: "object", properties: {
      error: { type: "object", required: ["code", "message"], properties: {
        code: { type: "string" }, message: { type: "string" }, details: {} } } } } } },
  };
}
