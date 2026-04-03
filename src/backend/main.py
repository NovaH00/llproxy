from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI

from .api import proxy_router, settings_router, logs_router
from .config import AppConfig, DBConfig
from .database import DBManager
from .services.logging_service import LoggingService

logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:     %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    db_manager = DBManager(
        host=DBConfig.HOST,
        port=DBConfig.PORT,
        db_name=DBConfig.DB_NAME,
        username=DBConfig.USER,
        password=DBConfig.PASS,
    )

    await db_manager.connect()
    app.state.db_manager = db_manager
    
    # Initialize and start logging service
    logging_service = LoggingService(db_manager)
    await logging_service.start()
    app.state.logging_service = logging_service
    
    yield
    
    # Stop logging service (drain queue)
    await logging_service.stop()
    
    # Close database connections
    await db_manager.close()
    

app = FastAPI(lifespan=lifespan)

app.include_router(settings_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(proxy_router) 

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app="src.backend.main:app", host=AppConfig.HOST, port=AppConfig.PORT, reload=True)
