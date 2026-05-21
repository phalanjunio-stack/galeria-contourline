"use client";
import { useEffect, useState } from "react";

const COLLAPSED_KEY   = "galeria-sidebar-collapsed";
const COLLAPSED_EVENT = "galeria-sidebar-collapsed-changed";
const SIDEBAR_OPEN_PX   = 240;
const SIDEBAR_CLOSED_PX = 68;

export default function MainContent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Sync inicial
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}

    function onCustom(e: Event) {
      const ev = e as CustomEvent<{ collapsed: boolean }>;
      setCollapsed(!!ev.detail?.collapsed);
    }
    function onStorage() {
      try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1"); } catch {}
    }

    window.addEventListener(COLLAPSED_EVENT, onCustom as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COLLAPSED_EVENT, onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const ml = collapsed ? SIDEBAR_CLOSED_PX : SIDEBAR_OPEN_PX;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        marginLeft: ml,
        transition: "margin-left 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}
