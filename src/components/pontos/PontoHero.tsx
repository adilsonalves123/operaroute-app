"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Loader2,
  MessageCircle,
  Pencil,
  Wrench,
} from "lucide-react";
import { FotoPontoField } from "@/components/pontos/FotoPontoField";
import { IniciarVisitaButton } from "@/components/visitas-ponto/IniciarVisitaButton";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoPonto } from "@/lib/storage/coleta-fotos";
import { formatCurrency, cn } from "@/lib/utils";

type Props = {
  pontoId: string;
  nome: string;
  status: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  fotoUrl: string | null;
  whatsapp: string | null;
  totalCobravel: number;
  cobrarUrl: string | null;
  pendenciasCount: number;
  chamadosCount: number;
  mostraVisita: boolean;
  visitaRascunhoId: string | null;
  alertaFura?: ReactNode;
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  retirado: "Retirado",
  inadimplente: "Inadimplente",
};

export function PontoHero({
  pontoId,
  nome,
  status,
  endereco,
  bairro,
  cidade,
  fotoUrl: initialUrl,
  whatsapp,
  totalCobravel,
  cobrarUrl,
  pendenciasCount,
  chamadosCount,
  mostraVisita,
  visitaRascunhoId,
  alertaFura,
}: Props) {
  const [fotoUrl, setFotoUrl] = useState(initialUrl);
  const [editando, setEditando] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const local = [endereco, bairro, cidade].filter(Boolean).join(" · ");

  function handleFile(f: File | null) {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : fotoUrl);
  }

  async function salvar() {
    setLoading(true);
    setError("");
    try {
      let url: string | null = fotoUrl;
      if (file) {
        const supabase = createClient();
        const empresaId = await getEmpresaIdForUser(supabase);
        if (!empresaId) throw new Error("Empresa não encontrada.");
        url = await uploadFotoPonto(supabase, empresaId, pontoId, file);
      } else if (!preview) {
        url = null;
      }
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_url: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar foto.");
      setFotoUrl(url);
      setEditando(false);
      setFile(null);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  if (editando) {
    return (
      <div className="space-y-4">
        <Link
          href="/pontos"
          className="inline-flex items-center gap-2 text-[13px] text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Pontos
        </Link>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-4">
          <p className="text-sm font-medium text-white">Foto — {nome}</p>
          <FotoPontoField preview={preview} onChange={handleFile} size="md" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={loading}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando…
                </span>
              ) : (
                "Salvar foto"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setFile(null);
                if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
                setPreview(null);
                setError("");
              }}
              className="rounded-full border border-white/15 px-5 py-2 text-sm text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/pontos"
          className="inline-flex items-center gap-2 text-[13px] text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Pontos
        </Link>
        <button
          type="button"
          onClick={() => {
            setPreview(fotoUrl);
            setEditando(true);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300"
        >
          <Camera className="h-3.5 w-3.5" />
          {fotoUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08]">
        <div className="relative aspect-[16/10] min-h-[220px] w-full bg-slate-950 sm:aspect-[2/1] sm:min-h-[280px]">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt={`Foto de ${nome}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(56,189,248,0.12),transparent_55%),linear-gradient(160deg,#0b1220_0%,#05070c_70%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
          <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]",
                  status === "ativo"
                    ? "bg-emerald-400/15 text-emerald-200"
                    : status === "inadimplente"
                      ? "bg-rose-400/15 text-rose-200"
                      : "bg-white/10 text-slate-300"
                )}
              >
                {STATUS_LABEL[status] ?? status}
              </span>
              {totalCobravel > 0.009 && (
                <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-100">
                  A receber {formatCurrency(totalCobravel)}
                </span>
              )}
            </div>
            <h1 className="max-w-xl text-[clamp(1.85rem,5vw,2.75rem)] font-semibold leading-[1.05] tracking-tight text-white">
              {nome}
            </h1>
            {local && (
              <p className="max-w-lg text-[13px] leading-relaxed text-slate-300/90">
                {local}
              </p>
            )}
          </div>
        </div>
      </section>

      {alertaFura}

      {mostraVisita && (
        <IniciarVisitaButton
          pontoId={pontoId}
          rascunhoId={visitaRascunhoId}
          className="!border-0 !bg-white !p-4 !text-slate-950 hover:!bg-slate-100 [&_span]:!text-slate-950 [&_svg]:!text-slate-900"
        />
      )}

      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] pb-4 text-[13px]">
        <Link
          href={`/pontos/${pontoId}/editar`}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Link>
        {whatsapp && (
          <a
            href={`https://wa.me/55${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        )}
        {cobrarUrl && (
          <a
            href={cobrarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-amber-200/90 hover:text-amber-100"
          >
            Cobrar
          </a>
        )}
        <Link
          href="/pendencias"
          className="text-slate-400 hover:text-white"
        >
          Pendências
          {pendenciasCount > 0 ? ` (${pendenciasCount})` : ""}
        </Link>
        {chamadosCount > 0 && (
          <Link
            href="/chamados"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"
          >
            <Wrench className="h-3.5 w-3.5" />
            Manutenção ({chamadosCount})
          </Link>
        )}
      </nav>
    </div>
  );
}
