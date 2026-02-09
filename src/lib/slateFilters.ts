type SlateLite = {
  week: number;
  slateType: string;
  slateDate: Date | string;
  season?: { year: number };
  contests?: Array<{
    contestName?: string | null;
    siteContestId?: string | null;
    winners?: Array<{ username?: string | null; points?: number | null }>;
  }>;
};

function normalize(s: unknown) {
  return String(s ?? "").toLowerCase().trim();
}

export function classifyShowdownTag(contestName: string) {
  const n = normalize(contestName);

  if (n.includes("super bowl")) return "SUPER_BOWL";
  if (n.includes("wild card")) return "WILD_CARD";
  if (n.includes("divisional")) return "DIVISIONAL";
  if (n.includes("conference")) return "CONF_CHAMP";
  if (n.includes("playoff")) return "PLAYOFFS";

  if (n.includes("tnf")) return "TNF";
  if (n.includes("mnf")) return "MNF";
  if (n.includes("snf")) return "SNF";

  if (n.includes("thanksgiving")) return "THANKSGIVING";
  if (n.includes("black friday")) return "BLACK_FRIDAY";
  if (n.includes("saturday")) return "SAT";

  return "OTHER";
}

export function filterSlates<T extends SlateLite>(slates: T[], opts: { q?: string; tag?: string }) {
  const q = normalize(opts.q);
  const tag = normalize(opts.tag);

  return slates.filter((s) => {
    const contest = s.contests?.[0];
    const contestName = contest?.contestName ?? "";
    const winner = contest?.winners?.[0];

    const year = s.season?.year ?? "";
    const week = s.week ?? "";
    const slateType = s.slateType ?? "";
    const date = s.slateDate ? new Date(s.slateDate).toLocaleDateString() : "";

    const haystack = normalize(
      [
        year,
        week,
        slateType,
        date,
        contestName,
        contest?.siteContestId ?? "",
        winner?.username ?? "",
        winner?.points ?? ""
      ].join(" ")
    );

    if (q && !haystack.includes(q)) return false;

    if (tag) {
      const computed = classifyShowdownTag(contestName);
      if (normalize(computed) !== tag) return false;
    }

    return true;
  });
}
