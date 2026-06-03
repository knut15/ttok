"use client";

// 근무 안정성 레이더(chart.js Radar). PayList 로딩 완료 후 렌더(클라이언트 전용).
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type TooltipItem,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import type { StabilityAxis } from "@/types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

export function StabilityRadar({ axes }: { axes: StabilityAxis[] }) {
  if (axes.length === 0) return null;
  const overall = Math.round(axes.reduce((s, a) => s + a.score, 0) / axes.length);

  const data = {
    labels: axes.map((a) => a.label),
    datasets: [
      {
        label: "근무 안정성",
        data: axes.map((a) => a.score),
        backgroundColor: "rgba(255,107,90,0.20)", // coral fill
        borderColor: "rgba(255,107,90,0.9)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(255,107,90,1)",
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // 점수 + 실측값(지각/연장/결근 등 도메인 규칙 기준)을 함께 노출.
          label: (ctx: TooltipItem<"radar">) =>
            `${ctx.parsed.r}점 · ${axes[ctx.dataIndex]?.detail ?? ""}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, display: false },
        pointLabels: { font: { size: 12 } },
        grid: { color: "rgba(0,0,0,0.08)" },
        angleLines: { color: "rgba(0,0,0,0.08)" },
      },
    },
  } as const;

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">근무 안정성</h3>
        <span className="text-sm font-bold text-coral">{overall}점</span>
      </div>
      <div className="relative h-56">
        <Radar data={data} options={options} />
      </div>
      {/* 터치 환경에서도 실측값이 보이도록 축별 실측을 상시 노출(툴팁은 보조). */}
      <ul className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
        {axes.map((a) => (
          <li key={a.label} className="flex items-center justify-between gap-3">
            <span className="text-muted">{a.label}</span>
            <span className="font-medium">{a.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
