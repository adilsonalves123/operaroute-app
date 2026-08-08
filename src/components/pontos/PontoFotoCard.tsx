"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { FotoPontoField } from "@/components/pontos/FotoPontoField";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoPonto } from "@/lib/storage/coleta-fotos";

type Props = {
  pontoId: string;
  fotoUrl: string | null;
  pontoNome: string;
};

export function PontoFotoCard({ pontoId, fotoUrl: initialUrl, pontoNome }: Props) {
  const [fotoUrl, setFotoUrl] = useState(initialUrl);
  const [editando, setEditando] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="glass-card p-4 space-y-4">
        <p className="text-sm font-medium text-white">Foto — {pontoNome}</p>
        <FotoPontoField preview={preview} onChange={handleFile} size="md" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={loading}
            className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
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
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-4">
        {fotoUrl ? (
          <ExpandableImage
            src={fotoUrl}
            alt={`Foto de ${pontoNome}`}
            fullWidth={false}
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-900/60 text-slate-500 border border-white/5">
            <Camera className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-white">Foto do estabelecimento</p>
          <p className="text-xs text-slate-500">
            {fotoUrl ? "Toque na miniatura para ampliar" : "Sem foto cadastrada"}
          </p>
          <button
            type="button"
            onClick={() => {
              setPreview(fotoUrl);
              setEditando(true);
            }}
            className="text-sm text-primary-neon hover:underline"
          >
            {fotoUrl ? "Trocar foto" : "Adicionar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
