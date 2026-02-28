from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_next_load_rule() -> None:
    payload = {
        "target_reps": 10,
        "sets": [
            {"reps": 10, "weight": 80, "rpe": 7.5},
            {"reps": 10, "weight": 80, "rpe": 7.8},
            {"reps": 11, "weight": 80, "rpe": 7.2},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/next-load", json=payload)

    assert response.status_code == 200
    assert response.json()["recommended_delta_kg"] == 2.5
