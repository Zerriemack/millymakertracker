from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PlayerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    first_name: str
    last_name: str
    positions: List[str] = Field(min_length=1)
    team: str
    salary: int = Field(ge=0)
    fppg: float = Field(ge=0)

    @field_validator("id", "first_name", "last_name", "team")
    @classmethod
    def _validate_required_strings(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("must be a non-empty string")
        return value

    @field_validator("positions")
    @classmethod
    def _validate_positions(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("positions must contain at least one entry")
        cleaned = [pos.strip() for pos in value if isinstance(pos, str)]
        if not cleaned or any(not pos for pos in cleaned):
            raise ValueError("positions must be non-empty strings")
        return cleaned


class StackRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team: Optional[str] = None
    positions: List[str] = Field(default_factory=list)
    count: int = Field(ge=0)


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    players: List[PlayerInput] = Field(min_length=1)

    lineup_count: int = Field(default=1, ge=1)
    min_salary: Optional[int] = Field(default=None, ge=0)
    max_salary: Optional[int] = Field(default=None, ge=0)
    max_repeating_players: Optional[int] = Field(default=None, ge=0)

    locked_player_ids: List[str] = Field(default_factory=list)
    excluded_player_ids: List[str] = Field(default_factory=list)

    team_limit: Optional[int] = Field(default=None, ge=0)
    randomness: Optional[float] = Field(default=None, ge=0)

    stacks: List[StackRule] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_request(self):
        player_ids = {player.id for player in self.players}
        if len(player_ids) != len(self.players):
            raise ValueError("player ids must be unique")

        if self.min_salary is not None and self.max_salary is not None:
            if self.min_salary > self.max_salary:
                raise ValueError("min_salary cannot be greater than max_salary")

        locked = set(self.locked_player_ids)
        excluded = set(self.excluded_player_ids)
        if locked & excluded:
            raise ValueError("locked_player_ids and excluded_player_ids cannot overlap")

        missing_locked = locked - player_ids
        missing_excluded = excluded - player_ids
        if missing_locked or missing_excluded:
            missing = sorted(missing_locked | missing_excluded)
            raise ValueError(f"locked/excluded player ids not found: {missing}")

        return self
