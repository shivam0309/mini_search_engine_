import Link from 'next/link';

// The links in the top right of every public page.
const LINKS = [
  { key: 'how', href: '/how-it-works', label: 'How it works' },
  { key: 'history', href: '/history', label: 'History' },
  { key: 'about', href: '/about', label: 'About' },
  { key: 'admin', href: '/login', label: 'Admin' },
];

export default function MainNav({ active, className = 'site-nav' }) {
  return (
    <nav className={className} aria-label="Main">
      {LINKS.map((link) => (
        <Link key={link.key} href={link.href} aria-current={active === link.key ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
