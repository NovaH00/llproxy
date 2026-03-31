"""Logging schema models for llproxy."""

from typing import ClassVar
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from .openai import ChatCompletionRequest, ChatCompletionResponse


class LogEntry(BaseModel):
    """A logged request/response cycle.

    Stores complete information about a proxied request including
    the original request, the upstream response, and timing metadata.
    """

    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: int = 0
    created_at: datetime | None = None
    path: str = ""
    method: str = ""
    provider: str | None = None
    model: str | None = None

    request_headers: dict[str, str] | None = None
    request_body_raw: str | None = None
    request_body: ChatCompletionRequest | None = None

    response_status: int | None = None
    response_headers: dict[str, str] | None = None
    response_body_raw: str | None = None
    response_body: ChatCompletionResponse | None = None

    is_stream: bool = False
    chunk_count: int = 0

    latency_ms: int | None = None
    total_duration_ms: int | None = None

    error_message: str | None = None


class LogStats(BaseModel):
    """Dashboard statistics for logged requests."""

    total_requests: int
    streaming_requests: int
    non_streaming_requests: int
    avg_latency_ms: float | None = None
