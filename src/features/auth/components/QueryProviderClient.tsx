"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createAppQueryClient } from "@/lib/query-client";

export function QueryProviderClient({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAppQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
