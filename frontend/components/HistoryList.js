'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { clearHistory, readHistory } from '@/lib/history';

export default function HistoryList() {
  const [items, setItems] = useState(null); // null until read from the browser
  const [status, setStatus] = useState('');

  useEffect(() => {
    setItems(readHistory());
  }, []);

  function clearAll() {
    clearHistory();
    setItems([]);
    setStatus('Your search history was cleared.');
  }

  if (items === null) return <p className="history-loading">Loading your history…</p>;

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title">
          {items.length === 0 ? 'No searches yet' : `${items.length} recent ${items.length === 1 ? 'search' : 'searches'}`}
        </h2>
        <button type="button" className="button secondary" onClick={clearAll} disabled={items.length === 0}>
          Clear history
        </button>
      </div>
      <p className="history-status" role="status">
        {status}
      </p>

      {items.length === 0 ? (
        <div className="empty-note">
          Searches you make appear here, newest first. <Link href="/">Start a search</Link>
        </div>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={`${item.q}-${item.at}`}>
              <Link className="q" href={`/search?q=${encodeURIComponent(item.q)}`}>
                {item.q}
              </Link>
              <span className="meta num">
                {typeof item.total === 'number' && `${item.total} ${item.total === 1 ? 'result' : 'results'} · `}
                {formatDateTime(item.at)}
              </span>
              <Link className="explain" href={`/how-it-works?q=${encodeURIComponent(item.q)}`}>
                How it was ranked
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
