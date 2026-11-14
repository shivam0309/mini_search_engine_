"""Entry point. Run from the backend folder: uvicorn app.main:app --reload"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api import admin, search
from app.config import ADMIN_PASSWORD, FRONTEND_ORIGINS, FRONTEND_PREVIEWS
from app.db import Database, init_db
from app.sample_data import load_sample_if_empty

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if config.LOAD_SAMPLE_IF_EMPTY:
        with Database() as db:
            if load_sample_if_empty(db):
                logging.info("Empty database: loaded the 41 sample pages.")
    if ADMIN_PASSWORD == "admin":
        logging.warning("Admin password is the default 'admin'. Set ADMIN_PASSWORD before sharing this server.")
    yield
    admin.runner.stop()


app = FastAPI(title="Mini Search Engine API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=FRONTEND_PREVIEWS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(search.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}
