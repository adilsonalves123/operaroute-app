import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { VisitasListClient } from "@/components/coletas/cassino/VisitasListClient";
import { FuraFuraColetasClient } from "@/components/coletas/fura-fura/FuraFuraColetasClient";
import { ColetasMultiNichoTabs } from "@/components/coletas/ColetasMultiNichoTabs";
import { ColetasClient } from "./ColetasClient";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getNichoConfig } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";

export default async function ColetasPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const nicho = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nicho);

  if (!profile?.empresa_id) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">{config.labels.coleta}s</h1>
        <ColetasClient coletas={[]} />
      </div>
    );
  }

  if (isCassino && isFuraFura) {
    const { data: visitasRaw } = await supabase
      .from("visitas")
      .select("*, pontos(nome, cidade)")
      .eq("empresa_id", profile.empresa_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const visitaIds = (visitasRaw ?? []).map((v) => v.id);
    const { data: coletasCounts } = visitaIds.length
      ? await supabase
          .from("coletas")
          .select("visita_id")
          .in("visita_id", visitaIds)
      : { data: [] };

    const countMap = new Map<string, number>();
    coletasCounts?.forEach((c) => {
      if (c.visita_id) countMap.set(c.visita_id, (countMap.get(c.visita_id) ?? 0) + 1);
    });

    const visitas = (visitasRaw ?? []).map((v) => ({
      ...v,
      maquinas_count: countMap.get(v.id) ?? 0,
    }));

    const { data: coletasFura } = await supabase
      .from("coletas")
      .select("*, pontos(nome, cidade, whatsapp)")
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .order("created_at", { ascending: false })
      .limit(50);

    return <ColetasMultiNichoTabs visitas={visitas} coletasFura={coletasFura ?? []} />;
  }

  if (isCassino) {
    const { data: visitasRaw } = await supabase
      .from("visitas")
      .select("*, pontos(nome, cidade)")
      .eq("empresa_id", profile.empresa_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const visitaIds = (visitasRaw ?? []).map((v) => v.id);
    const { data: coletasCounts } = visitaIds.length
      ? await supabase
          .from("coletas")
          .select("visita_id")
          .in("visita_id", visitaIds)
      : { data: [] };

    const countMap = new Map<string, number>();
    coletasCounts?.forEach((c) => {
      if (c.visita_id) countMap.set(c.visita_id, (countMap.get(c.visita_id) ?? 0) + 1);
    });

    const visitas = (visitasRaw ?? []).map((v) => ({
      ...v,
      maquinas_count: countMap.get(v.id) ?? 0,
    }));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Visitas / Leituras</h1>
            <p className="text-slate-400 mt-1">Histórico de coletas cassino por visita</p>
          </div>
          <Link
            href="/coletas/nova/cassino"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            <Plus className="h-4 w-4" />
            Nova leitura
          </Link>
        </div>
        <VisitasListClient visitas={visitas} />
      </div>
    );
  }

  if (isFuraFura) {
    const { data: coletasFura } = await supabase
      .from("coletas")
      .select("*, pontos(nome, cidade, whatsapp)")
      .eq("empresa_id", profile.empresa_id)
      .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
      .order("created_at", { ascending: false })
      .limit(50);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Coletas fura-fura</h1>
            <p className="text-slate-400 mt-1">Histórico de coletas</p>
          </div>
          <Link
            href="/coletas/nova/fura-fura"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            <Plus className="h-4 w-4" />
            Nova coleta
          </Link>
        </div>
        <FuraFuraColetasClient coletas={coletasFura ?? []} />
      </div>
    );
  }

  const { data: coletas } = await supabase
    .from("coletas")
    .select("*, pontos(nome, cidade)")
    .eq("empresa_id", profile.empresa_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{config.labels.coleta}s</h1>
          <p className="text-slate-400 mt-1">Histórico de coletas da operação</p>
        </div>
        <Link
          href="/coletas/nova"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          {config.labels.coletaNova}
        </Link>
      </div>
      <ColetasClient coletas={coletas ?? []} />
    </div>
  );
}
