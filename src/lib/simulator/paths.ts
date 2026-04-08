import path from "path";

export const SLATES_ROOT = path.resolve("src/data/simulator/slates");

export function resolveSlatePackagePath(slateKey: string) {
  return path.resolve(SLATES_ROOT, slateKey);
}
