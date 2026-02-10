import type { APIRoute } from "astro";
import { prisma } from "../../../lib/prisma";

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing slate id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const slate = await prisma.slate.findUnique({
    where: { id },
    include: {
      season: true,
      contests: {
        orderBy: { contestName: "asc" },
        include: {
          winners: {
            orderBy: { points: "desc" },
            include: {
              lineup: {
                include: {
                  items: {
                    orderBy: [{ rosterSpot: "asc" }, { slotIndex: "asc" }],
                    include: { player: { include: { team: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!slate) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ slate }), {
    headers: { "content-type": "application/json" },
  });
};
