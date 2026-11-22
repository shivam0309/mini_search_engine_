import Link from 'next/link';
import { Dashes } from '@/components/Logo';
import SiteHeader from '@/components/SiteHeader';
import { getIndexSummary, usingSampleData } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export const metadata = { title: 'About' };
export const dynamic = 'force-dynamic';

const MODULES = [
  { id: 'M1', name: 'Web Crawler', c: 'blue', text: 'Starts from seed URLs and follows links on the same sites. Obeys robots.txt, waits at least a second between requests to a site, skips duplicate pages and resumes after a stop.', where: 'backend/crawler' },
  { id: 'M2', name: 'Text Processor', c: 'coral', text: 'Strips the HTML, menus and scripts, splits the text into words, drops common words like “the”, and cuts each word to its stem with the Porter stemmer.', where: 'backend/text_processing' },
  { id: 'M3', name: 'Indexer', c: 'yellow', text: 'Builds the inverted index: for every stem, the pages that contain it, how many times, and at which word positions.', where: 'backend/indexer' },
  { id: 'M4', name: 'Ranking Engine', c: 'green', text: 'Scores relevance with BM25 and authority with PageRank, then blends them: 0.7 × relevance + 0.3 × authority.', where: 'backend/ranking' },
  { id: 'M5', name: 'Query Processor', c: 'orange', text: 'Reads the query the same way as the pages, handles “exact phrases”, fixes typos, picks the snippet and returns 10 results per page.', where: 'backend/query' },
  { id: 'M6', name: 'Search Interface', c: 'orange', text: 'The pages you are using now: search box, highlighted snippets, a score bar and “Why this rank?” for every result, on desktop and mobile.', where: 'frontend/app' },
  { id: 'M7', name: 'Admin Dashboard', c: 'blue', text: 'Sign-in for the administrator, seed URLs and crawl limits, live crawl progress and the crawl log, and index rebuilds.', where: 'frontend/app/admin' },
  { id: 'M8', name: 'Evaluation', c: 'green', text: 'Measures result quality on 10 hand-judged test queries with Precision@10 and Mean Reciprocal Rank, with and without PageRank.', where: 'backend/evaluation' },
];

const STACK = [
  ['Front-end', 'Next.js 16 and React 19, plain CSS'],
  ['Back-end', 'Python 3.13 with FastAPI'],
  ['Crawling and parsing', 'httpx, BeautifulSoup, Python’s robots.txt parser'],
  ['Text and links', 'NLTK Porter stemmer, NetworkX for PageRank'],
  ['Database', 'PostgreSQL on Neon, or SQLite on a laptop'],
  ['Hosting', 'Vercel (website), Render (API), Neon (database)'],
];

export default async function AboutPage() {
  const summary = await getIndexSummary().catch(() => null);

  return (
    <>
      <SiteHeader active="about" />
      <main className="page">
        <div className="page-head">
          <h1>About this project</h1>
          <p>
            Mini Search Engine is a web search engine built from scratch. It crawls a chosen set of websites, builds its own
            inverted index and ranks results by blending BM25 relevance with PageRank authority. No Google, Bing or paid
            search service sits behind it, and every score can be explained.
          </p>
          <Dashes />
        </div>

        <div className="about-facts">
          <div className="stat">
            <div className="label">Pages indexed</div>
            <div className="value">{summary ? formatNumber(summary.pages) : '–'}</div>
            <div className="sub">{usingSampleData ? 'sample pages' : 'searchable now'}</div>
          </div>
          <div className="stat">
            <div className="label">Websites</div>
            <div className="value">{summary ? summary.sites : '–'}</div>
            <div className="sub">crawled from seed URLs</div>
          </div>
          <div className="stat">
            <div className="label">Modules</div>
            <div className="value">8</div>
            <div className="sub">crawl to evaluation</div>
          </div>
          <div className="stat">
            <div className="label">Search time goal</div>
            <div className="value">&lt; 300 ms</div>
            <div className="sub">measured on 10,000 pages</div>
          </div>
        </div>

        <section className="section" aria-labelledby="modules-title">
          <h2 id="modules-title">The 8 modules</h2>
          <p>
            The project is split into eight modules. Want to see them working on a real query?{' '}
            <Link href="/how-it-works">Walk a search through every step</Link>.
          </p>
          <ol className="module-grid">
            {MODULES.map((m) => (
              <li key={m.id} className="module" style={{ '--c': `var(--${m.c})`, '--c-ink': `var(--${m.c}-ink)` }}>
                <span className="n">{m.id}</span>
                <h3>{m.name}</h3>
                <p>{m.text}</p>
                <p className="where">{m.where}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" aria-labelledby="team-title">
          <h2 id="team-title">Team and guide</h2>
          <div className="people">
            <div className="person card">
              <span className="role">Developed by</span>
              <h3>Shivam Ashok Sinhasane</h3>
              <p>Roll No. 115</p>
              <p>F.Y. MCA, Semester I</p>
            </div>
            <div className="person card">
              <span className="role">Project guide</span>
              <h3>Prof. Pranita Manjare</h3>
              <p>Guide for the MCA-I Mini Project</p>
            </div>
            <div className="person card">
              <span className="role">Institute</span>
              <h3>D Y Patil Institute of MCA and Management</h3>
              <p>Akurdi, Pune</p>
              <p>MCA-I Mini Project, academic year 2026–2027</p>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="stack-title">
          <h2 id="stack-title">Built with</h2>
          <div className="table-wrap stack-table">
            <table>
              <tbody>
                {STACK.map(([part, tools]) => (
                  <tr key={part}>
                    <th scope="row">{part}</th>
                    <td>{tools}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
