import pytest
from fastapi.testclient import TestClient

from app.api import search as search_api
from app.main import app
from app.sample_data import load_sample


@pytest.fixture
def client(db):
    load_sample(db)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth(client):
    token = client.post("/api/auth/login", json={"username": "admin", "password": "admin"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_search_and_stats(client):
    body = client.get("/api/search", params={"q": "web crawler"}).json()
    assert body["results"][0]["title"] == "Web crawler"
    assert {"query", "correctedFrom", "suggestion", "terms", "phrases", "weight", "total", "page", "pages", "tookMs"} <= set(body)
    assert client.get("/api/stats").json() == {"pages": 41, "sites": 7}


def test_search_rejects_empty_and_long_queries(client):
    assert client.get("/api/search", params={"q": ""}).status_code == 422
    assert client.get("/api/search", params={"q": "a" * 201}).status_code == 422


def test_search_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(search_api.search_limit, "limit", 3)
    search_api.search_limit.hits.clear()
    codes = [client.get("/api/search", params={"q": "pagerank"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    search_api.search_limit.hits.clear()


def test_admin_needs_sign_in(client):
    assert client.get("/api/admin/overview").status_code == 401
    bad = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert bad.status_code == 401


def test_overview_and_log(client, auth):
    client.get("/api/search", params={"q": "pagerank"})
    body = client.get("/api/admin/overview", headers=auth).json()
    assert body["pages"] == 41 and body["terms"] > 400 and body["links"] > 100
    assert body["avgQueryMs"] is not None
    assert [s["step"] for s in body["pipeline"]] == ["Crawl", "Parse", "Index", "PageRank"]
    assert len(body["topPages"]) == 5
    assert body["crawl"]["state"] == "idle"
    assert len(client.get("/api/admin/crawl/log", headers=auth).json()) == 41


def test_seeds(client, auth):
    assert len(client.get("/api/admin/seeds", headers=auth).json()) == 7
    assert client.post("/api/admin/seeds", json={"url": "not a url"}, headers=auth).status_code == 422
    dup = client.post("/api/admin/seeds", json={"url": "https://en.wikipedia.org/wiki/Search_engine"}, headers=auth)
    assert dup.status_code == 409
    new = client.post("/api/admin/seeds", json={"url": "https://Example.org/docs"}, headers=auth).json()
    assert new["url"] == "https://example.org/docs" and new["status"] == "Waiting"
    assert client.delete(f"/api/admin/seeds/{new['id']}", headers=auth).status_code == 204


def test_settings_are_validated(client, auth):
    good = {"maxPages": 500, "maxDepth": 2, "delaySeconds": 2, "obeyRobots": True, "userAgent": "Bot"}
    assert client.put("/api/admin/settings", json=good, headers=auth).json()["maxPages"] == 500
    assert client.put("/api/admin/settings", json={**good, "delaySeconds": 0.1}, headers=auth).status_code == 422
    assert client.get("/api/admin/settings", headers=auth).json()["maxDepth"] == 2


def test_rebuild_and_evaluation(client, auth):
    assert client.post("/api/admin/index/rebuild", headers=auth).json()["pages"] == 41
    assert client.post("/api/admin/pagerank/recompute", headers=auth).json()["ok"]
    body = client.get("/api/admin/evaluation", headers=auth).json()
    assert round(body["blended"]["mrr"], 2) == 1.0


def test_crawl_needs_seeds(client, auth):
    for seed in client.get("/api/admin/seeds", headers=auth).json():
        client.delete(f"/api/admin/seeds/{seed['id']}", headers=auth)
    res = client.post("/api/admin/crawl/start", headers=auth)
    assert res.status_code == 409 and "seed" in res.json()["detail"]


def test_sign_out(client, auth):
    assert client.post("/api/auth/logout", headers=auth).status_code == 204
    assert client.get("/api/admin/overview", headers=auth).status_code == 401


def test_sample_pages_load_on_first_start_only(db, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "LOAD_SAMPLE_IF_EMPTY", True)
    with TestClient(app) as c:                       # empty database: sample pages are loaded
        assert c.get("/api/stats").json() == {"pages": 41, "sites": 7}
    db.execute("DELETE FROM pages")
    db.commit()
    with TestClient(app) as c:                       # seed URLs exist, so nothing is reloaded
        assert c.get("/api/stats").json()["pages"] == 0


def test_pasted_settings_are_tidied():
    from app.config import clean_database_url, clean_origin
    url = "postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require"
    assert clean_database_url(f"psql '{url}'") == url
    assert clean_database_url(f"  \"{url}\" ") == url
    assert clean_origin("https://my-site.vercel.app/") == "https://my-site.vercel.app"
    assert clean_origin("my-site.vercel.app") == "https://my-site.vercel.app"


def test_vercel_preview_addresses_are_allowed():
    import re
    from app.config import vercel_preview_pattern
    pattern = re.compile(vercel_preview_pattern(["https://mini-search.vercel.app", "http://localhost:3000"]))
    assert pattern.fullmatch("https://mini-search.vercel.app")
    assert pattern.fullmatch("https://mini-search-k2j4h7-shivam.vercel.app")
    assert pattern.fullmatch("https://mini-search-git-main-shivam.vercel.app")
    assert not pattern.fullmatch("https://other-site.vercel.app")
    assert not pattern.fullmatch("https://mini-search.vercel.app.evil.com")
    assert vercel_preview_pattern(["http://localhost:3000"]) is None
