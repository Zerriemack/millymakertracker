from collections import defaultdict

from pydfs_lineup_optimizer import Player, Site, Sport, TeamStack, get_optimizer
from pydfs_lineup_optimizer.exceptions import GenerateLineupException

from app.schemas import OptimizeRequest


def _build_player_lookup(players):
    return {player.id: player for player in players}


def _apply_locked_and_excluded_players(optimizer, request, lookup):
    for player_id in request.locked_player_ids:
        player_data = lookup.get(player_id)
        if not player_data:
            continue
        player = next((p for p in optimizer.player_pool.players if p.id == player_id), None)
        if player:
            optimizer.player_pool.lock_player(player)

    for player_id in request.excluded_player_ids:
        player_data = lookup.get(player_id)
        if not player_data:
            continue
        player = next((p for p in optimizer.player_pool.players if p.id == player_id), None)
        if player:
            optimizer.player_pool.remove_player(player)


def _apply_team_limit(optimizer, request):
    if request.team_limit is not None:
        optimizer.set_players_from_one_team({"BUF": request.team_limit})


def _apply_stacks(optimizer, request):
    for stack in request.stacks:
        if stack.team and stack.count > 0:
            optimizer.add_stack(TeamStack(stack.count, for_teams=[stack.team]))


def _build_exposures(lineups):
    exposure_counts = defaultdict(int)
    total_lineups = len(lineups)

    for lineup in lineups:
        for player in lineup.players:
            exposure_counts[player.full_name] += 1

    exposures = []
    for player_name, count in sorted(exposure_counts.items(), key=lambda x: (-x[1], x[0])):
        exposures.append(
            {
                "name": player_name,
                "lineups": count,
                "exposure": round((count / total_lineups) * 100, 2) if total_lineups else 0,
            }
        )

    return exposures


def build_optimizer_response(request: OptimizeRequest):
    optimizer = get_optimizer(Site.DRAFTKINGS, Sport.FOOTBALL)

    player_pool = []
    for p in request.players:
        player = Player(
            player_id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            positions=p.positions,
            team=p.team,
            salary=p.salary,
            fppg=p.fppg,
            game_info=None,
        )
        player_pool.append(player)

    optimizer.player_pool.extend_players(player_pool)

    if request.min_salary is not None:
        optimizer.set_min_salary_cap(request.min_salary)

    if request.max_salary is not None:
        optimizer.set_max_salary_cap(request.max_salary)

    if request.max_repeating_players is not None:
        optimizer.set_max_repeating_players(request.max_repeating_players)

    if request.randomness is not None and hasattr(optimizer, "set_randomness"):
        optimizer.set_randomness(request.randomness)
    elif hasattr(optimizer, "set_randomness"):
        optimizer.set_randomness(0)

    lookup = _build_player_lookup(request.players)
    _apply_locked_and_excluded_players(optimizer, request, lookup)
    _apply_stacks(optimizer, request)

    try:
        generated_lineups = list(optimizer.optimize(n=request.lineup_count))
    except GenerateLineupException as exc:
        raise GenerateLineupException(str(exc))

    if not generated_lineups:
        raise GenerateLineupException("No valid lineups could be generated.")

    return {
        "settings": {
            "lineup_count": request.lineup_count,
            "min_salary": request.min_salary,
            "max_salary": request.max_salary,
            "max_repeating_players": request.max_repeating_players,
            "locked_player_ids": request.locked_player_ids,
            "excluded_player_ids": request.excluded_player_ids,
            "team_limit": request.team_limit,
            "randomness": request.randomness,
            "stacks": [stack.model_dump() for stack in request.stacks],
        },
        "lineup_count_requested": request.lineup_count,
        "lineup_count_returned": len(generated_lineups),
        "lineups": [
            {
                "players": [
                    {
                        "id": player.id,
                        "name": player.full_name,
                        "team": player.team,
                        "positions": list(player.positions),
                        "salary": player.salary,
                        "fppg": player.fppg,
                    }
                    for player in lineup.players
                ],
                "salary_costs": lineup.salary_costs,
                "fantasy_points_projection": lineup.fantasy_points_projection,
            }
            for lineup in generated_lineups
        ],
        "exposures": _build_exposures(generated_lineups),
    }
