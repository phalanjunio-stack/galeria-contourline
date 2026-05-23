"use client";

import { useEffect, useState } from "react";
import { Eye, Heart, Share2 } from "lucide-react";

type MetricKey = "views" | "likes" | "shares";

type Metrics = {
  views: number;
  likes: number;
  shares: number;
};

const EVENT_NAME = "event-card-metrics";

function emptyMetrics(): Metrics {
  return { views: 0, likes: 0, shares: 0 };
}

function normalizeMetrics(value: unknown): Metrics {
  if (!value || typeof value !== "object") return emptyMetrics();
  const obj = value as Partial<Record<MetricKey, unknown>>;
  return {
    views: Number(obj.views ?? 0) || 0,
    likes: Number(obj.likes ?? 0) || 0,
    shares: Number(obj.shares ?? 0) || 0,
  };
}

export async function bumpEventMetric(slug: string, metric: MetricKey) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, optimistic: metric } }));

  const res = await fetch("/api/eventos/metricas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, metric }),
  });

  if (!res.ok) return;
  const data = normalizeMetrics(await res.json());
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug, metrics: data } }));
}

async function fetchMetrics(slug: string): Promise<Metrics> {
  const res = await fetch(`/api/eventos/metricas?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) return emptyMetrics();
  return normalizeMetrics(await res.json());
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

interface Props {
  slug: string;
  compact?: boolean;
}

export default function EventCardMetrics({ slug, compact = false }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(() => emptyMetrics());

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      const data = await fetchMetrics(slug);
      if (!cancelado) setMetrics(data);

      const viewedKey = `event_card_viewed_${slug}`;
      if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, "1");
        void bumpEventMetric(slug, "views");
      }
    }

    void iniciar();

    function onMetric(event: Event) {
      const detail = (event as CustomEvent<{ slug?: string; optimistic?: MetricKey; metrics?: Metrics }>).detail;
      if (!detail?.slug || detail.slug !== slug) return;

      if (detail.metrics) {
        setMetrics(detail.metrics);
        return;
      }

      if (detail.optimistic) {
        setMetrics((current) => ({
          ...current,
          [detail.optimistic as MetricKey]: current[detail.optimistic as MetricKey] + 1,
        }));
      }
    }

    window.addEventListener(EVENT_NAME, onMetric);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENT_NAME, onMetric);
    };
  }, [slug]);

  const itemClass = compact
    ? "gap-0.5 px-1 py-0.5 text-[9px]"
    : "gap-1 px-2 py-1 text-[10px]";
  const iconSize = compact ? 10 : 12;

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-black/45 p-0.5 text-white backdrop-blur-sm">
      <span className={`inline-flex items-center font-bold ${itemClass}`}>
        <Eye size={iconSize} /> {fmt(metrics.views)}
      </span>
      <span className={`inline-flex items-center font-bold ${itemClass}`}>
        <Heart size={iconSize} fill="currentColor" /> {fmt(metrics.likes)}
      </span>
      <span className={`inline-flex items-center font-bold ${itemClass}`}>
        <Share2 size={iconSize} /> {fmt(metrics.shares)}
      </span>
    </div>
  );
}
