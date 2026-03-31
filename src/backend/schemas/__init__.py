"""Shared schemas for llproxy."""

from .settings import Settings
from .logs import LogEntry, LogStats
from .openai import (
    ChatMessage,
    ChatCompletionRequest,
    ChatChoice,
    UsageInfo,
    ChatCompletionResponse,
    StreamChoiceDelta,
    StreamChoice,
    ChatCompletionChunk,
)

__all__ = [
    # Settings
    "Settings",
    # Logs
    "LogEntry",
    "LogStats",
    # OpenAI request
    "ChatMessage",
    "ChatCompletionRequest",
    # OpenAI response
    "ChatChoice",
    "UsageInfo",
    "ChatCompletionResponse",
    # OpenAI streaming
    "StreamChoiceDelta",
    "StreamChoice",
    "ChatCompletionChunk",
]
