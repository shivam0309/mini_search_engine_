"""Runs the crawler in a background thread so the dashboard stays usable.

When a crawl ends (finished or stopped) the index and PageRank are rebuilt,
so the new pages become searchable straight away. If the server stops in
the middle of a crawl, the next "Start crawl" carries on from the queue.
"""

import logging
import threading

from app.db import Database, now
from crawler.crawler import Crawler, start_queue
from indexer.indexer import rebuild_index, record_step
from ranking.pagerank import compute_pagerank

log = logging.getLogger("crawler")

index_lock = threading.Lock()  # only one index build at a time


class CrawlError(Exception):
    """A crawl could not be started; the message is shown to the admin."""


class CrawlRunner:
    def __init__(self, db_url: str | None = None):
        self.db_url = db_url
        self.thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.state = "idle"
        self.error: str | None = None
        self._lock = threading.Lock()

    def busy(self) -> bool:
        return self.thread is not None and self.thread.is_alive()

    def start(self) -> None:
        with self._lock:
            if self.busy():
                raise CrawlError("A crawl is already running.")
            if index_lock.locked():
                raise CrawlError("The index is being rebuilt. Try again when it finishes.")
            with Database(self.db_url) as db:
                run = db.get_setting("crawl_run") or {}
                queued = db.value("SELECT COUNT(*) FROM crawl_queue WHERE status = 'queued'") or 0
                if not (run.get("state") in ("running", "stopped") and queued):
                    if not db.value("SELECT COUNT(*) FROM seeds"):
                        raise CrawlError("Add at least one seed URL before starting a crawl.")
                    start_queue(db)
                    run = {"startedAt": now()}
                run.update(state="running", finishedAt=None)
                db.set_setting("crawl_run", run)
            self.stop_event.clear()
            self.error = None
            self.state = "running"
            self.thread = threading.Thread(target=self._work, name="crawler", daemon=True)
            self.thread.start()

    def stop(self) -> None:
        if self.busy():
            self.stop_event.set()
            self.state = "stopping"

    def wait(self, timeout: float | None = None) -> None:
        if self.thread:
            self.thread.join(timeout)

    def _work(self) -> None:
        try:
            with Database(self.db_url) as db:
                crawler = Crawler(db, db.crawl_settings(), should_stop=self.stop_event.is_set, sleep=self.stop_event.wait)
                result = crawler.run()
                run = db.get_setting("crawl_run") or {}
                run.update(state="stopped" if result["stopped"] else "finished", finishedAt=now())
                db.set_setting("crawl_run", run)
                record_step(db, "Crawl", f"{result['crawled']:,} pages fetched, {result['skipped']:,} skipped")
                db.commit()
                self.state = "indexing"
                with index_lock:
                    rebuild_index(db)
                    compute_pagerank(db)
        except Exception as error:  # keep the server alive and show what went wrong
            log.exception("Crawl failed")
            self.error = f"The crawl stopped because of an error: {error}"
            with Database(self.db_url) as db:
                run = db.get_setting("crawl_run") or {}
                run.update(state="stopped", finishedAt=now())
                db.set_setting("crawl_run", run)
        finally:
            self.state = "idle"

    def status(self, db: Database) -> dict:
        run = db.get_setting("crawl_run") or {}
        counts = {r["status"]: r["n"] for r in db.all("SELECT status, COUNT(*) AS n FROM crawl_queue GROUP BY status")}
        done, skipped, queued = counts.get("done", 0), counts.get("skipped", 0), counts.get("queued", 0)
        state = self.state if self.busy() else "idle"
        return {
            "state": state,
            "crawled": done,
            "skipped": skipped,
            "queued": queued,
            "processed": done + skipped,
            "limit": db.crawl_settings()["maxPages"],
            "startedAt": run.get("startedAt"),
            "finishedAt": run.get("finishedAt"),
            "resumable": state == "idle" and run.get("state") in ("running", "stopped") and queued > 0,
            "error": self.error,
        }
