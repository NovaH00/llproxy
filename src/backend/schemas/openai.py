"""OpenAI API schema models for llproxy.

Lightweight schemas for tracing passthrough requests/responses.
Only essential fields are defined - extra fields are captured via model_config.
"""
from typing import ClassVar, Literal
from pydantic import BaseModel, ConfigDict


# >>>> New implementation
class ChatContentText(BaseModel):
    type: Literal["text"] = "text"
    text: str

class ChatContentImage(BaseModel):
    type: Literal["input_image"] = "input_image"
    image_url: str 

class Audio(BaseModel):
    data: str
    format: str

class ChatContentAudio(BaseModel):
    type: Literal["input_audio"] = "input_audio"
    input_audio: Audio 

type ChatContentType = ChatContentText | ChatContentImage | ChatContentAudio

# <<<<

class ChatMessage(BaseModel):
    """A message in a chat conversation."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    role: str
    content: str | list | None = None # TODO: Implement the type for the list


class ChatCompletionRequest(BaseModel):
    """Request body for chat completions endpoint."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    model: str
    messages: list[ChatMessage]
    stream: bool = False


class ChatChoice(BaseModel):
    """A choice from a chat completion response."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    index: int
    message: ChatMessage
    finish_reason: str | None = None


class UsageInfo(BaseModel):
    """Token usage information."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    prompt_tokens: int
    completion_tokens: int | None = None
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """Response body for chat completions endpoint."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    id: str
    model: str
    choices: list[ChatChoice]
    usage: UsageInfo | None = None


class StreamChoiceDelta(BaseModel):
    """Delta content in streaming response."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    role: str | None = None
    content: str | None = None


class StreamChoice(BaseModel):
    """A choice in a streaming response."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    index: int
    delta: StreamChoiceDelta
    finish_reason: str | None = None


class ChatCompletionChunk(BaseModel):
    """Streaming response chunk."""

    model_config: ClassVar[ConfigDict] = ConfigDict(extra="allow")

    id: str
    model: str
    choices: list[StreamChoice]
    usage: UsageInfo | None = None
