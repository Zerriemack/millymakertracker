import pandas as pd

YEAR = 2022
RAW_PATH = f"data/stats/nfl/{YEAR}/weekly_player_raw.parquet"
OUT_PARQUET = f"data/stats/nfl/{YEAR}/weekly_player_normalized.parquet"
OUT_CSV = f"data/stats/nfl/{YEAR}/weekly_player_normalized.csv"

def pick(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None

def require(df, name, candidates):
    c = pick(df, candidates)
    if c is None:
        raise RuntimeError(f"Missing column for {name}. Tried: {candidates}")
    return c

def main():
    df = pd.read_parquet(RAW_PATH)

    col_player_id = require(df, "playerId", ["player_id", "gsis_id"])
    col_name = require(df, "playerName", ["player_name", "player_display_name", "name"])
    col_team = require(df, "team", ["recent_team", "team"])
    col_pos = require(df, "position", ["position", "pos"])
    col_week = require(df, "week", ["week"])
    col_season = require(df, "season", ["season"])

    col_pass_yds = pick(df, ["passing_yards", "pass_yards"])
    col_pass_tds = pick(df, ["passing_tds", "pass_tds"])
    col_rush_yds = pick(df, ["rushing_yards", "rush_yards"])
    col_rush_tds = pick(df, ["rushing_tds", "rush_tds"])
    col_rec = pick(df, ["receptions", "rec"])
    col_rec_yds = pick(df, ["receiving_yards", "rec_yards"])
    col_rec_tds = pick(df, ["receiving_tds", "rec_tds"])
    col_fumbles_lost = pick(df, ["fumbles_lost"])

    out = pd.DataFrame({
        "season": df[col_season].astype(int),
        "week": df[col_week].astype(int),
        "playerId": df[col_player_id].astype(str),
        "playerName": df[col_name].astype(str),
        "team": df[col_team].astype(str),
        "position": df[col_pos].astype(str),

        "passYds": df[col_pass_yds].fillna(0).astype(int) if col_pass_yds else 0,
        "passTd": df[col_pass_tds].fillna(0).astype(int) if col_pass_tds else 0,
        "rushYds": df[col_rush_yds].fillna(0).astype(int) if col_rush_yds else 0,
        "rushTd": df[col_rush_tds].fillna(0).astype(int) if col_rush_tds else 0,
        "rec": df[col_rec].fillna(0).astype(int) if col_rec else 0,
        "recYds": df[col_rec_yds].fillna(0).astype(int) if col_rec_yds else 0,
        "recTd": df[col_rec_tds].fillna(0).astype(int) if col_rec_tds else 0,
        "fumblesLost": df[col_fumbles_lost].fillna(0).astype(int) if col_fumbles_lost else 0,
    })

    out.to_parquet(OUT_PARQUET, index=False)
    out.to_csv(OUT_CSV, index=False)

    print("wrote", OUT_PARQUET)
    print("wrote", OUT_CSV)
    print("rows", len(out))
    print("cols", list(out.columns))

if __name__ == "__main__":
    main()