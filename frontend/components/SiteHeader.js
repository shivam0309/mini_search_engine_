import { Brand } from './Logo';
import MainNav from './MainNav';
import SearchBox from './SearchBox';

export default function SiteHeader({ query = '', showSearch = true, active }) {
  return (
    <header className="site-header">
      <div className="inner">
        <Brand />
        {showSearch ? <SearchBox defaultValue={query} /> : <span />}
        <MainNav active={active} />
      </div>
    </header>
  );
}
