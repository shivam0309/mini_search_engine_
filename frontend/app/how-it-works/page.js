import Link from 'next/link';
import HowItWorks from '@/components/HowItWorks';
import { Dashes } from '@/components/Logo';
import ServerError from '@/components/ServerError';
import SiteHeader from '@/components/SiteHeader';
import { explainQuery } from '@/lib/api';

export const metadata = { title: 'How it works' };
export const dynamic = 'force-dynamic';

const EXAMPLES = ['web crawler', '"inverted index"', 'pagerank algorithm', 'crawlr'];
const DEFAULT_QUERY = 'web crawler';

export default async function HowItWorksPage({ searchParams }) {
  const { q = '' } = await searchParams;
  const query = String(q).trim().slice(0, 200) || DEFAULT_QUERY;

  let data = null;
  let error = null;
  try {
    data = await explainQuery(query);
  } catch (e) {
    error = e;
  }

  return (
    <>
      <SiteHeader active="how" />
      <main className="page">
        <div className="page-head">
          <h1>How it works</h1>
          <p>
            Follow one search through the four steps of the engine: crawl, process, index and rank. Every number below is
            the real one, worked out from your query with the same BM25 and PageRank formulas the search uses.
          </p>
          <Dashes />
        </div>

        <form className="explain-form" action="/how-it-works" method="get" role="search">
          <label htmlFor="explain-q">Query to follow</label>
          <div className="explain-row">
            <input id="explain-q" className="input" name="q" type="search" defaultValue={query} maxLength={200} required />
            <button type="submit" className="button">
              Explain
            </button>
          </div>
          <div className="try left">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <Link key={example} className="chip" href={`/how-it-works?q=${encodeURIComponent(example)}`}>
                {example}
              </Link>
            ))}
          </div>
        </form>

        {error ? (
          error.status === 429 ? (
            <div className="empty">
              <h1>Too many searches</h1>
              <p>{error.message}</p>
            </div>
          ) : (
            <ServerError message={error.message} />
          )
        ) : (
          <HowItWorks key={data.query} data={data} />
        )}
      </main>
    </>
  );
}
