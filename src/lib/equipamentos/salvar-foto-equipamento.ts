import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoEquipamento } from "@/lib/storage/coleta-fotos";
import type { EquipamentoInput, EquipamentoTipo } from "@/lib/equipamentos";

export async function salvarFotoEquipamento(
  equipamentoId: string,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const empresaId = await getEmpresaIdForUser(supabase);
  if (!empresaId) {
    return { ok: false, error: "Empresa não encontrada." };
  }

  try {
    const url = await uploadFotoEquipamento(supabase, empresaId, equipamentoId, file);
    const res = await fetch(`/api/equipamentos/${equipamentoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ foto_url: url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: (data.error as string) ?? "Erro ao gravar foto." };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Falha ao enviar foto." };
  }
}

export function matchEquipamentoCriado(
  local: EquipamentoInput,
  server: { id: string; nome: string; numero_maquina: string | null; tipo: EquipamentoTipo }
): boolean {
  return (
    local.nome.trim() === server.nome.trim() &&
    local.numero_maquina.trim() === (server.numero_maquina ?? "").trim() &&
    local.tipo === server.tipo
  );
}
