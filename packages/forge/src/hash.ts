import { createHash } from "node:crypto";
export const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");
