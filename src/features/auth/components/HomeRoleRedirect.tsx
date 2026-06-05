"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function HomeRoleRedirect() {
  const { data, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && data?.role === "master") {
      router.replace("/master");
    }
  }, [data?.role, router, status]);

  return null;
}
