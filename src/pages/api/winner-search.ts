import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

function toInt(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type SlateTypeFilter =
  | { kind: "lineupType"; value: "CLASSIC" | "SHOWDOWN" }
  | {
      kind: "slateType";
      value: "MAIN" | "SHOWDOWN" | "TNF" | "SUPER_BOWL" | "SNF" | "MNF" | "OTHER";
    };

function parseSlateTypeParam(raw: string): SlateTypeFilter | null {
  const v = (raw || "").trim().toUpperCase();
  if (!v || v === "ANY") return null;

  if (v === "CLASSIC") return { kind: "lineupType", value: "CLASSIC" };
  if (v === "SHOWDOWN") return { kind: "lineupType", value: "SHOWDOWN" };

  const slateTypes = ["MAIN", "SHOWDOWN", "TNF", "SUPER_BOWL", "SNF", "MNF", "OTHER"] as const;
  if ((slateTypes as readonly string[]).includes(v)) {
    return { kind: "slateType", value: v as SlateTypeFilter["value"] };
  }

  return null;
}

function normalizeQ(raw: string) {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickNameParts(qNorm: string) {
  if (!qNorm) return { first: "", last: "", tokens: [] as string[] };

  const tokens = qNorm.split(" ").filter(Boolean);
  if (tokens.length === 1) return { first: "", last: tokens[0], tokens };

  // "m stafford" -> first=m last=stafford
  // "matthew stafford" -> first=matthew last=stafford
  const first = tokens[0];
  const last = tokens[tokens.length - 1];

  return { first, last, tokens };
}

function wantsJaWilliams(first: string) {
  // Handle the only meaningful ambiguity you called out
  // "ja williams" OR "jameson williams" should target "Ja. Williams"
  return first === "ja" || first === "jameson";
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const sport = (url.searchParams.get("sport") || "NFL").toUpperCase();
    const year = toInt(url.searchParams.get("year"));
    const week = toInt(url.searchParams.get("week"));
    const slateTypeParam = url.searchParams.get("slateType") || "ANY";
    const st = parseSlateTypeParam(slateTypeParam);

    const qRaw = (url.searchParams.get("q") || "").trim();
    const q = normalizeQ(qRaw);
    const limit = Math.min(toInt(url.searchParams.get("limit")) ?? 25, 50);

    const { first, last } = pickNameParts(q);

    const where: any = {
      slate: {
        season: {
          sport,
          ...(year != null ? { year } : {}),
        },
        ...(week != null ? { week } : {}),
        ...(st?.kind === "lineupType" ? { lineupType: st.value } : {}),
        ...(st?.kind === "slateType" ? { slateType: st.value } : {}),
      },
    };

    // Build search OR
    if (q) {
      const or: any[] = [
        { contestName: { contains: qRaw, mode: "insensitive" } },
        { siteContestId: { contains: qRaw, mode: "insensitive" } },
        { winners: { some: { username: { contains: qRaw, mode: "insensitive" } } } },
      ];

      // Player search:
      // Use LAST NAME matching to bridge "Matthew Stafford" -> "M. Stafford"
      // This works across your initials naming convention without touching seeds.
      if (last) {
        const basePlayerCond: any = {
          winners: {
            some: {
              lineup: {
                is: {
                  items: {
                    some: {
                      player: {
                        name: { contains: last, mode: "insensitive" },
                      },
                    },
                  },
                },
              },
            },
          },
        };

        // Special handling for Ja. Williams vs J. Williams when user clearly intends "Ja"
        if (last === "williams" && wantsJaWilliams(first)) {
          or.push({
            winners: {
              some: {
                lineup: {
                  is: {
                    items: {
                      some: {
                        player: {
                          name: { startsWith: "Ja.", mode: "insensitive" },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        } else {
          // General case: just last name match is enough
          or.push(basePlayerCond);
        }
      }

      where.OR = or;
    }

    const rows = await prisma.contest.findMany({
      where,
      take: limit,
      orderBy: { slate: { slateDate: "desc" } },
      select: {
        contestName: true,
        siteContestId: true,
        topPrizeCents: true,
        slate: {
          select: {
            id: true, // IMPORTANT: use DB slate id for the correct page
            slateKey: true,
            week: true,
            slateType: true,
            lineupType: true,
            slateDate: true,
            season: { select: { year: true, sport: true } },
          },
        },
        winners: {
          take: 1,
          orderBy: { points: "desc" },
          select: { username: true, points: true },
        },
      },
    });

    const items = rows.map((r: any) => {
      const dollars =
        typeof r.topPrizeCents === "number" ? `$${(r.topPrizeCents / 100).toLocaleString()}` : "";

      const w = r.winners?.[0];
      const points = typeof w?.points === "number" ? `${w.points.toFixed(2)} pts` : "";

      // IMPORTANT: link to the analysis/image page by slate id
      const href =
        r.slate?.season?.sport === "CFB"
          ? `/cfb/${encodeURIComponent(String(r.slate.season.year))}/slate/${encodeURIComponent(r.slate.id)}`
          : `/nfl/${encodeURIComponent(String(r.slate.season.year))}/slate/${encodeURIComponent(r.slate.id)}`;

      const weekPart = r.slate.week != null ? ` Week ${r.slate.week}` : "";

      return {
        href,
        title: r.contestName || r.siteContestId,
        right: [dollars, points].filter(Boolean).join(" • "),
        line1: `${r.slate.season.sport} ${r.slate.season.year}${weekPart} ${r.slate.slateType}`,
        line2: w?.username ? `Winner: ${w.username}` : "",
      };
    });

    return new Response(JSON.stringify({ count: items.length, items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("[winner-search] error:", err);
    return new Response(
      JSON.stringify({
        error: "winner-search failed",
        name: err?.name ?? null,
        message: err?.message ?? String(err),
        stack: err?.stack ?? null,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
