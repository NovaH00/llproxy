from fastapi import APIRouter, Depends, Response

from ...database import DBManager
from ...dependencies.database import get_db_manager
from ...schemas.settings import Settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(db: DBManager = Depends(get_db_manager)) -> Settings:
    """Get all settings."""
    return await db.get_settings()


@router.put("")
async def set_settings(settings: Settings, db: DBManager = Depends(get_db_manager)) -> Settings:
    """Update settings."""
    await db.set_settings(settings)
    return await db.get_settings()


@router.delete("")
async def delete_settings(db: DBManager = Depends(get_db_manager)) -> Response:
    """Delete all settings."""
    await db.delete_settings()
    return Response(content='{"message": "Settings deleted"}', media_type="application/json")
