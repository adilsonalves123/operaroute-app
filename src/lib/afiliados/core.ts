import type { SupabaseClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/app-url";

export const AFILIADO_REF_COOKIE = "or_ref";
export const AFILIADO_SESSION_COOKIE = "or_parceiro_session";

export type AfiliadoRow = {
  id: string;
  codigo: string;
  nome: string;
  email: string;
  senha_hash: string;
  whatsapp: string | null;
  comissao_tipo: "percentual" | "fixo";
  comissao_valor: number;
  ativo: boolean;
  notas: string | null;
  created_at: string;
};

export type AfiliadoPublic = Omit<AfiliadoRow, "senha_hash">;

export function normalizarCodigo(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function toPublicAfiliado(row: AfiliadoRow): AfiliadoPublic {
  const { senha_hash: _s, ...rest } = row;
  void _s;
  return {
    ...rest,
    comissao_valor: Number(rest.comissao_valor),
  };
}

export function calcComissaoCentavos(
  afiliado: Pick<AfiliadoRow, "comissao_tipo" | "comissao_valor">,
  baseReais: number
): number {
  const baseCentavos = Math.round(Math.max(0, baseReais) * 100);
  if (afiliado.comissao_tipo === "fixo") {
    return Math.round(Number(afiliado.comissao_valor) * 100);
  }
  const pct = Math.max(0, Math.min(100, Number(afiliado.comissao_valor)));
  return Math.round((baseCentavos * pct) / 100);
}

export function linkAfiliado(codigo: string, origin?: string): string {
  return absoluteUrl(`/cadastro?ref=${encodeURIComponent(codigo)}`, origin);
}

export async function findAfiliadoByCodigo(
  admin: SupabaseClient,
  codigo: string
): Promise<AfiliadoRow | null> {
  const c = normalizarCodigo(codigo);
  if (!c) return null;
  const { data } = await admin
    .from("plataforma_afiliados")
    .select("*")
    .eq("codigo", c)
    .eq("ativo", true)
    .maybeSingle();
  return (data as AfiliadoRow | null) ?? null;
}

export async function registrarEventoAfiliado(
  admin: SupabaseClient,
  input: {
    afiliado_id: string;
    tipo: "click" | "cadastro" | "conversao";
    empresa_id?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  await admin.from("plataforma_afiliado_eventos").insert({
    afiliado_id: input.afiliado_id,
    tipo: input.tipo,
    empresa_id: input.empresa_id ?? null,
    meta: input.meta ?? null,
  });
}

export async function atribuirAfiliadoEmpresa(
  admin: SupabaseClient,
  empresaId: string,
  codigo: string
): Promise<{ ok: true; afiliado_id: string } | { ok: false; error: string }> {
  const afiliado = await findAfiliadoByCodigo(admin, codigo);
  if (!afiliado) return { ok: false, error: "Código inválido." };

  const { data: emp } = await admin
    .from("empresas")
    .select("id, afiliado_id")
    .eq("id", empresaId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Empresa não encontrada." };
  if (emp.afiliado_id) return { ok: true, afiliado_id: emp.afiliado_id };

  const { error } = await admin
    .from("empresas")
    .update({
      afiliado_id: afiliado.id,
      afiliado_codigo: afiliado.codigo,
      afiliado_atribuido_em: new Date().toISOString(),
    })
    .eq("id", empresaId);
  if (error) return { ok: false, error: error.message };

  await registrarEventoAfiliado(admin, {
    afiliado_id: afiliado.id,
    tipo: "cadastro",
    empresa_id: empresaId,
  });
  return { ok: true, afiliado_id: afiliado.id };
}

export async function criarComissaoSeAfiliado(
  admin: SupabaseClient,
  input: {
    empresa_id: string;
    empresa_nome?: string;
    base_reais: number;
    referencia?: string;
  }
): Promise<{ criada: boolean; valor_centavos?: number }> {
  const { data: emp } = await admin
    .from("empresas")
    .select("id, nome_operacao, afiliado_id")
    .eq("id", input.empresa_id)
    .maybeSingle();
  if (!emp?.afiliado_id) return { criada: false };

  const { data: afiliado } = await admin
    .from("plataforma_afiliados")
    .select("*")
    .eq("id", emp.afiliado_id)
    .eq("ativo", true)
    .maybeSingle();
  if (!afiliado) return { criada: false };

  const valor = calcComissaoCentavos(afiliado as AfiliadoRow, input.base_reais);
  if (valor <= 0) return { criada: false };

  await admin.from("plataforma_afiliado_comissoes").insert({
    afiliado_id: afiliado.id,
    empresa_id: emp.id,
    empresa_nome: input.empresa_nome ?? emp.nome_operacao,
    valor_centavos: valor,
    base_centavos: Math.round(input.base_reais * 100),
    status: "pendente",
    referencia: input.referencia ?? null,
  });

  await registrarEventoAfiliado(admin, {
    afiliado_id: afiliado.id,
    tipo: "conversao",
    empresa_id: emp.id,
    meta: { valor_centavos: valor, base_reais: input.base_reais },
  });

  return { criada: true, valor_centavos: valor };
}
