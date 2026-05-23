"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { bumpEventMetric } from "@/app/components/EventCardMetrics";

interface Props {
  slug: string;
  nome: string;
}

export default function EventCardActions({ slug, nome }: Props) {
  const [curtido, setCurtido] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function curtir() {
    setCurtido((v) => {
      if (!v) void bumpEventMetric(slug, "likes");
      return !v;
    });
  }

  async function compartilhar() {
    const url = `${window.location.origin}/eventos/${slug}`;
    const text = `Veja as fotos do evento ${nome}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: nome, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1800);
      }
      void bumpEventMetric(slug, "shares");
    } catch {
      // Usuario cancelou o compartilhamento nativo.
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={curtir}
        title={curtido ? "Curtido" : "Curtir evento"}
        aria-label={curtido ? "Curtido" : "Curtir evento"}
        className={`grid h-7 w-7 place-items-center rounded-md text-xs transition ${
          curtido
            ? "text-red-600"
            : "text-[#2E7DD1] hover:bg-[#EFF6FF] dark:text-[#8CC3FF] dark:hover:bg-white/10"
        }`}
      >
        <Heart size={14} fill={curtido ? "currentColor" : "none"} />
      </button>

      <a
        href={`/eventos/${slug}#comentarios`}
        title="Comentar"
        aria-label="Comentar"
        className="grid h-7 w-7 place-items-center rounded-md text-[#2E7DD1] transition hover:bg-[#EFF6FF] dark:text-[#8CC3FF] dark:hover:bg-white/10"
      >
        <MessageCircle size={14} />
      </a>

      <button
        type="button"
        onClick={compartilhar}
        title={copiado ? "Link copiado" : "Compartilhar"}
        aria-label={copiado ? "Link copiado" : "Compartilhar"}
        className="grid h-7 w-7 place-items-center rounded-md text-[#2E7DD1] transition hover:bg-[#EFF6FF] dark:text-[#8CC3FF] dark:hover:bg-white/10"
      >
        <Share2 size={14} />
      </button>
    </div>
  );
}
