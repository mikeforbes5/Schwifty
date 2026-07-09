import { formatUsdc, type Product } from "@schwifty/core";

export function toPublicProduct(p: Product) {
  const { payload: _payload, ...pub } = p;
  return { ...pub, priceUsdc: formatUsdc(p.priceUnits) };
}
