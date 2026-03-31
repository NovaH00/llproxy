"""Settings schema for llproxy."""

from pydantic import BaseModel


class Settings(BaseModel):
    """Proxy settings configuration."""

    upstream_url: str | None
    tracing_paths: list[str] = ["/v1/chat/completions"]
