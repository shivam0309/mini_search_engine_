import Link from 'next/link';

function pageHref(query, page) {
  return `/search?q=${encodeURIComponent(query)}&page=${page}`;
}

export default function Pagination({ query, page, pages }) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1);

  return (
    <nav className="pagination" aria-label="Result pages">
      {page > 1 ? (
        <Link href={pageHref(query, page - 1)}>Previous</Link>
      ) : (
        <span className="disabled">Previous</span>
      )}
      {numbers.map((n) =>
        n === page ? (
          <span key={n} aria-current="page">
            {n}
          </span>
        ) : (
          <Link key={n} href={pageHref(query, n)} aria-label={`Page ${n}`}>
            {n}
          </Link>
        )
      )}
      {page < pages ? (
        <Link href={pageHref(query, page + 1)}>Next</Link>
      ) : (
        <span className="disabled">Next</span>
      )}
    </nav>
  );
}
