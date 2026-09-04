import { createClient } from "@/lib/supabase/server";
import { getAppBootstrap } from "@/lib/supabase/app-bootstrap";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { VisitasListClient, type VisitaListItem } from "@/components/coletas/cassino/VisitasListClient";
import { FuraFuraColetasClient, type ColetaFuraListItem } from "@/components/coletas/fura-fura/FuraFuraColetasClient";
import { ColetasMultiNichoTabs } from "@/components/coletas/ColetasMultiNichoTabs";
import { ColetasClient } from "./ColetasClient";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import { NICHO_MODULO_URSINHO } from "@/lib/nichos/ursinho";
import { NICHO_MODULO_DIVERSAO } from "@/lib/nichos/diversao";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import { NICHO_MODULO_CONSIGNADO } from "@/lib/nichos/consignado";
import {
  getDashboardNichosAtivos,
  isDashboardMultiNicho,
} from "@/lib/dashboard-nichos-ativos";
import { coletaBtnPrimaryClass } from "@/components/coletas/layout/coleta-form-styles";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getNichoConfig } from "@/lib/nicho";
import type { Coleta, Nicho } from "@/lib/types/database";

type ColetaUrsinhoListItem = Coleta & {
  pontos?: { nome: string; cidade: string | null } | null;
};

const VISITA_LIST_SELECT =
  "id, created_at, total_lucro_centavos, valor_operacao_efetivo, valor_pago, restante, saldo_negativo, forma_pagamento, relatorio_url, pontos(nome, cidade)";

const COLETA_FURA_LIST_SELECT =
  "id, ponto_id, created_at, lucro_real, valor_liquido, valor_pago_recebido, valor_a_receber, quantidade_furos, forma_pagamento, valor_bruto, nicho_modulo, pontos(nome, cidade, whatsapp)";

const COLETA_LIST_SELECT =
  "id, nicho_modulo, lucro_real, valor_liquido, valor_a_receber, valor_pago_recebido, valor_pix, valor_dinheiro, forma_pagamento, created_at, observacao, pontos(nome, cidade)";

async function visitasComContagemMaquinas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<VisitaListItem[]> {
  const { data: visitasRaw } = await supabase
    .from("visitas")
    .select(VISITA_LIST_SELECT)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(50);

  const visitaIds = (visitasRaw ?? []).map((v) => v.id);
  const { data: coletasCounts } = visitaIds.length
    ? await supabase.from("coletas").select("visita_id").in("visita_id", visitaIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  coletasCounts?.forEach((c) => {
    if (c.visita_id) countMap.set(c.visita_id, (countMap.get(c.visita_id) ?? 0) + 1);
  });

  return (visitasRaw ?? []).map((v) => ({
    ...v,
    maquinas_count: countMap.get(v.id) ?? 0,
  })) as unknown as VisitaListItem[];
}

export default async function ColetasPage() {
  const { profile, supabase, empresa } = await getAppBootstrap();
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const dashboardNichos = getDashboardNichosAtivos(nichosAtivos);
  const isMultiNicho = isDashboardMultiNicho(nichosAtivos);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isUrsinho = nichosAtivos.includes("ursinho");
  const isDiversao = nichosAtivos.includes("diversao");
  const isBolinha = nichosAtivos.includes("bolinha");
  const isConsignado = nichosAtivos.includes("consignado");
  const nicho = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nicho);

  if (!profile?.empresa_id) {
    return (
      <div className="space-y-6">
        <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>{config.labels.coleta}s</h1>
        <ColetasClient coletas={[]} />
      </div>
    );
  }

  if (isMultiNicho) {
    const [visitas, coletasFuraResult, coletasUrsinhoResult, coletasDiversaoResult, coletasBolinhaResult, coletasConsignadoResult] = await Promise.all([
      isCassino ? visitasComContagemMaquinas(supabase, profile.empresa_id) : Promise.resolve([]),
      isFuraFura
        ? supabase
            .from("coletas")
            .select(COLETA_FURA_LIST_SELECT)
            .eq("empresa_id", profile.empresa_id)
            .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      isUrsinho
        ? supabase
            .from("coletas")
            .select(COLETA_LIST_SELECT)
            .eq("empresa_id", profile.empresa_id)
            .eq("nicho_modulo", NICHO_MODULO_URSINHO)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      isDiversao
        ? supabase
            .from("coletas")
            .select(COLETA_LIST_SELECT)
            .eq("empresa_id", profile.empresa_id)
            .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      isBolinha
        ? supabase
            .from("coletas")
            .select(COLETA_LIST_SELECT)
            .eq("empresa_id", profile.empresa_id)
            .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      isConsignado
        ? supabase
            .from("coletas")
            .select(COLETA_LIST_SELECT)
            .eq("empresa_id", profile.empresa_id)
            .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    return (
      <ColetasMultiNichoTabs
        nichos={dashboardNichos}
        visitas={visitas}
        coletasFura={(coletasFuraResult.data ?? []) as unknown as ColetaFuraListItem[]}
        coletasUrsinho={(coletasUrsinhoResult.data ?? []) as unknown as ColetaUrsinhoListItem[]}
        coletasDiversao={(coletasDiversaoResult.data ?? []) as unknown as ColetaUrsinhoListItem[]}
        coletasBolinha={(coletasBolinhaResult.data ?? []) as unknown as ColetaUrsinhoListItem[]}
        coletasConsignado={(coletasConsignadoResult.data ?? []) as unknown as ColetaUrsinhoListItem[]}
      />
    );
  }

  if (isCassino) {
    const visitas = await visitasComContagemMaquinas(supabase, profile.empresa_id);

    return (
      <div className="relative space-y-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-10 h-48 w-48 rounded-full bg-[#c4a574]/[0.06] blur-3xl"
        />
        <header className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-at-link/80">
              Operação
            </p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-at-primary sm:text-[2rem]">
              Coletas
            </h1>
            <p className="mt-1.5 text-sm text-at-muted">Histórico de leituras cassino por visita</p>
          </div>
          <Link
            href="/coletas/nova/cassino"
            className={coletaBtnPrimaryClass("shrink-0 rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4 transition group-hover:rotate-90" />
            Nova leitura
          </Link>
        </header>
        <VisitasListClient visitas={visitas} />
      </div>
    );
  }

  if (isFuraFura) {
    const { data: coletasFura } = await supabase
      .from("coletas")
      .select(COLETA_FURA_LIST_SELECT)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>Coletas fura-fura</h1>
            <p className="text-at-muted mt-1">Histórico de coletas</p>
          </div>
          <Link
            href="/coletas/nova/fura-fura"
            className={coletaBtnPrimaryClass("rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4" />
            Nova coleta
          </Link>
        </div>
        <FuraFuraColetasClient coletas={(coletasFura ?? []) as unknown as ColetaFuraListItem[]} />
      </div>
    );
  }

  if (isUrsinho) {
    const { data: coletasUrsinho } = await supabase
      .from("coletas")
      .select(COLETA_LIST_SELECT)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_URSINHO)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>Coletas ursinho</h1>
            <p className="text-at-muted mt-1">Histórico de coletas por máquina</p>
          </div>
          <Link
            href="/coletas/nova/ursinho"
            className={coletaBtnPrimaryClass("rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4" />
            Nova coleta
          </Link>
        </div>
        <ColetasClient coletas={(coletasUrsinho ?? []) as unknown as ColetaUrsinhoListItem[]} novaColetaHref="/coletas/nova/ursinho" />
      </div>
    );
  }

  if (isDiversao) {
    const { data: coletasDiversao } = await supabase
      .from("coletas")
      .select(COLETA_LIST_SELECT)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>Coletas diversão</h1>
            <p className="text-at-muted mt-1">Histórico de coletas por máquina</p>
          </div>
          <Link
            href="/coletas/nova/diversao"
            className={coletaBtnPrimaryClass("rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4" />
            Nova coleta
          </Link>
        </div>
        <ColetasClient
          coletas={(coletasDiversao ?? []) as unknown as ColetaUrsinhoListItem[]}
          novaColetaHref="/coletas/nova/diversao"
        />
      </div>
    );
  }

  if (isBolinha) {
    const { data: coletasBolinha } = await supabase
      .from("coletas")
      .select(COLETA_LIST_SELECT)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>Coletas bolinha</h1>
            <p className="text-at-muted mt-1">Histórico de coletas por máquina</p>
          </div>
          <Link
            href="/coletas/nova/bolinha"
            className={coletaBtnPrimaryClass("rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4" />
            Nova coleta
          </Link>
        </div>
        <ColetasClient
          coletas={(coletasBolinha ?? []) as unknown as ColetaUrsinhoListItem[]}
          novaColetaHref="/coletas/nova/bolinha"
        />
      </div>
    );
  }

  if (isConsignado) {
    const { data: coletasConsignado } = await supabase
      .from("coletas")
      .select(COLETA_LIST_SELECT)
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>Recolhes consignado</h1>
            <p className="text-at-muted mt-1">Histórico de recolhes por expositor</p>
          </div>
          <Link
            href="/coletas/nova/consignado"
            className={coletaBtnPrimaryClass("rounded-2xl px-5 py-3")}
          >
            <Plus className="h-4 w-4" />
            Novo recolhe
          </Link>
        </div>
        <ColetasClient
          coletas={(coletasConsignado ?? []) as unknown as ColetaUrsinhoListItem[]}
          novaColetaHref="/coletas/nova/consignado"
        />
      </div>
    );
  }

  const { data: coletas } = await supabase
    .from("coletas")
    .select(COLETA_LIST_SELECT)
    .eq("empresa_id", profile.empresa_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[0.95] tracking-tight text-at-primary" style={{ fontFamily: "Georgia, serif" }}>{config.labels.coleta}s</h1>
          <p className="text-at-muted mt-1">Histórico de coletas da operação</p>
        </div>
        <Link
          href="/coletas/nova"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          {config.labels.coletaNova}
        </Link>
      </div>
      <ColetasClient coletas={(coletas ?? []) as unknown as ColetaUrsinhoListItem[]} />
    </div>
  );
}
