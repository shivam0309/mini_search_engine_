// Server-side helpers for the admin pages.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from './token';

export async function adminToken() {
  return (await cookies()).get(TOKEN_COOKIE)?.value || '';
}

// Loads admin data with the signed-in token. An expired sign-in goes back to
// the login page; any other problem comes back as { error } for the page to show.
export async function loadAdmin(load) {
  const token = await adminToken();
  try {
    return { data: await load(token) };
  } catch (error) {
    if (error.status === 401) redirect('/login');
    return { error: error.message };
  }
}
