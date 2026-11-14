import Link from 'next/link';
import { Dashes, LogoMark } from '@/components/Logo';
import SearchBox from '@/components/SearchBox';
import { SiteFooter } from '@/components/SiteHeader';
import { getIndexSummary, usingSampleData } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  { q: 'pagerank' },
  { q: '"inverted index"', note: 'exact phrase' },
  { q: 'web crawlr', note: 'with a typo' },
  { q: 'how are pages ranked' },
];

export default async function HomePage() {
  const summary = await getIndexSummary().catch(() => null);

  return (
    <div className="home">
      <nav className="home-top site-nav" aria-label="Main">
        <Link href="/login">Admin</Link>
      </nav>

      <main className="home-main">
        <div className="mark">
          <LogoMark size={88} />
        </div>
        <h1 className="home-title">Mini Search Engine</h1>
        <p className="home-subtitle">Crawled, indexed and ranked from scratch</p>
        <Dashes />

        <div className="home-form">
          <SearchBox large autoFocus />
        </div>

        <div className="try">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <Link key={example.q} className="chip" href={`/search?q=${encodeURIComponent(example.q)}`}>
              {example.q}
              {example.note && <span className="note">{example.note}</span>}
            </Link>
          ))}
        </div>

        <p className="home-index-note">
          {!summary
            ? 'The search server isn’t responding right now.'
            : summary.pages === 0
              ? 'Nothing is indexed yet. Sign in as admin, add seed URLs and start a crawl.'
              : `Searching ${formatNumber(summary.pages)} ${usingSampleData ? 'sample ' : ''}pages from ${summary.sites} ${summary.sites === 1 ? 'site' : 'sites'}. Every result shows how its score was worked out.`}
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
