// Sample data for the admin dashboard, built from the sample pages so the
// numbers on screen always agree with what the search page can find.

import { DOCUMENTS } from './documents';
import { BM25_WEIGHT, indexStats, rankedIds, search, topPagesByPageRank } from './engine';

export const DEFAULT_SETTINGS = {
  maxPages: 10000,
  maxDepth: 3,
  delaySeconds: 1,
  obeyRobots: true,
  userAgent: 'MiniSearchBot/0.1 (MCA-I college project)',
};

const SEED_URLS = [
  'https://en.wikipedia.org/wiki/Search_engine',
  'https://docs.python.org/3/library/',
  'https://developer.mozilla.org/en-US/docs/Web/',
  'https://www.postgresql.org/docs/current/',
  'https://www.nltk.org/api/',
  'https://networkx.org/documentation/stable/',
  'https://fastapi.tiangolo.com/tutorial/',
];

export function sampleSeeds() {
  return SEED_URLS.map((url, n) => {
    const host = new URL(url).host;
    return {
      id: n + 1,
      url,
      host,
      pages: DOCUMENTS.filter((d) => new URL(d.url).host === host).length,
      status: 'Crawled',
      lastCrawled: '2026-10-28T18:30:00+05:30',
    };
  });
}

// One row per fetched page, plus a few skipped URLs to show the crawler's rules.
export function sampleCrawlLog() {
  const start = new Date('2026-10-28T18:30:00+05:30').getTime();
  const rows = DOCUMENTS.map((d, n) => ({
    id: n + 1,
    time: new Date(start + n * 1000).toISOString(),
    url: d.url,
    status: 200,
    outcome: 'Indexed',
  }));
  rows.splice(6, 0, {
    id: 101,
    time: new Date(start + 6 * 1000 + 400).toISOString(),
    url: 'https://en.wikipedia.org/wiki/Special:Random',
    status: null,
    outcome: 'Blocked by robots.txt',
  });
  rows.splice(15, 0, {
    id: 102,
    time: new Date(start + 15 * 1000 + 300).toISOString(),
    url: 'https://en.wikipedia.org/wiki/Web_crawler#Politeness',
    status: null,
    outcome: 'Already seen',
  });
  rows.splice(27, 0, {
    id: 103,
    time: new Date(start + 27 * 1000 + 600).toISOString(),
    url: 'https://docs.python.org/3/library/robotparser-old.html',
    status: 404,
    outcome: 'Not found',
  });
  return rows.reverse(); // newest first
}

export function sampleOverview() {
  // Average query time: run every test query a few times on this machine.
  const times = [];
  for (let round = 0; round < 5; round++) {
    for (const t of TEST_QUERIES) times.push(search(t.query).tookMs);
  }
  const avgQueryMs = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
  return {
    ...indexStats(),
    avgQueryMs,
    crawl: { state: 'idle', crawled: DOCUMENTS.length, limit: DEFAULT_SETTINGS.maxPages },
    pipeline: [
      { step: 'Crawl', detail: `${DOCUMENTS.length} pages fetched, 3 skipped`, finishedAt: '2026-10-28T18:31:00+05:30' },
      { step: 'Parse', detail: 'HTML cleaned, tokenized and stemmed', finishedAt: '2026-10-28T18:31:20+05:30' },
      { step: 'Index', detail: 'Inverted index rebuilt', finishedAt: '2026-10-28T18:31:25+05:30' },
      { step: 'PageRank', detail: '50 iterations, damping 0.85', finishedAt: '2026-10-28T18:31:26+05:30' },
    ],
    topPages: topPagesByPageRank(5),
  };
}

// ---------- Evaluation (M8) ----------
// Test queries with the pages a person judged relevant for each.
export const TEST_QUERIES = [
  { query: 'pagerank', relevant: ['pagerank', 'networkx-pagerank', 'markov-chain', 'larry-page', 'graph-theory'] },
  { query: 'web crawler', relevant: ['web-crawler', 'robots-txt', 'py-robotparser', 'web-scraping', 'py-asyncio'] },
  { query: 'inverted index', relevant: ['inverted-index', 'search-engine-indexing', 'database-index', 'pg-indexes'] },
  { query: 'bm25 ranking', relevant: ['okapi-bm25', 'tf-idf', 'vector-space-model', 'relevance'] },
  { query: 'porter stemmer', relevant: ['stemming', 'nltk-porter', 'nlp'] },
  { query: 'stop words', relevant: ['stop-word', 'text-segmentation', 'nlp'] },
  { query: 'precision recall', relevant: ['precision-recall', 'mrr', 'relevance'] },
  { query: 'spelling did you mean', relevant: ['levenshtein', 'google-search', 'query-expansion', 'web-search-query'] },
  { query: 'http status codes', relevant: ['mdn-status', 'http'] },
  { query: 'full text search database', relevant: ['pg-textsearch', 'postgresql', 'database-index', 'pg-indexes'] },
];

function evaluateWith(weight) {
  const rows = TEST_QUERIES.map(({ query, relevant }) => {
    const judged = new Set(relevant);
    const ids = rankedIds(query, weight);
    const top10 = ids.slice(0, 10);
    const found = top10.filter((id) => judged.has(id)).length;
    const firstHit = ids.findIndex((id) => judged.has(id));
    return {
      query,
      relevant: relevant.length,
      found,
      precisionAt10: found / 10,
      firstRelevantRank: firstHit === -1 ? null : firstHit + 1,
      reciprocalRank: firstHit === -1 ? 0 : 1 / (firstHit + 1),
    };
  });
  const mean = (key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  return { weight, rows, meanPrecisionAt10: mean('precisionAt10'), mrr: mean('reciprocalRank') };
}

export function sampleEvaluation() {
  return { blended: evaluateWith(BM25_WEIGHT), bm25Only: evaluateWith(1) };
}
