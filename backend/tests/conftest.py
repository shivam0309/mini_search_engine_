"""Test set-up. Tests use a temporary SQLite file, or PostgreSQL when
TEST_DATABASE_URL is set, e.g.
    TEST_DATABASE_URL=postgresql://postgres@localhost/minisearch_test pytest
"""

import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_URL = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["DATABASE_URL"] = TEST_URL  # must be set before the app is imported

from app.db import Database, init_db  # noqa: E402

TABLES = ["seeds", "crawl_queue", "pages", "links", "terms", "postings", "words", "crawl_log",
          "pipeline_runs", "query_log", "settings", "sessions"]


@pytest.fixture
def db():
    """A fresh, empty database for each test."""
    with Database(TEST_URL) as conn:
        for table in TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
    init_db(TEST_URL)
    conn = Database(TEST_URL)
    yield conn
    conn.close()


def add_page(db, url, title, body, links=()):
    page_id = db.value(
        "INSERT INTO pages (url, host, title, body) VALUES (?, ?, ?, ?) RETURNING id",
        (url, url.split("/")[2], title, body),
    )
    db.executemany("INSERT INTO links (from_page, to_url) VALUES (?, ?)", [(page_id, link) for link in links])
    db.commit()
    return page_id


# ---------------------------------------------------------------- a tiny website for crawler tests

PAGE = "<html><head><title>{title}</title></head><body><nav>Menu Home About</nav><main><h1>{title}</h1><p>{text}</p>{links}</main></body></html>"


def html(title, text, *hrefs):
    links = "".join(f'<a href="{h}">link</a>' for h in hrefs)
    return PAGE.format(title=title, text=text, links=links)


SITE = {
    "/robots.txt": (200, "text/plain", "User-agent: *\nDisallow: /private/\n"),
    "/": (200, "text/html", html("Home", "Welcome to the garden site about plants.",
                                 "/a", "/b", "/a#top", "/private/secret", "/missing", "/report.pdf",
                                 "mailto:x@example.com", "https://other.example.org/page", "/dup", "/old", "/Talk:Home")),
    "/a": (200, "text/html", html("Apples", "Apples grow on apple trees in orchards.", "/b", "/c")),
    "/b": (200, "text/html", html("Bananas", "Bananas grow in warm places.", "/")),
    "/c": (200, "text/html", html("Cherries", "Cherries are small red fruit.", "/d")),
    "/d": (200, "text/html", html("Dates", "Dates grow on date palms.", "/e")),
    "/e": (200, "text/html", html("Elderberries", "Too deep to be crawled.")),
    "/dup": (200, "text/html", html("Apples", "Apples grow on apple trees in orchards.", "/b", "/c")),
    "/private/secret": (200, "text/html", html("Secret", "Robots may not read this.")),
}
REDIRECTS = {"/old": "/b"}


class SiteServer:
    def __init__(self):
        self.requests: list[tuple[str, float]] = []
        server = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                import time
                server.requests.append((self.path, time.monotonic()))
                if self.path in REDIRECTS:
                    self.send_response(301)
                    self.send_header("Location", REDIRECTS[self.path])
                    self.end_headers()
                    return
                status, kind, body = SITE.get(self.path, (404, "text/html", "<h1>Not found</h1>"))
                data = body.encode()
                self.send_response(status)
                self.send_header("Content-Type", f"{kind}; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *_):
                pass

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def paths(self):
        return [p for p, _ in self.requests]

    def close(self):
        self.httpd.shutdown()


@pytest.fixture
def site():
    server = SiteServer()
    yield server
    server.close()
