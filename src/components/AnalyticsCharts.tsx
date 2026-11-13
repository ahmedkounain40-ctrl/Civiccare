import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useEffect, useRef } from 'react';
import type { AnalyticsData } from '../types/civic.ts';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

export function CategoryBarChart({ data }: { data: AnalyticsData['byCategory'] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map((d) => d.category),
        datasets: [
          {
            label: 'Complaints',
            data: data.map((d) => d.count),
            backgroundColor: '#1d4ed8',
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#475569' },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#475569', font: { size: 11 } },
            grid: { color: '#f1f5f9' },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="relative h-64 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function StatusDoughnutChart({ data }: { data: AnalyticsData['byStatus'] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const colorMap: Record<string, string> = {
      Submitted: '#64748b',
      Verified: '#2563eb',
      'In Progress': '#d97706',
      Resolved: '#059669',
      Rejected: '#dc2626',
    };

    const chart = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: data.map((d) => d.status),
        datasets: [
          {
            data: data.map((d) => d.count),
            backgroundColor: data.map((d) => colorMap[d.status] || '#94a3b8'),
            borderWidth: 2,
            borderColor: '#ffffff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { size: 11 },
              color: '#334155',
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="relative h-64 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function MonthlyTrendChart({ data }: { data: AnalyticsData['byMonth'] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: data.map((d) => d.month),
        datasets: [
          {
            label: 'Total Reported',
            data: data.map((d) => d.total),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
          },
          {
            label: 'Resolved',
            data: data.map((d) => d.resolved),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.08)',
            fill: false,
            tension: 0.3,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 14, font: { size: 11 }, color: '#334155' },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#475569', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#475569', font: { size: 11 } },
            grid: { color: '#f1f5f9' },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="relative h-64 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
