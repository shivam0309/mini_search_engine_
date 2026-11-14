import Link from 'next/link';
import { redirect } from 'next/navigation';
import Pagination from '@/components/Pagination';
import ResultItem from '@/components/ResultItem';
import ServerError from '@/components/ServerError';
import SiteHeader, { SiteFooter } from '@/components/SiteHeader';
import { searchPages, usingSampleData } from '@/lib/api';

export async function generateMetadata({ searchParams }) {
  const { q = '' } = await searchParams;
  return { title: q ? `${q}` : 'Search' };
}

function searchHref(query) {
  return `/search?q=${encodeURIComponent(query)}`;
}

export default async function SearchPage({ searchParams }) {
  const { q = '', page = '1' } = await searchParams;
  const query = String(q).trim();
  if (!query) redirect('/');

  let data;
  try {
    data = await searchPages(query, Number(page) || 1);
  } catch (error) {
    return (
      <>
        <SiteHeader query={query} />
        <main className="results-layout">
          {error.status === 429 ? (
            <div className="empty">
              <h1>Too many searches</h1>
              <p>{error.message}</p>
            </div>
          ) : (
            <ServerError message={error.message} />
          )}
        </main>
        <SiteFooter />
      </>
    );
  }
  const onlyCommonWords = data.terms.length > 0 && data.terms.every((t) => t.stop);

  return (
    <>
      <SiteHeader query={data.correctedFrom ? data.query : query} />

      <main className="results-layout">
        <div>
          {data.total > 0 && (
            <p className="results-meta num" aria-live="polite">
              {data.total} {data.total === 1 ? 'result' : 'results'} in {data.tookMs} ms
              {data.pages > 1 && `, page ${data.page} of ${data.pages}`}
            </p>
          )}

          {data.correctedFrom && (
            <p className="notice">
              Showing results for <Link href={searchHref(data.query)}>{data.query}</Link>
              <span className="small">No pages matched “{data.correctedFrom}”, so the spelling was corrected.</span>
            </p>
          )}

          {data.suggestion && (
            <p className="notice">
              Did you mean <Link href={searchHref(data.suggestion)}>{data.suggestion}</Link>?
            </p>
          )}

          {data.total === 0 ? (
            <div className="empty">
              {onlyCommonWords ? (
                <>
                  <h1>Your search only has common words</h1>
                  <p>Words like “the”, “of” and “how” are left out of the index. Add a word that describes the topic.</p>
                </>
              ) : (
                <>
                  <h1>No pages match “{query}”</h1>
                  <p>Try one of these:</p>
                  <ul>
                    <li>Check the spelling of each word.</li>
                    <li>Use fewer or more general words.</li>
                    <li>Remove the quotation marks to match words anywhere on the page.</li>
                  </ul>
                </>
              )}
              {usingSampleData && (
                <p>The sample index has pages about search engines, crawling, ranking and the web.</p>
              )}
            </div>
          ) : (
            <ol className="result-list" start={(data.page - 1) * 10 + 1}>
              {data.results.map((result) => (
                <ResultItem key={result.id} result={result} weight={data.weight} />
              ))}
            </ol>
          )}

          <Pagination query={data.query} page={data.page} pages={data.pages} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
