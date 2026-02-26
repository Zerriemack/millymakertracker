import type { APIRoute } from "astro";
import { prisma } from "../../lib/prisma";

export const GET: APIRoute = async () => {
  const rows = await prisma.$queryRawUnsafe(
    "select current_database() as db, inet_server_addr()::text as host, current_user as user"
  );
  return new Response(JSON.stringify(rows, null, 2), {
    headers: { "content-type": "application/json" },
  });
};
