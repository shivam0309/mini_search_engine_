'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartIcon, OverviewIcon, SeedIcon } from './Icons';

const LINKS = [
  { href: '/admin', label: 'Overview', Icon: OverviewIcon },
  { href: '/admin/seeds', label: 'Seed URLs & limits', Icon: SeedIcon },
  { href: '/admin/evaluation', label: 'Evaluation', Icon: ChartIcon },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      <span className="label">Admin</span>
      {LINKS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
