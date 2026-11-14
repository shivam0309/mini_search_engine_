'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BackIcon } from '@/components/Icons';
import { Brand } from '@/components/Logo';
import { login, usingSampleData } from '@/lib/api';
import { saveToken } from '@/lib/token';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await login(username.trim(), password);
      saveToken(session.token);
      router.push('/admin');
      router.refresh();
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <Brand />
        <h1>Admin sign in</h1>
        <p className="lead">Manage seed URLs, crawl limits and the index.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={Boolean(error && !username.trim())}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error && !password)}
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {usingSampleData && (
          <p className="note">Sample mode: any username and password opens the dashboard. With the back-end connected, use the ADMIN_USERNAME and ADMIN_PASSWORD set on the server.</p>
        )}
        <p className="note">
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <BackIcon size={16} /> Back to search
          </Link>
        </p>
      </div>
    </main>
  );
}
