'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCrawlLog,
  getCrawlStatus,
  rebuildIndex,
  recomputePageRank,
  startCrawl,
  stopCrawl,
  usingSampleData,
} from '@/lib/api';
import { formatClock, formatDateTime, formatNumber } from '@/lib/format';

const OUTCOME_BADGE = {
  Indexed: 'green',
  'Blocked by robots.txt': 'orange',
  'Site refused the crawler': 'orange',
  'Already seen': 'plain',
  Redirected: 'blue',
  'Not found': 'coral',
};

const STATE_LABEL = {
  idle: ['Idle', 'plain'],
  running: ['Crawling', 'blue'],
  stopping: ['Stopping', 'orange'],
  indexing: ['Building index', 'yellow'],
};

const STEP_COLOURS = {
  Crawl: ['var(--blue-tint)', 'var(--blue-ink)'],
  Parse: ['var(--coral-tint)', 'var(--coral-ink)'],
  Index: ['var(--yellow-tint)', 'var(--yellow-ink)'],
  PageRank: ['var(--green-tint)', 'var(--green-ink)'],
};

const LOG_ROWS_SHOWN = 10;
const POLL_MS = 2000;

// Counts for the progress bar, worked out from the crawl log in sample mode.
function countsFromLog(log, total) {
  const crawled = log.filter((row) => row.outcome === 'Indexed').length;
  return { crawled, skipped: log.length - crawled, processed: log.length, queued: Math.max(0, total - log.length) };
}

export default function OverviewDashboard({ overview, crawlLog }) {
  const router = useRouter();
  const [log, setLog] = useState(crawlLog);
  const [status, setStatus] = useState(
    usingSampleData ? { state: 'idle', ...countsFromLog(crawlLog, crawlLog.length) } : overview.crawl
  );
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(status.error || '');
  const [working, setWorking] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  // ---- live updates from the back-end ----

  const poll = useCallback(async () => {
    try {
      const [next, rows] = await Promise.all([getCrawlStatus(), getCrawlLog()]);
      setStatus(next);
      setLog(rows);
      if (next.state === 'idle') {
        clearInterval(timer.current);
        timer.current = null;
        if (next.error) setProblem(next.error);
        else setMessage(`Crawl ended: ${formatNumber(next.crawled)} pages stored, ${formatNumber(next.skipped)} skipped. The index and PageRank are up to date.`);
        router.refresh();
      }
    } catch (error) {
      setProblem(error.message);
    }
  }, [router]);

  useEffect(() => {
    if (!usingSampleData && status.state !== 'idle' && !timer.current) {
      timer.current = setInterval(poll, POLL_MS);
    }
  }, [status.state, poll]);

  // ---- buttons ----

  async function handleStartCrawl() {
    setMessage('');
    setProblem('');
    if (usingSampleData) return replaySampleCrawl();
    try {
      setStatus(await startCrawl());
    } catch (error) {
      setProblem(error.message);
    }
  }

  async function handleStopCrawl() {
    try {
      setStatus(await stopCrawl());
      setMessage('Stopping after the current page. The pages crawled so far will be indexed.');
    } catch (error) {
      setProblem(error.message);
    }
  }

  async function runJob(name, job, done) {
    setMessage('');
    setProblem('');
    setWorking(name);
    try {
      const result = await job();
      setMessage(done(result));
      router.refresh();
    } catch (error) {
      setProblem(error.message);
    }
    setWorking('');
  }

  // Sample mode: replay the sample crawl so the dashboard can be demonstrated.
  function replaySampleCrawl() {
    const queue = [...crawlLog].reverse();
    let n = 0;
    setLog([]);
    setStatus({ state: 'running', ...countsFromLog([], queue.length) });
    timer.current = setInterval(() => {
      const shown = queue.slice(0, n + 1).map((row) => ({ ...row, time: new Date().toISOString() })).reverse();
      n += 1;
      setLog(shown);
      const done = n >= queue.length;
      setStatus({ state: done ? 'idle' : 'running', ...countsFromLog(shown, queue.length) });
      if (done) {
        clearInterval(timer.current);
        timer.current = null;
        const counts = countsFromLog(shown, queue.length);
        setMessage(`Crawl ended: ${counts.crawled} pages stored, ${counts.skipped} skipped.`);
      }
    }, 180);
  }

  const busy = status.state !== 'idle' || Boolean(working);
  const crawling = status.state === 'running' || status.state === 'stopping';
  const totalQueued = status.processed + status.queued;
  const percent = totalQueued ? Math.round((status.processed / totalQueued) * 100) : 0;
  const [stateLabel, stateBadge] = STATE_LABEL[status.state] || STATE_LABEL.idle;
  const topScore = overview.topPages[0]?.pagerank || 1;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="label">
            <span className="dot blue" /> Pages indexed
          </span>
          <div className="value">{formatNumber(overview.pages)}</div>
          <div className="sub">Limit {formatNumber(status.limit ?? overview.crawl.limit)} pages</div>
        </div>
        <div className="stat">
          <span className="label">
            <span className="dot coral" /> Unique terms
          </span>
          <div className="value">{formatNumber(overview.terms)}</div>
          <div className="sub">{formatNumber(overview.postings)} postings</div>
        </div>
        <div className="stat">
          <span className="label">
            <span className="dot green" /> Links in graph
          </span>
          <div className="value">{formatNumber(overview.links)}</div>
          <div className="sub">Used by PageRank</div>
        </div>
        <div className="stat">
          <span className="label">
            <span className="dot orange" /> Average query time
          </span>
          <div className="value">{overview.avgQueryMs == null ? '–' : `${overview.avgQueryMs} ms`}</div>
          <div className="sub">{overview.avgQueryMs == null ? 'No searches yet' : 'Target under 300 ms'}</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="crawler-title">
          <div className="card-head">
            <h2 id="crawler-title">Crawler</h2>
            <span className={`badge ${stateBadge}`}>{stateLabel}</span>
          </div>
          <p className="desc">1 request per second per site. robots.txt is checked before every URL.</p>

          <div className="progress">
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Crawl progress"
            >
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="progress-label num">
              <span>
                {formatNumber(status.processed)} of {formatNumber(totalQueued)} queued URLs processed
              </span>
              <span>
                {formatNumber(status.crawled)} stored, {formatNumber(status.skipped)} skipped
              </span>
            </div>
          </div>

          <div className="actions">
            {crawling ? (
              <button type="button" className="button small" onClick={handleStopCrawl} disabled={status.state === 'stopping'}>
                {status.state === 'stopping' ? 'Stopping…' : 'Stop crawl'}
              </button>
            ) : (
              <button type="button" className="button small" onClick={handleStartCrawl} disabled={busy}>
                {status.state === 'indexing' ? 'Building index…' : status.resumable ? 'Resume crawl' : 'Start crawl'}
              </button>
            )}
            <button
              type="button"
              className="button small secondary"
              disabled={busy}
              onClick={() => runJob('index', rebuildIndex, (r) =>
                r.terms != null
                  ? `Index rebuilt: ${formatNumber(r.terms)} terms from ${formatNumber(r.pages)} pages in ${formatNumber(r.tookMs)} ms.`
                  : `Inverted index rebuilt at ${formatClock(new Date().toISOString())}.`
              )}
            >
              {working === 'index' ? 'Rebuilding…' : 'Rebuild index'}
            </button>
            <button
              type="button"
              className="button small secondary"
              disabled={busy}
              onClick={() => runJob('pagerank', recomputePageRank, (r) =>
                r.links != null
                  ? `PageRank recomputed over ${formatNumber(r.links)} links in ${formatNumber(r.tookMs)} ms.`
                  : `PageRank recomputed at ${formatClock(new Date().toISOString())}.`
              )}
            >
              {working === 'pagerank' ? 'Recomputing…' : 'Recompute PageRank'}
            </button>
          </div>
          {problem ? (
            <p className="error-text" role="alert" style={{ marginTop: 12 }}>
              {problem}
            </p>
          ) : (
            <p className="success-text" role="status" style={{ marginTop: 12, minHeight: 20 }}>
              {message}
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="top-title">
          <h2 id="top-title">Most linked-to pages</h2>
          <p className="desc">Highest PageRank in the current link graph.</p>
          {overview.topPages.length === 0 ? (
            <p className="empty-note">Run a crawl to see which pages other pages link to most.</p>
          ) : (
            <ol className="rank-list">
              {overview.topPages.map((page) => (
                <li key={page.id}>
                  <a className="title" href={page.url} target="_blank" rel="noreferrer">
                    {page.title}
                  </a>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${(page.pagerank / topScore) * 100}%` }} />
                  </span>
                  <span className="num" style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    {page.pagerank.toFixed(3)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="log-title">
          <div className="card-head">
            <h2 id="log-title">Recent crawl activity</h2>
            <span className="num" style={{ fontSize: 13, color: 'var(--muted)' }}>
              Latest {Math.min(LOG_ROWS_SHOWN, log.length)}
            </span>
          </div>
          {log.length === 0 ? (
            <p className="empty-note">No crawl activity yet. Add seed URLs, then start a crawl.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="log-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 92 }}>
                      Time
                    </th>
                    <th scope="col">URL</th>
                    <th scope="col" style={{ width: 196 }}>
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {log.slice(0, LOG_ROWS_SHOWN).map((row) => (
                    <tr key={`${row.id}-${row.time}`}>
                      <td className="num" style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                        {formatClock(row.time)}
                      </td>
                      <td className="url">
                        <span className="truncate" title={row.url}>
                          {row.url.replace(/^https?:\/\//, '')}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${OUTCOME_BADGE[row.outcome] || 'coral'}`}>
                          {row.status ? `${row.status} ` : ''}
                          {row.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="pipeline-title">
          <h2 id="pipeline-title">Last index build</h2>
          <p className="desc">The offline steps that turn crawled pages into a searchable index.</p>
          <ol className="pipeline">
            {overview.pipeline.map((item, i) => (
              <li key={item.step} style={{ '--c-tint': STEP_COLOURS[item.step][0], '--c-ink': STEP_COLOURS[item.step][1] }}>
                <span className="n">{i + 1}</span>
                <span className="what">
                  <strong>{item.step}</strong>
                  <span>{item.detail}</span>
                </span>
                <time dateTime={item.finishedAt || undefined}>{formatDateTime(item.finishedAt)}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
