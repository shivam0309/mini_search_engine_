import AdminHeader from '@/components/AdminHeader';
import CrawlSettings from '@/components/admin/CrawlSettings';
import SeedsManager from '@/components/admin/SeedsManager';
import ServerError from '@/components/ServerError';
import { getSeeds, getSettings } from '@/lib/api';
import { loadAdmin } from '@/lib/session';

export const metadata = { title: 'Seed URLs & limits' };
export const dynamic = 'force-dynamic';

export default async function SeedsPage() {
  const { data, error } = await loadAdmin(async (token) => {
    const [seeds, settings] = await Promise.all([getSeeds(token), getSettings(token)]);
    return { seeds, settings };
  });

  return (
    <>
      <AdminHeader title="Seed URLs & limits" description="Choose where the crawler starts and how far it goes." />
      {error ? (
        <ServerError message={error} />
      ) : (
        <>
          <SeedsManager initialSeeds={data.seeds} />
          <CrawlSettings initialSettings={data.settings} />
        </>
      )}
    </>
  );
}
