"""Logging service dependencies for llproxy."""

from fastapi import Request

from ..services.logging_service import LoggingService


async def get_logging_service(request: Request) -> LoggingService:
    """FastAPI dependency that provides LoggingService instance.

    Usage:
        @router.post("/endpoint")
        async def endpoint(logging_service: LoggingService = Depends(get_logging_service)):
            logging_service.enqueue(log_entry)
    """
    return request.app.state.logging_service
