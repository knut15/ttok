import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // perf: 대형 패키지 임포트 최적화 → 필요한 심볼만 번들.
  experimental: {
    optimizePackageImports: ["chart.js", "react-chartjs-2"],
  },
  // Prisma 를 서버 외부 패키지로 분리(번들링 제외 → 서버리스 콜드스타트 안정).
  serverExternalPackages: ["@prisma/client", "@auth/prisma-adapter"],
};

export default nextConfig;
