import Link from 'next/link';

// The four-colour mark from the presentation's title slide.
export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="-4 -4 72 72" aria-hidden="true">
      <rect x="22" y="2" width="20" height="20" rx="5" transform="rotate(45 32 12)" fill="#5E8BE0" />
      <rect x="42" y="22" width="20" height="20" rx="5" transform="rotate(45 52 32)" fill="#8DB86A" />
      <rect x="22" y="42" width="20" height="20" rx="5" transform="rotate(45 32 52)" fill="#F2C543" />
      <rect x="2" y="22" width="20" height="20" rx="5" transform="rotate(45 12 32)" fill="#EF8A84" />
      <circle cx="32" cy="32" r="12.5" fill="#FFFAF2" />
      <circle cx="30.5" cy="30.5" r="5" fill="none" stroke="#1F2433" strokeWidth="2.4" />
      <path d="m34.2 34.2 4 4" stroke="#1F2433" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ size = 34 }) {
  return (
    <Link href="/" className="brand" aria-label="Mini Search Engine home">
      <LogoMark size={size} />
      <span>Mini Search Engine</span>
    </Link>
  );
}

export function Dashes() {
  return (
    <div className="dashes" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
