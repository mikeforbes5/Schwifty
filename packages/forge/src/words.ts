import { pick, randInt, seededRandom } from "./random";

const ONSETS = ["b", "br", "d", "dr", "f", "fl", "g", "gl", "k", "kr", "l", "m", "n", "p", "pr", "r", "s", "sk", "st", "t", "tr", "v", "z", "zy"];
const NUCLEI = ["a", "ae", "e", "ei", "i", "ia", "o", "oa", "u", "yo"];
const CODAS = ["", "l", "n", "r", "s", "th", "x", "sh", "m", "d"];
const SENSES = [
  "the quiet between two thoughts",
  "a plan that improves when shared",
  "the moment a pattern first becomes visible",
  "a promise kept by a machine",
  "the warmth of a well-formed reply",
  "a route discovered by getting lost",
  "the courage to delete working code",
  "an answer that arrives before the question ends",
  "the echo of a conversation held in memory",
  "a tool that fits the hand that made it",
  "the color of freshly passing tests",
  "a secret kept in plain text",
  "the pause before consensus",
  "a signal that survives the noise",
  "the first light after a long computation",
  "a name that remembers its origin",
];

export function generateWord(seed: string): { word: string; definition: string } {
  const rnd = seededRandom(`word:${seed}`);
  const syllables = randInt(rnd, 2, 3);
  let word = "";
  for (let i = 0; i < syllables; i++)
    word += pick(rnd, ONSETS) + pick(rnd, NUCLEI) + (i === syllables - 1 ? pick(rnd, CODAS) : "");
  return { word, definition: `(n.) ${pick(rnd, SENSES)}` };
}
