from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Starter API"
    environment: str = "development"
    port: int = 8000

    model_config = SettingsConfigDict(env_file=".env")
