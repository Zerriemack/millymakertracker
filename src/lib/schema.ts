export type Sport = "NFL";
export type Site = "DraftKings";
export type ContestType = "Classic";

export type LineupSlot = {
  pos: string;
  name: string;
  team?: string;
  salary?: number;
};

export type Winner = {
  place: number;
  username: string;
  points: number;
  lineup: LineupSlot[];
};

export type ContestMeta = {
  name: string;
  type: ContestType;
  entryFee?: number;
  entrants?: number;
  contestId?: string;
};

export type Slate = {
  id: string;
  sport: Sport;
  season: number;
  week?: number;
  slateName?: string;
  date: string; // YYYY-MM-DD
  site: Site;
  contest: ContestMeta;
  winners: Winner[];
  notes?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function assertSlates(data: unknown): asserts data is Slate[] {
  if (!Array.isArray(data)) throw new Error("slates.json must be an array");

  for (const item of data) {
    if (!isObject(item)) throw new Error("Each slate must be an object");

    if (typeof item.id !== "string" || item.id.length === 0) {
      throw new Error("Slate.id must be a non empty string");
    }
    if (item.sport !== "NFL") throw new Error("Slate.sport must be NFL");
    if (typeof item.season !== "number") throw new Error("Slate.season must be a number");
    if (typeof item.date !== "string") throw new Error("Slate.date must be a string");
    if (item.site !== "DraftKings") throw new Error("Slate.site must be DraftKings");

    if (!isObject(item.contest)) throw new Error("Slate.contest must be an object");
    if (typeof item.contest.name !== "string") throw new Error("contest.name must be a string");
    if (item.contest.type !== "Classic") throw new Error("contest.type must be Classic");

    if (!Array.isArray(item.winners)) throw new Error("Slate.winners must be an array");
    for (const w of item.winners) {
      if (!isObject(w)) throw new Error("Each winner must be an object");
      if (typeof w.place !== "number") throw new Error("winner.place must be a number");
      if (typeof w.username !== "string") throw new Error("winner.username must be a string");
      if (typeof w.points !== "number") throw new Error("winner.points must be a number");
      if (!Array.isArray(w.lineup)) throw new Error("winner.lineup must be an array");
      for (const s of w.lineup) {
        if (!isObject(s)) throw new Error("lineup slot must be an object");
        if (typeof s.pos !== "string") throw new Error("lineup.pos must be a string");
        if (typeof s.name !== "string") throw new Error("lineup.name must be a string");
      }
    }
  }
}
