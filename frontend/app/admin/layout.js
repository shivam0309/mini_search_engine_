import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { BackIcon } from '@/components/Icons';
import { Brand } from '@/components/Logo';
import SignOutButton from '@/components/SignOutButton';
import { adminToken } from '@/lib/session';

export const metadata = {
  title: { default: 'Admin', template: '%s | Admin | Mini Search Engine' },
};

export default async function AdminLayout({ children }) {
  if (!(await adminToken())) redirect('/login');

  return (
    <div className="admin">
      <aside className="admin-side">
        <Brand size={30} />
        <AdminNav />
        <div className="bottom">
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <BackIcon size={16} /> Back to search
          </Link>
          <SignOutButton />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
