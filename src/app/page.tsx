import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-white/50">
      <div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-sky-400" />
      <p className="text-sm">Loading Signal Desk…</p>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}
