import { Dashes } from '@/components/Logo';
import HistoryList from '@/components/HistoryList';
import SiteHeader from '@/components/SiteHeader';

export const metadata = { title: 'Search history' };

export default function HistoryPage() {
  return (
    <>
      <SiteHeader active="history" />
      <main className="page narrow">
        <div className="page-head">
          <h1>Search history</h1>
          <p>Your recent searches on this device. They are kept only in this browser and are never sent to the server.</p>
          <Dashes />
        </div>
        <HistoryList />
      </main>
    </>
  );
}
