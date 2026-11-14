import { formatScore, urlParts } from '@/lib/format';

// One search result: URL, title, highlighted snippet and the score breakdown.
export default function ResultItem({ result, weight }) {
  const [host, ...path] = urlParts(result.url);
  const { relevance, authority, final, bm25 } = result.scores;
  const relWidth = weight * relevance * 100;
  const authWidth = (1 - weight) * authority * 100;

  return (
    <li className="result">
      <div className="result-url">
        <span className="host">{host}</span>
        {path.map((part) => (
          <span key={part}>› {part}</span>
        ))}
      </div>
      <a className="result-title" href={result.url} target="_blank" rel="noreferrer">
        {result.title}
      </a>
      <p className="result-snippet">
        {result.snippet.map((segment, i) =>
          segment.hit ? <mark key={i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>
        )}
      </p>

      <div className="score">
        <span
          className="score-bar"
          role="img"
          aria-label={`Score ${formatScore(final)} out of 1: relevance part ${formatScore(weight * relevance)}, authority part ${formatScore((1 - weight) * authority)}`}
        >
          <span className="rel" style={{ width: `${relWidth}%` }} />
          <span className="auth" style={{ width: `${authWidth}%` }} />
        </span>
        <span className="total num">Score {formatScore(final)}</span>
        <span className="legend num">
          <span className="dot blue" /> Relevance {formatScore(relevance)}
        </span>
        <span className="legend num">
          <span className="dot green" /> Authority {formatScore(authority)}
        </span>
        <details>
          <summary>Why this rank?</summary>
          <div className="score-detail num">
            BM25 score <code>{bm25.toFixed(2)}</code>, scaled against the best match for this query, gives relevance{' '}
            <code>{formatScore(relevance)}</code>.
            <br />
            PageRank, scaled against the most linked-to page, gives authority <code>{formatScore(authority)}</code>.
            <br />
            Score = {weight} × {formatScore(relevance)} + {Math.round((1 - weight) * 10) / 10} × {formatScore(authority)} ={' '}
            <code>{formatScore(final)}</code>
            <br />
            Matched words: {result.matched.length ? result.matched.join(', ') : 'none'}
          </div>
        </details>
      </div>
    </li>
  );
}
