'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import { clearToken } from '@/lib/token';

export default function SignOutButton() {
  const router = useRouter();

  async function handleClick() {
    try {
      await logout();
    } catch {
      // Signing out locally is enough if the server can't be reached.
    }
    clearToken();
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" className="link-button muted" onClick={handleClick}>
      Sign out
    </button>
  );
}
