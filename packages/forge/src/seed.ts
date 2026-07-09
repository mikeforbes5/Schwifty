import type { Core, ProductKind } from "@schwifty/core";
import { forgeItem } from "./index";

const DEFAULT_COUNTS: Record<ProductKind, number> = {
  sigil: 8, word: 8, motif: 8, ascii_pack: 3, bundle: 4,
};

export function seedCatalog(core: Core, counts: Partial<Record<ProductKind, number>> = {}): number {
  const plan = { ...DEFAULT_COUNTS, ...counts };
  let created = 0;
  for (const [kind, n] of Object.entries(plan) as Array<[ProductKind, number]>) {
    for (let i = 1; i <= n; i++) {
      const sku = `${kind.toUpperCase()}-${String(i).padStart(4, "0")}`;
      if (core.catalog.bySku(sku)) continue;
      core.catalog.create({ sku, ...forgeItem(kind, sku) });
      created++;
    }
  }
  return created;
}
