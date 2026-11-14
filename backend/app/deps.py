"""Shared FastAPI dependencies."""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.db import Database


def get_db():
    """One database connection per request, committed and closed afterwards."""
    with Database() as db:
        yield db


class RateLimiter:
    """Allows `limit` requests per minute from each address (non-functional requirement: security)."""

    def __init__(self, limit: int, message: str, window: float = 60.0):
        self.limit = limit
        self.window = window
        self.message = message
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        moment = time.monotonic()
        with self.lock:
            hits = self.hits[key]
            while hits and moment - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                raise HTTPException(status_code=429, detail=self.message)
            hits.append(moment)
