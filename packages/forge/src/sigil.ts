import { seededRandom } from "./random";

export function generateSigil(seed: string): string {
  const rnd = seededRandom(`sigil:${seed}`);
  const parts: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      if (rnd() < 0.45) {
        const px = 10 + x * 10, py = 10 + y * 10;
        parts.push(`<rect x="${px}" y="${py}" width="10" height="10"/>`);
        const mx = 90 - px - 10;
        if (mx !== px) parts.push(`<rect x="${mx}" y="${py}" width="10" height="10"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000">${parts.join("")}</g></svg>`;
}
