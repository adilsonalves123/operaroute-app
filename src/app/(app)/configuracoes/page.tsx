import { getProfile, getEmpresa, createClient } from "@/lib/supabase/server";
import { getNichoConfig } from "@/lib/nicho";
import { calcPrecoMensal, formatPreco, normalizeFaixaPontos } from "@/lib/pricing";
import { resolveNichosAtivos } from "@/lib/assinatura";
import Link from "next/link";
import type { Nicho } from "@/lib/types/database";
import { Settings, CreditCard } from "lucide-react";
import { ZerarDadosButton } from "@/components/configuracoes/ZerarDadosButton";

export default async function ConfiguracoesPage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const nichoPrincipal = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nichoPrincipal);

  const supabase = await createClient();
  const { count: pontosAtivos } = empresa
    ? await supabase
        .from("pontos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresa.id)
        .eq("status", "ativo")
    : { count: 0 };

  const faixa = normalizeFaixaPontos(empresa?.quantidade_pontos);
  const preco = empresa ? calcPrecoMensal(faixa, nichosAtivos) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 mt-1">Gerencie sua operação e conta</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary-neon" />
          Dados da operação
        </h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Nome</span>
            <span className="text-white">{empresa?.nome_operacao ?? profile?.nome_operacao ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Nicho principal</span>
            <span className="text-white">{config.label}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Nichos ativos</span>
            <span className="text-white text-right">
              {nichosAtivos.map((n) => getNichoConfig(n).label).join(", ")}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Pontos</span>
            <span className="text-white">
              {pontosAtivos ?? 0} / {empresa?.limite_pontos ?? "—"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Valor estimado</span>
            <span className="text-primary-neon font-medium">{formatPreco(preco)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-400">Responsável</span>
            <span className="text-white">{profile?.nome}</span>
          </div>
        </div>
      </div>

      <Link
        href="/planos"
        className="glass-card p-6 flex items-center justify-between hover:border-primary-neon/30 transition"
      >
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-amber-400" />
          <div>
            <p className="font-medium text-white">Planos e assinatura</p>
            <p className="text-sm text-slate-400">Altere faixa de pontos ou adicione nichos</p>
          </div>
        </div>
        <span className="text-primary-neon text-sm">Ver planos →</span>
      </Link>

      <div className="glass-card p-6">
        <ZerarDadosButton />
      </div>

      {nichosAtivos.includes("maquinas_cassino") && (
        <div className="glass-card p-6 space-y-2">
          <h2 className="font-semibold text-white">Cassino</h2>
          <p className="text-sm text-slate-400">
            Abatimento automático de débito e comissão por ponto são configurados em cada ponto em{" "}
            <Link href="/pontos" className="text-primary-neon hover:underline">
              Pontos → detalhe do ponto
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
