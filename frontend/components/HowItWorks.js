'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { formatDateTime, formatNumber } from '@/lib/format';

// The interactive walk-through on /how-it-works. `data` comes from
// GET /api/explain (or lib/mock/engine.js in sample mode).

const STEPS = [
  { key: 'crawl', name: 'Crawl', c: 'blue', module: 'M1 Web Crawler' },
  { key: 'process', name: 'Process', c: 'coral', module: 'M2 Text Processor' },
  { key: 'index', name: 'Index', c: 'yellow', module: 'M3 Indexer' },
  { key: 'rank', name: 'Rank', c: 'green', module: 'M4 Ranking Engine' },
];

const f = (value, digits = 3) => Number(value).toFixed(digits);

export default function HowItWorks({ data }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const [weight, setWeight] = useState(data.params.weight);
  const stepsRef = useRef(null);
  const page = data.results[selected];
  const current = STEPS[step];

  // Change step, and bring the step tabs back into view if the reader has scrolled past them.
  function go(next) {
    setStep(next);
    requestAnimationFrame(() => {
      const el = stepsRef.current;
      const header = document.querySelector('.site-header')?.offsetHeight || 0;
      if (el && el.getBoundingClientRect().top < header) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="walk">
      <p className="walk-query">
        Following <strong>“{data.query}”</strong>
        {data.correctedFrom && <span className="small"> (corrected from “{data.correctedFrom}”)</span>}
        <span className="num"> · {data.total} matching {data.total === 1 ? 'page' : 'pages'}</span>
        {data.total > 0 && (
          <>
            {' · '}
            <Link href={`/search?q=${encodeURIComponent(data.query)}`}>See the results</Link>
          </>
        )}
      </p>

      <ol className="walk-steps" role="tablist" aria-label="Steps" ref={stepsRef}>
        {STEPS.map((s, i) => (
          <li key={s.key} style={{ '--c': `var(--${s.c})`, '--c-ink': `var(--${s.c}-ink)`, '--c-tint': `var(--${s.c}-tint)` }}>
            <button
              type="button"
              role="tab"
              id={`tab-${s.key}`}
              aria-selected={step === i}
              aria-controls={`panel-${s.key}`}
              className={step === i ? 'active' : step > i ? 'done' : ''}
              onClick={() => go(i)}
            >
              <span className="n">{i + 1}</span>
              <span className="name">{s.name}</span>
              <span className="mod">{s.module}</span>
            </button>
          </li>
        ))}
      </ol>

      <section
        className="walk-panel"
        role="tabpanel"
        id={`panel-${current.key}`}
        aria-labelledby={`tab-${current.key}`}
        style={{ '--c': `var(--${current.c})`, '--c-ink': `var(--${current.c}-ink)`, '--c-tint': `var(--${current.c}-tint)` }}
      >
        {step === 0 && <CrawlStep data={data} selected={selected} onSelect={setSelected} />}
        {step === 1 && <ProcessStep data={data} />}
        {step === 2 && <IndexStep data={data} page={page} />}
        {step === 3 && <RankStep data={data} page={page} selected={selected} onSelect={setSelected} weight={weight} onWeight={setWeight} />}

        <div className="walk-nav">
          <button type="button" className="button secondary" onClick={() => go(step - 1)} disabled={step === 0}>
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="button" onClick={() => go(step + 1)}>
              Next: {STEPS[step + 1].name} →
            </button>
          ) : (
            <Link className="button" href={`/search?q=${encodeURIComponent(data.query)}`}>
              See the search results →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function PagePicker({ results, selected, onSelect, label }) {
  if (!results.length) return null;
  return (
    <div className="picker">
      <p className="picker-label">{label}</p>
      <ol>
        {results.map((r, i) => (
          <li key={r.id}>
            <button type="button" aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="pos num">{r.position}</span>
              <span className="t">{r.title}</span>
              <span className="h">{r.host}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Step 1: crawl ----------

function CrawlStep({ data, selected, onSelect }) {
  const { index } = data;
  const page = data.results[selected];
  return (
    <>
      <h2>Crawl: collecting the pages</h2>
      <p className="lead">
        Long before you searched, the crawler started from a few seed URLs, downloaded each page and followed its links.
        It stays on the seed websites, obeys each site’s robots.txt and waits at least one second between requests to the
        same site.
      </p>
      <div className="walk-stats">
        <div><span className="v num">{formatNumber(index.pages)}</span><span className="l">pages crawled</span></div>
        <div><span className="v num">{index.sites}</span><span className="l">websites</span></div>
        <div><span className="v num">{formatNumber(index.links)}</span><span className="l">links between them</span></div>
      </div>
      {data.total === 0 ? (
        <p className="walk-note">None of the crawled pages contains the words of this query, so there is nothing to follow.</p>
      ) : (
        <>
          <p>
            <strong className="num">{data.total}</strong> of these pages contain at least one word of your query. Pick
            one to follow through the next steps:
          </p>
          <PagePicker results={data.results} selected={selected} onSelect={onSelect} label="Top matching pages" />
          <div className="walk-card">
            <h3>{page.title}</h3>
            <a className="url" href={page.url} target="_blank" rel="noreferrer">{page.url}</a>
            <ul>
              <li>Website: <strong>{page.host}</strong></li>
              {page.crawledAt && <li>Saved by the crawler: <strong>{formatDateTime(page.crawledAt)}</strong></li>}
              <li>
                <strong className="num">{page.inLinks}</strong> other crawled {page.inLinks === 1 ? 'page links' : 'pages link'} to it
                {page.linkedFrom.length > 0 && <>: {page.linkedFrom.join(', ')}{page.inLinks > page.linkedFrom.length ? ' …' : ''}</>}
              </li>
            </ul>
            <p className="walk-note">The crawler saved every one of those links. They become this page’s PageRank in step 4.</p>
          </div>
        </>
      )}
      <p className="where">Code: backend/crawler/crawler.py</p>
    </>
  );
}

// ---------- Step 2: process ----------

function ProcessStep({ data }) {
  const kept = data.terms.filter((t) => !t.stop);
  return (
    <>
      <h2>Process: reading your query like a page</h2>
      <p className="lead">
        Your query goes through the same three steps that every page went through when it was indexed. That is why
        “crawling” in a search can match “crawled” on a page.
      </p>
      <ol className="pipe">
        <li>
          <h3>1. Split into words</h3>
          <p>Lower-case the text and keep only letters and numbers.</p>
          <ul className="token-list">
            {data.terms.map((t, i) => <li key={i} className="token plain">{t.word}</li>)}
          </ul>
        </li>
        <li>
          <h3>2. Remove stop words</h3>
          <p>Very common words like “the” and “how” appear on almost every page, so they are left out.</p>
          <ul className="token-list">
            {data.terms.map((t, i) => <li key={i} className={`token ${t.stop ? 'stop' : 'plain'}`}>{t.word}</li>)}
          </ul>
        </li>
        <li>
          <h3>3. Stem</h3>
          <p>The Porter stemmer cuts each word to its root, so different forms of a word match.</p>
          <ul className="token-list">
            {kept.length === 0 && <li className="token stop">nothing left to search</li>}
            {kept.map((t, i) => (
              <li key={i} className="token">
                {t.word === t.stem ? t.stem : <>{t.word} → <strong>{t.stem}</strong></>}
              </li>
            ))}
          </ul>
        </li>
      </ol>
      {data.phrases.length > 0 && (
        <p className="walk-note">
          Phrase in quotes: {data.phrases.map((p) => `“${p}”`).join(', ')}. These words must stand side by side, in this
          order, on a page.
        </p>
      )}
      <p className="where">Code: backend/text_processing/processor.py</p>
    </>
  );
}

// ---------- Step 3: index ----------

function IndexStep({ data, page }) {
  const { index } = data;
  return (
    <>
      <h2>Index: looking the words up</h2>
      <p className="lead">
        The inverted index works like the index at the back of a book: for every stem it lists the pages that contain it,
        how many times, and at which word positions. A search reads only these lists, never all {formatNumber(index.pages)} pages.
      </p>
      {data.stems.length === 0 && <p className="walk-note">There are no words left to look up.</p>}
      <div className="postings">
        {data.stems.map((s) => {
          const rows = data.results.filter((r) => r.terms.some((t) => t.stem === s.stem)).slice(0, 5);
          return (
            <div key={s.stem} className="posting-card">
              <div className="posting-head">
                <code>{s.stem}</code>
                {s.indexed ? (
                  <span className="num">on <strong>{s.docFreq}</strong> of {index.pages} pages (document frequency)</span>
                ) : (
                  <span className="missing">not in the index: no crawled page has this word</span>
                )}
              </div>
              {s.indexed && (
                <>
                  <div className="df-bar" aria-hidden="true"><span style={{ width: `${(s.docFreq / Math.max(1, index.pages)) * 100}%` }} /></div>
                  <table>
                    <thead>
                      <tr><th>Page</th><th className="right">Times (tf)</th><th>Word positions</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const t = r.terms.find((x) => x.stem === s.stem);
                        return (
                          <tr key={r.id} className={page && r.id === page.id ? 'picked' : undefined}>
                            <td>{r.title}</td>
                            <td className="right num">{t.tf}</td>
                            <td className="num">{t.positions && t.positions.length ? t.positions.join(', ') + (t.tf > t.positions.length ? ' …' : '') : '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {s.docFreq > rows.length && <p className="more num">… and {s.docFreq - rows.length} more {s.docFreq - rows.length === 1 ? 'page' : 'pages'}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="where">Code: backend/indexer/indexer.py · tables terms and postings</p>
    </>
  );
}

// ---------- Step 4: rank ----------

function RankStep({ data, page, selected, onSelect, weight, onWeight }) {
  const { index, params } = data;
  const reranked = useMemo(
    () =>
      data.results
        .map((r) => ({ ...r, mixed: weight * r.relevance + (1 - weight) * r.authority }))
        .sort((a, b) => b.mixed - a.mixed || b.relevance - a.relevance),
    [data.results, weight],
  );

  if (!page) {
    return (
      <>
        <h2>Rank: scoring the pages</h2>
        <p className="walk-note">No page matched this query, so there is nothing to rank. Try one of the examples above.</p>
      </>
    );
  }

  const norm = 1 - params.b + params.b * (page.length / index.avgLength);
  const best = data.bestBm25 || page.bm25;

  return (
    <>
      <h2>Rank: scoring “{page.title}”</h2>
      <p className="lead">
        Every matching page gets two scores. <span className="dot blue" /> Relevance (BM25) asks how well the page matches
        your words. <span className="dot green" /> Authority (PageRank) asks how important the page is, judged by the
        links pointing to it.
      </p>
      <PagePicker results={data.results} selected={selected} onSelect={onSelect} label="Score a different page" />

      <div className="calc">
        <h3><span className="dot blue" /> Relevance: BM25</h3>
        <div className="formula num">
          BM25 = Σ IDF(t) × tf × (k1 + 1) ÷ (tf + k1 × (1 − b + b × length ÷ avgLength))
          <br />
          IDF(t) = ln(1 + (N − df + 0.5) ÷ (df + 0.5))
        </div>
        <p className="vars num">
          N = {index.pages} pages · avgLength = {f(index.avgLength, 1)} words · this page’s length = {page.length} words · k1 = {params.k1} · b = {params.b}
        </p>
        <ul className="calc-lines num">
          {page.terms.map((t) => {
            const s = data.stems.find((x) => x.stem === t.stem);
            const idf = Math.log(1 + (index.pages - s.docFreq + 0.5) / (s.docFreq + 0.5));
            const tfPart = (t.tf * (params.k1 + 1)) / (t.tf + params.k1 * norm);
            return (
              <li key={t.stem}>
                <code>{t.stem}</code>
                <span>IDF = ln(1 + ({index.pages} − {s.docFreq} + 0.5) ÷ ({s.docFreq} + 0.5)) = <strong>{f(idf)}</strong></span>
                <span>tf part = {t.tf} × {f(params.k1 + 1, 1)} ÷ ({t.tf} + {params.k1} × {f(norm)}) = <strong>{f(tfPart)}</strong></span>
                <span>score = {f(idf)} × {f(tfPart)} = <strong>{f(t.score)}</strong></span>
              </li>
            );
          })}
        </ul>
        <p className="result-line num">
          BM25 = {page.terms.map((t) => f(t.score)).join(' + ')} = <strong>{f(page.bm25)}</strong>
          <br />
          Relevance = BM25 ÷ best BM25 for this query = {f(page.bm25)} ÷ {f(best)} = <strong>{f(page.relevance, 2)}</strong>
        </p>
        {page.terms.length < data.stems.filter((s) => s.indexed).length && (
          <p className="walk-note">Words that are not on this page add nothing to its score.</p>
        )}
      </div>

      <div className="calc">
        <h3><span className="dot green" /> Authority: PageRank</h3>
        <div className="formula num">
          PR(p) = (1 − d) ÷ N + d × Σ PR(q) ÷ L(q)
        </div>
        <p className="vars">
          The sum runs over every page q that links to p, and L(q) is the number of links on q. d = {params.damping} is
          the damping factor: a random reader follows a link 85% of the time and jumps to a random page 15% of the time.
          PageRank is worked out once after each crawl, over all {formatNumber(index.links)} links.
        </p>
        <p className="result-line num">
          PR(“{page.title}”) = <strong>{f(page.pagerank, 4)}</strong>, from {page.inLinks} incoming {page.inLinks === 1 ? 'link' : 'links'}
          <br />
          Authority = PR ÷ highest PR in the index = {f(page.pagerank, 4)} ÷ {f(index.maxPagerank, 4)} = <strong>{f(page.authority, 2)}</strong>
        </p>
      </div>

      <div className="calc final">
        <h3>Final score</h3>
        <p className="result-line big num">
          {params.weight} × {f(page.relevance, 2)} + {f(1 - params.weight, 1)} × {f(page.authority, 2)} = <strong>{f(page.final, 2)}</strong>
        </p>
        <p className="vars">The weight {params.weight} gives relevance the bigger say; authority helps choose between pages that match about equally.</p>
      </div>

      <div className="calc">
        <h3>Try a different weight</h3>
        <label className="weight" htmlFor="weight">
          <span>Relevance weight: <strong className="num">{f(weight, 2)}</strong> · authority weight: <strong className="num">{f(1 - weight, 2)}</strong></span>
          <input id="weight" type="range" min="0" max="1" step="0.05" value={weight} onChange={(e) => onWeight(Number(e.target.value))} />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th className="right">#</th><th>Page</th><th className="right">Relevance</th><th className="right">Authority</th><th className="right">Score</th><th className="right">Move</th></tr>
            </thead>
            <tbody>
              {reranked.map((r, i) => {
                const move = r.position - (i + 1);
                return (
                  <tr key={r.id} className={r.id === page.id ? 'picked' : undefined}>
                    <td className="right num">{i + 1}</td>
                    <td>{r.title}</td>
                    <td className="right num">{f(r.relevance, 2)}</td>
                    <td className="right num">{f(r.authority, 2)}</td>
                    <td className="right num"><strong>{f(r.mixed, 2)}</strong></td>
                    <td className={`right num move ${move > 0 ? 'up' : move < 0 ? 'down' : ''}`}>
                      {move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${-move}` : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="vars">
          Moves are compared with the live ranking, which uses {params.weight}. At 1.00 only BM25 counts; at 0.00 only
          PageRank counts. Only the top {data.results.length} pages are re-ranked here.
        </p>
      </div>
      <p className="where">Code: backend/ranking/bm25.py, pagerank.py and blend.py</p>
    </>
  );
}
