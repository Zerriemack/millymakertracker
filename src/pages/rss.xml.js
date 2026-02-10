import rss from "@astrojs/rss";
import { prisma } from "../lib/prisma";

export async function GET(context) {
  const winners = await prisma.winner.findMany({
    take: 30,
    orderBy: { id: "desc" },
    include: {
      contest: {
        include: {
          slate: { include: { season: true } },
        },
      },
    },
  });

  const items = winners
    .map((w) => {
      const slate = w.contest?.slate;
      const season = slate?.season;

      if (!slate || !season) return null;

      const title = `${season.sport} ${season.year} ${slate.slateTag ?? slate.slateType} winner ${w.username}`;
      const link = `/${season.sport.toLowerCase()}/${season.year}/slate/${slate.id}`;

      return {
        title,
        link,
        pubDate: slate.slateDate,
        description: `${w.username} scored ${w.points} in ${w.contest.contestName}`,
      };
    })
    .filter(Boolean);

  return rss({
    title: "Milly Maker Tracker",
    description: "Latest logged slates and winners",
    site: context.site,
    items,
  });
}
