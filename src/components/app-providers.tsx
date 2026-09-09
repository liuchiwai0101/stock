import { DailyCaptureProvider } from "@/components/daily-capture-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <DailyCaptureProvider>{children}</DailyCaptureProvider>;
}
