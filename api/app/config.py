from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+psycopg://gg:gg@127.0.0.1:5433/gg"

    # Until real sign-in lands (Phase 6) the admin API only runs in dev mode,
    # and every write is attributed to this Owner account.
    admin_dev_mode: bool = False
    dev_admin_email: str = "owner@localhost"

    # Comma-separated list of origins allowed to call the API from a browser
    cors_origins: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}

    @property
    def admin_enabled(self) -> bool:
        return self.admin_dev_mode and not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
