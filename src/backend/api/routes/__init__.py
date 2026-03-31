from .proxy import router as proxy_router
from .settings import router as settings_router
from .logs import router as logs_router


__all__ = [
    "proxy_router",
    "settings_router",
    "logs_router"
]
