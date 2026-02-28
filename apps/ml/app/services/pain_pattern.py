from app.models.schemas import PainPatternRequest, PainPatternResponse


class PainPatternService:
    @staticmethod
    def detect(payload: PainPatternRequest) -> PainPatternResponse:
        flagged = payload.recent_sessions_rpe10_count >= 3 or payload.dramatic_weight_drop_percent >= 20

        if flagged:
            return PainPatternResponse(
                flagged=True,
                reason="Repeated RPE 10 sessions or dramatic load drop detected",
            )

        return PainPatternResponse(
            flagged=False,
            reason="No concerning pain pattern detected",
        )
