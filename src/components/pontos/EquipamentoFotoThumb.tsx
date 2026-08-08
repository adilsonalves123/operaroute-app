"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoEquipamento } from "@/lib/storage/coleta-fotos";
import type { Equipamento } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function EquipamentoFotoThumb({
  equipamento,
  onUpdated,
}: {
  equipamento: Equipamento;
  onUpdated?: (fotoUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fotoUrl, setFotoUrl] = useState(equipamento.foto_url);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;
    setErro("");
    setUploading(true);
    try {
      const supabase = createClient();
      const empresaId = await getEmpresaIdForUser(supabase);
      if (!empresaId) {
        setErro("Empresa não encontrada.");
        return;
      }
      const url = await uploadFotoEquipamento(supabase, empresaId, equipamento.id, file);
      const res = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ foto_url: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao salvar foto.");
        return;
      }
      setFotoUrl(url);
      onUpdated?.(url);
    } catch {
      setErro("Falha ao enviar foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      {fotoUrl ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative block overflow-hidden rounded-sm ring-1 ring-white/[0.08] hover:ring-[#c4a574]/35"
          title="Trocar foto"
        >
          <ExpandableImage src={fotoUrl} alt="" className="h-11 w-11 object-cover" />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-white/[0.12] text-slate-600",
            "hover:border-[#c4a574]/40 hover:text-[#c4a574]/80"
          )}
          title="Adicionar foto"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" />
              <span className="text-[8px] tracking-wide">Foto</span>
            </>
          )}
        </button>
      )}
      {erro && <p className="mt-1 max-w-[88px] text-[10px] text-red-400">{erro}</p>}
    </div>
  );
}
