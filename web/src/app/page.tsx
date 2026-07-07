import Dashboard from "@/components/Dashboard";
import { getDashboardData } from "@/lib/data";

// Re-fetch from Supabase at most once a minute; imagery comparison is a
// periodic snapshot, not live streaming, so this is plenty.
export const revalidate = 60;

export default async function Home() {
  const data = await getDashboardData();
  return <Dashboard initial={data} />;
}
