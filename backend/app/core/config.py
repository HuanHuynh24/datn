from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import EmailStr, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    mysql_host: str = Field(default="mysql", min_length=1)
    mysql_port: int = Field(default=3306, ge=1, le=65535)
    mysql_database: str = Field(default="recruitment_db", min_length=1)
    mysql_user: str = Field(default="recruitment_app", min_length=1)
    mysql_password: SecretStr = Field(min_length=16)
    swagger_enabled: bool = True
    cors_origins: str = ""
    cv_storage_dir: Path = Path("/data/cv")
    image_storage_dir: Path = Path("/data/cv/images")
    public_api_url: str = "http://localhost:8000"
    jwt_secret: SecretStr | None = None
    jwt_issuer: str = Field(default="recruitment-api", min_length=1)
    jwt_audience: str = Field(default="recruitment-web", min_length=1)
    frontend_url: str = "http://localhost:3000"
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_security: Literal["starttls", "ssl"] = "starttls"
    smtp_username: str = Field(default="", repr=False)
    smtp_password: SecretStr | None = Field(default=None, repr=False)
    smtp_from_email: EmailStr | None = None

    @field_validator("smtp_password", "smtp_from_email", mode="before")
    @classmethod
    def blank_optional_smtp(cls, value):
        return None if value == "" else value

    @field_validator("public_api_url", "frontend_url")
    @classmethod
    def validate_public_api_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in {"", "/"}
        ):
            raise ValueError("Public API URL must be an HTTP(S) origin")
        return value.rstrip("/")

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            raw = value.get_secret_value()
            if len(raw.encode("utf-8")) < 32 or raw.startswith("CHANGE_ME"):
                raise ValueError(
                    "JWT secret must be independently generated with at least 32 bytes"
                )
        return value

    @field_validator("mysql_password")
    @classmethod
    def reject_placeholder(cls, value: SecretStr) -> SecretStr:
        if value.get_secret_value().startswith("CHANGE_ME"):
            raise ValueError("Generate a local database password before starting the API")
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, value: str) -> str:
        for origin in (item.strip() for item in value.split(",") if item.strip()):
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
            ):
                raise ValueError("CORS origins must be explicit HTTP(S) origins without paths")
            # Accessing port also rejects malformed port values.
            _ = parsed.port
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
