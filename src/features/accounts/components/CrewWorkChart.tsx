"use client";

// 마스터 집계: 크루별 근무/연장 시간 막대 차트(chart.js + react-chartjs-2).
// MasterView 가드 하위(mount 후·로딩 완료)에서만 렌더 → 사실상 클라이언트 전용(SSR canvas 이슈 회피).
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { CrewSummary } from "@/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const toHours = (min: number) => Math.round((min / 60) * 10) / 10;

export function CrewWorkChart({ crews }: { crews: CrewSummary[] }) {
  if (crews.length === 0) return null;

  const data = {
    labels: crews.map((c) => c.name),
    datasets: [
      {
        label: "근무(시간)",
        data: crews.map((c) => toHours(c.workMinutes)),
        borderColor: "rgba(255,107,90,1)", // coral
        backgroundColor: "rgba(255,107,90,0.15)",
        pointBackgroundColor: "rgba(255,107,90,1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "연장(시간)",
        data: crews.map((c) => toHours(c.overtimeMinutes)),
        borderColor: "rgba(245,158,11,1)", // amber
        backgroundColor: "rgba(245,158,11,0.15)",
        pointBackgroundColor: "rgba(245,158,11,1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"line">) => `${ctx.dataset.label}: ${ctx.parsed.y}시간`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { font: { size: 11 } }, title: { display: true, text: "시간" } },
    },
  };

  return (
    <div className="mx-5 mb-4 rounded-2xl border border-black/5 bg-surface p-4">
      <h3 className="pb-2 text-sm font-bold">크루별 근무시간</h3>
      <div className="h-56">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
