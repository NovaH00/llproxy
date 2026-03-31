# llproxy

A lightweight LLM proxy that adds a tracing layer between clients and LLM providers.

## What it does

llproxy sits between your application and an LLM provider (like llama.cpp, OpenAI, etc.), forwarding requests while logging all traffic for debugging and analysis.

## Features

- **Transparent proxy** - Forwards requests/responses unchanged
- **Request/Response logging** - Full trace of all proxied requests
- **Streaming support** - Handles SSE streaming with proper TTFT tracking
- **Tracing dashboard** - View conversations, token usage, and performance metrics
- **Configurable** - Set upstream URL and tracing paths via UI

## Status

⚠️ **Work in Progress** - This project is under active development. Basic proxying and logging work, but some features may be incomplete.

## Quick Start

```bash
# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Run the server
uv run -m src.backend.main

# Run the frontend
cd src/frontend && npm run dev

# Open the dashboard
open http://localhost:3535
```

## Architecture

- **Backend**: FastAPI + asyncpg (PostgreSQL)
- **Frontend**: React + TypeScript + shadcn/ui
- **Proxy endpoint**: `POST /proxy/v1/chat/completions`
- **Dashboard**: `http://localhost:3535`
