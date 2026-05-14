"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisivel(window.scrollY > 320);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function subir() {
    const inicio   = window.scrollY;
    const duracao  = 700; // ms
    const startTime = performance.now();

    function ease(t: number) {
      // easeInOutCubic — começa rápido, desacelera no final
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now: number) {
      const decorrido  = now - startTime;
      const progresso  = Math.min(decorrido / duracao, 1);
      const posicao    = inicio * (1 - ease(progresso));
      window.scrollTo(0, posicao);
      if (progresso < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  return (
    <button
      onClick={subir}
      aria-label="Voltar ao topo"
      className="fixed bottom-28 right-4 lg:bottom-8 lg:right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-300"
      style={{
        background: "linear-gradient(135deg,#2E7DD1,#1A4A80)",
        opacity:    visivel ? 1 : 0,
        transform:  visivel ? "translateY(0) scale(1)" : "translateY(16px) scale(0.85)",
        pointerEvents: visivel ? "auto" : "none",
        boxShadow: "0 4px 20px rgba(46,125,209,0.45)",
      }}
    >
      <ArrowUp size={18} className="text-white" />
    </button>
  );
}
