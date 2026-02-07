import { prisma } from "../../lib/prisma";

export async function GET() {
  const contests = await prisma.contest.count();

  return new Response(JSON.stringify({ ok: true, contests }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
