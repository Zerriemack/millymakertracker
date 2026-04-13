import itertools

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def build_players():
    return [
        {"id": "qb1", "first_name": "Josh", "last_name": "Allen", "positions": ["QB"], "team": "BUF", "salary": 7800, "fppg": 24.5},
        {"id": "qb2", "first_name": "Jalen", "last_name": "Hurts", "positions": ["QB"], "team": "PHI", "salary": 7600, "fppg": 23.8},
        {"id": "qb3", "first_name": "Joe", "last_name": "Burrow", "positions": ["QB"], "team": "CIN", "salary": 7300, "fppg": 22.1},
        {"id": "rb1", "first_name": "Christian", "last_name": "McCaffrey", "positions": ["RB"], "team": "SF", "salary": 8800, "fppg": 25.2},
        {"id": "rb2", "first_name": "Breece", "last_name": "Hall", "positions": ["RB"], "team": "NYJ", "salary": 5900, "fppg": 17.8},
        {"id": "rb3", "first_name": "James", "last_name": "Cook", "positions": ["RB"], "team": "BUF", "salary": 6200, "fppg": 15.4},
        {"id": "rb4", "first_name": "Najee", "last_name": "Harris", "positions": ["RB"], "team": "PIT", "salary": 5600, "fppg": 13.1},
        {"id": "rb5", "first_name": "Devin", "last_name": "Singletary", "positions": ["RB"], "team": "HOU", "salary": 5100, "fppg": 12.2},
        {"id": "wr1", "first_name": "Stefon", "last_name": "Diggs", "positions": ["WR"], "team": "BUF", "salary": 7200, "fppg": 19.6},
        {"id": "wr2", "first_name": "Amon-Ra", "last_name": "St. Brown", "positions": ["WR"], "team": "DET", "salary": 7100, "fppg": 18.9},
        {"id": "wr3", "first_name": "Puka", "last_name": "Nacua", "positions": ["WR"], "team": "LAR", "salary": 5800, "fppg": 18.1},
        {"id": "wr4", "first_name": "Jaylen", "last_name": "Waddle", "positions": ["WR"], "team": "MIA", "salary": 6100, "fppg": 16.9},
        {"id": "wr5", "first_name": "Tank", "last_name": "Dell", "positions": ["WR"], "team": "HOU", "salary": 4700, "fppg": 12.8},
        {"id": "wr6", "first_name": "Zay", "last_name": "Flowers", "positions": ["WR"], "team": "BAL", "salary": 5200, "fppg": 14.2},
        {"id": "wr7", "first_name": "Chris", "last_name": "Olave", "positions": ["WR"], "team": "NO", "salary": 6000, "fppg": 15.8},
        {"id": "te1", "first_name": "George", "last_name": "Kittle", "positions": ["TE"], "team": "SF", "salary": 5200, "fppg": 14.3},
        {"id": "te2", "first_name": "Dalton", "last_name": "Kincaid", "positions": ["TE"], "team": "BUF", "salary": 3900, "fppg": 10.1},
        {"id": "te3", "first_name": "Kyle", "last_name": "Pitts", "positions": ["TE"], "team": "ATL", "salary": 4700, "fppg": 11.4},
        {"id": "dst1", "first_name": "Bills", "last_name": "DST", "positions": ["DST"], "team": "BUF", "salary": 2900, "fppg": 8.2},
        {"id": "dst2", "first_name": "Jets", "last_name": "DST", "positions": ["DST"], "team": "NYJ", "salary": 2500, "fppg": 7.4},
        {"id": "dst3", "first_name": "Eagles", "last_name": "DST", "positions": ["DST"], "team": "PHI", "salary": 2600, "fppg": 7.9},
    ]


def build_payload(overrides=None):
    payload = {
        "players": build_players(),
        "lineup_count": 2,
        "min_salary": 49000,
        "max_salary": 50000,
        "max_repeating_players": 6,
        "locked_player_ids": [],
        "excluded_player_ids": [],
        "team_limit": None,
        "randomness": None,
        "stacks": [],
    }
    if overrides:
        payload.update(overrides)
    return payload


def extract_positions(lineup):
    players = lineup.get("players", [])
    positions = []
    for player in players:
        pos = player.get("positions")
        if isinstance(pos, list) and pos:
            positions.append(pos[0])
        else:
            positions.append(player.get("position") or player.get("pos"))
    return positions


def test_valid_payload_returns_lineups():
    response = client.post("/optimize", json=build_payload())
    assert response.status_code == 200
    data = response.json()

    assert data["lineup_count_returned"] == 2
    assert len(data["lineups"]) == 2

    for lineup in data["lineups"]:
        players = lineup.get("players", [])
        assert len(players) == 9

        total_salary = sum(player["salary"] for player in players)
        assert total_salary <= 50000
        assert total_salary >= 49000

        positions = extract_positions(lineup)
        assert positions.count("QB") == 1
        assert positions.count("RB") >= 2
        assert positions.count("WR") >= 3
        assert positions.count("TE") >= 1
        assert positions.count("DST") == 1


def test_max_repeating_players_respected():
    response = client.post("/optimize", json=build_payload())
    assert response.status_code == 200
    data = response.json()

    lineups = data["lineups"]
    ids_by_lineup = [set(player["id"] for player in lineup["players"]) for lineup in lineups]

    for left, right in itertools.combinations(ids_by_lineup, 2):
        overlap = len(left & right)
        assert overlap <= 6


def test_invalid_payload_returns_400():
    response = client.post("/optimize", json={"players": []})
    assert response.status_code == 400

    response = client.post("/optimize", json=build_payload({"lineup_count": 0}))
    assert response.status_code == 400


def test_infeasible_payload_returns_400():
    response = client.post("/optimize", json=build_payload({"max_salary": 10000}))
    assert response.status_code == 400
