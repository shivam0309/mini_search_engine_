import AdminHeader from '@/components/AdminHeader';
import EvaluationView from '@/components/admin/EvaluationView';
import ServerError from '@/components/ServerError';
import { getEvaluation } from '@/lib/api';
import { loadAdmin } from '@/lib/session';

export const metadata = { title: 'Evaluation' };
export const dynamic = 'force-dynamic';

export default async function EvaluationPage() {
  const { data, error } = await loadAdmin((token) => getEvaluation(token));

  return (
    <>
      <AdminHeader title="Evaluation" description="How well the ranking puts relevant pages near the top." />
      {error ? <ServerError message={error} /> : <EvaluationView evaluation={data} />}
    </>
  );
}
