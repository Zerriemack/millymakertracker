import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const contests = await prisma.contest.count();
  return Response.json({ ok: true, contests });
}
