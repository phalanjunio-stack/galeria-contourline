"use client";

import { useEffect, useState } from "react";
import { Eye, Heart, Share2 } from "lucide-react";

type MetricKey = "views" | "likes" | "shares";

type Metrics = {
  views: number;
  likes: number;
  shares: number;
};

const STORAGE_KEY = "event_card_metrics_v1";
const EVENT_NAME = "event-card-metrics";

function readAll(): Record<string, Metrics> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Metrics>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function emptyMetrics(): Metrics {
  return { views: 0, likes: 0, shares: 0 };
}

export function bumpEventMetric(slug: string, metric: MetricKey) {
  const data = readAll();
  const atual = data[slug] ?? emptyMetrics();
  data[slug] = { ...atual, [metric]: atual[metric] + 1 };
  writeAll(data);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug } }));
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
    function carregar() {
      setMetrics(readAll()[slug] ?? emptyMetrics());
    }

    carregar();

    const viewedKey = `event_card_viewed_${slug}`;
    if (!sessionStorage.getItem(viewedKey)) {
      sessionStorage.setItem(viewedKey, "1");
      bumpEventMetric(slug, "views");
    }

    function onMetric(event: Event) {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (!detail?.slug || detail.slug === slug) carregar();
    }

    window.addEventListener(EVENT_NAME, onMetric);
    return () => window.removeEventListener(EVENT_NAME, onMetric);
  }, [slug]);

  const itemClass = compact
    ? "gap-0.5 px-1.5 py-0.5 text-[9px]"
    : "gap-1 px-2 py-1 text-[10px]";
  const iconSize = compact ? 10 : 12;

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-[#07182f]/74 p-1 text-white shadow backdrop-blur-sm">
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
