from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "IronTrack ML Service"
    api_prefix: str = "/api/v1"


settings = Settings()
