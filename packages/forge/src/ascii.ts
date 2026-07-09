import { pick, randInt, seededRandom } from "./random";

const CHARS = ["═", "─", "▚", "█", "◈", "╬", "▓", "░", "◆", "∴", "≡", "☰"];

export function generateAsciiPack(seed: string): { pieces: string[] } {
  const rnd = seededRandom(`ascii:${seed}`);
  const pieces: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = pick(rnd, CHARS), d = pick(rnd, CHARS);
    pieces.push(`${c}${d}`.repeat(randInt(rnd, 10, 20)));
  }
  const f = pick(rnd, CHARS);
  pieces.push(`${f.repeat(30)}\n${f}${" ".repeat(28)}${f}\n${f.repeat(30)}`);
  return { pieces };
}
