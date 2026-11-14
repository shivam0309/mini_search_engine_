// The admin sign-in token lives in a cookie so both the browser and the
// Next.js server can send it to the back-end.

export const TOKEN_COOKIE = 'admin_token';
const TWELVE_HOURS = 12 * 60 * 60;

export function readToken() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function saveToken(token) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TWELVE_HOURS}; samesite=lax`;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
