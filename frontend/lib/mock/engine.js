// A small, in-browser version of the search pipeline so the UI works
// before the Python back-end exists. It follows the same steps as the
// planned back-end: tokenize -> remove stop words -> stem -> inverted index
// -> BM25 + PageRank blend. The back-end will replace this file.

import { DOCUMENTS } from './documents';

export const RESULTS_PER_PAGE = 10;
export const BM25_WEIGHT = 0.7; // final = 0.7 x BM25 + 0.3 x PageRank
const K1 = 1.5; // BM25 term-frequency saturation
const B = 0.75; // BM25 length normalisation

const STOPWORDS = new Set(
  ('a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
    'me my no not of on or our so such than that the their them then there these they this to was we were what ' +
    'when where which who why will with you your')
    .split(' ')
);

// ---------- Text processing (M2) ----------

export function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

export function isStopword(word) {
  return STOPWORDS.has(word);
}

// Simplified suffix stripping. The back-end uses NLTK's Porter stemmer.
export function stem(word) {
  if (word.length <= 3) return word;
  let w = word;
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (/(x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);

  for (const suffix of ['ing', 'ed']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length);
      if (/([^aeiouslz])\1$/.test(w)) w = w.slice(0, -1); // stemm -> stem
      break;
    }
  }
  return w;
}

// ---------- Indexer (M3) ----------

function buildIndex(docs) {
  const postings = new Map(); // stem -> Map(docIndex -> term frequency)
  const lengths = [];
  const vocabulary = new Set(); // plain words, used for "did you mean"

  docs.forEach((doc, i) => {
    let length = 0;
    for (const word of tokenize(`${doc.title} ${doc.text}`)) {
      if (isStopword(word)) continue;
      if (word.length >= 3 && !/^\d+$/.test(word)) vocabulary.add(word);
      const s = stem(word);
      if (!postings.has(s)) postings.set(s, new Map());
      const list = postings.get(s);
      list.set(i, (list.get(i) || 0) + 1);
      length++;
    }
    lengths.push(length);
  });

  const avgLength = lengths.reduce((a, b) => a + b, 0) / docs.length;
  return { postings, lengths, avgLength, vocabulary };
}

// ---------- PageRank (M4) ----------

export function computePageRank(docs, damping = 0.85, iterations = 50) {
  const n = docs.length;
  const position = new Map(docs.map((d, i) => [d.id, i]));
  const outLinks = docs.map((d) => d.links.map((id) => position.get(id)).filter((j) => j !== undefined));
  let rank = new Array(n).fill(1 / n);

  for (let step = 0; step < iterations; step++) {
    const next = new Array(n).fill((1 - damping) / n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      if (outLinks[i].length === 0) {
        dangling += rank[i];
        continue;
      }
      const share = (damping * rank[i]) / outLinks[i].length;
      for (const j of outLinks[i]) next[j] += share;
    }
    for (let i = 0; i < n; i++) next[i] += (damping * dangling) / n;
    rank = next;
  }
  return rank;
}

const INDEX = buildIndex(DOCUMENTS);
const PAGERANK = computePageRank(DOCUMENTS);
const MAX_PAGERANK = Math.max(...PAGERANK);

// ---------- Query processor (M5) ----------

export function parseQuery(raw) {
  const phrases = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim().toLowerCase()).filter(Boolean);
  const terms = tokenize(raw).map((word) => {
    const s = stem(word);
    return { word, stem: s, stop: isStopword(word), indexed: INDEX.postings.has(s) };
  });
  return { raw, phrases, terms };
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length];
}

function closestWord(word) {
  const maxDistance = word.length <= 4 ? 1 : 2;
  let best = null;
  let bestDistance = maxDistance + 1;
  let bestFrequency = 0;
  for (const candidate of INDEX.vocabulary) {
    if (Math.abs(candidate.length - word.length) > maxDistance) continue;
    const distance = levenshtein(word, candidate);
    const frequency = INDEX.postings.get(stem(candidate))?.size || 0;
    if (distance < bestDistance || (distance === bestDistance && frequency > bestFrequency)) {
      best = candidate;
      bestDistance = distance;
      bestFrequency = frequency;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}

function suggestSpelling(query) {
  let changed = false;
  const words = query.terms.map((t) => {
    if (t.stop || INDEX.postings.has(t.stem) || /^\d+$/.test(t.word)) return t.word;
    const fix = closestWord(t.word);
    if (fix && fix !== t.word) {
      changed = true;
      return fix;
    }
    return t.word;
  });
  return changed ? words.join(' ') : null;
}

// ---------- Ranking engine (M4) ----------

function rank(query, weight) {
  const N = DOCUMENTS.length;
  const stems = [...new Set(query.terms.filter((t) => !t.stop).map((t) => t.stem))];
  const bm25 = new Map();

  for (const s of stems) {
    const list = INDEX.postings.get(s);
    if (!list) continue;
    const idf = Math.log(1 + (N - list.size + 0.5) / (list.size + 0.5));
    for (const [i, tf] of list) {
      const norm = 1 - B + B * (INDEX.lengths[i] / INDEX.avgLength);
      bm25.set(i, (bm25.get(i) || 0) + (idf * tf * (K1 + 1)) / (tf + K1 * norm));
    }
  }

  // Phrase search: every quoted phrase must appear as-is.
  if (query.phrases.length) {
    for (const i of [...bm25.keys()]) {
      const text = `${DOCUMENTS[i].title} ${DOCUMENTS[i].text}`.toLowerCase().replace(/\s+/g, ' ');
      if (!query.phrases.every((p) => text.includes(p))) bm25.delete(i);
    }
  }

  const maxBm25 = Math.max(0, ...bm25.values());
  const scored = [...bm25.entries()].map(([i, raw]) => {
    const relevance = raw / maxBm25;
    const authority = PAGERANK[i] / MAX_PAGERANK;
    return { i, bm25Raw: raw, relevance, authority, score: weight * relevance + (1 - weight) * authority };
  });
  scored.sort((a, b) => b.score - a.score || b.relevance - a.relevance);
  return { scored, stems: new Set(stems) };
}

// ---------- Snippets ----------

function isHit(word, stems) {
  const lower = word.toLowerCase();
  return !isStopword(lower) && stems.has(stem(lower));
}

function makeSnippet(doc, stems) {
  // Split after ". " so "robots.txt" and "0.85" stay in one piece.
  const sentences = doc.text.split(/(?<=[.!?])\s+/);
  let bestIndex = 0;
  let bestHits = -1;
  sentences.forEach((sentence, index) => {
    const hits = tokenize(sentence).filter((w) => isHit(w, stems)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestIndex = index;
    }
  });

  let text = sentences[bestIndex].trim();
  if (text.length < 120 && sentences[bestIndex + 1]) text += ` ${sentences[bestIndex + 1].trim()}`;
  if (text.length > 230) text = `${text.slice(0, 227).replace(/\s+\S*$/, '')} …`;
  if (bestIndex > 0) text = `… ${text}`;

  const segments = [];
  for (const part of text.split(/([A-Za-z0-9]+)/)) {
    if (!part) continue;
    const hit = /^[A-Za-z0-9]+$/.test(part) && isHit(part, stems);
    const last = segments[segments.length - 1];
    if (last && last.hit === hit) last.text += part;
    else segments.push({ text: part, hit });
  }
  return segments;
}

function matchedWords(doc, query) {
  const words = new Set(tokenize(`${doc.title} ${doc.text}`).map(stem));
  return [...new Set(query.terms.filter((t) => !t.stop && words.has(t.stem)).map((t) => t.word))];
}

// ---------- Public API (same shape the FastAPI back-end will return) ----------

export function search(rawQuery, { page = 1, weight = BM25_WEIGHT } = {}) {
  const started = performance.now();
  const original = (rawQuery || '').trim();
  let query = parseQuery(original);
  let suggestion = suggestSpelling(query);
  let ranked = rank(query, weight);
  let correctedFrom = null;

  if (ranked.scored.length === 0 && suggestion) {
    correctedFrom = original;
    query = parseQuery(suggestion);
    ranked = rank(query, weight);
    suggestion = null;
  }

  const total = ranked.scored.length;
  const pages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * RESULTS_PER_PAGE;

  const results = ranked.scored.slice(start, start + RESULTS_PER_PAGE).map((r, n) => {
    const doc = DOCUMENTS[r.i];
    return {
      id: doc.id,
      position: start + n + 1,
      title: doc.title,
      url: doc.url,
      snippet: makeSnippet(doc, ranked.stems),
      matched: matchedWords(doc, query),
      scores: {
        bm25: round(r.bm25Raw),
        relevance: round(r.relevance),
        authority: round(r.authority),
        final: round(r.score),
      },
    };
  });

  return {
    query: correctedFrom ? query.raw : original,
    correctedFrom,
    suggestion,
    terms: query.terms,
    phrases: query.phrases,
    weight,
    total,
    page: current,
    pages,
    results,
    tookMs: round(performance.now() - started, 1),
  };
}

export function rankedIds(rawQuery, weight = BM25_WEIGHT) {
  return rank(parseQuery(rawQuery), weight).scored.map((r) => DOCUMENTS[r.i].id);
}

export function indexStats() {
  const links = DOCUMENTS.reduce((sum, d) => sum + d.links.length, 0);
  let postings = 0;
  for (const list of INDEX.postings.values()) postings += list.size;
  return {
    pages: DOCUMENTS.length,
    terms: INDEX.postings.size,
    postings,
    links,
    avgPageLength: Math.round(INDEX.avgLength),
  };
}

export function topPagesByPageRank(limit = 5) {
  return DOCUMENTS.map((d, i) => ({ id: d.id, title: d.title, url: d.url, pagerank: round(PAGERANK[i], 4) }))
    .sort((a, b) => b.pagerank - a.pagerank)
    .slice(0, limit);
}

function round(value, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// ---------- Explain one query (the "How it works" page) ----------

const IN_LINKS = DOCUMENTS.map((doc) => DOCUMENTS.filter((d) => d.id !== doc.id && d.links.includes(doc.id)));

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function positionsOf(doc, s) {
  const out = [];
  tokenize(`${doc.title} ${doc.text}`).forEach((word, pos) => {
    if (out.length < 8 && !isStopword(word) && stem(word) === s) out.push(pos);
  });
  return out;
}

// Same shape as GET /api/explain on the back-end.
export function explain(rawQuery, { weight = BM25_WEIGHT } = {}) {
  const started = performance.now();
  const original = (rawQuery || '').trim();
  let query = parseQuery(original);
  let suggestion = suggestSpelling(query);
  let ranked = rank(query, weight);
  let correctedFrom = null;
  if (ranked.scored.length === 0 && suggestion) {
    correctedFrom = original;
    query = parseQuery(suggestion);
    ranked = rank(query, weight);
    suggestion = null;
  }

  const N = DOCUMENTS.length;
  const idfOf = (df) => Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const stems = [...new Set(query.terms.filter((t) => !t.stop).map((t) => t.stem))].map((s) => {
    const list = INDEX.postings.get(s);
    return {
      stem: s,
      words: [...new Set(query.terms.filter((t) => t.stem === s).map((t) => t.word))],
      indexed: Boolean(list),
      docFreq: list ? list.size : 0,
      idf: list ? round(idfOf(list.size), 4) : null,
    };
  });

  const results = ranked.scored.slice(0, 10).map((r, n) => {
    const doc = DOCUMENTS[r.i];
    const norm = 1 - B + B * (INDEX.lengths[r.i] / INDEX.avgLength);
    const terms = stems
      .filter((s) => s.indexed && INDEX.postings.get(s.stem).has(r.i))
      .map((s) => {
        const tf = INDEX.postings.get(s.stem).get(r.i);
        return {
          stem: s.stem,
          tf,
          positions: positionsOf(doc, s.stem),
          score: round((idfOf(s.docFreq) * tf * (K1 + 1)) / (tf + K1 * norm), 4),
        };
      });
    return {
      id: doc.id,
      position: n + 1,
      title: doc.title,
      url: doc.url,
      host: hostOf(doc.url),
      crawledAt: null,
      length: INDEX.lengths[r.i],
      pagerank: round(PAGERANK[r.i], 6),
      inLinks: IN_LINKS[r.i].length,
      linkedFrom: IN_LINKS[r.i].slice(0, 6).map((d) => d.title),
      terms,
      bm25: round(r.bm25Raw, 4),
      relevance: round(r.relevance, 4),
      authority: round(r.authority, 4),
      final: round(r.score, 4),
    };
  });

  const stats = indexStats();
  return {
    query: correctedFrom ? query.raw : original,
    correctedFrom,
    suggestion,
    terms: query.terms,
    phrases: query.phrases,
    index: {
      pages: N,
      sites: new Set(DOCUMENTS.map((d) => hostOf(d.url))).size,
      terms: stats.terms,
      links: stats.links,
      avgLength: round(INDEX.avgLength, 4),
      maxPagerank: round(MAX_PAGERANK, 6),
    },
    params: { k1: K1, b: B, damping: 0.85, weight },
    stems,
    total: ranked.scored.length,
    bestBm25: round(ranked.scored.reduce((best, r) => Math.max(best, r.bm25Raw), 0), 4),
    results,
    tookMs: round(performance.now() - started, 1),
  };
}
