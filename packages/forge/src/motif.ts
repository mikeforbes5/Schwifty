import { pick, seededRandom } from "./random";

const SCALES: Record<string, string[]> = {
  C: ["C", "D", "E", "G", "A", "c", "d", "e"],
  G: ["G", "A", "B", "d", "e", "g", "a", "b"],
  D: ["D", "E", "F", "A", "B", "d", "e", "f"],
  Am: ["A", "C", "D", "E", "G", "a", "c", "d"],
  Em: ["E", "G", "A", "B", "D", "e", "g", "a"],
};

export function generateMotif(seed: string): { abc: string; key: string } {
  const rnd = seededRandom(`motif:${seed}`);
  const key = pick(rnd, Object.keys(SCALES));
  const notes = SCALES[key] as string[];
  const bars: string[] = [];
  for (let b = 0; b < 4; b++) {
    let bar = "";
    for (let n = 0; n < 8; n++) bar += pick(rnd, notes);
    bars.push(bar);
  }
  const abc = `X:1\nT:Signature Motif ${seed}\nM:4/4\nL:1/8\nK:${key}\n${bars.join("|")}|]`;
  return { abc, key };
}
