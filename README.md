# Mini Search Engine

A web-based search engine built from scratch: it crawls a chosen set of websites, builds its own inverted index, and ranks results by blending BM25 relevance with PageRank authority. No third-party search APIs.

MCA-I Mini Project · Shivam Ashok Sinhasane (Roll No. 115) · Guide: Prof. Pranita Manjare
D Y Patil Institute of MCA and Management, Akurdi

## Screenshots

| Search | Results with score breakdown |
| --- | --- |
| ![Home page](docs/screenshots/01-home.png) | ![Results page](docs/screenshots/03-results-why-this-rank.png) |
| **Admin overview** | **Evaluation** |
| ![Admin overview](docs/screenshots/10-admin-overview.png) | ![Evaluation page](docs/screenshots/13-admin-evaluation.png) |

Every screen, including mobile, is in [`docs/screenshots`](docs/screenshots).

## What it does

| Module | What is built | Where |
| --- | --- | --- |
| M1 Web Crawler | Follows links from seed URLs on the same sites, obeys robots.txt, waits at least 1 second between requests to a site, skips duplicates, and resumes after a crash | `backend/crawler/` |
| M2 Text Processor | Strips HTML and menus, splits text into words, removes stop words, Porter-stems with NLTK | `backend/text_processing/` |
| M3 Indexer | Inverted index of terms, postings, counts and word positions | `backend/indexer/` |
| M4 Ranking Engine | BM25 relevance + NetworkX PageRank, blended 0.7 / 0.3 | `backend/ranking/` |
| M5 Query Processor | Phrase search in quotes, paging, "did you mean", automatic typo fixes, highlighted snippets | `backend/query/` |
| M6 Search Interface | Next.js search and results pages, desktop and mobile | `frontend/app/` |
| M7 Admin Dashboard | Sign-in, seed URLs, crawl limits, live crawl progress, crawl log, index rebuild | `frontend/app/admin/`, `backend/app/api/` |
| M8 Evaluation | Precision@10 and MRR on 10 hand-judged test queries, BM25 + PageRank vs BM25 only | `backend/evaluation/` |

Non-functional requirements: searches take well under 300 ms on 10,000 pages (see [Performance](#performance)). Data is stored in SQLite by default or PostgreSQL, input is checked, searches and sign-ins are rate-limited, there are 43 tests, and it runs on Windows and Linux.

## Folder structure

```
mini-search-engine/
├── frontend/              Next.js app (search pages + admin dashboard)
│   ├── app/               One folder per page (/, /search, /login, /admin/...)
│   ├── components/        Reusable UI pieces (search box, result card, score bar...)
│   └── lib/
│       ├── api.js         The only file that talks to the back-end
│       └── mock/          Sample pages + a small JS version of the pipeline (sample mode)
├── backend/               Python + FastAPI
│   ├── app/               API routes, sign-in, database access, settings
│   ├── crawler/           M1 Web Crawler
│   ├── text_processing/   M2 Text Processor
│   ├── indexer/           M3 Indexer
│   ├── ranking/           M4 Ranking Engine (BM25 + PageRank)
│   ├── query/             M5 Query Processor
│   ├── evaluation/        M8 Evaluation (Precision@10, MRR) and test queries
│   ├── data/              The 41 sample pages
│   ├── tests/             Unit and API tests (pytest)
│   └── manage.py          Command-line tools: load data, crawl, index, search, evaluate
├── database/
│   └── schema.sql         Tables for pages, links, terms, postings, crawl queue and log
└── docs/
    ├── api-contract.md    Every endpoint and the JSON it returns
    └── screenshots/       Every screen, desktop and mobile
```

## Run it

You need **Python 3.10+** and **Node.js 20+**.

### 1. Back-end (terminal 1)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
source .venv/bin/activate         # Linux / macOS
pip install -r requirements.txt

python manage.py load-sample      # 41 sample pages, ready to search
uvicorn app.main:app --reload     # API on http://localhost:8000 (docs at /docs)
```

### 2. Front-end (terminal 2)

```bash
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

Before `npm run dev`, copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:8000` in it, so the front-end uses the back-end.

Admin pages are at http://localhost:3000/admin. Sign in with username `admin` and password `admin`. To use your own, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before starting the back-end.

### Crawl real websites

1. Sign in, open **Seed URLs & limits**, add the sites to crawl (for example `https://en.wikipedia.org/wiki/Search_engine`) and set the limits.
2. On **Overview**, press **Start crawl**. Progress and the crawl log update live. **Stop crawl** stops it; **Resume crawl** carries on later.
3. When the crawl ends, the index and PageRank are rebuilt automatically and the new pages are searchable.

At 1 request per second per site, 10,000 pages from one site takes about 3 hours. The same can be done from the terminal: `python manage.py add-seed URL`, then `python manage.py crawl`.

### Sample mode (no back-end)

Without `NEXT_PUBLIC_API_URL`, the front-end runs on its own with the 41 sample pages and a small JavaScript copy of the pipeline. This is how the Vercel demo runs. In sample mode any username and password opens the admin pages.

### PostgreSQL

SQLite needs no set-up and is used by default (`backend/search.db`). To use PostgreSQL, create a database and set `DATABASE_URL` before running any command:

```bash
set "DATABASE_URL=postgresql://postgres:password@localhost:5432/minisearch"        # Windows Command Prompt
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/minisearch"     # Windows PowerShell
export DATABASE_URL="postgresql://postgres:password@localhost:5432/minisearch"     # Linux / macOS
```

Keep the quotes: connection strings often contain `&`, which the terminal would otherwise treat as the start of another command.

The tables are created automatically on first run.

## Deploy

The front-end runs on **Vercel**, the API on **Render** and the database on **Neon** (PostgreSQL). All three have free plans.

1. **Database.** Create a project at neon.com (the Singapore region is closest to India). Click **Connect**, turn **Connection pooling** off and copy the connection string, `postgresql://...neon.tech/neondb?sslmode=require`.
2. **Front-end.** In Vercel, import this repository with **Root Directory** set to `frontend` and deploy. It runs on the sample data until step 4. Note its address, e.g. `https://name.vercel.app`.
3. **API.** In Render choose **New > Blueprint** and pick this repository. When asked, enter `DATABASE_URL` (step 1), `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `FRONTEND_ORIGINS` (the Vercel address from step 2). `render.yaml` sets up everything else. On its first start the API sees an empty database and loads the 41 sample pages (`LOAD_SAMPLE_IF_EMPTY`). When it's live, `https://<service>.onrender.com/api/stats` shows `{"pages":41,"sites":7}`.
4. **Connect them.** In the Vercel project, add the environment variable `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com`, then redeploy. The value is built into the site, so the redeploy is needed.

Crawling: start crawls from the admin dashboard, or from a laptop with `DATABASE_URL` set to the Neon string: `python manage.py add-seed URL`, then `python manage.py crawl --max-pages 3000`. The laptop is better for long crawls, because it doesn't fall asleep like a free Render service.

Setting up the API by hand instead of with the Blueprint: leave **Root Directory** empty, use `cd backend && pip install -r requirements.txt` as the build command and `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` as the start command, and add the same environment variables plus `LOAD_SAMPLE_IF_EMPTY=true`. The root directory has to stay empty because Render hides files outside it, and the API needs `database/schema.sql`.

Things to know on the free plans:
- Render puts a free service to sleep after 15 minutes without requests, and it takes about a minute to wake up. Open the site shortly before a demo.
- A crawl started from the dashboard stops if the service sleeps. **Resume crawl** carries on from where it stopped.
- The crawler runs inside the API, so keep the service at a single instance.
- Neon's free plan has 1 GB per project. Long pages such as Wikipedia articles fill it quickly, so keep **Maximum pages** to a few thousand there.

## Tests

```bash
cd backend
pytest                            # 43 tests on SQLite
```

To run the same tests on PostgreSQL, set `TEST_DATABASE_URL` to an empty test database first. The crawler tests run against a small website started inside the tests, so they need no internet connection.

## Performance

These figures were measured on 10,041 pages (the 41 sample pages plus 10,000 generated pages with realistic word frequencies and links): 3.5 million postings and 38,000 links.

| | SQLite | PostgreSQL |
| --- | --- | --- |
| Full index rebuild | 33 s | 61 s |
| PageRank | 0.4 s | 0.5 s |
| Typical search (2 words) | 40–90 ms | 30–90 ms |
| Worst case (3 words found on every page) | 220 ms | 220 ms |

Run `python manage.py benchmark` to time the test queries on your own crawl.
