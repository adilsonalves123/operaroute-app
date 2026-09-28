import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyEmpresaAdmins } from "@/lib/push/notify-admins";
import type { PushPayload } from "@/lib/push/types";
import {
  DIAS_PUSH_VENCIMENTO,
  diasCalendarioAte,
  formatarDataVencimento,
} from "@/lib/billing/vencimento";

type EmpresaVencendo = {
  id: string;
  owner_id: string | null;
  assinatura_vence_em: string | null;
};

function mensagemPush(dias: number, venceEm: string): PushPayload {
  const data = formatarDataVencimento(venceEm);
  const tag = `assinatura-vencimento-${dias}`;
  if (dias < 0) {
    return {
      title: "Assinatura vencida",
      body: `Sua assinatura venceu em ${data}. Renove para liberar a operação — seus dados continuam salvos.`,
      url: "/planos",
      tag,
    };
  }
  if (dias === 0) {
    return {
      title: "Sua assinatura vence hoje",
      body: "Renove agora para a equipe não ficar travada amanhã.",
      url: "/planos",
      tag,
    };
  }
  return {
    title: dias === 1 ? "Sua assinatura vence amanhã" : `Sua assinatura vence em ${dias} dias`,
    body: `Vencimento em ${data}. Renove pelo app em poucos cliques.`,
    url: "/planos",
    tag,
  };
}

/**
 * Cron diário: push para dono/admin/gerente nos dias definidos em DIAS_PUSH_VENCIMENTO.
 * Como roda 1x por dia e cada dia relativo casa uma vez só, não precisa guardar histórico.
 * Quem cancelou a renovação não recebe.
 */
export async function avisarVencimentosAssinatura(admin: SupabaseClient) {
  const agora = Date.now();
  const maiorAntes = Math.max(...DIAS_PUSH_VENCIMENTO);
  const maiorDepois = Math.abs(Math.min(...DIAS_PUSH_VENCIMENTO));
  const de = new Date(agora - (maiorDepois + 1) * 86_400_000).toISOString();
  const ate = new Date(agora + (maiorAntes + 1) * 86_400_000).toISOString();

  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, owner_id, assinatura_vence_em")
    .gte("assinatura_vence_em", de)
    .lte("assinatura_vence_em", ate);

  if (error) return { ok: false as const, error: error.message };

  const lista = (empresas ?? []) as EmpresaVencendo[];
  const ownerIds = [...new Set(lista.map((e) => e.owner_id).filter(Boolean))] as string[];

  const renovacaoAtiva = new Map<string, boolean>();
  if (ownerIds.length > 0) {
    const { data: perfis } = await admin
      .from("profiles")
      .select("user_id, assinatura_ativa")
      .in("user_id", ownerIds);
    for (const p of perfis ?? []) {
      renovacaoAtiva.set(String(p.user_id), p.assinatura_ativa !== false);
    }
  }

  const alvos = new Set<number>(DIAS_PUSH_VENCIMENTO);
  let enviados = 0;
  let ignorados = 0;

  for (const empresa of lista) {
    if (!empresa.assinatura_vence_em) continue;
    if (empresa.owner_id && renovacaoAtiva.get(empresa.owner_id) === false) {
      ignorados += 1;
      continue;
    }
    const dias = diasCalendarioAte(empresa.assinatura_vence_em, new Date(agora));
    if (dias == null || !alvos.has(dias)) continue;

    await notifyEmpresaAdmins(empresa.id, mensagemPush(dias, empresa.assinatura_vence_em));
    enviados += 1;
  }

  return { ok: true as const, analisadas: lista.length, enviados, ignorados };
}
