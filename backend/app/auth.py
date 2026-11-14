"""Admin sign-in. The username and password come from ADMIN_USERNAME and
ADMIN_PASSWORD; signing in returns a random token that the dashboard sends
with every admin request (Authorization: Bearer <token>)."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException

from app.config import ADMIN_PASSWORD, ADMIN_USERNAME, SESSION_HOURS
from app.db import Database, now
from app.deps import get_db


def check_password(username: str, password: str) -> bool:
    # compare_digest takes the same time whether the guess is close or not
    same_user = secrets.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    same_password = secrets.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    return same_user and same_password


def create_session(db: Database, username: str) -> str:
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions (token, username, created_at) VALUES (?, ?, ?)", (token, username, now()))
    return token


def end_session(db: Database, token: str) -> None:
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _token_from(header: str | None) -> str:
    if header and header.lower().startswith("bearer "):
        return header[7:].strip()
    return ""


def require_admin(authorization: str | None = Header(None), db: Database = Depends(get_db)) -> str:
    """FastAPI dependency: the signed-in admin's username, or a 401 error."""
    token = _token_from(authorization)
    row = db.one("SELECT username, created_at FROM sessions WHERE token = ?", (token,)) if token else None
    if row:
        created = datetime.fromisoformat(row["created_at"])
        if datetime.now(timezone.utc) - created < timedelta(hours=SESSION_HOURS):
            return row["username"]
        end_session(db, token)
    raise HTTPException(status_code=401, detail="Sign in again to continue.")


def current_token(authorization: str | None = Header(None)) -> str:
    return _token_from(authorization)
