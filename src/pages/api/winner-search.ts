cat > src/pages/api/winner-search.ts <<'EOF'
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

export const GET: APIRoute = async ({ url }) => {
  try {
    const sport = (url.searchParams.get("sport") || "NFL").toUpperCase();
    const year = toInt(url.searchParams.get("year"));
    const week = toInt(url.searchParams.get("week"));
    const slateTypeParam = url.searchParams.get("slateType") || "ANY";
    const st = parseSlateTypeParam(slateTypeParam);

    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(toInt(url.searchParams.get("limit")) ?? 25, 50);

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

    if (q) {
      where.OR = [
        { contestName: { contains: q, mode: "insensitive" } },
        { siteContestId: { contains: q, mode: "insensitive" } },
        { winners: { some: { username: { contains: q, mode: "insensitive" } } } },
      ];
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

      const href =
        r.slate?.season?.sport === "CFB"
          ? `/cfb/${encodeURIComponent(r.slate.slateKey)}`
          : `/nfl/${encodeURIComponent(r.slate.slateKey)}`;

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
EOF
