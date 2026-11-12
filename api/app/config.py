from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+psycopg://gg:gg@127.0.0.1:5433/gg"

    # Shared secret between the website server and this API. Required for the OAuth
    # sign-in endpoint (the website vouches for the GitHub/Google identity).
    internal_api_secret: str = ""

    # Public URL of the website, used for links in emails
    app_url: str = "http://localhost:3000"
    site_name: str = "Gradient Garage"

    # Outgoing email over SMTP (works with Resend, Postmark, Brevo, Mailgun, Gmail…).
    # When SMTP_HOST is empty, emails are written to OUTBOX_DIR as .eml files instead.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # "starttls" (port 587), "ssl" (port 465) or "none"
    smtp_security: str = "starttls"
    email_from: str = "Gradient Garage <no-reply@localhost>"
    outbox_dir: str = "outbox"

    # Public sign-up
    allow_signup: bool = True
    verify_hours: int = 48
    # Verification / reset emails per address per hour
    email_hourly_limit: int = 3

    session_days: int = 30
    invite_days: int = 7
    reset_hours: int = 24
    min_password_length: int = 10
    # Failed password attempts allowed per email (and per IP) in the window
    login_max_failures: int = 5
    login_window_minutes: int = 15

    # Uploaded images are stored here and served at /media/<key>
    media_dir: str = "media"
    max_upload_mb: int = 10

    # Sync job. HF_USERNAME is the default account(s) to import from (comma-separated
    # users/orgs) until an Owner saves sync settings in the admin panel.
    hf_username: str = ""
    # Optional tokens: private items / higher rate limits. Never sent to the browser.
    hf_token: str = ""
    github_token: str = ""
    sync_timeout_seconds: float = 20.0

    # Comma-separated list of origins allowed to call the API from a browser
    cors_origins: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}



@lru_cache
def get_settings() -> Settings:
    return Settings()
