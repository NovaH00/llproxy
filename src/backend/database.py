from __future__ import annotations

import json
from datetime import datetime
from typing import final

import asyncpg

from .schemas.logs import LogEntry, LogStats
from .schemas.openai import ChatCompletionRequest, ChatCompletionResponse
from .schemas.settings import Settings



@final
class DBManager:
    """Database manager for llproxy using asyncpg."""

    _host: str
    _port: str
    _username: str
    _password: str
    _db_name: str
    _pool: asyncpg.Pool | None

    def __init__(
        self, host: str, port: str, username: str, password: str, db_name: str
    ):
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._db_name = db_name
        self._pool = None

    async def connect(self) -> None:
        """Initialize database connection, create database if needed, and create tables."""
        # First connect to default 'postgres' database to check/create our database
        admin_pool = await asyncpg.create_pool(
            host=self._host,
            port=int(self._port),
            user=self._username,
            password=self._password,
            database="postgres",
            min_size=1,
            max_size=2,
        )

        try:
            async with admin_pool.acquire() as conn: #pyright: ignore 
                # Check if database exists
                exists = await conn.fetchval( #pyright: ignore
                    "SELECT 1 FROM pg_database WHERE datname = $1",
                    self._db_name,
                )

                if not exists:
                    # Create database (can't use parameterized query for CREATE DATABASE)
                    await conn.execute(f'CREATE DATABASE "{self._db_name}"')
        finally:
            await admin_pool.close()

        # Now connect to the actual database
        self._pool = await asyncpg.create_pool(
            host=self._host,
            port=int(self._port),
            user=self._username,
            password=self._password,
            database=self._db_name,
            min_size=2,
            max_size=10,
        )
        await self._init_tables()

    async def close(self) -> None:
        """Close the database connection pool."""
        if self._pool:
            await self._pool.close()

    async def _init_tables(self) -> None:
        async with self._pool.acquire() as conn: #pyright: ignore
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS logs (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    path TEXT NOT NULL,
                    method TEXT NOT NULL,
                    provider TEXT,
                    model TEXT,
                    request_headers JSONB,
                    request_body_raw TEXT,
                    request_body JSONB,
                    response_status INTEGER,
                    response_headers JSONB,
                    response_body_raw TEXT,
                    response_body JSONB,
                    is_stream BOOLEAN DEFAULT FALSE,
                    chunk_count INTEGER DEFAULT 0,
                    latency_ms INTEGER,
                    total_duration_ms INTEGER,
                    error_message TEXT
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value JSONB NOT NULL DEFAULT 'null'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Insert default settings if table is empty
            await conn.execute("""
                INSERT INTO settings (key, value) VALUES
                    ('upstream_url', 'null'::jsonb),
                    ('tracing_paths', '["/v1/chat/completions"]'::jsonb)
                ON CONFLICT (key) DO NOTHING
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_path ON logs(path)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_method ON logs(method)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_provider ON logs(provider)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_model ON logs(model)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_logs_is_stream ON logs(is_stream)
            """)

    async def insert_log(self, log_entry: LogEntry) -> int:
        """Insert a log entry and return its ID."""
        async with self._pool.acquire() as conn: #pyright: ignore
            request_body_json = None
            if log_entry.request_body is not None:
                request_body_json = log_entry.request_body.model_dump_json()

            response_body_json = None
            if log_entry.response_body is not None:
                response_body_json = log_entry.response_body.model_dump_json()

            request_headers_json = None
            if log_entry.request_headers:
                request_headers_json = json.dumps(log_entry.request_headers)

            response_headers_json = None
            if log_entry.response_headers:
                response_headers_json = json.dumps(log_entry.response_headers)

            result = await conn.fetchrow( #pyright: ignore
                """
                INSERT INTO logs (
                    path, method, provider, model,
                    request_headers, request_body_raw, request_body,
                    response_status, response_headers, response_body_raw, response_body,
                    is_stream, chunk_count, latency_ms, total_duration_ms, error_message
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                )
                RETURNING id
            """,
                log_entry.path,
                log_entry.method,
                log_entry.provider,
                log_entry.model,
                request_headers_json,
                log_entry.request_body_raw,
                request_body_json,
                log_entry.response_status,
                response_headers_json,
                log_entry.response_body_raw,
                response_body_json,
                log_entry.is_stream,
                log_entry.chunk_count,
                log_entry.latency_ms,
                log_entry.total_duration_ms,
                log_entry.error_message,
            )
            return result["id"] #pyright: ignore

    async def get_log(self, log_id: int) -> LogEntry | None:
        """Get a single log entry by ID."""
        async with self._pool.acquire() as conn: #pyright: ignore
            row = await conn.fetchrow("SELECT * FROM logs WHERE id = $1", log_id) #pyright: ignore
            if row:
                return self._row_to_log_entry(dict(row)) #pyright: ignore
            return None

    def _row_to_log_entry(self, row: dict[str, object]) -> LogEntry:
        """Convert a database row to a LogEntry object."""
        request_body: ChatCompletionRequest | None = None
        raw_request = row.get("request_body")
        if raw_request:
            if isinstance(raw_request, str):
                try:
                    raw_request = json.loads(raw_request)
                except json.JSONDecodeError:
                    pass
            if isinstance(raw_request, dict):
                request_body = ChatCompletionRequest.model_validate(raw_request)

        response_body: ChatCompletionResponse | None = None
        raw_response = row.get("response_body")
        if raw_response:
            if isinstance(raw_response, str):
                try:
                    raw_response = json.loads(raw_response)
                except json.JSONDecodeError:
                    pass
            if isinstance(raw_response, dict):
                response_body = ChatCompletionResponse.model_validate(raw_response)

        request_headers: dict[str, str] | None = None
        raw_headers = row.get("request_headers")
        if raw_headers:
            if isinstance(raw_headers, str):
                try:
                    raw_headers = json.loads(raw_headers)
                except json.JSONDecodeError:
                    pass
            if isinstance(raw_headers, dict):
                request_headers = raw_headers #pyright: ignore

        response_headers: dict[str, str] | None = None
        raw_headers = row.get("response_headers")
        if raw_headers:
            if isinstance(raw_headers, str):
                try:
                    raw_headers = json.loads(raw_headers)
                except json.JSONDecodeError:
                    pass
            if isinstance(raw_headers, dict):
                response_headers = raw_headers #pyright: ignore

        return LogEntry(
            id                = row["id"],                    #pyright: ignore
            created_at        = row["created_at"],            #pyright: ignore
            path              = row["path"],                  #pyright: ignore
            method            = row["method"],                #pyright: ignore
            provider          = row.get("provider"),          #pyright: ignore
            model             = row.get("model"),             #pyright: ignore
            request_headers   = request_headers, 
            request_body_raw  = row.get("request_body_raw"),  #pyright: ignore
            request_body      = request_body, 
            response_status   = row.get("response_status"),   #pyright: ignore
            response_headers  = response_headers, 
            response_body_raw = row.get("response_body_raw"), #pyright: ignore
            response_body     = response_body, 
            is_stream         = row.get("is_stream", False),  #pyright: ignore
            chunk_count       = row.get("chunk_count", 0),    #pyright: ignore
            latency_ms        = row.get("latency_ms"),        #pyright: ignore
            total_duration_ms = row.get("total_duration_ms"), #pyright: ignore
            error_message     = row.get("error_message"),     #pyright: ignore
        )

    async def get_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        path: str | None = None,
        method: str | None = None,
        provider: str | None = None,
        model: str | None = None,
        is_stream: bool | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> list[LogEntry]:
        """Get log entries with optional filters."""
        conditions = []
        params: list[object] = []
        param_idx = 1

        if path:
            conditions.append(f"path = ${param_idx}")
            params.append(path)
            param_idx += 1
        if method:
            conditions.append(f"method = ${param_idx}")
            params.append(method)
            param_idx += 1
        if provider:
            conditions.append(f"provider = ${param_idx}")
            params.append(provider)
            param_idx += 1
        if model:
            conditions.append(f"model = ${param_idx}")
            params.append(model)
            param_idx += 1
        if is_stream is not None:
            conditions.append(f"is_stream = ${param_idx}")
            params.append(is_stream)
            param_idx += 1
        if start_date:
            conditions.append(f"created_at >= ${param_idx}")
            params.append(start_date)
            param_idx += 1
        if end_date:
            conditions.append(f"created_at <= ${param_idx}")
            params.append(end_date)
            param_idx += 1

        where_clause = " AND ".join(conditions) if conditions else "1=1" #pyright: ignore

        query = f"""
            SELECT * FROM logs
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])

        async with self._pool.acquire() as conn: #pyright: ignore
            rows = await conn.fetch(query, *params) #pyright: ignore
            return [self._row_to_log_entry(dict(row)) for row in rows] #pyright: ignore

    async def count_logs(
        self,
        path: str | None = None,
        method: str | None = None,
        provider: str | None = None,
        model: str | None = None,
        is_stream: bool | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> int:
        """Count log entries with optional filters."""
        conditions = []
        params: list[object] = []
        param_idx = 1

        if path:
            conditions.append(f"path = ${param_idx}")
            params.append(path)
            param_idx += 1
        if method:
            conditions.append(f"method = ${param_idx}")
            params.append(method)
            param_idx += 1
        if provider:
            conditions.append(f"provider = ${param_idx}")
            params.append(provider)
            param_idx += 1
        if model:
            conditions.append(f"model = ${param_idx}")
            params.append(model)
            param_idx += 1
        if is_stream is not None:
            conditions.append(f"is_stream = ${param_idx}")
            params.append(is_stream)
            param_idx += 1
        if start_date:
            conditions.append(f"created_at >= ${param_idx}")
            params.append(start_date)
            param_idx += 1
        if end_date:
            conditions.append(f"created_at <= ${param_idx}")
            params.append(end_date)
            param_idx += 1

        where_clause = " AND ".join(conditions) if conditions else "1=1" #pyright: ignore

        query = f"SELECT COUNT(*) as count FROM logs WHERE {where_clause}"
        async with self._pool.acquire() as conn: #pyright: ignore
            row = await conn.fetchrow(query, *params) #pyright: ignore
            return row["count"] #pyright: ignore

    async def get_log_stats(self) -> LogStats:
        """Get statistics for dashboard."""
        async with self._pool.acquire() as conn: #pyright: ignore
            total_row = await conn.fetchrow("SELECT COUNT(*) as count FROM logs") #pyright: ignore
            stream_row = await conn.fetchrow( #pyright: ignore
                "SELECT COUNT(*) as count FROM logs WHERE is_stream = TRUE"
            )
            non_stream_row = await conn.fetchrow( #pyright: ignore
                "SELECT COUNT(*) as count FROM logs WHERE is_stream = FALSE"
            )
            avg_row = await conn.fetchrow( #pyright: ignore
                "SELECT AVG(latency_ms) as avg_latency FROM logs WHERE latency_ms IS NOT NULL"
            )

            avg_latency = avg_row["avg_latency"] #pyright: ignore
            return LogStats(
                total_requests=int(total_row["count"] or 0), #pyright: ignore
                streaming_requests=int(stream_row["count"] or 0), #pyright: ignore
                non_streaming_requests=int(non_stream_row["count"] or 0), #pyright: ignore
                avg_latency_ms=float(avg_latency) if avg_latency is not None else None, #pyright: ignore
            )

    async def delete_log(self, log_id: int) -> bool:
        """Delete a single log entry by ID."""
        async with self._pool.acquire() as conn: #pyright: ignore
            result = await conn.execute("DELETE FROM logs WHERE id = $1", log_id) #pyright: ignore
            return result == "DELETE 1" #pyright: ignore

    async def delete_logs(self, log_ids: list[int]) -> int:
        """Delete multiple log entries by IDs. Returns count of deleted entries."""
        async with self._pool.acquire() as conn: #pyright: ignore
            result = await conn.execute("DELETE FROM logs WHERE id = ANY($1)", log_ids) #pyright: ignore
            parts = result.split() #pyright: ignore
            return int(parts[1]) if len(parts) > 1 else 0 #pyright: ignore

    async def get_settings(self) -> Settings:
        """Get all settings as a Settings object."""
        import json

        async with self._pool.acquire() as conn: #pyright: ignore
            rows = await conn.fetch("SELECT key, value FROM settings") #pyright: ignore
            settings_dict = {}
            for row in rows: #pyright: ignore
                value = row["value"] #pyright:ignore
                # JSONB values come as strings, need to parse them
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except json.JSONDecodeError:
                        pass
                settings_dict[row["key"]] = value
            return Settings.model_validate(settings_dict)

    async def set_settings(self, settings: Settings) -> None:
        """Set settings from a Settings object."""
        import json

        async with self._pool.acquire() as conn:  #pyright: ignore
            settings_dict = settings.model_dump(exclude_unset=True)
            for key, value in settings_dict.items():
                if value is not None:
                    # Serialize to JSON string, then cast to jsonb
                    json_str = json.dumps(value)
                    await conn.execute(
                        """
                        INSERT INTO settings (key, value, updated_at)
                        VALUES ($1, $2::jsonb, NOW())
                        ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()
                    """,
                        key,
                        json_str,
                    )

    async def delete_settings(self) -> None:
        """Reset all settings to defaults."""
        async with self._pool.acquire() as conn: #pyright: ignore
            await conn.execute("""
                UPDATE settings SET value = CASE key
                    WHEN 'upstream_url' THEN 'null'::jsonb
                    WHEN 'tracing_paths' THEN '["/v1/chat/completions"]'::jsonb
                    ELSE value
                END, updated_at = NOW()
            """)
