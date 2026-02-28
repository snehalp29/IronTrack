from app.models.schemas import RestTimeRequest, RestTimeResponse


class RestTimeService:
    @staticmethod
    def recommend(payload: RestTimeRequest) -> RestTimeResponse:
        if payload.is_superset:
            return RestTimeResponse(
                recommended_rest_seconds=30,
                reason="Superset pacing",
            )

        compound_types = {"WEIGHT_REPS", "BODYWEIGHT_PLUS_WEIGHT"}
        if payload.exercise_type in compound_types and payload.is_heavy:
            return RestTimeResponse(
                recommended_rest_seconds=240,
                reason="Heavy compound movement",
            )

        if payload.exercise_type in compound_types:
            return RestTimeResponse(
                recommended_rest_seconds=180,
                reason="Compound movement",
            )

        return RestTimeResponse(
            recommended_rest_seconds=75,
            reason="Isolation or accessory movement",
        )
