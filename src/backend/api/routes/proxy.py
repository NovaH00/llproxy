import json
import time
import logging
from collections.abc import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, Request, Response
from starlette.responses import StreamingResponse

from ...database import DBManager
from ...dependencies.database import get_db_manager
from ...dependencies.logging import get_logging_service
from ...schemas.logs import LogEntry
from ...schemas.openai import ChatCompletionRequest, ChatCompletionResponse
from ...services.logging_service import LoggingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proxy")

async def stream_and_log(
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes,
    params: dict[str, str],
    log_entry: LogEntry,
    logging_service: LoggingService,
) -> AsyncGenerator[bytes, None]:
    """Stream from upstream and log the response."""
    start_time = time.time()
    chunks: list[bytes] = []
    chunk_count = 0
    status_code = 0
    response_headers: dict[str, str] = {}
    first_chunk_time: float | None = None

    async with httpx.AsyncClient(timeout=None) as client:
        try:
            # Use send() with stream=True for proper async streaming
            upstream_response = await client.send(
                client.build_request(
                    method=method,
                    url=url,
                    headers=headers,
                    content=body,
                    params=params,
                ),
                stream=True,
            )

            status_code = upstream_response.status_code
            response_headers = dict(upstream_response.headers)

            async for chunk in upstream_response.aiter_bytes():
                if first_chunk_time is None:
                    first_chunk_time = time.time()
                chunks.append(chunk)
                chunk_count += 1
                yield chunk

            total_duration = int((time.time() - start_time) * 1000)
            latency_ms = int((first_chunk_time - start_time) * 1000) if first_chunk_time else total_duration

            full_response = b"".join(chunks)
            if full_response:
                log_entry.response_body_raw = full_response.decode("utf-8", errors="replace")
                # Parse chunks to extract model from response (source of truth)
                for line in full_response.decode("utf-8", errors="replace").split("\n"):
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            chunk_data = json.loads(line[6:])
                            if chunk_data.get("model"):
                                log_entry.model = chunk_data["model"]
                                break
                        except (json.JSONDecodeError, Exception):
                            pass

            log_entry.chunk_count = chunk_count
            log_entry.total_duration_ms = total_duration
            log_entry.latency_ms = latency_ms
            log_entry.response_status = status_code
            log_entry.response_headers = response_headers

        except Exception as e:
            log_entry.error_message = str(e)
            total_duration = int((time.time() - start_time) * 1000)
            latency_ms = int((first_chunk_time - start_time) * 1000) if first_chunk_time else total_duration
            log_entry.total_duration_ms = total_duration
            log_entry.latency_ms = latency_ms
            log_entry.response_status = status_code

        finally:
            # Enqueue log entry for async processing (non-blocking)
            success = await logging_service.enqueue(log_entry)
            if success:
                logger.info(f"[LOGGING] Enqueued streaming log entry (path={log_entry.path})")
            else:
                logger.error(f"[LOGGING ERROR] Failed to enqueue streaming log (queue full)")


@router.api_route("/{path:path}", methods=["POST", "GET"], operation_id="proxy_request")
async def proxy(
    request: Request,
    db: DBManager = Depends(get_db_manager),
    logging_service: LoggingService = Depends(get_logging_service),
) -> Response:
    """Proxy requests to the upstream LLM provider and log them."""
    logger.info(f"[PROXY] Received request: {request.method} {request.url.path}")
    
    settings = await db.get_settings()
    upstream_url = settings.upstream_url

    if not upstream_url:
        return Response(
            content='{"error": "upstream_url not configured"}',
            status_code=503,
            media_type="application/json",
        )

    start_time = time.time()

    # Strip /proxy prefix from path for logging and upstream request
    raw_path = request.url.path
    clean_path = raw_path[len("/proxy"):] if raw_path.startswith("/proxy") else raw_path

    log_entry = LogEntry(
        path=clean_path,
        method=request.method,
        provider=upstream_url.split("//")[-1].split("/")[0],
    )

    body = await request.body()
    if body:
        log_entry.request_body_raw = body.decode("utf-8", errors="replace")
        try:
            request_json = json.loads(log_entry.request_body_raw)
            request_body = ChatCompletionRequest.model_validate(request_json)
            log_entry.request_body = request_body
            log_entry.is_stream = request_body.stream
        except (json.JSONDecodeError, Exception):
            pass

    # Forward request with original headers and body, using clean path
    headers = dict(request.headers)
    _ = headers.pop("host", None)
    _ = headers.pop("content-length", None)

    url = f"{upstream_url}{clean_path}"
    params = dict(request.query_params)

    try:
        if log_entry.is_stream:
            return StreamingResponse(
                stream_and_log(request.method, url, headers, body, params, log_entry, logging_service),
                status_code=200,
                media_type="text/event-stream",
            )

        # Non-streaming: wait for full response
        async with httpx.AsyncClient(timeout=None) as client:
            upstream_response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                params=params,
            )

        latency_ms = int((time.time() - start_time) * 1000)
        log_entry.latency_ms = latency_ms
        log_entry.total_duration_ms = latency_ms  # For non-streaming, TTFT == total duration
        log_entry.response_status = upstream_response.status_code
        log_entry.response_headers = dict(upstream_response.headers)

        response_body = upstream_response.content
        log_entry.response_body_raw = response_body.decode("utf-8", errors="replace")

        try:
            response_json = json.loads(log_entry.response_body_raw)
            response_body_obj = ChatCompletionResponse.model_validate(response_json)
            log_entry.response_body = response_body_obj
            # Use model from response (source of truth)
            log_entry.model = response_body_obj.model
        except (json.JSONDecodeError, Exception):
            pass

        # Enqueue log entry for async processing
        success = await logging_service.enqueue(log_entry)
        if success:
            logger.info(f"[LOGGING] Enqueued non-streaming log entry (path={log_entry.path})")
        else:
            logger.error(f"[LOGGING ERROR] Failed to enqueue non-streaming log (queue full)")

        return Response(
            content=response_body,
            status_code=upstream_response.status_code,
            headers=dict(upstream_response.headers),
            media_type=upstream_response.headers.get("content-type", "application/json"),
        )

    except httpx.RequestError as e:
        latency_ms = int((time.time() - start_time) * 1000)
        log_entry.latency_ms = latency_ms
        log_entry.total_duration_ms = latency_ms  # For non-streaming, TTFT == total duration
        log_entry.error_message = str(e)
        log_entry.response_status = 502

        # Enqueue error log entry
        success = await logging_service.enqueue(log_entry)
        if success:
            logger.info(f"[LOGGING] Enqueued error log entry (path={log_entry.path})")
        else:
            logger.error(f"[LOGGING ERROR] Failed to enqueue error log (queue full)")

        return Response(
            content=json.dumps({"error": f"Upstream request failed: {str(e)}"}),
            status_code=502,
            media_type="application/json",
        )

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        log_entry.latency_ms = latency_ms
        log_entry.total_duration_ms = latency_ms  # For non-streaming, TTFT == total duration
        log_entry.error_message = str(e)

        # Enqueue exception log entry
        success = await logging_service.enqueue(log_entry)
        if success:
            logger.info(f"[LOGGING] Enqueued exception log entry (path={log_entry.path})")
        else:
            logger.error(f"[LOGGING ERROR] Failed to enqueue exception log (queue full)")

        return Response(
            content=json.dumps({"error": f"Proxy error: {str(e)}"}),
            status_code=500,
            media_type="application/json",
        )
