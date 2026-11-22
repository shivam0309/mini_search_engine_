# Back-end

Python + FastAPI. Each folder is one module from the project plan.

| Folder | Module | Main file | What it does |
| --- | --- | --- | --- |
| `crawler/` | M1 Web Crawler | `crawler.py`, `runner.py` | Fetches pages with httpx, obeys robots.txt, waits between requests, follows links to the seed sites, keeps its queue in the database |
| `text_processing/` | M2 Text Processor | `processor.py` | HTML → text with BeautifulSoup, tokenize, remove stop words, Porter stem (NLTK) |
| `indexer/` | M3 Indexer | `indexer.py` | Builds the inverted index: `terms`, `postings` (with word positions) and `words` |
| `ranking/` | M4 Ranking Engine | `bm25.py`, `pagerank.py`, `blend.py` | BM25 relevance, PageRank with NetworkX, final = 0.7 × relevance + 0.3 × authority |
| `query/` | M5 Query Processor | `query_processor.py` | Phrases, paging, "did you mean", typo correction, snippets |
| `evaluation/` | M8 Evaluation | `metrics.py`, `test_queries.json` | Precision@10 and MRR |
| `app/` | API for M6 and M7 | `main.py`, `api/`, `auth.py`, `db.py` | FastAPI routes, admin sign-in, rate limits, SQLite/PostgreSQL access |

## Set up

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux / macOS
pip install -r requirements.txt
```

## Commands (run from this folder)

| Command | What it does |
| --- | --- |
| `uvicorn app.main:app --reload` | Start the API on http://localhost:8000. Interactive docs at http://localhost:8000/docs |
| `python manage.py load-sample` | Replace the database with the 41 sample pages and build the index |
| `python manage.py add-seed URL` | Add a site for the crawler to start from |
| `python manage.py crawl` | Crawl the seed sites. Ctrl+C stops; run it again to carry on. `--max-pages 3000` saves a new page limit first |
| `python manage.py index` | Rebuild the inverted index and PageRank |
| `python manage.py search "web crawler"` | Search from the terminal |
| `python manage.py evaluate` | Precision@10 and MRR on the test queries |
| `python manage.py benchmark` | How long each test query takes |
| `pytest` | Run the 47 tests |

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///backend/search.db` | Use `postgresql://user:password@host:5432/dbname` for PostgreSQL |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin` | Admin sign-in. Change the password before sharing the server |
| `FRONTEND_ORIGINS` | `http://localhost:3000` | Front-end addresses allowed to call the API (comma-separated) |
| `LOAD_SAMPLE_IF_EMPTY` | off | `true` loads the 41 sample pages when the server starts with an empty database (no pages, no seed URLs) |
| `TEST_DATABASE_URL` | temporary SQLite file | Database used by `pytest` |

Crawl limits (maximum pages, link depth, delay, robots.txt, user agent) are set on the admin dashboard and stored in the database.

## How a search is answered

1. The query is tokenized, stop words are removed and words are stemmed, exactly as pages were.
2. Each stem's postings are read from the inverted index and every matching page gets a BM25 score.
3. Pages without each "quoted phrase" are dropped, using the stored word positions.
4. BM25 is scaled by the best match, PageRank by the highest PageRank, and the two are blended 0.7 / 0.3.
5. If nothing matched and a word isn't in the index, the closest indexed word (Levenshtein distance) is used instead and the page says so.

The API's JSON shapes are in `../docs/api-contract.md`.
