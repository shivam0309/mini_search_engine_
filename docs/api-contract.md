# API contract

The FastAPI back-end (`backend/app/api/`) serves these endpoints; the front-end calls them through `frontend/lib/api.js`. The sample data in `frontend/lib/mock/` returns the same shapes, so both modes look identical to the pages.

Base URL during development: `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.

**Errors** always come back as `{ "detail": "A sentence saying what went wrong" }` with a matching status: 401 (not signed in), 409 (conflict, e.g. a crawl is already running), 422 (invalid input) or 429 (too many requests).

## Visitor

### `GET /api/search?q={query}&page={n}`

`q` is 1–200 characters. Limited to 60 searches a minute from one address.

```json
{
  "query": "web crawler",
  "correctedFrom": null,
  "suggestion": null,
  "terms": [{ "word": "web", "stem": "web", "stop": false, "indexed": true }],
  "phrases": [],
  "weight": 0.7,
  "total": 20,
  "page": 1,
  "pages": 2,
  "tookMs": 3.1,
  "results": [
    {
      "id": 2,
      "position": 1,
      "title": "Web crawler",
      "url": "https://en.wikipedia.org/wiki/Web_crawler",
      "snippet": [{ "text": "A ", "hit": false }, { "text": "web", "hit": true }],
      "matched": ["web", "crawler"],
      "scores": { "bm25": 3.89, "relevance": 1.0, "authority": 0.59, "final": 0.88 }
    }
  ]
}
```

- `correctedFrom` is set when the original query found nothing and a spelling fix was searched instead.
- `suggestion` is a "did you mean" query, shown when the original query did find results.
- `relevance` = BM25 ÷ best BM25 for this query; `authority` = PageRank ÷ highest PageRank; `final` = 0.7 × relevance + 0.3 × authority.
- Text in quotes is a phrase whose words must appear side by side.

### `GET /api/stats`

```json
{ "pages": 41, "sites": 7 }
```

## Admin sign-in

`POST /api/auth/login` with `{ "username", "password" }` returns `{ "token", "username" }`, or 401. Limited to 10 attempts a minute from one address. Every other admin endpoint needs the header `Authorization: Bearer <token>`. A sign-in lasts 12 hours. `POST /api/auth/logout` ends it (204).

## Admin

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | | see below |
| GET | `/api/admin/crawl/status` | | crawl status (below) |
| GET | `/api/admin/crawl/log` | | latest 50 `[{ "id", "time", "url", "status", "outcome" }]`, newest first |
| POST | `/api/admin/crawl/start` | | crawl status; 409 if already running or no seed URLs |
| POST | `/api/admin/crawl/stop` | | crawl status |
| POST | `/api/admin/index/rebuild` | | `{ "ok", "pages", "terms", "postings", "tookMs" }` |
| POST | `/api/admin/pagerank/recompute` | | `{ "ok", "pages", "links", "tookMs" }` |
| GET | `/api/admin/seeds` | | `[{ "id", "url", "host", "pages", "status", "lastCrawled" }]` |
| POST | `/api/admin/seeds` | `{ "url" }` | the new seed (201); 409 if already listed |
| DELETE | `/api/admin/seeds/{id}` | | 204 |
| GET | `/api/admin/settings` | | `{ "maxPages", "maxDepth", "delaySeconds", "obeyRobots", "userAgent" }` |
| PUT | `/api/admin/settings` | same as GET | the saved settings; 422 if out of range |
| GET | `/api/admin/evaluation` | | see below |

Setting ranges: `maxPages` 1–100,000, `maxDepth` 1–10, `delaySeconds` 1–60.

`outcome` in the crawl log is one of `Indexed`, `Blocked by robots.txt`, `Already seen`, `Redirected`, `Not found`, `HTTP error`, `Not a web page`, `Too large` or `Failed: <reason>`.

### Crawl status

```json
{
  "state": "running",
  "crawled": 120, "skipped": 8, "queued": 940, "processed": 128, "limit": 10000,
  "startedAt": "2026-11-13T06:30:00+00:00", "finishedAt": null,
  "resumable": false, "error": null
}
```

`state` is `idle`, `running`, `stopping` or `indexing` (rebuilding the index after a crawl). `resumable` is true when a stopped or interrupted crawl still has URLs waiting; starting again then carries on instead of beginning from the seeds.

### `GET /api/admin/overview`

```json
{
  "pages": 41, "terms": 456, "postings": 985, "links": 137, "avgPageLength": 31, "avgQueryMs": 5.4,
  "crawl": { "...": "crawl status as above" },
  "pipeline": [{ "step": "Crawl", "detail": "41 sample pages loaded", "finishedAt": "2026-11-13T06:33:00+00:00" }],
  "topPages": [{ "id": 7, "title": "Information retrieval", "url": "https://...", "pagerank": 0.0506 }]
}
```

`avgQueryMs` is the average of the last 200 searches, or `null` before the first search. `pipeline` always lists Crawl, Parse, Index and PageRank; a step that hasn't run has `finishedAt: null`.

### `GET /api/admin/evaluation`

```json
{
  "blended": {
    "weight": 0.7,
    "meanPrecisionAt10": 0.33,
    "mrr": 1.0,
    "rows": [{ "query": "pagerank", "relevant": 5, "found": 5, "precisionAt10": 0.5, "firstRelevantRank": 1, "reciprocalRank": 1.0 }]
  },
  "bm25Only": { "weight": 1.0, "meanPrecisionAt10": 0.34, "mrr": 1.0, "rows": [] }
}
```

Test queries and their relevant URLs are in `backend/evaluation/test_queries.json`.
