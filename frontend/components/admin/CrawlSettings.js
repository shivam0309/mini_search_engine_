'use client';

import { useState } from 'react';
import { saveSettings } from '@/lib/api';

const RULES = {
  maxPages: { min: 1, max: 100000, label: 'Maximum pages' },
  maxDepth: { min: 1, max: 10, label: 'Maximum link depth' },
  delaySeconds: { min: 1, max: 60, label: 'Delay between requests' },
};

function validate(values) {
  const errors = {};
  for (const [key, rule] of Object.entries(RULES)) {
    const n = Number(values[key]);
    if (!Number.isFinite(n) || n < rule.min || n > rule.max) {
      errors[key] = `${rule.label} must be between ${rule.min} and ${rule.max}.`;
    }
  }
  if (!values.userAgent.trim()) errors.userAgent = 'Enter a user agent so site owners can identify the crawler.';
  return errors;
}

export default function CrawlSettings({ initialSettings }) {
  const [values, setValues] = useState(initialSettings);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState('');

  function update(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSaved('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await saveSettings({
        ...values,
        maxPages: Number(values.maxPages),
        maxDepth: Number(values.maxDepth),
        delaySeconds: Number(values.delaySeconds),
      });
      setSaved('Crawl limits saved. They apply from the next crawl.');
    } catch (problem) {
      setErrors({ form: problem.message });
    }
  }

  function numberField(key, hint) {
    return (
      <div className="field">
        <label htmlFor={key}>{RULES[key].label}</label>
        <input
          id={key}
          type="number"
          className="input num"
          min={RULES[key].min}
          max={RULES[key].max}
          value={values[key]}
          onChange={(e) => update(key, e.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={`${key}-hint`}
        />
        <span id={`${key}-hint`} className={errors[key] ? 'error-text' : 'hint'}>
          {errors[key] || hint}
        </span>
      </div>
    );
  }

  return (
    <section className="card section-gap" aria-labelledby="limits-title">
      <h2 id="limits-title">Crawl limits</h2>
      <p className="desc">Keep the crawler polite and the index a manageable size.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="settings-grid">
          {numberField('maxPages', 'The crawl stops after this many pages.')}
          {numberField('maxDepth', 'How many links away from a seed URL to go.')}
          {numberField('delaySeconds', 'Seconds to wait between requests to the same site. At least 1.')}
          <div className="field">
            <label htmlFor="userAgent">User agent</label>
            <input
              id="userAgent"
              className="input"
              value={values.userAgent}
              onChange={(e) => update('userAgent', e.target.value)}
              aria-invalid={Boolean(errors.userAgent)}
              aria-describedby="userAgent-hint"
            />
            <span id="userAgent-hint" className={errors.userAgent ? 'error-text' : 'hint'}>
              {errors.userAgent || 'Sent with every request so sites know who is crawling.'}
            </span>
          </div>
        </div>

        <label className="checkbox" style={{ marginTop: 18 }}>
          <input
            type="checkbox"
            checked={values.obeyRobots}
            onChange={(e) => update('obeyRobots', e.target.checked)}
          />
          <span>
            <strong>Obey robots.txt</strong>
            <span>Skip any URL a site’s robots.txt disallows.</span>
          </span>
        </label>

        <div className="form-footer">
          <button type="submit" className="button">
            Save limits
          </button>
          {errors.form ? (
            <span className="error-text" role="alert">
              {errors.form}
            </span>
          ) : (
            <span className="success-text" role="status">
              {saved}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
