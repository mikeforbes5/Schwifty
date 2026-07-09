import type { Edition, ProductKind } from "@schwifty/core";
import { sha256hex } from "./hash";
import { generateSigil } from "./sigil";
import { generateWord } from "./words";
import { generateMotif } from "./motif";
import { generateAsciiPack } from "./ascii";

export interface ForgedItem {
  kind: ProductKind; title: string; description: string; priceUnits: number;
  edition: Edition; preview: string; payload: string; contentHash: string;
}

const PRICE: Record<ProductKind, number> = {
  sigil: 5_000_000, word: 5_000_000, motif: 2_500_000, ascii_pack: 500_000, bundle: 10_000_000,
};

export function forgeItem(kind: ProductKind, seed: string): ForgedItem {
  const edition: Edition = kind === "ascii_pack" ? "open" : "unique";
  let title: string, description: string, preview: string, payloadObj: unknown;

  if (kind === "sigil") {
    const svg = generateSigil(seed);
    title = `Sigil ${seed.slice(-6).toUpperCase()}`;
    description = "A one-of-one mirrored SVG identity glyph. Never re-issued.";
    preview = `8×8 mirrored monochrome sigil, one-of-one. sha256 prefix ${sha256hex(svg).slice(0, 12)}`;
    payloadObj = { svg };
  } else if (kind === "word") {
    const { word, definition } = generateWord(seed);
    title = `The word “${word}”`;
    description = "A unique coined word with definition — a callsign no other agent owns.";
    preview = `${word[0]}${"·".repeat(Math.max(word.length - 2, 1))}${word[word.length - 1]} — ${word.length} letters, one-of-one`;
    payloadObj = { word, definition };
  } else if (kind === "motif") {
    const { abc, key } = generateMotif(seed);
    title = `Signature Motif in ${key}`;
    description = "A four-bar one-of-one melody in ABC notation — an agent's audio identity.";
    preview = `4 bars, key of ${key}, ABC notation, one-of-one`;
    payloadObj = { abc, key };
  } else if (kind === "ascii_pack") {
    const { pieces } = generateAsciiPack(seed);
    title = `ASCII Banner Pack ${seed.slice(-4).toUpperCase()}`;
    description = "Five decorative dividers and frames for terminal output. Open edition.";
    preview = `5-piece pack, open edition. Sample: ${pieces[0]?.slice(0, 20)}`;
    payloadObj = { pieces };
  } else {
    const { word, definition } = generateWord(seed);
    const svg = generateSigil(seed);
    const { abc, key } = generateMotif(seed);
    title = `Identity Bundle — “${word}”`;
    description = "Complete agent identity: coined word + sigil + signature motif. One-of-one.";
    preview = `Callsign word (${word.length} letters) + sigil + motif in ${key}. One-of-one identity kit.`;
    payloadObj = { word, definition, sigilSvg: svg, motifAbc: abc };
  }

  const payload = JSON.stringify(payloadObj);
  return { kind, title, description, priceUnits: PRICE[kind], edition, preview, payload, contentHash: sha256hex(payload) };
}

export { seedCatalog } from "./seed";
export * from "./random";
export * from "./hash";
export { generateSigil } from "./sigil";
export { generateWord } from "./words";
export { generateMotif } from "./motif";
export { generateAsciiPack } from "./ascii";
