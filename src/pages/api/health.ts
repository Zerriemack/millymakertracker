import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const contests = await prisma.contest.count();

  return new Response(JSON.stringify({ ok: true, contests }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
