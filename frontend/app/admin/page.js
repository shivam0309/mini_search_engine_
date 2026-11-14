import AdminHeader from '@/components/AdminHeader';
import OverviewDashboard from '@/components/admin/OverviewDashboard';
import ServerError from '@/components/ServerError';
import { getCrawlLog, getOverview } from '@/lib/api';
import { loadAdmin } from '@/lib/session';

export const metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const { data, error } = await loadAdmin(async (token) => {
    const [overview, crawlLog] = await Promise.all([getOverview(token), getCrawlLog(token)]);
    return { overview, crawlLog };
  });

  return (
    <>
      <AdminHeader title="Overview" description="Crawl progress, index size and search speed." />
      {error ? <ServerError message={error} /> : <OverviewDashboard overview={data.overview} crawlLog={data.crawlLog} />}
    </>
  );
}
