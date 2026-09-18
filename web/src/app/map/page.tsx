import Dashboard from "@/components/Dashboard";
import { getViewer } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";

// Re-fetch from Supabase at most once a minute; imagery comparison is a
// periodic snapshot, not live streaming, so this is plenty.
export const revalidate = 60;

export default async function MapPage() {
  const [data, viewer] = await Promise.all([getDashboardData(), getViewer()]);
  return <Dashboard initial={data} viewer={viewer} />;
}
