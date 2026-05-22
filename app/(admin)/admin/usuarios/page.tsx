"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Users, Search, ScanFace, Bell, BellOff,
  Trash2, Loader2, User, XCircle,
  Calendar, Mail, Images, ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface UsuarioItem {
  email: string;
  nome: string;
  foto: string;
  thumb: string | null;
  temDescriptor: boolean;
  totalReferencias: number;
  totalFotosRastreio: number;
  isAdmin: boolean;
  notificar_site: boolean;
  criado_em: string;
  atualizado_em: string;
}

function tempo(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function Avatar({ u }: { u: UsuarioItem }) {
  const [err, setErr] = useState(false);
  const src = u.thumb || u.foto;

  if (src && !err) {
    return (
      <img
        src={src} alt={u.nome}
        onError={() => setErr(true)}
        className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
      {(u.nome || u.email)[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function AdminUsuariosPage() {
  const [usuarios,   setUsuarios]   = useState<UsuarioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca,      setBusca]      = useState("");
  const [filtro,     setFiltro]     = useState<"todos" | "prontos" | "reforcar" | "sem_rosto" | "sem_sininho">("todos");
  const [removendo,  setRemovendo]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then(r => r.json())
      .then(data => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => setUsuarios([]))
      .finally(() => setCarregando(false));
  }, []);

  const lista = useMemo(() => {
    let r = usuarios;
    if (filtro === "prontos")    r = r.filter(u => u.totalReferencias >= 2);
    if (filtro === "reforcar")   r = r.filter(u => u.totalReferencias === 1);
    if (filtro === "sem_rosto")  r = r.filter(u => !u.temDescriptor);
    if (filtro === "sem_sininho") r = r.filter(u => !u.notificar_site);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      r = r.filter(u => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return r;
  }, [usuarios, filtro, busca]);

  async function remover(email: string) {
    if (!confirm(`Remover o perfil de ${email}? Isso apaga rosto e preferências.`)) return;
    setRemovendo(email);
    await fetch(`/api/usuarios?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    setUsuarios(prev => prev.filter(u => u.email !== email));
    setRemovendo(null);
  }

  const totalComRosto = usuarios.filter(u => u.temDescriptor).length;
  const totalProntos = usuarios.filter(u => u.totalReferencias >= 2).length;
  const totalReforcar = usuarios.filter(u => u.totalReferencias === 1).length;
  const totalSemRosto = usuarios.filter(u => !u.temDescriptor).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2B4E] flex items-center gap-2">
            <Users className="text-[#2E7DD1]" size={24} /> Usuários
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {carregando ? "Carregando..." : `${usuarios.length} cadastrado${usuarios.length !== 1 ? "s" : ""} · ${totalComRosto} com rosto`}
          </p>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      {!carregando && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow">
                <Users size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0D2B4E]">{usuarios.length}</p>
                <p className="text-xs text-gray-500">Total cadastrados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ScanFace size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0D2B4E]">{totalProntos}</p>
                <p className="text-xs text-gray-500">Com 2+ referencias</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <ScanFace size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0D2B4E]">{totalReforcar}</p>
                <p className="text-xs text-gray-500">Com 1 referencia</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <XCircle size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0D2B4E]">{totalSemRosto}</p>
                <p className="text-xs text-gray-500">Sem rosto</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Bell size={16} className="text-[#2E7DD1]" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0D2B4E]">
                  {usuarios.filter(u => u.notificar_site).length}
                </p>
                <p className="text-xs text-gray-500">Com notificação ativa</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#0D2B4E] bg-white focus:outline-none focus:border-[#2E7DD1] transition"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["todos", "prontos", "reforcar", "sem_rosto", "sem_sininho"] as const).map(f => (
            <button key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                filtro === f
                  ? "gradient-primary text-white shadow"
                  : "border border-gray-200 text-gray-500 hover:bg-[#EFF5FF] hover:text-[#1A4A80]"
              }`}
            >
              {{
                todos: "Todos",
                prontos: "2+ referencias",
                reforcar: "1 referencia",
                sem_rosto: "Sem rosto",
                sem_sininho: "Sem sininho",
              }[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center py-20 gap-3 text-[#2E7DD1]">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm font-medium">Carregando usuários...</span>
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <User size={36} className="text-gray-200" />
            <p className="font-semibold text-[#0D2B4E]">
              {busca || filtro !== "todos" ? "Nenhum resultado" : "Nenhum usuário cadastrado"}
            </p>
            <p className="text-gray-400 text-sm">
              {busca ? "Tente outro termo de busca" : "Os usuários aparecem aqui ao se cadastrar"}
            </p>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="hidden sm:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-gray-50 bg-[#EFF5FF]">
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Usuário</span>
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Email</span>
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Rosto</span>
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Notif.</span>
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Permissão</span>
              <span className="text-xs font-bold text-[#1A4A80] uppercase tracking-wider">Fotos / Ações</span>
            </div>

            <div className="divide-y divide-gray-50">
              {lista.map(u => (
                <div
                  key={u.email}
                  className="flex flex-col sm:grid sm:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 items-start sm:items-center px-6 py-4 hover:bg-[#EFF5FF]/50 transition"
                >
                  {/* Nome + data */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar u={u} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0D2B4E] text-sm truncate">{u.nome || "—"}</p>
                      <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                        <Calendar size={10} />
                        {tempo(u.criado_em)}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-1.5 min-w-0 sm:pl-0 pl-12">
                    <Mail size={12} className="text-gray-300 shrink-0" />
                    <span className="text-sm text-gray-500 truncate">{u.email}</span>
                  </div>

                  {/* Rosto */}
                  <div className="pl-12 sm:pl-0">
                    {u.totalReferencias >= 2 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ScanFace size={11} /> {u.totalReferencias} refs
                      </span>
                    ) : u.totalReferencias === 1 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                        <ScanFace size={11} /> 1 ref
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        <XCircle size={11} /> Sem rosto
                      </span>
                    )}
                  </div>

                  {/* Notificação */}
                  <div className="pl-12 sm:pl-0">
                    {u.notificar_site ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2E7DD1] border border-blue-100">
                        <Bell size={11} /> Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">
                        <BellOff size={11} /> Inativa
                      </span>
                    )}
                  </div>

                  {/* Permissão */}
                  <div className="pl-12 sm:pl-0">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                        <ShieldCheck size={11} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">
                        Usuário
                      </span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="pl-12 sm:pl-0 flex items-center gap-1.5">
                    <Link
                      href={`/admin/usuarios/${encodeURIComponent(u.email)}`}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-[#2E7DD1] hover:bg-[#EFF5FF] hover:border-[#2E7DD1]/30 transition"
                      title="Ver fotos encontradas"
                    >
                      <Images size={14} />
                    </Link>
                    <button
                      onClick={() => remover(u.email)}
                      disabled={removendo === u.email}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition disabled:opacity-40"
                      title="Remover usuário"
                    >
                      {removendo === u.email
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé da lista */}
            <div className="px-6 py-3 border-t border-gray-50 bg-[#EFF5FF]/40">
              <p className="text-xs text-gray-400">
                Mostrando {lista.length} de {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
