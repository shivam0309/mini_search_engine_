'use client';

import Link from 'next/link';
import { useState } from 'react';

const METHODS = {
  blended: { label: 'BM25 + PageRank', c: 'var(--blue)' },
  bm25Only: { label: 'BM25 only', c: 'var(--line)' },
};

function fixed(n) {
  return Number(n).toFixed(2);
}

export default function EvaluationView({ evaluation }) {
  const [method, setMethod] = useState('blended');
  const current = evaluation[method];

  return (
    <>
      <div className="compare">
        {Object.entries(METHODS).map(([key, m]) => (
          <section key={key} className="card" style={{ '--c': m.c }} aria-labelledby={`${key}-title`}>
            <h2 id={`${key}-title`}>{m.label}</h2>
            <p className="desc">
              {key === 'blended'
                ? `Score = ${evaluation.blended.weight} × relevance + ${Math.round((1 - evaluation.blended.weight) * 10) / 10} × authority`
                : 'Relevance only, links ignored'}
            </p>
            <div className="figures">
              <div>
                <div className="value">{fixed(evaluation[key].meanPrecisionAt10)}</div>
                <div className="label">Mean Precision@10</div>
              </div>
              <div>
                <div className="value">{fixed(evaluation[key].mrr)}</div>
                <div className="label">MRR</div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="card section-gap" aria-labelledby="queries-title">
        <div className="card-head">
          <div>
            <h2 id="queries-title">Test queries</h2>
            <p className="desc">
              Each query has pages judged relevant by hand (backend/evaluation/test_queries.json). Precision@10 can’t
              exceed the number of relevant pages divided by 10.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Ranking method">
            {Object.entries(METHODS).map(([key, m]) => (
              <button key={key} type="button" aria-pressed={method === key} onClick={() => setMethod(key)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Query</th>
                <th scope="col" className="right">
                  Relevant pages
                </th>
                <th scope="col" className="right">
                  Found in top 10
                </th>
                <th scope="col">Precision@10</th>
                <th scope="col" className="right">
                  First relevant at
                </th>
                <th scope="col" className="right">
                  Reciprocal rank
                </th>
              </tr>
            </thead>
            <tbody>
              {current.rows.map((row) => (
                <tr key={row.query}>
                  <td>
                    <Link href={`/search?q=${encodeURIComponent(row.query)}`}>{row.query}</Link>
                  </td>
                  <td className="right num">{row.relevant}</td>
                  <td className="right num">{row.found}</td>
                  <td className="num">
                    <span className="mini-bar" aria-hidden="true">
                      <span style={{ width: `${row.precisionAt10 * 100}%` }} />
                    </span>
                    {fixed(row.precisionAt10)}
                  </td>
                  <td className="right num">{row.firstRelevantRank ?? 'Not found'}</td>
                  <td className="right num">{fixed(row.reciprocalRank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
