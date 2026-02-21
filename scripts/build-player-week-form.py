import json
import sys
from datetime import datetime
import pandas as pd

SOURCE = "https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.parquet"

def die(msg: str):
    print(msg, file=sys.stderr)
    sys.exit(1)

def pick_col(df, options):
    for c in options:
        if c in df.columns:
            return c
    return ""

def main():
    if len(sys.argv) < 3:
        die("Usage: python scripts/build-player-week-form.py <seasonYear> <outPath>")

    season_year = int(sys.argv[1])
    out_path = sys.argv[2]

    df = pd.read_parquet(SOURCE)

    # Validate minimum schema
    for c in ["season", "week", "season_type", "player_id"]:
        if c not in df.columns:
            die(f"Unexpected schema in player_stats.parquet. Missing {c}.")

    # Choose team/opponent/position columns flexibly
    team_col = pick_col(df, ["team", "posteam", "recent_team"])
    opp_col = pick_col(df, ["opponent_team", "defteam", "opp_team", "opponent"])
    pos_col = pick_col(df, ["position", "pos"])

    if not team_col:
        die("Missing team column (expected one of: team, posteam, recent_team).")
    if not opp_col:
        die("Missing opponent column (expected one of: opponent_team, defteam, opp_team, opponent).")
    if not pos_col:
        die("Missing position column (expected one of: position, pos).")

    # Filter regular season, weeks 1-18, single season
    df = df[(df["season"] == season_year) & (df["season_type"] == "REG") & (df["week"].between(1, 18))].copy()

    rows = []
    built_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    # Columns we store as top-level (the rest goes into metrics)
    skip_cols = set(["season", "season_type", "player_id", "week", team_col, opp_col, pos_col])

    for _, r in df.iterrows():
        metrics = {}
        for col in df.columns:
            if col in skip_cols:
                continue
            v = r[col]
            if pd.isna(v):
                continue
            if hasattr(v, "item"):
                v = v.item()
            metrics[col] = v

        rows.append({
            "sport": "NFL",
            "seasonYear": season_year,
            "week": int(r["week"]),
            "playerGsisId": str(r["player_id"]),
            "team": str(r[team_col]),
            "opponentTeam": str(r[opp_col]),
            "position": str(r[pos_col]),
            "metrics": metrics,
            "source": "nflverse.player_stats",
            "builtAtUtc": built_at
        })

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)

    print(json.dumps({"ok": True, "seasonYear": season_year, "rows": len(rows), "outPath": out_path}, indent=2))

if __name__ == "__main__":
    main()
