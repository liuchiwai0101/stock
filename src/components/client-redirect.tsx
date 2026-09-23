"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client redirect for static GitHub Pages (no server redirects). */
export function ClientRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/50">
      Redirecting…
    </div>
  );
}
