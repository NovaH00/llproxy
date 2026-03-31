from fastapi import APIRouter, Depends, Query, HTTPException

from ...database import DBManager
from ...dependencies.database import get_db_manager
from ...schemas.logs import LogEntry, LogStats
from ...schemas.settings import Settings

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/stats", response_model=LogStats)
async def get_stats(
    db: DBManager = Depends(get_db_manager),
) -> LogStats:
    """Get dashboard statistics."""
    return await db.get_log_stats()


@router.get("/tracings", response_model=list[LogEntry])
async def list_tracings(
    db: DBManager = Depends(get_db_manager),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[LogEntry]:
    """List logs filtered by configured tracing paths."""
    settings: Settings = await db.get_settings()
    tracing_paths = settings.tracing_paths or ["/v1/chat/completions"]
    
    from datetime import datetime
    
    # Fetch logs for each tracing path
    all_logs: list[LogEntry] = []
    for path in tracing_paths:
        logs = await db.get_logs(
            limit=limit,
            offset=offset,
            path=path,
        )
        all_logs.extend(logs)
    
    # Sort by created_at descending and limit
    all_logs.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
    return all_logs[:limit]


@router.get("", response_model=list[LogEntry])
async def list_logs(
    db: DBManager = Depends(get_db_manager),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    path: str | None = None,
    method: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    is_stream: bool | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[LogEntry]:
    """List logs with optional filters and pagination."""
    from datetime import datetime

    start_dt = None
    end_dt = None

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO 8601.")

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO 8601.")

    return await db.get_logs(
        limit=limit,
        offset=offset,
        path=path,
        method=method,
        provider=provider,
        model=model,
        is_stream=is_stream,
        start_date=start_dt,
        end_date=end_dt,
    )


@router.get("/{log_id}", response_model=LogEntry)
async def get_log(
    log_id: int,
    db: DBManager = Depends(get_db_manager),
) -> LogEntry:
    """Get a single log entry by ID."""
    log_entry = await db.get_log(log_id)
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return log_entry


@router.delete("/{log_id}")
async def delete_log(
    log_id: int,
    db: DBManager = Depends(get_db_manager),
) -> dict[str, str]:
    """Delete a single log entry."""
    success = await db.delete_log(log_id)
    if not success:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return {"message": "Log deleted"}


@router.delete("")
async def delete_logs(
    log_ids: list[int] = Query(...),
    db: DBManager = Depends(get_db_manager),
) -> dict[str, int]:
    """Delete multiple log entries by IDs."""
    deleted_count = await db.delete_logs(log_ids)
    return {"deleted": deleted_count}
