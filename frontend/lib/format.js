// Small display helpers shared by several pages.

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatScore(value) {
  return Number(value).toFixed(2);
}

// "https://en.wikipedia.org/wiki/Web_crawler" -> ["en.wikipedia.org", "wiki", "Web_crawler"]
export function urlParts(url) {
  try {
    const { host, pathname } = new URL(url);
    const path = decodeURIComponent(pathname).split('/').filter(Boolean);
    return [host, ...path.slice(-2)];
  } catch {
    return [url];
  }
}

export function formatDateTime(iso) {
  if (!iso) return 'Not yet';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export function formatClock(iso) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}
