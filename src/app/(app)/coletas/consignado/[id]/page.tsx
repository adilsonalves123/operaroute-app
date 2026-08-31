import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import { NICHO_MODULO_CONSIGNADO } from "@/lib/nichos/consignado";
import { snapshotFromColetaRow } from "@/lib/comprovantes/from-relatorio-nicho";
import {
  cobrancaFromColetaRow,
  ColetaHistoricoRecebimentoCards,
} from "@/components/coletas/ColetaHistoricoRecebimentoCards";
import { CompartilharColetaHistoricoActions } from "@/components/coletas/CompartilharColetaHistoricoActions";
import { CorrigirPagamentoButton } from "@/components/coletas/CorrigirPagamentoButton";

export default async function ColetaConsignadoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: coleta } = await supabase
    .from("coletas")
    .select("*, pontos(nome, whatsapp), equipamentos(nome, numero_maquina)")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
    .maybeSingle();

  if (!coleta) notFound();

  const { data: pagamentos } = await supabase
    .from("coleta_pagamentos")
    .select("*")
    .eq("coleta_id", id)
    .order("created_at");

  const [{ data: empresa }, { data: itemVisita }] = await Promise.all([
    profile?.empresa_id
      ? supabase
          .from("empresas")
          .select("nome_operacao, chave_pix")
          .eq("id", profile.empresa_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("visita_ponto_itens")
      .select("visita_ponto_id")
      .eq("coleta_id", id)
      .eq("nicho", "consignado")
      .maybeSingle(),
  ]);

  const editarHref = (() => {
    const params = new URLSearchParams({
      ponto: coleta.ponto_id,
      editar_visita: id,
    });
    if (itemVisita?.visita_ponto_id) {
      params.set("visita_ponto", itemVisita.visita_ponto_id);
    }
    return `/coletas/nova/consignado?${params.toString()}`;
  })();

  const vendidos = (
    Array.isArray(coleta.brindes_entregues) ? coleta.brindes_entregues : []
  ) as {
    nome: string;
    quantidade: number;
    custo_unitario?: number;
    codigo?: string | null;
    preco_venda?: number;
    receita?: number;
    comissao?: number;
  }[];

  const valorAReceber = Number(coleta.valor_a_receber ?? coleta.valor_liquido ?? 0);
  const valorPago = Number(coleta.valor_pago_recebido ?? 0);
  const saldoPendente = saldoPendenteColeta(coleta);
  const cobrancaSalva = cobrancaFromColetaRow(coleta);
  const pagamentoColeta = pagamentos?.[0];
  const totalVendido = Number(coleta.quantidade_furos ?? coleta.entrada_periodo ?? 0);
  const ponto = coleta.pontos as { nome?: string; whatsapp?: string | null } | null;
  const snapshot = {
    ...snapshotFromColetaRow({
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto?.nome ?? "Comércio",
      chavePix: empresa?.chave_pix ?? null,
      nichoLabel: "Consignado",
      createdAt: coleta.created_at,
      valorAReceber,
      valorPago,
      saldoPendente,
      desconto: Number(coleta.desconto ?? 0),
      comissao: Number(coleta.valor_comissao ?? 0),
      valorBruto: Number(coleta.valor_bruto ?? 0),
      haverGerado: Math.max(0, valorPago - valorAReceber),
      maquinas: [
        {
          nome:
            (coleta.equipamentos as { nome?: string } | null)?.nome ??
            "Expositor",
          lucro: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
        },
      ],
    }),
    layout: "historico" as const,
    nichoModulo: "consignado" as const,
    relatorio: {
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto?.nome ?? "Comércio",
      pontoWhatsapp: ponto?.whatsapp ?? null,
      data: coleta.created_at,
      previa: false,
      expositores: [
        {
          nome:
            (coleta.equipamentos as { nome?: string } | null)?.nome ?? "Expositor",
          linhas: vendidos.map((v) => ({
            nome: v.nome,
            codigo: v.codigo ?? null,
            vendido: v.quantidade,
            precoVenda: Number(v.preco_venda ?? 0),
            receita: Number(v.receita ?? v.quantidade * Number(v.preco_venda ?? 0)),
            comissao: Number(v.comissao ?? 0),
            custoUnitario: Number(v.custo_unitario ?? 0),
          })),
          valorBruto: Number(coleta.valor_bruto ?? 0),
          custoProdutos: Number(coleta.custo_brindes ?? 0),
          lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
          fotoUrl: coleta.foto_url ?? null,
        },
      ],
      calculo: {
        valorBruto: Number(coleta.valor_bruto ?? 0),
        valorComissao: Number(coleta.valor_comissao ?? 0),
        comissaoPercentual: Number(coleta.comissao_percentual ?? 0),
        modoComissao: "percentual",
        desconto: Number(coleta.desconto ?? 0),
        valorAReceber,
        lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
        valorPagoRecebido: valorPago,
        saldoPendente,
        haver: Math.max(0, valorPago - valorAReceber),
      },
      cobranca: cobrancaSalva,
    },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Recolhe Consignado</h1>
          <p className="text-sm text-slate-400">{formatDateTime(coleta.created_at)}</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Comércio</p>
            <p className="font-medium text-white">{coleta.pontos?.nome ?? "Comércio"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Expositor</p>
            <p className="font-medium text-white">
              {coleta.equipamentos?.nome ?? coleta.equipamento_id ?? "Expositor"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Itens vendidos</p>
            <p className="font-semibold text-emerald-300">{totalVendido}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vendido (bruto)</p>
            <p className="font-semibold text-white">{formatCurrency(Number(coleta.valor_bruto ?? 0))}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Comissão do cliente</p>
            <p className="font-semibold text-amber-300">
              {formatCurrency(Number(coleta.valor_comissao ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Desconto</p>
            <p className="font-semibold text-rose-300">
              {formatCurrency(Number(coleta.desconto ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">A receber</p>
            <p className="font-semibold text-pink-300">{formatCurrency(valorAReceber)}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Separar p/ custo</p>
            <p className="font-semibold text-rose-300">
              {formatCurrency(Number(coleta.custo_brindes ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Livre (lucro)</p>
            <p className="font-semibold text-primary-neon">
              {formatCurrency(Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0))}
            </p>
          </div>
          <ColetaHistoricoRecebimentoCards
            coleta={coleta}
            valorPago={valorPago}
            saldoPendente={saldoPendente}
            pagamentoColeta={pagamentoColeta}
          />
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-white">Comprovante — produtos vendidos</h2>
          {vendidos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto vendido neste recolhe.</p>
          ) : (
            <div className="space-y-2">
              {vendidos.map((item, index) => (
                <div
                  key={`${item.nome}-${index}`}
                  className="flex justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-slate-200">
                      <span className="font-semibold tabular-nums text-white">
                        {item.quantidade}
                      </span>
                      {" × "}
                      {item.nome}
                      {item.codigo ? (
                        <span className="text-slate-500"> ({item.codigo})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.preco_venda != null
                        ? `${formatCurrency(Number(item.preco_venda))} un`
                        : "—"}
                      {item.comissao != null && Number(item.comissao) > 0.009
                        ? ` · comissão ${formatCurrency(Number(item.comissao))}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-slate-200">
                    {item.receita != null
                      ? formatCurrency(Number(item.receita))
                      : formatCurrency(
                          Number(item.quantidade) * Number(item.preco_venda ?? 0)
                        )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {coleta.foto_url && (
          <div className="space-y-2">
            <h2 className="font-semibold text-white">Foto do recolhe</h2>
            <img
              src={coleta.foto_url}
              alt="Foto do recolhe"
              className="max-h-[420px] w-full rounded-xl border border-slate-800 object-cover"
            />
          </div>
        )}

        {coleta.observacao && (
          <div>
            <h2 className="font-semibold text-white">Observação</h2>
            <p className="mt-2 text-sm text-slate-400">{coleta.observacao}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={editarHref}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
        >
          Editar coleta completa
        </Link>
        <CorrigirPagamentoButton
          tipo="coleta"
          id={id}
          valorAReceber={valorAReceber}
          valorPixInicial={Number(coleta.valor_pix ?? 0)}
          valorDinheiroInicial={Number(coleta.valor_dinheiro ?? 0)}
          valorPagoInicial={Number(coleta.valor_pago_recebido ?? 0)}
        />
        <CompartilharColetaHistoricoActions
          snapshot={snapshot}
          telefone={ponto?.whatsapp}
        />
      </div>
    </div>
  );
}
