import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_BpFJd2pw.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_C4OFTAex.mjs';
export { renderers } from '../renderers.mjs';

const rawSlates = [
	{
		id: "nfl-2025-wk01-main-sun",
		sport: "NFL",
		season: 2025,
		week: 1,
		slateName: "Main Slate",
		date: "2025-09-07",
		site: "DraftKings",
		contest: {
			name: "NFL $1M Milly Maker",
			type: "Classic",
			entryFee: 20,
			entrants: 0,
			contestId: ""
		},
		winners: [
			{
				place: 1,
				username: "example_user",
				points: 0,
				lineup: [
					{
						pos: "QB",
						name: "QB Name",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "RB",
						name: "RB Name",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "RB",
						name: "RB Name 2",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "WR",
						name: "WR Name",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "WR",
						name: "WR Name 2",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "WR",
						name: "WR Name 3",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "TE",
						name: "TE Name",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "FLEX",
						name: "FLEX Name",
						team: "TEAM",
						salary: 0
					},
					{
						pos: "DST",
						name: "DST Name",
						team: "TEAM",
						salary: 0
					}
				]
			}
		],
		notes: "Seed data. Replace with real slates as you ingest."
	}
];

function isObject(value) {
  return typeof value === "object" && value !== null;
}
function assertSlates(data) {
  if (!Array.isArray(data)) throw new Error("slates.json must be an array");
  for (const item of data) {
    if (!isObject(item)) throw new Error("Each slate must be an object");
    if (typeof item.id !== "string" || item.id.length === 0) {
      throw new Error("Slate.id must be a non empty string");
    }
    if (item.sport !== "NFL") throw new Error("Slate.sport must be NFL");
    if (typeof item.season !== "number") throw new Error("Slate.season must be a number");
    if (typeof item.date !== "string") throw new Error("Slate.date must be a string");
    if (item.site !== "DraftKings") throw new Error("Slate.site must be DraftKings");
    if (!isObject(item.contest)) throw new Error("Slate.contest must be an object");
    if (typeof item.contest.name !== "string") throw new Error("contest.name must be a string");
    if (item.contest.type !== "Classic") throw new Error("contest.type must be Classic");
    if (!Array.isArray(item.winners)) throw new Error("Slate.winners must be an array");
    for (const w of item.winners) {
      if (!isObject(w)) throw new Error("Each winner must be an object");
      if (typeof w.place !== "number") throw new Error("winner.place must be a number");
      if (typeof w.username !== "string") throw new Error("winner.username must be a string");
      if (typeof w.points !== "number") throw new Error("winner.points must be a number");
      if (!Array.isArray(w.lineup)) throw new Error("winner.lineup must be an array");
      for (const s of w.lineup) {
        if (!isObject(s)) throw new Error("lineup slot must be an object");
        if (typeof s.pos !== "string") throw new Error("lineup.pos must be a string");
        if (typeof s.name !== "string") throw new Error("lineup.name must be a string");
      }
    }
  }
}

let cache = null;
function getSlates() {
  if (cache) return cache;
  const data = rawSlates;
  assertSlates(data);
  cache = data;
  return cache;
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const slates = getSlates().filter((s) => s.sport === "CFB").sort((a, b) => a.date > b.date ? -1 : 1);
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "CFB | MillyMakerTracker" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="container"> <h1>CFB</h1> <p>Tracking DraftKings CFB Milly Maker winning lineups by slate.</p> ${slates.length === 0 ? renderTemplate`<p>No slates yet.</p>` : renderTemplate`<ul> ${slates.map((s) => renderTemplate`<li> <strong> ${s.season} ${typeof s.week === "number" ? ` Week ${s.week}` : ""} </strong> ${" \u2022 "} ${s.slateName ?? "Slate"} ${" \u2022 "} ${s.date} ${" \u2022 "} ${s.contest.name} ${s.winners?.[0] ? renderTemplate`<div>
Winner: ${s.winners[0].username} (${s.winners[0].points} pts)
</div>` : null} </li>`)} </ul>`} </main> ` })}`;
}, "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/cfb/index.astro", void 0);

const $$file = "/Users/zerriemack/Desktop/millymakertracker.com/src/pages/cfb/index.astro";
const $$url = "/cfb";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
