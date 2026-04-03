"""Logging service for llproxy.

Provides a queue-based logging service that processes log entries asynchronously
with proper lifecycle management and bounded concurrency.
"""

import asyncio
import logging
from typing import final

from ..schemas.logs import LogEntry
from ..database import DBManager

logger = logging.getLogger(__name__)


@final
class LoggingService:
    """Queue-based logging service for async log processing."""
    
    def __init__(self, db_manager: DBManager, queue_size: int = 1000):
        self._db = db_manager
        self._queue: asyncio.Queue[LogEntry] = asyncio.Queue(maxsize=queue_size)
        self._worker_task: asyncio.Task | None = None # pyright: ignore
        self._shutdown_event = asyncio.Event()
        self._processed_count = 0
        self._error_count = 0
    
    async def start(self) -> None:
        """Start the logging worker."""
        self._shutdown_event.clear()
        self._worker_task = asyncio.create_task(self._worker())
        logger.info(f"[LoggingService] Started with queue size={self._queue.maxsize}")
    
    async def stop(self) -> None:
        """Stop the logging worker gracefully."""
        logger.info(f"[LoggingService] Stopping... ({self._queue.qsize()} pending logs)")
        
        # Signal shutdown
        self._shutdown_event.set()
        
        # Wait for queue to drain (with timeout)
        if self._worker_task and not self._queue.empty():
            try:
                await asyncio.wait_for(self._queue.join(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning(f"[LoggingService] Timeout waiting for {self._queue.qsize()} pending logs")
        
        # Cancel worker if still running
        if self._worker_task and not self._worker_task.done():
            _ = self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        
        logger.info(f"[LoggingService] Stopped (processed={self._processed_count}, errors={self._error_count})")
    
    async def enqueue(self, log_entry: LogEntry) -> bool:
        """
        Add a log entry to the queue.
        
        Returns True if successfully queued, False if queue is full.
        This method never blocks - it's safe to call from streaming contexts.
        """
        if self._queue.full():
            logger.warning(f"[LoggingService] Queue full, dropping log entry (path={log_entry.path})")
            self._error_count += 1
            return False
        
        try:
            self._queue.put_nowait(log_entry)
            return True
        except asyncio.QueueFull:
            logger.warning("[LoggingService] Queue full (race condition), dropping log")
            self._error_count += 1
            return False
    
    async def _worker(self) -> None:
        """Worker coroutine that processes log entries from the queue."""
        logger.info("[LoggingService] Worker started")
        
        while not self._shutdown_event.is_set() or not self._queue.empty():
            try:
                # Wait for log entry with timeout to check shutdown
                try:
                    log_entry = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                # Process the log entry
                try:
                    _ = await self._db.insert_log(log_entry)
                    self._processed_count += 1
                except Exception as e:
                    logger.error(f"[LoggingService] Failed to insert log: {e}")
                    self._error_count += 1
                finally:
                    self._queue.task_done()
                    
            except asyncio.CancelledError:
                logger.info("[LoggingService] Worker cancelled")
                break
            except Exception as e:
                logger.error(f"[LoggingService] Worker error: {e}")
                await asyncio.sleep(1)  # Back off on error
        
        logger.info("[LoggingService] Worker stopped")
