import { createClient, getProfile } from "@/lib/supabase/server";
import { PontosClient } from "./PontosClient";
import type { Ponto } from "@/lib/types/database";

export default async function PontosPage() {
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);

  if (!profile?.empresa_id) {
    return <PontosClient pontos={[]} />;
  }

  const { data: pontos } = await supabase
    .from("pontos")
    .select(
      "id, empresa_id, nome, responsavel, whatsapp, cidade, bairro, endereco, latitude, longitude, tipo_ponto, status, comissao_percentual, operador_id, observacoes, abater_automatico, foto_url, ultima_coleta, created_at, preco_furo, furos_estoque, furos_minimo, estoque_brindes, kit_ativo_id, kit_instalado_em"
    )
    .eq("empresa_id", profile.empresa_id)
    .order("nome");

  const pontosSemFoto = (pontos ?? []).filter((p) => !(p.foto_url ?? "").trim());
  const limiteFotosColeta = Math.min(Math.max(pontosSemFoto.length * 8, 300), 2000);
  const { data: coletasFotos } =
    pontosSemFoto.length > 0
      ? await supabase
          .from("coletas")
          .select("ponto_id, foto_url, created_at")
          .eq("empresa_id", profile.empresa_id)
          .not("foto_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(limiteFotosColeta)
      : { data: [] };

  const fotoColetaPorPonto = new Map<string, string>();
  for (const c of coletasFotos ?? []) {
    if (c.ponto_id && c.foto_url && !fotoColetaPorPonto.has(c.ponto_id)) {
      fotoColetaPorPonto.set(c.ponto_id, c.foto_url);
    }
  }

  const pontosComFoto: Ponto[] = (pontos ?? []).map((p) => ({
    ...p,
    foto_url: p.foto_url ?? fotoColetaPorPonto.get(p.id) ?? null,
  }));

  return <PontosClient pontos={pontosComFoto} />;
}
