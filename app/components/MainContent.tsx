"use client";
import { useEffect, useState } from "react";

const COLLAPSED_KEY = "galeria-sidebar-collapsed";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function sync() {
      try {
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
      } catch {}
    }
    sync();
    // Escuta storageEvent caso outra aba mude, e evento customizado da mesma aba
    window.addEventListener("storage", sync);
    // Poll leve pra reagir ao toggle da Sidebar na mesma página
    const id = setInterval(sync, 300);
    return () => { window.removeEventListener("storage", sync); clearInterval(id); };
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen transition-all duration-300"
      style={{ marginLeft: collapsed ? 68 : 240 }}
    >
      {children}
    </div>
  );
}
