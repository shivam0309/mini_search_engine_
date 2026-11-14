import Link from 'next/link';
import { Brand } from './Logo';
import SearchBox from './SearchBox';

export default function SiteHeader({ query = '', showSearch = true }) {
  return (
    <header className="site-header">
      <div className="inner">
        <Brand />
        {showSearch ? <SearchBox defaultValue={query} /> : <span />}
        <nav className="site-nav" aria-label="Main">
          <Link href="/login">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <span>MCA-I Mini Project by Shivam Ashok Sinhasane</span>
        <span>D Y Patil Institute of MCA and Management, Akurdi</span>
      </div>
    </footer>
  );
}
