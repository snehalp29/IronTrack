from typing import List, Optional

from pydantic import BaseModel, Field


class SetPerformance(BaseModel):
    reps: Optional[int] = None
    weight: Optional[float] = None
    rpe: Optional[float] = None


class NextLoadRequest(BaseModel):
    target_reps: int = Field(gt=0)
    sets: List[SetPerformance]


class NextLoadResponse(BaseModel):
    recommended_delta_kg: float
    reason: str


class RestTimeRequest(BaseModel):
    exercise_type: str
    is_heavy: bool = False
    is_superset: bool = False


class RestTimeResponse(BaseModel):
    recommended_rest_seconds: int
    reason: str


class PainPatternRequest(BaseModel):
    recent_sessions_rpe10_count: int = 0
    dramatic_weight_drop_percent: float = 0


class PainPatternResponse(BaseModel):
    flagged: bool
    reason: str


class SessionRecommenderRequest(BaseModel):
    underworked_muscle_groups: List[str]
    templates: List[dict]


class SessionRecommenderResponse(BaseModel):
    recommended_template_id: Optional[str] = None
    recommended_template_name: Optional[str] = None
    reason: str
