"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";

type Theme = "light" | "dark";
const STORAGE_KEY = "galeria-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    playSound(next === "dark" ? "close" : "open");
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  const isDark = theme === "dark";

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title="Tema"
      className="relative p-2 rounded-xl transition-all duration-200 overflow-visible"
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.10) 100%)"
          : "transparent",
        boxShadow: isDark
          ? "0 0 14px rgba(251,191,36,0.35), inset 0 0 0 1px rgba(251,191,36,0.3)"
          : "none",
        color: isDark ? "#fbbf24" : "#1A4A80",
      }}
    >
      {/* Halo dark mode */}
      {isDark && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(251,191,36,0.25) 0%, transparent 60%)",
            filter: "blur(2px)",
          }}
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0,    opacity: 1, scale: 1   }}
          exit={{    rotate: 90,   opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
