"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Circle,
  CircleDot,
  CheckCircle2,
  Gamepad2,
  Store,
  ToyBrick,
  Wallet,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { VisitaPontoResumo, VisitaPontoNicho } from "@/lib/visitas-ponto/types";
import { buildColetaUrl } from "@/lib/visitas-ponto";
import { ReceberDividaAnteriorPanel } from "@/components/visitas-ponto/ReceberDividaAnteriorPanel";
import { CancelarVisitaPontoButton } from "@/components/visitas-ponto/CancelarVisitaPontoButton";
import { VisitaPontoNav } from "@/components/visitas-ponto/VisitaPontoNav";
import { VisitaPontoStickyBar } from "@/components/visitas-ponto/VisitaPontoStickyBar";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";

const NICHO_OPCOES: {
  id: VisitaPontoNicho;
  label: string;
  descricao: string;
  icon: typeof Building2;
  color: string;
}[] = [
  {
    id: "cassino",
    label: "Cassino",
    descricao: "Leitura entrada/saída por máquina",
    icon: Building2,
    color: "border-emerald-500/30 hover:bg-emerald-500/5 text-emerald-400",
  },
  {
    id: "ursinho",
    label: "Ursinho",
    descricao: "Entrada, foto e brindes por máquina",
    icon: ToyBrick,
    color: "border-pink-500/30 hover:bg-pink-500/5 text-pink-400",
  },
  {
    id: "fura_fura",
    label: "Fura-fura",
    descricao: "Contagem de furos, comissão e brindes",
    icon: CircleDot,
    color: "border-amber-500/30 hover:bg-amber-500/5 text-amber-400",
  },
  {
    id: "diversao",
    label: "Diversão",
    descricao: "Entrada e foto por máquina — sem brindes",
    icon: Gamepad2,
    color: "border-cyan-500/30 hover:bg-cyan-500/5 text-cyan-400",
  },
  {
    id: "bolinha",
    label: "Bolinha",
    descricao: "Entrada, foto e estoque de cápsulas",
    icon: Circle,
    color: "border-orange-500/30 hover:bg-orange-500/5 text-orange-400",
  },
  {
    id: "consignado",
    label: "Consignado",
    descricao: "Conte o que sobrou no expositor — tabela do produto",
    icon: Store,
    color: "border-amber-500/30 hover:bg-amber-500/5 text-amber-300",
  },
];

type Props = {
  resumo: VisitaPontoResumo;
  nichosDisponiveis: VisitaPontoNicho[];
  dividaSaldo?: number;
  comissaoStaffPercentual?: number;
};

export function VisitaPontoHub({
  resumo,
  nichosDisponiveis,
  dividaSaldo = 0,
  comissaoStaffPercentual,
}: Props) {
  const router = useRouter();
  const nichosFeitos = new Set(resumo.nichos.map((n) => n.nicho));
  const cobrarHref = `/visitas-ponto/${resumo.visitaPontoId}/resumo`;
  const temColeta = resumo.itensConcluidos > 0;
  const totalCobrar = resumo.subtotalCobravel + Math.max(0, dividaSaldo);
  const valorCta =
    totalCobrar > resumo.subtotalCobravel ? totalCobrar : resumo.subtotalCobravel;

  const nichosPendentes = NICHO_OPCOES.filter(
    (o) => nichosDisponiveis.includes(o.id) && !nichosFeitos.has(o.id)
  );
  const primeiroPendente = nichosPendentes[0];
  const outroNichoHref = primeiroPendente
    ? buildColetaUrl(primeiroPendente.id, resumo.pontoId, resumo.visitaPontoId)
    : null;

  const nichosFeitosLabel =
    resumo.nichos.length > 0
      ? resumo.nichos.map((n) => n.label).join(" · ")
      : undefined;

  return (
    <div
      className={cn(
        "mx-auto max-w-3xl space-y-6",
        // Espaço para sticky (Outro nicho / Cobrar) + BottomNav + safe-area no tablet
        temColeta && "pb-[calc(12rem+env(safe-area-inset-bottom,0px))] lg:pb-36"
      )}
    >
      <VisitaPontoNav
        visitaPontoId={resumo.visitaPontoId}
        pontoId={resumo.pontoId}
        nichosDisponiveis={nichosDisponiveis}
        nichosFeitos={[...nichosFeitos]}
        active="hub"
        pontoNome={resumo.pontoNome}
        subtotalCobravel={resumo.subtotalCobravel}
      />

      <header className="space-y-3">
        <Link
          href={`/pontos/${resumo.pontoId}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-neon"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao ponto
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Visita ao ponto</p>
          <h1 className="text-2xl font-bold text-white">{resumo.pontoNome}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {temColeta
              ? "Operações salvas. Faça outro nicho ou cobre tudo agora — o cliente ainda não pagou."
              : "Escolha um nicho para começar. Pode cobrar no final ou já no primeiro."}
          </p>
        </div>
      </header>

      {temColeta && (
        <section className="rounded-2xl border border-primary-neon/30 bg-primary-neon/[0.08] p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-amber-300/90">
              Acumulado · ainda não pago
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-white">
              {formatCurrency(resumo.subtotalCobravel)}
            </p>
            <div className="mt-3 space-y-1.5 text-sm">
              {resumo.nichos.map((n) => (
                <div key={n.nicho} className="flex justify-between text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    {n.label}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(n.totalCobravel)}
                  </span>
                </div>
              ))}
              {dividaSaldo > 0.009 && (
                <div className="flex justify-between text-amber-300/90 border-t border-white/[0.06] pt-2">
                  <span>Dívida anterior (opcional no Cobrar)</span>
                  <span className="tabular-nums">{formatCurrency(dividaSaldo)}</span>
                </div>
              )}
            </div>
            {resumo.totalLucro > 0.009 && (
              <div className="mt-3">
                <ComissaoStaffLinha
                  lucroAposBrindes={resumo.totalLucro}
                  percentual={comissaoStaffPercentual}
                />
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {outroNichoHref ? (
              <Link
                href={outroNichoHref}
                prefetch={false}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(outroNichoHref);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 px-4 py-3.5 text-sm font-semibold text-white hover:border-white/25"
              >
                Outro nicho
                {primeiroPendente ? ` · ${primeiroPendente.label}` : ""}
              </Link>
            ) : (
              <a
                href="#nichos-visita"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 px-4 py-3.5 text-sm font-semibold text-white hover:border-white/25"
              >
                Ver nichos
              </a>
            )}
            <Link
              href={cobrarHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-neon px-4 py-3.5 text-base font-semibold text-black hover:bg-primary-neon/90"
            >
              <Wallet className="h-5 w-5" />
              Cobrar agora {formatCurrency(valorCta)}
            </Link>
          </div>
          <p className="text-center text-xs text-slate-500">
            Pix, dinheiro, desconto e WhatsApp abrem na tela Cobrar.
          </p>

          {resumo.cassinoNegativo && (
            <p className="text-xs text-slate-500">
              Cassino negativo ({formatCurrency(resumo.cassinoNegativo.valorOperacao)}) não entra na
              cobrança —{" "}
              <Link href={resumo.cassinoNegativo.href} className="text-primary-neon hover:underline">
                corrigir leituras
              </Link>
            </p>
          )}
        </section>
      )}

      <ReceberDividaAnteriorPanel
        visitaPontoId={resumo.visitaPontoId}
        dividaSaldo={dividaSaldo}
        dividaRecebidaInicio={resumo.dividaRecebidaInicio}
      />

      <div id="nichos-visita" className="space-y-3 scroll-mt-24">
        <div>
          <h2 className="text-sm font-medium text-slate-300">
            {temColeta
              ? nichosPendentes.length > 0
                ? "Fazer outro nicho? (opcional)"
                : "Nichos desta visita"
              : "O que fazer agora?"}
          </h2>
          {temColeta && (
            <p className="mt-1 text-xs text-slate-500">
              {nichosPendentes.length > 0
                ? "Não é obrigatório. Se já terminou, use Cobrar agora."
                : "Todos os nichos disponíveis já foram feitos — pode cobrar."}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {NICHO_OPCOES.filter((o) => nichosDisponiveis.includes(o.id)).map((opcao) => {
            const Icon = opcao.icon;
            const feito = nichosFeitos.has(opcao.id);
            const nichoResumo = resumo.nichos.find((n) => n.nicho === opcao.id);
            const href =
              feito && nichoResumo?.href
                ? nichoResumo.href
                : buildColetaUrl(opcao.id, resumo.pontoId, resumo.visitaPontoId);
            return (
              <Link
                key={opcao.id}
                href={href}
                prefetch={false}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(href);
                }}
                className={cn(
                  "glass-card block border p-4 transition",
                  opcao.color,
                  feito && "ring-1 ring-green-500/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-5 w-5 shrink-0" />
                  {feito && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                </div>
                <p className="mt-3 font-semibold text-white">{opcao.label}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {feito
                    ? `Feito · ${formatCurrency(nichoResumo?.totalCobravel ?? 0)} — toque para corrigir`
                    : opcao.descricao}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-white/[0.06] pt-6">
        <CancelarVisitaPontoButton
          visitaPontoId={resumo.visitaPontoId}
          pontoId={resumo.pontoId}
        />
      </div>

      {temColeta && (
        <VisitaPontoStickyBar
          acumulado={resumo.subtotalCobravel}
          cobrarHref={cobrarHref}
          outroNichoHref={outroNichoHref}
          nichosFeitosLabel={nichosFeitosLabel}
        />
      )}
    </div>
  );
}
