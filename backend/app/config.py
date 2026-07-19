from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Starter API"
    environment: str = "development"
    port: int = 8000

    class Config:
        env_file = ".env"
