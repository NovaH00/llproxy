"""Database dependencies for llproxy."""

from fastapi import Request

from ..database import DBManager


async def get_db_manager(request: Request) -> DBManager:
    """FastAPI dependency that provides DBManager instance.
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(db: DBManager = Depends(get_db_manager)):
            settings = await db.get_settings()
    """
    return request.app.state.db_manager

