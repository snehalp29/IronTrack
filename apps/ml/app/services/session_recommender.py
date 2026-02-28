from app.models.schemas import SessionRecommenderRequest, SessionRecommenderResponse


class SessionRecommenderService:
    @staticmethod
    def recommend(payload: SessionRecommenderRequest) -> SessionRecommenderResponse:
        if not payload.templates:
            return SessionRecommenderResponse(
                recommended_template_id=None,
                recommended_template_name=None,
                reason="No templates available",
            )

        underworked = set(item.lower() for item in payload.underworked_muscle_groups)

        best_score = -1
        best_template = None
        for template in payload.templates:
            muscles = set(item.lower() for item in template.get("muscles", []))
            score = len(underworked.intersection(muscles))
            if score > best_score:
                best_score = score
                best_template = template

        if not best_template:
            return SessionRecommenderResponse(
                reason="No matching template found",
            )

        return SessionRecommenderResponse(
            recommended_template_id=best_template.get("id"),
            recommended_template_name=best_template.get("name"),
            reason="Template best covers underworked muscle groups",
        )
