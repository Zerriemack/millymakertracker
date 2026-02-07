import { prisma } from "../../lib/prisma";

export async function GET() {
  try {
    const contests = await prisma.contest.count();
    return new Response(JSON.stringify({ ok: true, contests }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
