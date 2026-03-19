export const classicOverviewStats = [
  {
    label: "Slates Tracked",
    value: "218",
    note: "Main + afternoon Classic slates since 2016 (mock)",
  },
  {
    label: "Median Salary Left",
    value: "$1,200",
    note: "Tight builds still win when correlation hits.",
  },
  {
    label: "Median Total Ownership",
    value: "137.4%",
    note: "Balanced exposure, not pure chalk.",
  },
  {
    label: "Median Winner Points",
    value: "194.2",
    note: "Classic requires ceiling, not floor.",
  },
  {
    label: "Bring-Back Rate",
    value: "62%",
    note: "Most winners run a primary bring-back.",
  },
];

export const classicOverviewCharts = [
  {
    title: "Salary Usage",
    meta: "Winning lineups by salary left",
    helper: "Shows how often winners leave salary on the table across slates.",
    footer: "Median left: $1,200 (mock)",
    series: [20, 45, 62, 38, 78, 54, 33, 68, 49, 72],
  },
  {
    title: "Ownership Profile",
    meta: "Total ownership distribution",
    helper: "Captures how chalky winners tend to be in Classic.",
    footer: "Median total ownership: 137.4% (mock)",
    series: [35, 60, 48, 52, 70, 58, 42, 64, 50, 76],
  },
  {
    title: "Construction Mix",
    meta: "QB stack shapes that win",
    helper: "Highlights the most frequent QB stack constructions in winners.",
    footer: "Top pattern: QB+2 (mock)",
    series: [28, 40, 55, 66, 44, 60, 38, 72, 50, 62],
  },
];

export const classicDistributionSections = [
  {
    title: "Salary Left",
    charts: [
      {
        title: "Salary Left Distribution",
        meta: "Winners by salary left buckets",
        helper: "Tracks how often winners leave various amounts of salary.",
        footer: "Median: $1,200 | Mode: $0 (mock)",
        series: [30, 45, 60, 70, 48, 38, 52, 62, 40, 55],
      },
    ],
    stats: [
      { label: "Median", value: "$1,200" },
      { label: "Most", value: "$4,900" },
      { label: "Least", value: "$0" },
    ],
  },
  {
    title: "Total Ownership",
    charts: [
      {
        title: "Total Ownership Spread",
        meta: "Winning ownership totals",
        helper: "Shows how aggressive or conservative winning ownership tends to be.",
        footer: "Median: 137.4% (mock)",
        series: [42, 58, 70, 54, 62, 45, 66, 52, 60, 48],
      },
    ],
    stats: [
      { label: "Median", value: "137.4%" },
      { label: "Most", value: "178.8%" },
      { label: "Least", value: "101.2%" },
    ],
  },
  {
    title: "Winner Points",
    charts: [
      {
        title: "Winner Points Distribution",
        meta: "Ceiling scores across slates",
        helper: "Highlights scoring ranges that typically win Classic contests.",
        footer: "Median: 194.2 (mock)",
        series: [36, 52, 68, 74, 50, 60, 44, 62, 58, 72],
      },
    ],
    stats: [
      { label: "Median", value: "194.2" },
      { label: "Most", value: "236.8" },
      { label: "Least", value: "168.5" },
    ],
  },
  {
    title: "Max From One Team",
    charts: [
      {
        title: "Team Concentration",
        meta: "Highest player count from one team",
        helper: "Shows how far winners push team concentration.",
        footer: "Median: 4 (mock)",
        series: [28, 40, 55, 62, 48, 58, 46, 64, 50, 60],
      },
    ],
    stats: [
      { label: "Median", value: "4" },
      { label: "Most", value: "6" },
      { label: "Least", value: "3" },
    ],
  },
  {
    title: "Max From One Game",
    charts: [
      {
        title: "Game Concentration",
        meta: "Highest player count from one game",
        helper: "Tracks how often winners lock into a single game environment.",
        footer: "Median: 5 (mock)",
        series: [34, 48, 62, 68, 52, 60, 44, 66, 50, 58],
      },
    ],
    stats: [
      { label: "Median", value: "5" },
      { label: "Most", value: "7" },
      { label: "Least", value: "3" },
    ],
  },
];

export const classicConstructionSections = [
  {
    title: "QB Stack Shape",
    charts: [
      {
        title: "QB Stack Shape",
        meta: "Distribution of QB stack builds",
        helper: "Shows which stack shapes most often win Classic slates.",
        footer: "Top build: QB+2 (mock)",
        series: [45, 62, 58, 50, 72, 40, 60, 48, 66, 54],
      },
    ],
    stats: [
      { label: "Most Common", value: "QB+2" },
      { label: "Runner Up", value: "QB+1" },
    ],
  },
  {
    title: "Bring-Back Rate",
    charts: [
      {
        title: "Bring-Back Usage",
        meta: "Yes vs no bring-back",
        helper: "Shows how often winning stacks include an opposing bring-back.",
        footer: "Bring-back rate: 62% (mock)",
        series: [70, 54, 62, 48, 60, 42, 58, 46, 64, 50],
      },
    ],
    stats: [
      { label: "Yes", value: "62%" },
      { label: "No", value: "38%" },
    ],
  },
  {
    title: "Stack Links",
    charts: [
      {
        title: "Stack Links Count",
        meta: "Primary stack + secondary correlations",
        helper: "Tracks how many correlated links show up in winners.",
        footer: "Median links: 3 (mock)",
        series: [38, 54, 66, 60, 48, 58, 44, 62, 52, 70],
      },
    ],
    stats: [
      { label: "Median", value: "3" },
      { label: "Most", value: "5" },
      { label: "Least", value: "1" },
    ],
  },
  {
    title: "Bring-Back Links",
    charts: [
      {
        title: "Bring-Back Links Count",
        meta: "Opposing correlation depth",
        helper: "Shows how many opposing links appear in winners.",
        footer: "Median links: 1 (mock)",
        series: [30, 42, 58, 62, 46, 56, 40, 60, 48, 66],
      },
    ],
    stats: [
      { label: "Median", value: "1" },
      { label: "Most", value: "3" },
      { label: "Least", value: "0" },
    ],
  },
  {
    title: "Slate Type",
    charts: [
      {
        title: "Slate Type Split",
        meta: "Main vs afternoon vs primetime",
        helper: "Shows how construction patterns shift by slate type.",
        footer: "Main slate dominant (mock)",
        series: [60, 46, 52, 70, 48, 58, 44, 62, 50, 66],
      },
    ],
    stats: [
      { label: "Main", value: "68%" },
      { label: "Afternoon", value: "21%" },
      { label: "Primetime", value: "11%" },
    ],
  },
];

export const classicTrendCharts = [
  {
    title: "Stack Shape by Year",
    meta: "Year-over-year QB stack mix",
    helper: "Tracks how QB stack trends evolve by season.",
    footer: "Mock data",
    series: [48, 52, 60, 58, 66, 62, 70, 68, 74, 72],
  },
  {
    title: "Bring-Back Rate by Year",
    meta: "Opposing correlation over time",
    helper: "Shows whether bring-back usage is increasing or fading.",
    footer: "Mock data",
    series: [40, 44, 48, 52, 56, 60, 62, 64, 66, 70],
  },
  {
    title: "Ownership by Year",
    meta: "Total ownership trend",
    helper: "Tracks chalkiness of winners across seasons.",
    footer: "Mock data",
    series: [55, 52, 58, 54, 60, 56, 62, 59, 65, 61],
  },
  {
    title: "Salary Left by Year",
    meta: "Median salary left trend",
    helper: "Shows whether winners are leaving more salary year-to-year.",
    footer: "Mock data",
    series: [32, 38, 44, 40, 48, 52, 56, 50, 58, 60],
  },
  {
    title: "Winner Points by Year",
    meta: "Season scoring environment",
    helper: "Highlights how scoring ceilings shift over time.",
    footer: "Mock data",
    series: [46, 50, 54, 58, 62, 66, 64, 70, 68, 72],
  },
];
