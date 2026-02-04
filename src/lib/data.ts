import rawSlates from "../../data/processed/slates.json";
import type { Slate } from "./schema";
import { assertSlates } from "./schema";

let cache: Slate[] | null = null;

export function getSlates(): Slate[] {
  if (cache) return cache;

  const data: unknown = rawSlates;
  assertSlates(data);

  cache = data;
  return cache;
}

export function getSlateById(id: string): Slate | undefined {
  return getSlates().find((s) => s.id === id);
}

export function getSlatesBySeason(season: number): Slate[] {
  return getSlates().filter((s) => s.season === season);
}
