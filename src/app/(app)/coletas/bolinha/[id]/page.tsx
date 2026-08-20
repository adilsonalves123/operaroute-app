import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { labelFormaPagamento } from "@/lib/financeiro/forma-pagamento";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import { snapshotFromColetaRow } from "@/lib/comprovantes/from-relatorio-nicho";
import { CompartilharColetaHistoricoActions } from "@/components/coletas/CompartilharColetaHistoricoActions";
import { CorrigirPagamentoButton } from "@/components/coletas/CorrigirPagamentoButton";

export default async function ColetaBolinhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: coleta } = await supabase
    .from("coletas")
    .select("*, pontos(nome, whatsapp), equipamentos(nome, numero_maquina, numero_serie, preco_jogada)")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
    .maybeSingle();

  if (!coleta) notFound();

  const { data: empresa } = profile?.empresa_id
    ? await supabase
        .from("empresas")
        .select("nome_operacao, chave_pix")
        .eq("id", profile.empresa_id)
        .maybeSingle()
    : { data: null };

  const brindes = (
    Array.isArray(coleta.brindes_entregues) ? coleta.brindes_entregues : []
  ) as { nome: string; quantidade: number; custo_unitario?: number }[];

  const valorAReceber = Number(coleta.valor_a_receber ?? coleta.valor_liquido ?? 0);
  const valorPago = Number(coleta.valor_pago_recebido ?? 0);
  const saldoPendente = saldoPendenteColeta(coleta);
  const formaPagamento = labelFormaPagamento(
    coleta.forma_pagamento,
    coleta.valor_pix,
    coleta.valor_dinheiro
  );
  const valorContado = Number(coleta.valor_bruto ?? 0);
  const unidadesSaiu = Number(coleta.quantidade_furos ?? coleta.entrada_periodo ?? 0);
  const precoJogada = Number(coleta.equipamentos?.preco_jogada ?? 0);
  const ponto = coleta.pontos as { nome?: string; whatsapp?: string | null } | null;
  const snapshot = {
    ...snapshotFromColetaRow({
      empresaNome: empresa?.nome_operacao ?? "Operação",
      pontoNome: ponto?.nome ?? "Ponto",
      chavePix: empresa?.chave_pix ?? null,
      nichoLabel: "Bolinha",
      createdAt: coleta.created_at,
      valorAReceber,
      valorPago,
      saldoPendente,
      desconto: Number(coleta.desconto ?? 0),
      comissao: Number(coleta.valor_comissao ?? 0),
      valorBruto: valorContado,
      haverGerado: Math.max(0, valorPago - valorAReceber),
      maquinas: [
        {
          nome:
            (coleta.equipamentos as { nome?: string } | null)?.nome ??
            "Máquina",
          lucro: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
        },
      ],
    }),
    layout: "historico" as const,
    nichoModulo: "bolinha" as const,
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
          valorContado,
          precoJogada,
          unidadesSaiu,
          entradaAnterior: Number(coleta.entrada_anterior ?? 0),
          entradaAtual: Number(coleta.entrada_atual ?? 0),
          entradaPeriodo: Number(coleta.entrada_periodo ?? 0),
          valorBruto: valorContado,
          custoBrindes: Number(coleta.custo_brindes ?? 0),
          lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
          fotoUrl: coleta.foto_url ?? null,
        },
      ],
      calculo: {
        valorBruto: valorContado,
        valorComissao: Number(coleta.valor_comissao ?? 0),
        comissaoPercentual: Number(coleta.comissao_percentual ?? 0),
        desconto: Number(coleta.desconto ?? 0),
        valorAReceber,
        lucroReal: Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0),
        valorPagoRecebido: valorPago,
        saldoPendente,
        haver: Math.max(0, valorPago - valorAReceber),
      },
    },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Coleta Bolinha</h1>
          <p className="text-sm text-slate-400">{formatDateTime(coleta.created_at)}</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Ponto</p>
            <p className="font-medium text-white">{coleta.pontos?.nome ?? "Ponto"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Máquina</p>
            <p className="font-medium text-white">
              {coleta.equipamentos?.nome ?? coleta.equipamento_id ?? "Máquina"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dinheiro contado</p>
            <p className="font-semibold text-emerald-300">{formatCurrency(valorContado)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Jogada</p>
            <p className="font-semibold text-white">
              {precoJogada > 0 ? formatCurrency(precoJogada) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cápsulas saídas</p>
            <p className="font-semibold text-white">{unidadesSaiu}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Série</p>
            <p className="font-mono text-cyan-300">{coleta.equipamentos?.numero_serie ?? "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Bruto</p>
            <p className="font-semibold text-white">{formatCurrency(Number(coleta.valor_bruto ?? 0))}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Comissão</p>
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
            <p className="text-xs text-slate-500">Separar p/ brindes</p>
            <p className="font-semibold text-rose-300">
              {formatCurrency(Number(coleta.custo_brindes ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Livre</p>
            <p className="font-semibold text-primary-neon">
              {formatCurrency(Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0))}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Recebido</p>
            <p className="font-semibold text-green-400">{formatCurrency(valorPago)}</p>
            <p className="mt-1 text-xs text-slate-500">{formaPagamento}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500">Saldo pendente</p>
            <p className={`font-semibold ${saldoPendente > 0.009 ? "text-amber-400" : "text-green-400"}`}>
              {formatCurrency(saldoPendente)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-white">Cápsulas / itens (baixa automática)</h2>
          {brindes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum item baixado nesta coleta.</p>
          ) : (
            <div className="space-y-2">
              {brindes.map((item, index) => (
                <div
                  key={`${item.nome}-${index}`}
                  className="flex justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                >
                  <span className="text-slate-300">
                    {item.nome} x{item.quantidade}
                  </span>
                  <span className="text-slate-400">
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
            <p className="mt-2 text-sm text-slate-400">{coleta.observacao}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
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
