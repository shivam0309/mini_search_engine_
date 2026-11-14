"""Command-line tools. Run them from the backend folder:

    python manage.py load-sample          load the 41 sample pages and build the index
    python manage.py add-seed URL         add a site for the crawler to start from
    python manage.py crawl                crawl the seed sites (Ctrl+C stops; run again to resume)
    python manage.py crawl --max-pages 3000   ... and save a new page limit first
    python manage.py index                rebuild the inverted index and PageRank
    python manage.py search "web crawler" search from the terminal
    python manage.py evaluate             Precision@10 and MRR on the test queries
    python manage.py benchmark            how long each test query takes (target: under 300 ms)
"""

import argparse
import statistics
import sys
import time

from app.db import Database, init_db, now
from app.sample_data import load_sample
from crawler.crawler import normalize_url
from crawler.runner import CrawlError, CrawlRunner
from evaluation.metrics import compare, load_test_queries
from indexer.indexer import rebuild_index
from query.query_processor import search
from ranking.pagerank import compute_pagerank


def cmd_load_sample(_args):
    with Database() as db:
        count = load_sample(db)
    print(f"Loaded {count} sample pages and built the index.")


def cmd_add_seed(args):
    url = normalize_url(args.url)
    if not url:
        sys.exit("Enter a full address that starts with http:// or https://")
    with Database() as db:
        db.execute("INSERT INTO seeds (url, added_at) VALUES (?, ?) ON CONFLICT (url) DO NOTHING", (url, now()))
    print(f"Seed URL added: {url}")


def cmd_crawl(args):
    if args.max_pages is not None:
        if not 1 <= args.max_pages <= 100_000:
            sys.exit("--max-pages must be between 1 and 100000")
        with Database() as db:
            db.set_setting("maxPages", args.max_pages)
        print(f"Page limit set to {args.max_pages}.")
    runner = CrawlRunner()
    try:
        runner.start()
    except CrawlError as error:
        sys.exit(str(error))
    print("Crawling. Press Ctrl+C to stop; run this command again to carry on later.")
    try:
        while runner.busy():
            time.sleep(5)
            with Database() as db:
                s = runner.status(db)
            print(f"  {s['state']}: {s['crawled']} pages stored, {s['skipped']} skipped, {s['queued']} waiting")
    except KeyboardInterrupt:
        print("Stopping and rebuilding the index…")
        runner.stop()
        runner.wait()
    if runner.error:
        sys.exit(runner.error)
    print("Done. The index and PageRank are up to date.")


def cmd_index(_args):
    with Database() as db:
        index = rebuild_index(db)
        pagerank = compute_pagerank(db)
    print(f"Indexed {index['pages']} pages: {index['terms']} terms, {index['postings']} postings ({index['tookMs']} ms).")
    print(f"PageRank over {pagerank['links']} links ({pagerank['tookMs']} ms).")


def cmd_search(args):
    with Database() as db:
        result = search(db, args.query, args.page)
    if result["correctedFrom"]:
        print(f"No pages matched \"{result['correctedFrom']}\". Showing results for \"{result['query']}\".")
    elif result["suggestion"]:
        print(f"Did you mean: {result['suggestion']}")
    print(f"{result['total']} results in {result['tookMs']} ms (page {result['page']} of {result['pages']})\n")
    for r in result["results"]:
        s = r["scores"]
        print(f"{r['position']:>3}. {r['title']}  [score {s['final']:.2f} = relevance {s['relevance']:.2f}, authority {s['authority']:.2f}]")
        print(f"     {r['url']}")


def cmd_evaluate(_args):
    with Database() as db:
        results = compare(db)
    for name, run in (("BM25 + PageRank", results["blended"]), ("BM25 only", results["bm25Only"])):
        print(f"\n{name}: mean Precision@10 {run['meanPrecisionAt10']:.2f}, MRR {run['mrr']:.2f}")
        for row in run["rows"]:
            first = row["firstRelevantRank"] or "-"
            print(f"  {row['query']:<28} P@10 {row['precisionAt10']:.2f}   first relevant at {first}")


def cmd_benchmark(_args):
    with Database() as db:
        pages = db.value("SELECT COUNT(*) FROM pages WHERE length > 0")
        print(f"Search speed on {pages:,} indexed pages (5 runs per query):\n")
        worst = 0.0
        for item in load_test_queries():
            times = [search(db, item["query"])["tookMs"] for _ in range(5)]
            worst = max(worst, max(times))
            print(f"  {item['query']:<28} median {statistics.median(times):6.1f} ms   max {max(times):6.1f} ms")
    print(f"\nSlowest search: {worst:.1f} ms ({'within' if worst < 300 else 'over'} the 300 ms target)")


def main():
    parser = argparse.ArgumentParser(description="Mini Search Engine tools")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("load-sample", help="load the 41 sample pages").set_defaults(run=cmd_load_sample)
    seed = commands.add_parser("add-seed", help="add a seed URL")
    seed.add_argument("url")
    seed.set_defaults(run=cmd_add_seed)
    crawl = commands.add_parser("crawl", help="crawl the seed sites")
    crawl.add_argument("--max-pages", type=int, help="save a new page limit before crawling")
    crawl.set_defaults(run=cmd_crawl)
    commands.add_parser("index", help="rebuild the index and PageRank").set_defaults(run=cmd_index)
    find = commands.add_parser("search", help="search from the terminal")
    find.add_argument("query")
    find.add_argument("--page", type=int, default=1)
    find.set_defaults(run=cmd_search)
    commands.add_parser("evaluate", help="Precision@10 and MRR").set_defaults(run=cmd_evaluate)
    commands.add_parser("benchmark", help="time the test queries").set_defaults(run=cmd_benchmark)

    args = parser.parse_args()
    init_db()
    args.run(args)


if __name__ == "__main__":
    main()
