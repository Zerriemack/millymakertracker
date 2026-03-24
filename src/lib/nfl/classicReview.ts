export type ClassicReviewRow = {
  slateId: string;
  year: number | null;
  week: number | null;
  slateType: string;
  venue: string;
  venueIsIndoor: boolean | null;
  venueSummary: string;
  tag: string;
  group: string;
  link: string;
  qbStack: string;
  stackCount: number | null;
  bringbackCount: number | null;
  hasBringback: string;
  maxFromTeam: number | null;
  maxFromGame: number | null;
  earlyCount: number | null;
  lateCount: number | null;
  own0_10: number | null;
  own11_19: number | null;
  own20p: number | null;
  ownBucketTotal: number | null;
  salaryLeft: number | null;
  ownPct: number | null;
  pts: number | null;
  topPrizeCents: number | null;
};

export function toNumber(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function ynFromCount(v: unknown): string {
  const x = toNumber(v);
  if (x === null) return "";
  return x > 0 ? "YES" : "NO";
}

export function normalizeClassicReviewRows(data: any): ClassicReviewRow[] {
  const rowsRaw = Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.items) ? data.items : [];

  return rowsRaw
    .map((r: any) => {
      const slateId = String(r.slateId ?? r.id ?? r.slate?.id ?? "");
      const week = Number(r.week ?? r.slate?.week ?? null);
      const slateType = String(r.slateType ?? r.slate?.slateType ?? "");
      const venue = String(r.venue ?? r.stadiumName ?? r.stadium?.name ?? "");
      const venueIsIndoor =
        typeof r.venueIsIndoor === "boolean"
          ? r.venueIsIndoor
          : typeof r.stadiumIsIndoor === "boolean"
            ? r.stadiumIsIndoor
            : typeof r.stadium?.isIndoor === "boolean"
              ? r.stadium.isIndoor
              : null;
      const venueSummary = String(r.venueSummary ?? r.slateDate ?? "");

      const year =
        typeof r.year === "number"
          ? r.year
          : typeof r.slate?.season?.year === "number"
            ? r.slate.season.year
            : null;

      const salaryCap =
        typeof r.salaryCapCents === "number"
          ? r.salaryCapCents
          : typeof r.slate?.salaryCapCents === "number"
            ? r.slate.salaryCapCents
            : 50000;

      const salaryUsed = typeof r.salaryUsed === "number" ? r.salaryUsed : toNumber(r.lineup?.salaryUsed);
      const salaryLeft =
        typeof r.salaryLeft === "number"
          ? r.salaryLeft
          : typeof salaryUsed === "number" && typeof salaryCap === "number"
            ? salaryCap - salaryUsed
            : null;

      const ownPct =
        typeof r.totalOwnershipPct === "number"
          ? r.totalOwnershipPct
          : typeof r.totalOwnershipBp === "number"
            ? r.totalOwnershipBp / 100
            : typeof r.contest?.totalOwnershipBp === "number"
              ? r.contest.totalOwnershipBp / 100
              : typeof r.lineup?.totalOwnershipBp === "number"
                ? r.lineup.totalOwnershipBp / 100
                : null;

      const pts =
        typeof r.points === "number"
          ? r.points
          : typeof r.winnerPoints === "number"
            ? r.winnerPoints
            : typeof r.winner?.points === "number"
              ? r.winner.points
              : typeof r.totalPoints === "number"
                ? r.totalPoints
                : typeof r.lineup?.totalPoints === "number"
                  ? r.lineup.totalPoints
                  : null;

      const topPrizeCents =
        typeof r.topPrizeCents === "number"
          ? r.topPrizeCents
          : typeof r.contest?.topPrizeCents === "number"
            ? r.contest.topPrizeCents
            : null;

      const qbStack = String(r.qbStack ?? r.stack ?? r.construction?.qbStack ?? "");

      const maxFromTeam = typeof r.maxFromTeam === "number" ? r.maxFromTeam : toNumber(r.construction?.maxFromTeam);
      const maxFromGame = typeof r.maxFromGame === "number" ? r.maxFromGame : toNumber(r.construction?.maxFromGame);

      const stackCount = typeof r.stackCount === "number" ? r.stackCount : toNumber(r.construction?.stackCount);
      const bringbackCount = typeof r.bringbackCount === "number" ? r.bringbackCount : toNumber(r.construction?.bringbackCount);
      const hasBringback = String(r.hasBringback ?? ynFromCount(bringbackCount));

      const earlyCount =
        typeof r.earlyCount === "number"
          ? r.earlyCount
          : typeof r.lineup?.analysis?.earlyCount === "number"
            ? r.lineup.analysis.earlyCount
            : toNumber(r.construction?.earlyCount);

      const lateCount =
        typeof r.lateCount === "number"
          ? r.lateCount
          : typeof r.lineup?.analysis?.lateCount === "number"
            ? r.lineup.analysis.lateCount
            : toNumber(r.construction?.lateCount);

      const own0_10 = typeof r.own0_10 === "number" ? r.own0_10 : toNumber(r.ownership_0_10 ?? r.construction?.own0_10);
      const own11_19 = typeof r.own11_19 === "number" ? r.own11_19 : toNumber(r.ownership_11_19 ?? r.construction?.own11_19);
      const own20p = typeof r.own20p === "number" ? r.own20p : toNumber(r.ownership_20p ?? r.construction?.own20p);

      const ownBucketTotal =
        (typeof own0_10 === "number" ? own0_10 : 0) +
        (typeof own11_19 === "number" ? own11_19 : 0) +
        (typeof own20p === "number" ? own20p : 0);

      const tag = String(r.tag ?? "");
      const group = String(r.group ?? "");

      const link =
        typeof r.link === "string" && r.link
          ? r.link
          : typeof r.url === "string" && r.url
            ? r.url
            : slateId && year
              ? `/nfl/${year}/slate/${slateId}`
              : "";

      return {
        slateId,
        year,
        week,
        slateType,
        venue,
        venueIsIndoor,
        venueSummary,
        tag,
        group,
        link,
        qbStack,
        stackCount,
        bringbackCount,
        hasBringback,
        maxFromTeam,
        maxFromGame,
        earlyCount,
        lateCount,
        own0_10,
        own11_19,
        own20p,
        ownBucketTotal,
        salaryLeft,
        ownPct,
        pts,
        topPrizeCents,
      } satisfies ClassicReviewRow;
    })
    .filter((r: ClassicReviewRow) => r.slateId);
}

export async function fetchClassicReviewRows(origin: string): Promise<ClassicReviewRow[]> {
  const apiUrl = `${origin}/api/analysis/nfl/classic`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Analysis API failed: ${res.status} ${res.statusText} (${apiUrl})`);
  }

  const data = await res.json();
  return normalizeClassicReviewRows(data);
}

export function groupClassicReviewBy<T extends keyof ClassicReviewRow>(
  rows: ClassicReviewRow[],
  key: T,
): Record<string, ClassicReviewRow[]> {
  return rows.reduce<Record<string, ClassicReviewRow[]>>((acc, row) => {
    const k = String(row[key] ?? "");
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});
}

export function sumClassicReviewBy<T extends keyof ClassicReviewRow>(
  rows: ClassicReviewRow[],
  key: T,
): number {
  return rows.reduce((acc, row) => {
    const value = toNumber(row[key]);
    return acc + (value ?? 0);
  }, 0);
}

export function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeKey(value: unknown): string {
  return asString(value).toUpperCase();
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
}

export function mean(values: Array<number | null | undefined>): number | null {
  const list = values.filter((v): v is number => typeof v === "number");
  if (!list.length) return null;
  return sum(list) / list.length;
}

export function median(values: Array<number | null | undefined>): number | null {
  const list = values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  if (list.length % 2) return list[mid];
  return (list[mid - 1] + list[mid]) / 2;
}

export function min(values: Array<number | null | undefined>): number | null {
  const list = values.filter((v): v is number => typeof v === "number");
  if (!list.length) return null;
  return Math.min(...list);
}

export function max(values: Array<number | null | undefined>): number | null {
  const list = values.filter((v): v is number => typeof v === "number");
  if (!list.length) return null;
  return Math.max(...list);
}

export function countBy(values: Array<string | number | null | undefined>): Map<string, number> {
  const map = new Map<string, number>();
  values.forEach((value) => {
    const key = normalizeKey(value);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

export function mode(values: Array<string | number | null | undefined>): { value: string; count: number } {
  const map = countBy(values);
  let top = { value: "—", count: 0 };
  map.forEach((count, value) => {
    if (count > top.count) top = { value, count };
  });
  return top;
}

export function least(values: Array<string | number | null | undefined>): { value: string; count: number } {
  const map = countBy(values);
  let low = { value: "—", count: Number.POSITIVE_INFINITY };
  map.forEach((count, value) => {
    if (count < low.count) low = { value, count };
  });
  if (low.count === Number.POSITIVE_INFINITY) return { value: "—", count: 0 };
  return low;
}

export function uniqueCount(values: Array<string | number | null | undefined>): number {
  return countBy(values).size;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function groupByYear(rows: ClassicReviewRow[]): Record<string, ClassicReviewRow[]> {
  return groupBy(rows, (row) => (row.year == null ? "Unknown" : String(row.year)));
}

export function sortCounts(map: Map<string, number>): Array<{ value: string; count: number }> {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function pct(count: number, total: number, digits = 1): string {
  if (!total) return "—";
  return `${((count / total) * 100).toFixed(digits)}%`;
}

export function bandLabel(minValue: number, maxValue: number, unit?: string): string {
  if (unit === "%") return `${minValue.toFixed(1)}–${maxValue.toFixed(1)}%`;
  if (unit === "$") return `$${Math.round(minValue).toLocaleString("en-US")}–$${Math.round(maxValue).toLocaleString("en-US")}`;
  return `${minValue}–${maxValue}`;
}

export function bucketize(
  values: Array<number | null | undefined>,
  buckets: Array<{ min: number; max: number; label?: string }>
): Array<{ label: string; count: number }> {
  const counts = buckets.map((bucket) => ({
    label: bucket.label ?? bandLabel(bucket.min, bucket.max),
    count: 0,
  }));

  values.forEach((value) => {
    if (typeof value !== "number") return;
    const idx = buckets.findIndex((bucket) => value >= bucket.min && value <= bucket.max);
    if (idx >= 0) counts[idx].count += 1;
  });

  return counts;
}

export function bucketByStep(
  values: Array<number | null | undefined>,
  step: number,
  opts?: { min?: number; max?: number; unit?: string }
): Array<{ label: string; count: number; min: number; max: number }> {
  const list = values.filter((v): v is number => typeof v === "number");
  if (!list.length || step <= 0) return [];

  const minVal = typeof opts?.min === "number" ? opts.min : Math.floor(Math.min(...list) / step) * step;
  const maxVal = typeof opts?.max === "number" ? opts.max : Math.ceil(Math.max(...list) / step) * step;
  const buckets: Array<{ label: string; count: number; min: number; max: number }> = [];

  for (let start = minVal; start < maxVal; start += step) {
    const end = start + step;
    buckets.push({
      min: start,
      max: end,
      label: opts?.unit ? bandLabel(start, end, opts.unit) : bandLabel(start, end),
      count: 0,
    });
  }

  list.forEach((value) => {
    const idx = Math.min(
      Math.floor((value - minVal) / step),
      Math.max(buckets.length - 1, 0)
    );
    if (buckets[idx]) buckets[idx].count += 1;
  });

  return buckets;
}

export function quantile(values: Array<number | null | undefined>, q: number): number | null {
  const list = values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (!list.length) return null;
  const pos = (list.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (list[base + 1] !== undefined) {
    return list[base] + rest * (list[base + 1] - list[base]);
  }
  return list[base];
}

export function pickTopCounts(counts: Array<{ value: string; count: number }>, limit: number) {
  return counts.slice(0, limit);
}
