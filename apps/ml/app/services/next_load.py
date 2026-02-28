from app.models.schemas import NextLoadRequest, NextLoadResponse


class NextLoadService:
    @staticmethod
    def recommend(payload: NextLoadRequest) -> NextLoadResponse:
        if len(payload.sets) < 3:
            return NextLoadResponse(
                recommended_delta_kg=0,
                reason="Need at least 3 sets for confidence",
            )

        last_three = payload.sets[-3:]
        all_hit_target = all((item.reps or 0) >= payload.target_reps for item in last_three)
        all_low_rpe = all((item.rpe or 10) < 8 for item in last_three)

        if all_hit_target and all_low_rpe:
            return NextLoadResponse(
                recommended_delta_kg=2.5,
                reason="Last 3 sets hit target reps with RPE < 8",
            )

        return NextLoadResponse(
            recommended_delta_kg=0,
            reason="Hold load until consistency criteria are met",
        )
