"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown } from "lucide-react";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  /** Distância em px que o usuário precisa puxar pra disparar */
  limite?: number;
}

export default function PullToRefresh({ onRefresh, children, limite = 80 }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      // Só ativa se estamos no topo da página
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const y = e.touches[0].clientY;
      const delta = y - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        // damping para resistência tipo iOS
        const damped = Math.min(limite * 1.5, delta * 0.5);
        setPull(damped);
        if (damped > 10) e.preventDefault();
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      if (pull >= limite && !refreshing) {
        setRefreshing(true);
        setPull(limite);
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, limite, onRefresh]);

  const progresso = Math.min(1, pull / limite);

  return (
    <div ref={containerRef} className="relative">
      {/* Indicador */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center pointer-events-none transition-opacity"
        style={{ opacity: progresso, transform: `translate(-50%, ${pull - 50}px)` }}
      >
        <div className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center border border-[#2E7DD1]/20">
          {refreshing ? (
            <Loader2 size={18} className="text-[#2E7DD1] animate-spin" />
          ) : (
            <ArrowDown
              size={18}
              className="text-[#2E7DD1] transition-transform"
              style={{ transform: `rotate(${progresso * 180}deg)` }}
            />
          )}
        </div>
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: refreshing ? "transform 0.2s" : pull === 0 ? "transform 0.25s" : "none" }}>
        {children}
      </div>
    </div>
  );
}
