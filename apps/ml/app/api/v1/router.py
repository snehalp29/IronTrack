from fastapi import APIRouter

from app.models.schemas import (
    NextLoadRequest,
    NextLoadResponse,
    PainPatternRequest,
    PainPatternResponse,
    RestTimeRequest,
    RestTimeResponse,
    SessionRecommenderRequest,
    SessionRecommenderResponse,
)
from app.services.next_load import NextLoadService
from app.services.pain_pattern import PainPatternService
from app.services.rest_time import RestTimeService
from app.services.session_recommender import SessionRecommenderService

router = APIRouter()


@router.post("/next-load", response_model=NextLoadResponse)
def next_load(payload: NextLoadRequest) -> NextLoadResponse:
    return NextLoadService.recommend(payload)


@router.post("/rest-time", response_model=RestTimeResponse)
def rest_time(payload: RestTimeRequest) -> RestTimeResponse:
    return RestTimeService.recommend(payload)


@router.post("/pain-pattern", response_model=PainPatternResponse)
def pain_pattern(payload: PainPatternRequest) -> PainPatternResponse:
    return PainPatternService.detect(payload)


@router.post("/session-recommender", response_model=SessionRecommenderResponse)
def session_recommender(payload: SessionRecommenderRequest) -> SessionRecommenderResponse:
    return SessionRecommenderService.recommend(payload)
