import { describe, expect, it } from "vitest";
import { seededRandom } from "../src/random";
import { generateSigil } from "../src/sigil";
import { generateWord } from "../src/words";
import { generateMotif } from "../src/motif";
import { generateAsciiPack } from "../src/ascii";
import { forgeItem } from "../src/index";

describe("random", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a1 = seededRandom("s1")(), a2 = seededRandom("s1")(), b = seededRandom("s2")();
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toBeGreaterThanOrEqual(0);
    expect(a1).toBeLessThan(1);
  });
});

describe("generators", () => {
  it("sigils are deterministic well-formed SVG", () => {
    const svg = generateSigil("seed-1");
    expect(svg).toBe(generateSigil("seed-1"));
    expect(svg).not.toBe(generateSigil("seed-2"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<rect");
    expect(svg.endsWith("</svg>")).toBe(true);
  });
  it("words are pronounceable and defined", () => {
    const { word, definition } = generateWord("seed-1");
    expect(word).toMatch(/^[a-z]{3,24}$/);
    expect(generateWord("seed-1").word).toBe(word);
    expect(definition).toMatch(/^\(n\.\) /);
  });
  it("motifs are ABC notation", () => {
    const { abc, key } = generateMotif("seed-1");
    expect(abc).toContain("X:1");
    expect(abc).toContain(`K:${key}`);
    expect(abc).toContain("M:4/4");
    expect(abc).toBe(generateMotif("seed-1").abc);
  });
  it("ascii packs contain multiple pieces", () => {
    const { pieces } = generateAsciiPack("seed-1");
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    for (const p of pieces) expect(p.length).toBeGreaterThan(0);
  });
});

describe("forgeItem", () => {
  it("produces a complete listable item for every kind", () => {
    for (const kind of ["sigil", "word", "motif", "ascii_pack", "bundle"] as const) {
      const item = forgeItem(kind, `seed-${kind}`);
      expect(item.kind).toBe(kind);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.preview.length).toBeGreaterThan(0);
      expect(item.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(() => JSON.parse(item.payload)).not.toThrow();
    }
  });
  it("applies the price/edition table", () => {
    expect(forgeItem("sigil", "s").priceUnits).toBe(5_000_000);
    expect(forgeItem("word", "s").priceUnits).toBe(5_000_000);
    expect(forgeItem("motif", "s").priceUnits).toBe(2_500_000);
    expect(forgeItem("ascii_pack", "s").priceUnits).toBe(500_000);
    expect(forgeItem("bundle", "s").priceUnits).toBe(10_000_000);
    expect(forgeItem("ascii_pack", "s").edition).toBe("open");
    expect(forgeItem("sigil", "s").edition).toBe("unique");
  });
  it("bundle payload composes word + sigil + motif", () => {
    const payload = JSON.parse(forgeItem("bundle", "s").payload);
    expect(payload.word).toBeDefined();
    expect(payload.sigilSvg).toContain("<svg");
    expect(payload.motifAbc).toContain("X:1");
  });
  it("same seed same hash, different seed different hash", () => {
    expect(forgeItem("sigil", "a").contentHash).toBe(forgeItem("sigil", "a").contentHash);
    expect(forgeItem("sigil", "a").contentHash).not.toBe(forgeItem("sigil", "b").contentHash);
  });
});
