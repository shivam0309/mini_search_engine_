'use client';

import { useState } from 'react';
import { addSeed, removeSeed } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

function checkUrl(value, seeds) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return 'Enter a full address that starts with http:// or https://';
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'Only http:// and https:// addresses can be crawled.';
  if (seeds.some((s) => s.url === url.href)) return 'This seed URL is already in the list.';
  return '';
}

export default function SeedsManager({ initialSeeds }) {
  const [seeds, setSeeds] = useState(initialSeeds);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleAdd(event) {
    event.preventDefault();
    setMessage('');
    const problem = checkUrl(value, seeds);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const seed = await addSeed(new URL(value.trim()).href);
      setSeeds((list) => [...list, seed]);
      setValue('');
      setError('');
      setMessage(`Added ${seed.host}. It will be crawled on the next run.`);
    } catch (problem) {
      setError(problem.message);
    }
  }

  async function handleRemove(seed) {
    setMessage('');
    try {
      await removeSeed(seed.id);
      setSeeds((list) => list.filter((s) => s.id !== seed.id));
      setMessage(`Removed ${seed.host}. Pages already crawled from it stay in the index.`);
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <section className="card section-gap" aria-labelledby="seeds-title">
      <h2 id="seeds-title">Seed URLs</h2>
      <p className="desc">The crawler starts from these pages and follows links on the same sites.</p>

      <form className="form-row" onSubmit={handleAdd} noValidate>
        <label htmlFor="seed-url" className="visually-hidden">
          New seed URL
        </label>
        <input
          id="seed-url"
          className="input"
          placeholder="https://example.edu/"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'seed-error' : undefined}
        />
        <button type="submit" className="button">
          Add seed URL
        </button>
      </form>
      {error && (
        <p id="seed-error" className="error-text" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      <p className="success-text" role="status" style={{ marginTop: 8, minHeight: 20 }}>
        {message}
      </p>

      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table>
          <thead>
            <tr>
              <th scope="col">URL</th>
              <th scope="col" className="right">
                Pages found
              </th>
              <th scope="col">Status</th>
              <th scope="col">Last crawled</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {seeds.map((seed) => (
              <tr key={seed.id}>
                <td className="url">{seed.url}</td>
                <td className="right num">{seed.pages}</td>
                <td>
                  <span className={`badge ${seed.status === 'Crawled' ? 'green' : 'yellow'}`}>{seed.status}</span>
                </td>
                <td className="num" style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                  {formatDateTime(seed.lastCrawled)}
                </td>
                <td className="right">
                  <button type="button" className="link-button" onClick={() => handleRemove(seed)}>
                    Remove<span className="visually-hidden"> {seed.url}</span>
                  </button>
                </td>
              </tr>
            ))}
            {seeds.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No seed URLs yet. Add one above so the crawler has somewhere to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
