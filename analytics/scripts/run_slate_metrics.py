import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text


def pct(x):
    if x is None:
        return None
    try:
        return float(x)
    except Exception:
        return None


def first_existing(cols, candidates):
    for c in candidates:
        if c in cols:
            return c
    return None


def get_columns(conn, table_name: str):
    q = text("""
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = :t
      order by ordinal_position
    """)
    return [r[0] for r in conn.execute(q, {"t": table_name}).all()]


def main():
    slate_id = os.environ.get("SLATE_ID")
    if not slate_id:
        raise SystemExit("Missing SLATE_ID env var. Example: SLATE_ID=cmln7fepy0000qjit1agaa2cm")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("Missing DATABASE_URL env var. Use .env.local DATABASE_URL")

    engine = create_engine(database_url)

    with engine.connect() as conn:
        lineup_cols = get_columns(conn, "Lineup")
        li_cols = get_columns(conn, "LineupItem")
        player_cols = get_columns(conn, "Player") if "Player" in [
            r[0] for r in conn.execute(text("""
              select table_name from information_schema.tables
              where table_schema='public'
            """)).all()
        ] else []

        # ---- Lineup join (your schema uses winnerId) ----
        if "winnerId" in lineup_cols:
            lineup_join = 'left join "Lineup" l on l."winnerId" = w.id'
        else:
            raise SystemExit(f'Lineup join not found. Lineup columns: {lineup_cols}')

        # ---- LineupItem join to Lineup ----
        li_lineup_fk = first_existing(li_cols, ["lineupId", "lineup_id", "LineupId", "lineupID"])
        if not li_lineup_fk:
            raise SystemExit(f'LineupItem -> Lineup join not found. LineupItem columns: {li_cols}')
        lineup_item_join = f'left join "LineupItem" li on li."{li_lineup_fk}" = l.id'

        # ---- Player name source ----
        li_name_col = first_existing(li_cols, ["name", "playerName", "displayName", "fullName", "player_name"])
        li_player_fk = first_existing(li_cols, ["playerId", "player_id", "PlayerId"])

        player_join = ""
        player_name_expr = None

        if li_name_col:
            player_name_expr = f'li."{li_name_col}"'
        elif li_player_fk and player_cols:
            # join Player table
            player_join = f'left join "Player" p on p.id = li."{li_player_fk}"'
            p_name_col = first_existing(player_cols, ["name", "fullName", "displayName", "playerName"])
            if not p_name_col:
                raise SystemExit(f'Player table exists but no usable name column. Player columns: {player_cols}')
            player_name_expr = f'p."{p_name_col}"'
        else:
            raise SystemExit(
                "Could not find player name. "
                f"LineupItem columns: {li_cols}. "
                + (f"Player columns: {player_cols}." if player_cols else "No Player table detected.")
            )

        # ---- Position, team, salary, points, ownership ----
        li_pos_col = first_existing(li_cols, ["position", "pos"])
        li_team_col = first_existing(li_cols, ["team", "teamAbbreviation", "teamAbbr"])
        li_salary_col = first_existing(li_cols, ["salary"])
        li_points_col = first_existing(li_cols, ["points", "fantasyPoints", "fpts"])
        li_own_col = first_existing(li_cols, ["ownershipPercent", "ownershipPct", "ownPct", "ownership"])

        roster_spot_col = first_existing(li_cols, ["rosterSpot", "roster_slot", "slot"])
        if not roster_spot_col:
            raise SystemExit(f'No roster spot column found in LineupItem. Columns: {li_cols}')

        # If some of these don’t exist, we still run, we just output nulls
        pos_expr = f'li."{li_pos_col}"' if li_pos_col else "null"
        team_expr = f'li."{li_team_col}"' if li_team_col else "null"
        salary_expr = f'li."{li_salary_col}"' if li_salary_col else "null"
        points_expr = f'li."{li_points_col}"' if li_points_col else "null"
        own_expr = f'li."{li_own_col}"' if li_own_col else "null"

        sql = f"""
            select
              s.id as slate_id,
              s."slateKey" as slate_key,
              s."slateType" as slate_type,
              s."slateDate" as slate_date,

              c."siteContestId" as site_contest_id,

              w.id as winner_id,
              w."username" as winner_username,
              w."points" as winner_points,
              w."maxEntries" as winner_max_entries,

              l."lineupType" as lineup_type,
              l."salaryUsed" as salary_used,
              l."totalPoints" as lineup_points,
              l."totalOwnershipBp" as lineup_total_ownership_bp,

              li."{roster_spot_col}" as roster_spot,
              {player_name_expr} as player_name,
              {pos_expr} as position,
              {team_expr} as team,
              {salary_expr} as salary,
              {points_expr} as points,
              {own_expr} as ownership_percent
            from "Slate" s
            left join "Contest" c on c."slateId" = s.id
            left join "Winner" w on w."contestId" = c.id
            {lineup_join}
            {lineup_item_join}
            {player_join}
            where s.id = :slate_id
            order by
              case when li."{roster_spot_col}" = 'CAPTAIN' then 0 else 1 end,
              li.id asc
        """

        rows = conn.execute(text(sql), {"slate_id": slate_id}).mappings().all()

    if not rows:
        raise SystemExit(f"No rows returned for slate id {slate_id}. Check id exists.")

    head = rows[0]

    items = []
    for r in rows:
        if r["player_name"] is None:
            continue
        items.append({
            "rosterSpot": r["roster_spot"],
            "name": r["player_name"],
            "position": r.get("position"),
            "team": r.get("team"),
            "salary": int(r["salary"]) if r.get("salary") is not None else None,
            "points": float(r["points"]) if r.get("points") is not None else None,
            "ownershipPercent": pct(r.get("ownership_percent")),
        })

    salary_used = head.get("salary_used")
    salary_left = 50000 - int(salary_used) if salary_used is not None else None

    lineup_total_ownership_bp = head.get("lineup_total_ownership_bp")
    total_ownership_pct = (float(lineup_total_ownership_bp) / 100.0) if lineup_total_ownership_bp is not None else None

    captain = next((x for x in items if x["rosterSpot"] == "CAPTAIN"), None)

    archetype = None
    if captain:
        pos = captain.get("position")
        if pos == "DST":
            archetype = "DST captain"
        elif pos == "QB":
            archetype = "QB captain"
        elif pos in ("WR", "TE"):
            archetype = "pass catcher captain"
        elif pos == "RB":
            archetype = "RB captain"

    out = {
        "slateId": head["slate_id"],
        "siteContestId": head.get("site_contest_id"),
        "slateKey": head.get("slate_key"),
        "slateType": head.get("slate_type"),
        "slateDate": (head["slate_date"].isoformat() if hasattr(head.get("slate_date"), "isoformat") else str(head.get("slate_date"))),
        "winner": {
            "id": head.get("winner_id"),
            "username": head.get("winner_username"),
            "points": float(head["winner_points"]) if head.get("winner_points") is not None else None,
            "maxEntries": head.get("winner_max_entries"),
        },
        "lineup": {
            "lineupType": head.get("lineup_type"),
            "salaryUsed": int(salary_used) if salary_used is not None else None,
            "salaryLeft": salary_left,
            "totalPoints": float(head["lineup_points"]) if head.get("lineup_points") is not None else None,
            "totalOwnershipPct": total_ownership_pct,
            "captain": captain,
            "items": items
        },
        "tags": {
            "archetype": archetype
        },
        "generatedAt": datetime.utcnow().isoformat() + "Z"
    }

    out_path = f"public/analytics/slates/{slate_id}.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"WROTE {out_path}")


if __name__ == "__main__":
    main()
