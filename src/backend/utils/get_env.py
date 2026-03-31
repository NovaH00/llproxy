import os

def get_env[T: int | bool | float | str](
    key: str,
    cast_type: type[T],
    default: T | None = None,
) -> T:
    env = os.getenv(key)

    if env is None:
        if default is None:
            raise RuntimeError(f"Missing required environment variable: {key}")
        return default

    try:
        if cast_type is bool:
            return _parse_bool(env)  # pyright: ignore 
        return cast_type(env)
    except Exception as e:
        raise ValueError(
            f"Invalid value for {key}: cannot cast '{env}' to {cast_type.__name__}"
        ) from e


def _parse_bool(value: str) -> bool:
    value = value.lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")
