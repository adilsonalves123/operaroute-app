import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { formatContador } from "@/lib/nichos/cassino";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import { snapshotFromColetaRow } from "@/lib/comprovantes/from-relatorio-nicho";
import {
  cobrancaFromColetaRow,
  ColetaHistoricoRecebimentoCards,
} from "@/components/coletas/ColetaHistoricoRecebimentoCards";
import { CompartilharColetaHistoricoActions } from "@/components/coletas/CompartilharColetaHistoricoActions";
import { CorrigirPagamentoButton } from "@/components/coletas/CorrigirPagamentoButton";

export default async function ColetaUrsinhoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: coleta } = await supabase
    .from("coletas")
    .select("*, pontos(nome, whatsapp), equipamentos(nome, numero_maquina, numero_serie)")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .eq("nicho_modulo", "ursinho")
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
      .eq("nicho", "ursinho")
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
    return `/coletas/nova/ursinho?${params.toString()}`;
  })();

  const brindes = (
    Array.isArray(coleta.brindes_entregues) ? coleta.brindes_entregues : []
  ) as { nome: string; quantidade: number; custo_unitario?: number }[];

  const valorAReceber = Number(coleta.valor_a_receber ?? coleta.valor_liquido ?? 0);
  const valorPago = Number(coleta.valor_pago_recebido ?? 0);
  const saldoPendente = saldoPendenteColeta(coleta);
  const cobrancaSalva = cobrancaFromColetaRow(coleta);
  const pagamentoColeta = pagamentos?.[0];
  const ponto = coleta.pontos as { nome?: string; whatsapp?: string | null } | null;
  const snapshot = {
    ...snapshotFromColetaRow({
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto?.nome ?? "Ponto",
      chavePix: empresa?.chave_pix ?? null,
      nichoLabel: "Ursinho",
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
            "Máquina",
          lucro: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
          entradaAtual:
            coleta.entrada_atual != null ? Number(coleta.entrada_atual) : undefined,
        },
      ],
    }),
    layout: "historico" as const,
    nichoModulo: "ursinho" as const,
    relatorio: {
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto?.nome ?? "Ponto",
      pontoWhatsapp: ponto?.whatsapp ?? null,
      comissaoPercentual: Number(coleta.comissao_percentual ?? 0),
      data: coleta.created_at,
      previa: false,
      maquinas: [
        {
          nome:
            (coleta.equipamentos as { nome?: string } | null)?.nome ?? "Máquina",
          entradaAnterior: Number(coleta.entrada_anterior ?? 0),
          entradaAtual: Number(coleta.entrada_atual ?? 0),
          entradaPeriodo: Number(coleta.entrada_periodo ?? 0),
          valorBruto: Number(coleta.valor_bruto ?? 0),
          custoBrindes: Number(coleta.custo_brindes ?? 0),
          lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
          fotoUrl: coleta.foto_url ?? null,
        },
      ],
      calculo: {
        valorBruto: Number(coleta.valor_bruto ?? 0),
        valorComissao: Number(coleta.valor_comissao ?? 0),
        comissaoPercentual: Number(coleta.comissao_percentual ?? 0),
        desconto: Number(coleta.desconto ?? 0),
        valorAReceber,
        custoBrindes: Number(coleta.custo_brindes ?? 0),
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
        <Link href="/coletas" className="rounded-lg p-2 text-at-muted hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Coleta ursinho</h1>
          <p className="text-sm text-at-muted">{formatDateTime(coleta.created_at)}</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-at-muted">Ponto</p>
            <p className="font-medium text-white">{coleta.pontos?.nome ?? "Ponto"}</p>
          </div>
          <div>
            <p className="text-xs text-at-muted">Máquina</p>
            <p className="font-medium text-white">
              {coleta.equipamentos?.nome ?? coleta.equipamento_id ?? "Máquina"}
            </p>
          </div>
          <div>
            <p className="text-xs text-at-muted">Entrada anterior</p>
            <p className="font-semibold text-white">
              {coleta.entrada_anterior != null ? formatContador(Number(coleta.entrada_anterior)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-at-muted">Entrada atual</p>
            <p className="font-semibold text-emerald-300">
              {coleta.entrada_atual != null ? formatContador(Number(coleta.entrada_atual)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-at-muted">Período</p>
            <p className="font-semibold text-white">
              {coleta.entrada_periodo != null ? formatContador(Number(coleta.entrada_periodo)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-at-muted">Série</p>
            <p className="font-mono text-cyan-300">{coleta.equipamentos?.numero_serie ?? "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">Bruto</p>
            <p className="font-semibold text-white">{formatCurrency(Number(coleta.valor_bruto ?? 0))}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">Comissão</p>
            <p className="font-semibold text-amber-300">
              {formatCurrency(Number(coleta.valor_comissao ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">Desconto</p>
            <p className="font-semibold text-rose-300">
              {formatCurrency(Number(coleta.desconto ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">A receber</p>
            <p className="font-semibold text-pink-300">{formatCurrency(valorAReceber)}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">Brindes</p>
            <p className="font-semibold text-rose-300">
              {formatCurrency(Number(coleta.custo_brindes ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-at-muted">Líquido real</p>
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
          <h2 className="font-semibold text-white">Brindes / itens</h2>
          {brindes.length === 0 ? (
            <p className="text-sm text-at-muted">Nenhum item informado nesta coleta.</p>
          ) : (
            <div className="space-y-2">
              {brindes.map((item, index) => (
                <div
                  key={`${item.nome}-${index}`}
                  className="flex justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <span className="text-at-primary/85">
                    {item.nome} x{item.quantidade}
                  </span>
                  <span className="text-at-muted">
                    {formatCurrency(Number(item.quantidade) * Number(item.custo_unitario ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {coleta.foto_url && (
          <div className="space-y-2">
            <h2 className="font-semibold text-white">Foto da coleta</h2>
            <img
              src={coleta.foto_url}
              alt="Foto da coleta"
              className="max-h-[420px] w-full rounded-xl border border-slate-800 object-cover"
            />
          </div>
        )}

        {coleta.observacao && (
          <div>
            <h2 className="font-semibold text-white">Observação</h2>
            <p className="mt-2 text-sm text-at-muted">{coleta.observacao}</p>
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