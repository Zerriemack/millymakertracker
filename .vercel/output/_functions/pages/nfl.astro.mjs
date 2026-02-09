import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_BpFJd2pw.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_C4OFTAex.mjs';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
export { renderers } from '../renderers.mjs';

const viteEnv = import.meta?.env;
const databaseUrl = process.env.DATABASE_URL ?? viteEnv?.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add it to .env.local");
}
const adapter = new PrismaPg({ connectionString: databaseUrl });
const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const slates = await prisma.slate.findMany({
    where: {
      season: { sport: "NFL", year: 2025 }
    },
    orderBy: [{ week: "asc" }, { slateType: "asc" }],
    include: {
      season: true,
      contests: {
        include: {
          winners: true
        }
      }
    }
  });
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "NFL | MillyMakerTracker" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="container"> <h1>NFL</h1> <p>Tracking DraftKings NFL Milly Maker winning lineups by slate.</p> ${slates.length === 0 ? renderTemplate`<p>No slates yet.</p>` : renderTemplate`<ul style="list-style:none; padding:0; margin:0; max-width: 720px;"> ${slates.map((s) => {
    const contest = s.contests[0];
    const winner = contest?.winners?.[0];
    return renderTemplate`<li style="padding: 18px 0; border-bottom: 1px solid #eaeaea;"> <div style="font-weight:700; font-size: 18px;"> ${s.season.year} Week ${s.week} · ${s.slateType} ·${" "} ${new Date(s.slateDate).toLocaleDateString()} </div> <div style="margin-top: 6px; color: #555;">
Contest: ${contest ? contest.contestName : "TBD"} </div> <div style="margin-top: 6px; color: #555;">
Winner: ${winner ? winner.username : "TBD"}${" "}
(${winner ? winner.points : "\u2014"} pts)
</div> </li>`;
  })} </ul>`} </main> ` })}`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/nfl/index.astro", void 0);

const $$file = "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/nfl/index.astro";
const $$url = "/nfl";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
