import nfl_data_py as nfl

YEAR = 2022

def main():
    weekly = nfl.import_weekly_data([YEAR])
    out = f"data/stats/nfl/{YEAR}/weekly_player_raw.parquet"
    weekly.to_parquet(out, index=False)
    print(out)
    print("rows", len(weekly))
    print("cols", len(weekly.columns))

if __name__ == "__main__":
    main()