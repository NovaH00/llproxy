from dotenv import load_dotenv
from .utils import get_env

_ = load_dotenv()

class AppConfig:
    HOST: str = "localhost"
    PORT: int = 3535

class DBConfig:
    HOST: str    = get_env("PG_HOST",    str)
    PORT: str    = get_env("PG_PORT",    str)
    DB_NAME: str = get_env("PG_DB_NAME", str)
    USER: str    = get_env("PG_USER",   str)
    PASS: str    = get_env("PG_PASS",    str)

