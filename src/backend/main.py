from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import proxy_router, settings_router, logs_router 
from .config import AppConfig, DBConfig
from .database import DBManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_manager = DBManager(
        host=DBConfig.HOST,
        port=DBConfig.PORT,
        db_name=DBConfig.DB_NAME,
        username=DBConfig.USER,
        password=DBConfig.PASS,
    )

    await db_manager.connect()

    app.state.db_manager = db_manager
    yield

    await db_manager.close()


app = FastAPI(lifespan=lifespan)

app.include_router(settings_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(proxy_router) 

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app="src.backend.main:app", host=AppConfig.HOST, port=AppConfig.PORT, reload=True)
