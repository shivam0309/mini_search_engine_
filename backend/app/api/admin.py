"""Admin endpoints used by the dashboard (M7) and the evaluation page (M8).
Every route except sign-in needs a signed-in admin."""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth import check_password, create_session, current_token, end_session, require_admin
from app.config import LOGIN_RATE_LIMIT
from app.db import Database, now
from app.deps import RateLimiter, get_db
from crawler.crawler import normalize_url, site_of
from crawler.runner import CrawlError, CrawlRunner, index_lock
from evaluation.metrics import compare
from indexer.indexer import index_stats, rebuild_index
from ranking.pagerank import compute_pagerank

router = APIRouter(tags=["admin"])
admin = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])
runner = CrawlRunner()
login_limit = RateLimiter(LOGIN_RATE_LIMIT, "Too many sign-in attempts. Wait a minute and try again.")

PIPELINE_STEPS = ["Crawl", "Parse", "Index", "PageRank"]


class Login(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class NewSeed(BaseModel):
    url: str = Field(min_length=1, max_length=2000)


class Settings(BaseModel):
    maxPages: int = Field(ge=1, le=100_000)
    maxDepth: int = Field(ge=1, le=10)
    delaySeconds: float = Field(ge=1, le=60)
    obeyRobots: bool
    userAgent: str = Field(min_length=1, max_length=200)


# ---------------------------------------------------------------- sign in

@router.post("/auth/login", dependencies=[Depends(login_limit)])
def login(body: Login, db: Database = Depends(get_db)):
    if not check_password(body.username, body.password):
        raise HTTPException(status_code=401, detail="That username and password don’t match an admin account.")
    return {"token": create_session(db, body.username), "username": body.username}


@admin.post("/auth/logout", status_code=204)
def logout(token: str = Depends(current_token), db: Database = Depends(get_db)):
    end_session(db, token)
    return Response(status_code=204)


# ---------------------------------------------------------------- overview

@admin.get("/admin/overview")
def overview(db: Database = Depends(get_db)):
    times = db.all("SELECT took_ms FROM query_log ORDER BY id DESC LIMIT 200")
    steps = {r["step"]: r for r in db.all("SELECT step, detail, finished_at FROM pipeline_runs")}
    top = db.all("SELECT id, title, url, pagerank FROM pages WHERE length > 0 ORDER BY pagerank DESC, id LIMIT 5")
    return {
        **index_stats(db),
        "avgQueryMs": round(sum(t["took_ms"] for t in times) / len(times), 1) if times else None,
        "crawl": runner.status(db),
        "pipeline": [
            {
                "step": step,
                "detail": steps[step]["detail"] if step in steps else "Not run yet",
                "finishedAt": steps[step]["finished_at"] if step in steps else None,
            }
            for step in PIPELINE_STEPS
        ],
        "topPages": [{**p, "title": p["title"] or p["url"], "pagerank": round(p["pagerank"], 4)} for p in top],
    }


# ---------------------------------------------------------------- crawler

@admin.get("/admin/crawl/status")
def crawl_status(db: Database = Depends(get_db)):
    return runner.status(db)


@admin.get("/admin/crawl/log")
def crawl_log(db: Database = Depends(get_db)):
    rows = db.all("SELECT id, url, status_code, outcome, logged_at FROM crawl_log ORDER BY id DESC LIMIT 50")
    return [
        {"id": r["id"], "time": r["logged_at"], "url": r["url"], "status": r["status_code"], "outcome": r["outcome"]}
        for r in rows
    ]


@admin.post("/admin/crawl/start")
def start_crawl(db: Database = Depends(get_db)):
    try:
        runner.start()
    except CrawlError as error:
        raise HTTPException(status_code=409, detail=str(error))
    return runner.status(db)


@admin.post("/admin/crawl/stop")
def stop_crawl(db: Database = Depends(get_db)):
    runner.stop()
    return runner.status(db)


def _index_job(db: Database, job):
    if runner.busy():
        raise HTTPException(status_code=409, detail="Wait for the crawl to finish first.")
    if not index_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="The index is already being rebuilt.")
    try:
        return {"ok": True, **job(db)}
    finally:
        index_lock.release()


@admin.post("/admin/index/rebuild")
def rebuild(db: Database = Depends(get_db)):
    return _index_job(db, rebuild_index)


@admin.post("/admin/pagerank/recompute")
def recompute_pagerank(db: Database = Depends(get_db)):
    return _index_job(db, compute_pagerank)


# ---------------------------------------------------------------- seeds and limits

def _seed_rows(db: Database, where: str = "", params=()) -> list[dict]:
    per_site = {
        r["host"]: r for r in db.all("SELECT host, COUNT(*) AS pages, MAX(crawled_at) AS last FROM pages GROUP BY host")
    }
    seeds = []
    for r in db.all(f"SELECT id, url FROM seeds {where} ORDER BY id", params):
        site = per_site.get(site_of(r["url"]))
        seeds.append({
            "id": r["id"],
            "url": r["url"],
            "host": site_of(r["url"]),
            "pages": site["pages"] if site else 0,
            "status": "Crawled" if site else "Waiting",
            "lastCrawled": site["last"] if site else None,
        })
    return seeds


@admin.get("/admin/seeds")
def list_seeds(db: Database = Depends(get_db)):
    return _seed_rows(db)


@admin.post("/admin/seeds", status_code=201)
def add_seed(body: NewSeed, db: Database = Depends(get_db)):
    url = normalize_url(body.url.strip())
    if not url:
        raise HTTPException(status_code=422, detail="Enter a full address that starts with http:// or https://")
    if db.one("SELECT id FROM seeds WHERE url = ?", (url,)):
        raise HTTPException(status_code=409, detail="This seed URL is already in the list.")
    seed_id = db.value("INSERT INTO seeds (url, added_at) VALUES (?, ?) RETURNING id", (url, now()))
    return _seed_rows(db, "WHERE id = ?", (seed_id,))[0]


@admin.delete("/admin/seeds/{seed_id}", status_code=204)
def remove_seed(seed_id: int, db: Database = Depends(get_db)):
    db.execute("DELETE FROM seeds WHERE id = ?", (seed_id,))
    return Response(status_code=204)


@admin.get("/admin/settings")
def get_settings(db: Database = Depends(get_db)):
    return db.crawl_settings()


@admin.put("/admin/settings")
def save_settings(body: Settings, db: Database = Depends(get_db)):
    for key, value in body.model_dump().items():
        db.set_setting(key, value)
    return db.crawl_settings()


# ---------------------------------------------------------------- evaluation

@admin.get("/admin/evaluation")
def evaluation(db: Database = Depends(get_db)):
    return compare(db)


router.include_router(admin)
