"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [pathname, router, status]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="grid min-h-dvh place-items-center px-5 text-sm text-muted">
        불러오는 중...
      </div>
    );
  }

  return <>{children}</>;
}
